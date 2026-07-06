# Slice 01 (supplement): Banner lifecycle in the timer frame
#
# Feature ID : in-terminal-notifications
# Wave       : DISTILL | Date: 2026-07-04
# Traceability: US-01 (AC-01.2, AC-01.3, AC-01.6-via-pin), spike/upstream-issues.md #1
#
# Builds ON TOP of the inherited walking skeleton (walking-skeleton.feature,
# commit 2b8800d — do NOT duplicate its happy path). These scenarios cover the
# banner lifecycle the skeleton left implicit: auto-clear, supersession,
# overdue announcement, the long-break celebration, and the DISTILL-pinned
# moment-priority policy.
#
# MOMENT-PRIORITY PIN (DISTILL decision, from spike/upstream-issues.md #1):
# the domain emits SESSION_COMPLETED together with WORK->BREAK PHASE_CHANGED
# in the same event drain. On the TUI banner path PHASE_CHANGE WINS and
# SESSION_COMPLETED is a no-op (the single-slot banner keeps the
# owner-validated "Pomodoro complete" copy). In --minimal BOTH lines print
# (see slice-05-minimal-nocolor.feature). This file locks the TUI half.
#
# HARNESS NOTE: scenarios tagged @real-io spawn the built CLI (non-TTY stdout,
# NODE_ENV=acceptance, CHROMATO_*_SECONDS compressed timing — skeleton pattern).
# The "Break's over" and long-break copy require the S keypress (break expiry
# goes to OVERDUE, never auto-starts WORK), so those were @ink-testing
# SPEC_ONLY placeholders — ported by DELIVER step 02-02 to vitest +
# ink-testing-library twins at the TuiAdapter seam (repo precedent:
# returning-home/home-interaction). See the pointer comments below; twins live
# in tests/unit/adapters/tuiAdapter.banner.test.ts.

@in-terminal-notifications @slice-01 @US-01
Feature: The in-frame banner lives and dies with the notification moments

  # AC-01.3: auto-clear after the 10s tunable constant.
  # Expected ALREADY_GREEN at red-check (shipped by the skeleton) — DELIVER
  # unskips it first as a free regression lock.
  @real-io @env-E9
  Scenario: The banner clears on its own
    Given chromato is installed for in-terminal notifications
    When the user starts a session whose work phase lasts 2 seconds
    And the work timer completes
    Then the banner clears on its own within 12 seconds
    And the timer frame still shows the "BREAK" phase label

  # AC-01.3: at most one banner — a newer moment replaces an older one.
  @real-io @error @env-E9
  Scenario: A newer moment replaces an older banner
    Given chromato is installed for in-terminal notifications
    When the user starts a session whose work and break phases last 2 seconds each
    And the break runs over
    Then the in-frame banner shows the warm copy "Break ran over"
    And the pomodoro-complete banner is no longer shown

  # US-01 scenario 4: a break running over is announced (NFR-05.1: label stays text).
  @real-io @error @env-E9
  Scenario: A break running over is announced
    Given chromato is installed for in-terminal notifications
    When the user starts a session whose work and break phases last 2 seconds each
    And the break runs over
    Then the banner body reads "Ready to focus again?"
    And the timer frame still shows the "OVERDUE" phase label

  # AC-01.7 — owner-locked SPIKE decision: the banner renders BELOW the timer
  # frame content. Fragile placement (a refactor could silently move it), so it
  # is regression-locked here: within the captured frames, the banner copy must
  # appear after the frame's footer hints. Expected ALREADY_GREEN at red-check.
  @real-io @env-E9
  Scenario: The banner renders below the timer frame
    Given chromato is installed for in-terminal notifications
    When the user starts a session whose work phase lasts 2 seconds
    And the work timer completes
    Then the banner renders below the timer frame content

  # AC-01.2 — "The banner pulses at the shipped overdue cadence": ported to a
  # vitest twin per [D-DISTILL-4] (pulse styling is dim/colour ANSI, invisible
  # in the piped CI capture). TWIN: tests/unit/adapters/tuiAdapter.banner.test.ts
  # > "banner alternates normal/dim over four seconds of ticks at the shipped 2s rhythm"

  # DISTILL PIN — moment priority on the TUI banner path: the phase-change
  # copy wins; the co-fired session summary never steals the banner slot.
  # Expected ALREADY_GREEN (skeleton ships the no-op); this scenario makes the
  # policy a locked contract instead of an accident.
  @real-io @distill-pin @env-E9
  Scenario: Work completion keeps the pomodoro copy, not the session summary
    Given chromato is installed for in-terminal notifications
    When the user starts a session whose work phase lasts 2 seconds
    And the work timer completes
    Then the in-frame banner shows the warm copy "Pomodoro complete"
    And no session summary copy appears inside the timer frame

  # US-01 scenario 3 (second half) + M8-07 retirement target — "Completing the
  # final pomodoro celebrates the cycle": ported to a vitest twin per
  # [D-DISTILL-4] (reaching LONG_BREAK needs raw-mode keypresses, impossible
  # over a piped subprocess). TWIN: tests/unit/adapters/tuiAdapter.banner.test.ts
  # > "final work block of a 2-pomodoro cycle shows \"2 pomodoros done\" naming the long break length"

  # US-01 scenario 2 — "Skipping the break replaces the break banner
  # immediately": ported to a vitest twin per [D-DISTILL-4] (the S keypress is
  # raw-mode stdin, impossible over a piped subprocess).
  # TWIN: tests/unit/adapters/tuiAdapter.banner.test.ts
  # > "pressing S during a break supersedes the break-start banner with \"Break's over\" (at most one banner)"
