# Slice 06: The window title carries the phase
#
# Feature ID : in-terminal-notifications
# Wave       : DISTILL | Date: 2026-07-04
# Traceability: US-06 (AC-06.1..AC-06.7 + recommended AC-06.8), [D8], [D11],
#               [D14]/OQ-D, DDD-4, DDD-11, DDD-12, design-review medium finding
#
# BYTE-LEVEL CONTRACTS (spike-verified sequences):
#   set title      OSC 0   = ESC ] 0 ; {title} BEL
#   save title     XTWINOPS = ESC [ 22 ; 0 t
#   restore title  XTWINOPS = ESC [ 23 ; 0 t
#   exit ordering  = neutral "chromato" OSC 0 FIRST, then XTWINOPS 23 restore
#                    (a restore-less terminal is left neutral, never stale)
#
# VERIFICATION TIERS: title escapes are TTY-gated inside WindowTitleAdapter
# ([D8]), so TTY-POSITIVE byte assertions are @tty-sim — executable
# SPECIFICATION with DELIVER vitest twins (isTTY stub, byte-stream capture of
# start()/notify*/stop()); the piped complements (@real-io, E2) run in CI now
# and pin "output byte-identical to pre-feature" (AC-06.4). Visual contracts
# in real window chrome (Terminal.app / iTerm2 restore) are owner-dogfood
# tier (DoD item 9) and live on the owner dogfood checklist (feature-delta
# "Wave: DISTILL / [REF] Owner Dogfood Checklist") — not as skipped scenarios.
# Every exit path is enumerated per the design reviewer's medium finding
# (AC-06.8): start, each transition, Q, Ctrl+C, SIGTERM, natural completion.
#
# SIZING (@sizing-review-needed): 12 scenarios exceed the 8-scenario feature
# threshold; the exit-path enumeration is deliberate (AC-06.8). DELIVER may
# sub-group US-06 into start / follow / exit-paths files if the slice feels
# heavy — pure file reorganization, no scenario changes.

