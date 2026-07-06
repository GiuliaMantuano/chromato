# Slice 02: The ding (bell + tmux flag)
#
# Feature ID : in-terminal-notifications
# Wave       : DISTILL | Date: 2026-07-04
# Traceability: US-02 (AC-02.1..AC-02.5), [D8], M8-08 invariant, DDD-3
#
# VERIFICATION TIERS (per environments.yaml / DEVOPS honest tiering):
# - @real-io       : CI-runnable now — the spawned CLI's stdout is a pipe (E2),
#                    so the [D8] byte-cleanliness contract is directly assertable.
# - @tty-sim       : TTY-POSITIVE bell emission cannot be observed through a
#                    piped subprocess ([D8] correctly suppresses it). These are
#                    the executable SPECIFICATION; DELIVER implements each as a
#                    vitest twin with a simulated TTY (isTTY stub) against the
#                    BellNotificationAdapter/composite seam, then either makes
#                    the cucumber scenario runnable or removes it in favour of
#                    the twin BEFORE merge (the suite must be @skip-free at
#                    merge — DEVOPS registration rule 3).
# The tmux window FLAG (E7) is tmux's behaviour, not chromato's; CI asserts BEL
# emission only. The flag check lives on the owner dogfood checklist
# (feature-delta "Wave: DISTILL / [REF] Owner Dogfood Checklist", DoD item 9) —
# NOT as a permanently-skipped scenario in this suite.

@in-terminal-notifications @slice-02 @US-02
Feature: The phase-end ding reaches ears and background panes

  # AC-02.4 / [D8]: piped output must stay byte-clean — a bell byte in a
  # logfile is corruption, not a notification. E2 is exactly what CI sees.
  @real-io @error @env-E2
  Scenario: Piped session output carries no bell
    Given chromato is installed for in-terminal notifications
    When the user runs a piped minimal session through its first transition
    Then the captured output contains no bell character

  # The five @tty-sim scenarios below were ported to vitest twins per
  # [D-DISTILL-4] (DELIVER step 02-03): TTY-positive bell bytes are
  # unobservable through a piped subprocess, so each is locked with an isTTY
  # stub + exact-byte capture at the BellNotificationAdapter seam.
  # All twins live in tests/unit/adapters/bellNotificationAdapter.test.ts.

  # AC-02.1 — "A phase end rings once" + US-02 scenario 4 — "Overdue reminders
  # ring too": TWIN > "$name emits exactly one BEL on an interactive terminal"
  # (parametrized over the FULL NotificationPort moment universe: phase change,
  # overdue, session complete — plus the [D8] non-TTY zero-byte half).

  # AC-02.5 / M8-08 — "Never more than one bell for one moment":
  # TWIN > "a whole session of moments never doubles a bell — N moments, exactly N BELs"

  # AC-02.3 / SC-3 — "The ding survives colour suppression":
  # TWIN > "the bell is emitted exactly as in a colour session (byte-identical)"

  # AC-02.2 / SC-1 — "The ding never disturbs the timer frame":
  # TWIN > "the bell arrives as a single bare control character — no cursor movement attached"
