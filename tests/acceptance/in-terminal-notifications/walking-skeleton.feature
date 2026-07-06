# Walking Skeleton: in-terminal-notifications
#
# Feature ID : in-terminal-notifications
# Wave       : SPIKE promotion (slice-01 "banner-in-frame") | Date: 2026-07-04
# Traceability: spike/wave-decisions.md (PROMOTE, owner 2026-07-04), slice-01
#
# The thinnest end-to-end slice that delivers observable user value: during a
# live `chromato start` TUI session, when the work timer completes, the warm
# phase-change copy ("Pomodoro complete") appears INSIDE the timer frame as an
# in-terminal banner — driven by the real path:
#   chromato start -> SessionService PHASE_CHANGED -> NotificationPort
#   (implemented by TuiAdapter) -> banner below the frame -> 10s auto-clear.
#
# TESTABILITY NOTE (mirrors pomodoro-timer-cli phase-transition scenarios):
# The spawned CLI has a non-TTY stdout, so Ink writes plain frames that a pipe
# captures. CHROMATO_WORK_SECONDS compresses the work phase so the WORK->BREAK
# transition happens within the test timeout. NODE_ENV=acceptance keeps the
# TUI alive past the first frame (test-mode early exit disabled). The 10s
# auto-clear and pulse cadence are visual concerns validated in the spike and
# refined in DELIVER; the skeleton proves the WIRING through the real CLI.

Feature: Walking skeleton -- warm notification copy appears inside the live timer frame

  @walking_skeleton @driving_port @real-io @in-terminal-notifications
  Scenario: The phase-change banner shows the warm copy when the work timer completes
    Given chromato is installed for in-terminal notifications
    When the user starts a session whose work phase lasts 2 seconds
    And the work timer completes
    Then the in-frame banner shows the warm copy "Pomodoro complete"
    And the banner body reads "Time for a 5-minute break."
    And the timer frame still shows the "BREAK" phase label
