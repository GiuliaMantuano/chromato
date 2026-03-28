# Milestone 5: VS Code Terminal Compatibility
#
# Feature ID  : pomodoro-timer-cli
# Milestone   : M5 -- VS Code terminal compatibility (xterm.js, 256-color, Unicode blocks)
# Traceability: US-01, US-05 -- AC-NF6, AC-01.4
# Wave        : DISTILL
# Date        : 2026-03-28
#
# Context (from DESIGN): VS Code's integrated terminal uses xterm.js.
# It auto-detects as 256-color (chalk.level = 2) and renders Unicode
# block characters correctly. No special handling is required -- the
# existing chalk and Unicode detection paths cover it.
#
# Driving port: `chromato start`, `chromato status --format tmux`
#
# VS Code terminal coverage note: The CI OS matrix (ubuntu-22.04, ubuntu-24.04,
# macos-12, macos-14) validates 256-color and Unicode block rendering --
# the defining capabilities of VS Code terminal support. xterm.js behaves
# identically to any xterm-256color terminal on the same OS.
#
# Error/edge ratio: 4/7 = 57% -- target met

Feature: chromato renders correctly in VS Code integrated terminal and 256-color environments

  Background:
    Given chromato is installed and available on the PATH
    And no previous session state exists

  # -----------------------------------------------------------------------
  # HAPPY PATH
  # -----------------------------------------------------------------------

  # AC-NF6: VS Code integrated terminal visual mode
  @US-01 @AC-NF6 @skip
  Scenario: chromato renders the full TUI in a VS Code integrated terminal session
    Given the terminal environment reports COLORTERM="truecolor" and TERM="xterm-256color"
    When the developer runs "chromato start" with a 5-minute work session
    Then the TUI renders with Unicode block characters in the progress bar
    And the phase color uses the 256-color work phase scheme (cyan or green)
    And no fallback to ASCII characters occurs

  # AC-NF6: 256-color terminal renders correct phase colors
  @US-01 @US-02 @AC-NF6 @skip
  Scenario: Phase colors render correctly on a 256-color terminal
    Given the terminal supports 256 colors (TERM=xterm-256color)
    And a work session is active
    When the developer views the TUI output
    Then the progress bar and phase label use work-phase colors (green or cyan range)
    And when the break phase begins the colors switch to break-phase colors (blue or indigo range)
    And when overdue activates the colors switch to the overdue scheme (red or amber range)

  # AC-NF6: Unicode block characters render in VS Code terminal
  @US-01 @AC-NF6 @skip
  Scenario: Progress bar uses Unicode block characters in a Unicode-capable terminal
    Given the terminal supports Unicode block characters (LANG includes UTF-8)
    When the developer runs "chromato start"
    Then the progress bar fill consists of Unicode block characters (full block or partial blocks)
    And no ASCII fallback characters appear in the filled portion of the bar

  # -----------------------------------------------------------------------
  # ERROR / EDGE CASES
  # -----------------------------------------------------------------------

  # AC-01.4: ASCII fallback when terminal lacks Unicode support
  @US-01 @AC-01.4 @skip
  Scenario: ASCII fallback activates gracefully when the terminal reports no Unicode support
    Given the terminal environment reports TERM=dumb and LC_ALL=C
    When the developer runs "chromato start"
    Then chromato outputs an informational message about ASCII fallback mode
    And the progress bar renders with ASCII characters ("=", "-", ">")
    And all session information (phase, time, count) remains available

  # AC-NF6: Non-supported terminal environments (dumb terminal fallback)
  @US-01 @AC-NF6 @skip
  Scenario: chromato degrades to ASCII mode on a dumb terminal without crashing
    Given the TERM environment variable is set to "dumb"
    When the developer runs "chromato start"
    Then chromato starts successfully with ASCII fallback
    And the process exits with code 0 when Ctrl+C is pressed
    And no unhandled exception or error trace appears in the output

  # AC-NF6: chromato --minimal works in any terminal environment
  @US-05 @AC-NF6 @skip
  Scenario: Minimal mode works in any terminal regardless of color or Unicode support
    Given the terminal environment reports TERM=dumb with no color support
    When the developer runs "chromato start --minimal"
    Then the session starts and outputs plain text
    And the output contains zero ANSI escape sequences
    And the process exits with code 0 when Ctrl+C is pressed

  # Status command works in VS Code integrated terminal context
  @US-03 @AC-NF6 @skip
  Scenario: Status command produces correct output when invoked from a VS Code terminal session
    Given a work session is active
    And the terminal reports TERM=xterm-256color
    When the developer runs "chromato status --format tmux" from the VS Code integrated terminal
    Then the output contains the Pomodoro phase and remaining time
    And the command completes in under 50 milliseconds
    And the process exits with code 0
