# Milestone 2: tmux Status Bar Integration
#
# Feature ID  : pomodoro-timer-cli
# Milestone   : M2 -- tmux integration (O3)
# Traceability: US-03 -- AC-03.1 to AC-03.8, AC-P2, AC-P3
# Wave        : DISTILL
# Date        : 2026-03-28
#
# Driving port: `chromato status --format tmux` (StatusService via CLI)
# The status subcommand reads state.json. It does NOT connect to the
# running chromato process via IPC. This is the correct architectural
# boundary (DESIGN DD-06: file-based integration).
#
# Error/edge ratio: 5/11 = 45% -- target met

Feature: tmux status bar integration outputs a compact, colored session string

  Background:
    Given chromato is installed and available on the PATH

  # -----------------------------------------------------------------------
  # HAPPY PATH
  # -----------------------------------------------------------------------

  # AC-03.1: Status command outputs valid tmux string in < 50ms
  @US-03 @AC-03.1
  Scenario: Status command produces a valid tmux color string in under 50 milliseconds
    Given a 25-minute work session has been running for 10 minutes
    When the developer runs "chromato status --format tmux"
    Then the output is a non-empty string containing Pomodoro phase and remaining time
    And the command completes in under 50 milliseconds
    And the process exits with code 0

  # AC-03.2: Output fits within 20 characters by default
  @US-03 @AC-03.2
  Scenario: tmux status output is 20 characters or fewer in the default configuration
    Given a work session is active in work phase
    When the developer runs "chromato status --format tmux"
    Then the visible text length of the output is 20 characters or fewer
    And when "--width 15" is passed the output fits within 15 characters

  # AC-03.3: tmux color matches Full TUI phase color
  @US-03 @AC-03.3
  Scenario: tmux widget color matches the Full TUI color for the same phase at the same moment
    Given a work session is active in work phase
    When the developer runs "chromato status --format tmux" and observes the Full TUI simultaneously
    Then both outputs use the same work phase color scheme (green or cyan)
    And when the break phase begins both outputs switch to the break phase color scheme simultaneously

  # AC-03.4: tmux remaining time differs from Full TUI by at most 1 second
  @US-03 @AC-03.4 @AC-P2 @property
  Scenario: tmux widget remaining time stays within 1 second of the Full TUI at any point
    Given a work session is active in work phase
    When the developer reads the remaining time from "chromato status --format tmux"
    And reads the remaining time from the Full TUI within 1 second of the status call
    Then both remaining time values differ by at most 1 second

  # AC-03.6: README one-liner works on tmux 2.6 and 3.x
  @US-03 @AC-03.6
  Scenario: README one-liner example works on tmux 3.x without modification
    Given Hiroshi has chromato installed and tmux 3.0 running
    And he copies the README tmux integration example verbatim into his tmux configuration
    When he reloads his tmux configuration
    Then the chromato widget appears in his status bar within 5 seconds
    And the widget shows session state if a session is active
    And the widget shows an idle indicator if no session is active

  # AC-03.6 variant: tmux 2.6 compatibility
  @US-03 @AC-03.6
  Scenario: README one-liner example works on tmux 2.6 without modification
    Given Carlos has chromato installed and tmux 2.6 running
    And he uses the same README tmux configuration example
    When he reloads his tmux configuration
    Then the chromato widget appears and functions identically to the tmux 3.x behavior

  # -----------------------------------------------------------------------
  # ERROR / EDGE CASES
  # -----------------------------------------------------------------------

  # AC-03.7: tmux integration works in non-interactive shell
  @US-03 @AC-03.7
  Scenario: Status command executes correctly from tmux non-interactive shell environment
    Given chromato is installed in the system PATH
    When tmux evaluates "chromato status --format tmux" from a non-interactive shell
    Then chromato is found and the status string is returned
    And no silent failure or empty output occurs due to PATH differences

  # AC-03.8: IDLE state returns empty string
  @US-03 @AC-03.8
  Scenario: Status command returns an empty string when no session is active
    Given no chromato session is currently running
    And the state file shows phase "IDLE"
    When the developer runs "chromato status --format tmux"
    Then the output is an empty string or a configured idle indicator
    And the process exits with code 0

  # AC-03.5: Phase transition reflected within 1 tmux refresh cycle
  @US-03 @AC-03.5
  Scenario: tmux widget reflects the phase transition within one status interval
    Given a work session with 2 seconds remaining is active
    When the work timer reaches zero
    Then the next call to "chromato status --format tmux" returns break phase color
    And the break timer shows "05:00" remaining

  # AC-P3 applied to status output
  @US-03 @AC-P3 @property
  Scenario: NO_COLOR suppresses all color from the tmux status output
    Given the NO_COLOR environment variable is set to "1"
    And a work session is active in work phase
    When the developer runs "chromato status --format tmux"
    Then the output contains zero ANSI escape sequences
    And the visible text still shows phase and remaining time information

  # AC-03.1 error path: status command must not import Ink (startup budget)
  @US-03 @AC-03.1
  Scenario: Status command cold start meets the 50-millisecond threshold even without a warm Node.js cache
    Given no prior chromato process has run in the current shell session
    When the developer runs "chromato status --format tmux" for the first time
    Then the command completes in under 50 milliseconds
    And the process exits with code 0