@in-terminal-notifications @slice-06 @US-06 @sizing-review-needed
Feature: The window title carries the phase

  # AC-06.4 / [D8]: piped TUI output is byte-identical to pre-feature — zero
  # OSC title bytes, zero XTWINOPS bytes. Runs in CI now; ALREADY_GREEN today
  # and stays green forever as the [D8] regression lock.
  @real-io @error @env-E2
  Scenario: Piped session output stays byte-clean of title changes
    Given chromato is installed for in-terminal notifications
    When the user starts a session whose work phase lasts 2 seconds
    And the work timer completes
    Then no window-title escape sequences appear in the output

  # AC-06.4: the minimal path obeys the same rule.
  @real-io @error @env-E2
  Scenario: Piped minimal output stays byte-clean of title changes
    Given chromato is installed for in-terminal notifications
    When the user runs a piped minimal session through its first transition
    Then no window-title escape sequences appear in the output

  # AC-06.1 + AC-06.8 (start half) — "The window announces the session from
  # the start": ported to a vitest twin per [D-DISTILL-4] (DELIVER step 03-01;
  # TTY-positive title bytes unobservable through a piped subprocess).
  # TWIN: tests/unit/adapters/windowTitleAdapter.test.ts
  # > "start() saves the user title first, then sets \"🍅 WORK — chromato\" (exact bytes, exact order)"

  # AC-06.1 — "The title follows the break" / "The title follows the overdue
  # moment" (split per final-gate review: one action per scenario): ported to
  # vitest twins per [D-DISTILL-4] (DELIVER step 03-02).
  # TWINS: tests/unit/adapters/windowTitleAdapter.test.ts
  # > "notifyPhaseChange($from -> $to) retitles the window to \"$emoji\" (ASCII: \"$ascii\")"
  #   (parametrized over the destination-phase universe, ASCII variant honoured per moment)
  # > "notifyOverdue() sets \"⏰ OVERDUE — chromato\" (ASCII: \"OVERDUE - chromato\")"

  # DDD-11 pin — "Finishing the session sets the neutral title" (session
  # complete has no phase): ported to a vitest twin per [D-DISTILL-4]
  # (DELIVER step 03-02). TWIN: tests/unit/adapters/windowTitleAdapter.test.ts
  # > "notifySessionComplete() sets the neutral \"chromato\" title"

  # DDD-13 fix (corrected) — "The title survives a same-drain session-complete
  # collision": WORK→rest transitionPhase() pushes BOTH PHASE_CHANGED and
  # SESSION_COMPLETED into the SAME event batch on EVERY work block, not just
  # the final one (session.ts; "session complete" here means "one pomodoro
  # finished," not "the whole run is over" — see feature-delta.md Upstream
  # Issue 1). PHASE_CHANGE wins the collision ([D-DISTILL-1]), mirroring the
  # banner's existing arbitration in src/adapters/tuiAdapter.tsx: ported to a
  # vitest twin per [D-DISTILL-4] (DELIVER step 03-05; TTY-positive title
  # bytes unobservable through a piped subprocess, same rationale as the
  # other twins above).
  # TWIN: tests/unit/adapters/windowTitleAdapter.test.ts
  # > "notifyPhaseChange(WORK -> $to) then a same-drain notifySessionComplete() leaves the title on \"$phaseEmoji\", not neutral"
  #   (parametrized over BREAK and LONG_BREAK destinations)

  # AC-06.2 + AC-06.8 (start half): restore on the Q exit path (keypress ->
  # SessionControlPort.quit()): ported to a vitest twin per [D-DISTILL-4]
  # (DELIVER step 03-03; TTY-positive title bytes unobservable through a piped
  # subprocess, same rationale as the start/notify twins above).
  # TWIN: tests/unit/adapters/windowTitleAdapter.test.ts
  # > "$scenario exit: a neutral "chromato" title is emitted and then the saved title is restored"
  #   (parametrized over the Q / Ctrl+C / SIGTERM exit-path universe — DDD-4:
  #   the SINGLE post-await stop() in launchSession is exit-mechanism-agnostic)

  # AC-06.2 + AC-06.8: restore on the Ctrl+C exit path — twinned alongside Q
  # and SIGTERM in the same parametrized twin (DELIVER step 03-03).
  # TWIN: tests/unit/adapters/windowTitleAdapter.test.ts (see pointer above)

  # AC-06.2 + AC-06.8: restore on the SIGTERM exit path — twinned alongside Q
  # and Ctrl+C in the same parametrized twin (DELIVER step 03-03).
  # TWIN: tests/unit/adapters/windowTitleAdapter.test.ts (see pointer above)

  # AC-06.3: the neutral-then-restore ORDERING is what protects restore-less
  # terminals — the neutral title must be emitted BEFORE the restore sequence,
  # and no phase title may be the last title ever set, no matter which
  # notification moment was active when the session exited: ported to a
  # vitest twin per [D-DISTILL-4] (DELIVER step 03-03).
  # TWIN: tests/unit/adapters/windowTitleAdapter.test.ts
  # > "the session exits by any path: neutral precedes restore, and no phase title is the last title ever set ($name)"
  #   (full-surface enumeration over every notify moment that could be last
  #   before exit — fast-check absent from this project's stack, zero new deps)

  # AC-06.6 / OQ-D: "off" means everything off — zero title/XTWINOPS bytes
  # even on an interactive terminal; output byte-identical to pre-feature:
  # ported to a vitest twin per [D-DISTILL-4] (DELIVER step 03-03).
  # TWIN: tests/unit/adapters/windowTitleAdapter.test.ts
  # > "createWindowTitleAdapter($notifications) returns an adapter only when notifications are on"
  #   (mirrors src/index.ts launchSession's off-mode wiring gate)

  # AC-06.5 / [D11] — "ASCII sessions title without emoji": ported to a vitest
  # twin per [D-DISTILL-4] (DELIVER step 03-01).
  # TWIN: tests/unit/adapters/windowTitleAdapter.test.ts
  # > "with useAscii the start title is \"WORK - chromato\" and every emitted title is ASCII-only"
  # (the per-phase ASCII property is locked in tests/unit/domain/windowTitle.test.ts
  # > "$phase ASCII variant contains only ASCII characters")
