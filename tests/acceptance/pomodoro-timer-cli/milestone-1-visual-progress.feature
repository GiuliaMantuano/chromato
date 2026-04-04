# Milestone 1: Visual Progress Bar
#
# Feature ID  : pomodoro-timer-cli
# Milestone   : M1 -- Visual progress bar (O1)
# Traceability: US-01 -- AC-01.1 to AC-01.8, AC-P1, AC-P3
# Wave        : DISTILL
# Date        : 2026-03-28
#
# Driving port: chromato CLI (`chromato start`, `chromato start --minimal`)
# All Then steps assert observable output through the CLI driving port.
# Internal components (TimerSnapshot, TuiAdapter) are never called directly.
#
# Error/edge ratio target: >= 40%
# Happy path scenarios: 4 (AC-01.1, AC-01.2, AC-01.3, AC-01.5)
# Error/edge scenarios: 5 (AC-01.4, AC-01.6, AC-01.7, AC-01.8, AC-P1)
# Ratio: 5/9 = 56% -- target met

Feature: Visual progress bar fills and adapts to terminal conditions

  Background:
    Given chromato is installed and available on the PATH
    And no previous session state exists

  # -----------------------------------------------------------------------
  # HAPPY PATH
  # -----------------------------------------------------------------------

  # AC-01.1: Progress bar fill percentage accuracy
  @US-01 @AC-01.1
  Scenario: Progress bar fill matches elapsed time within two percent accuracy
    Given Kai started a 60-second work session 30 seconds ago
    When he views the chromato TUI output
    Then the progress bar fill covers approximately 50 percent of the bar width
    And the timer displays "00:30" remaining
    And the fill percentage is within 2 percent of the actual elapsed fraction

  # AC-01.2: Progress bar updates at least once per second
  @US-01 @AC-01.2
  Scenario: Progress bar updates every second during an active session
    Given a 60-second work session has just started
    When 3 seconds elapse
    Then the TUI has rendered at least 3 distinct frames
    And each frame shows a higher fill percentage than the previous frame

  # AC-01.3: Progress bar adapts to narrow terminal width
  @US-01 @AC-01.3
  Scenario: Progress bar renders correctly in a narrow 30-column terminal
    Given Aiko has a terminal window set to 30 columns
    When she runs "chromato start" with a 5-minute work session
    Then the display renders on a single line
    And the phase label and remaining time are both visible
    And no display element is truncated or overflows the 30-column boundary

  # AC-01.5: Work phase uses work color, break phase uses break color
  @US-01 @AC-01.5
  Scenario: Progress bar fill color matches the current phase
    Given a work session is active
    When the developer views the TUI output
    Then the progress bar fill uses the work phase color (green or cyan)
    And when the break phase begins the bar fill switches to the break phase color (blue or indigo)

  # -----------------------------------------------------------------------
  # ERROR / EDGE CASES
  # -----------------------------------------------------------------------

  # AC-01.4: ASCII fallback on non-Unicode terminal
  @US-01 @AC-01.4
  Scenario: ASCII fallback activates on a terminal that does not support Unicode block characters
    Given Priya's terminal is set to TERM=xterm without Unicode support
    When she runs "chromato start"
    Then chromato outputs an informational message about ASCII fallback mode
    And the progress bar uses ASCII characters ("=" for filled, "-" for empty)
    And the session starts and counts down identically to Unicode mode
    And the process exit code is 0 (not an error condition)

  # AC-01.4 complement: informational message is suppressible
  @US-01 @AC-01.4
  Scenario: ASCII fallback message is suppressed when the developer passes the --ascii flag
    Given Priya's terminal is set to TERM=xterm without Unicode support
    When she runs "chromato start --ascii"
    Then the informational ASCII fallback message does not appear
    And the session runs normally with ASCII progress bar characters

  # AC-01.6: Overdue state pulses red every 2 seconds
  @US-01 @AC-01.6
  Scenario: Overdue progress bar pulses between solid red and dim red
    Given a work session timer has reached zero
    And 30 seconds have elapsed in overdue state with no user action
    When the developer views the TUI output
    Then the progress bar shows 100 percent fill
    And the fill alternates between solid red and dim red on a 2-second interval
    And the timer shows the overdue elapsed time formatted as "+00:30"

  # AC-01.7: CPU usage below 1% during steady-state session
  @US-01 @AC-01.7 @skip
  Scenario: chromato process uses less than 1 percent CPU during a steady-state session
    Given a 5-minute work session has been running for 2 minutes
    And the developer is not interacting with the chromato TUI
    When CPU usage is sampled over a 30-second window
    Then the average CPU usage of the chromato process is below 1 percent

  # AC-01.8 / AC-P3: NO_COLOR suppresses all ANSI escapes
  @US-01 @AC-01.8 @AC-P3 @property @skip
  Scenario: NO_COLOR environment variable removes all color from every output mode
    Given the NO_COLOR environment variable is set to "1"
    When the developer runs "chromato start --minimal"
    Then the output contains zero ANSI escape sequences
    And the session phase, remaining time, and session number are still present as plain text
    And the process exits with code 0

  # AC-P1: Progress bar smoothness invariant
  @US-01 @AC-P1 @property @skip
  Scenario: Progress bar advances exactly one character width per render tick without flicker
    Given a work session is active on a 80-column terminal
    When 10 consecutive render frames are captured
    Then each frame differs from the previous by at most one progress bar character
    And no frame shows a lower fill than the immediately preceding frame
    And no full-screen flicker (clear-screen sequence) occurs between frames
