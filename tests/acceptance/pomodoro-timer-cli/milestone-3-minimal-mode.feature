# Milestone 3: Minimal Mode and Accessibility
#
# Feature ID  : pomodoro-timer-cli
# Milestone   : M3 -- Minimal/accessibility mode
# Traceability: US-05 -- AC-05.4, AC-05.5, AC-01.4, AC-01.8, AC-P3
# Wave        : DISTILL
# Date        : 2026-03-28
#
# Driving port: `chromato start --minimal`, `chromato start --no-color`,
#               `chromato start` with NO_COLOR env var
# All assertions are observable CLI output characteristics.
#
# Persona context: Yuki Mori (P5 minimalist) -- "I'd set --minimal and forget it."
# These scenarios validate that P5 users receive a first-class experience.
#
# Error/edge ratio: 5/8 = 63% -- target exceeded

Feature: Minimal mode and accessibility options disable color and animation

  Background:
    Given chromato is installed and available on the PATH
    And no previous session state exists

  # -----------------------------------------------------------------------
  # HAPPY PATH
  # -----------------------------------------------------------------------

  # AC-05.4: --minimal mode produces plain text with all functional information
  @US-05 @AC-05.4 @skip
  Scenario: Minimal mode produces plain text output without ANSI color or full-screen TUI
    Given Yuki runs "chromato start --minimal" with a 5-minute work session
    When the output is captured for 3 seconds
    Then the output contains zero ANSI escape sequences
    And each output line includes the phase (WORK or BREAK), remaining time, and session number
    And the progress bar uses ASCII characters ("=" for filled, "-" for empty)
    And no full-screen TUI clearing sequences appear in the output

  # AC-05.5: --no-color flag disables all ANSI output
  @US-05 @AC-05.5 @skip
  Scenario: The --no-color flag disables all ANSI escape sequences while preserving functionality
    Given a 5-minute work session
    When the developer runs "chromato start --no-color"
    Then the output contains zero ANSI escape sequences
    And the phase, remaining time, and session number are visible as plain text

  # AC-05.5 / AC-P3: NO_COLOR environment variable
  @US-05 @AC-05.5 @AC-P3 @property @skip
  Scenario: NO_COLOR environment variable suppresses all ANSI output regardless of other flags
    Given the NO_COLOR environment variable is set to any non-empty value
    When the developer runs "chromato start" in any display mode
    Then the output contains zero ANSI escape sequences
    And the functional session information remains present in plain text

  # -----------------------------------------------------------------------
  # ERROR / EDGE CASES
  # -----------------------------------------------------------------------

  # AC-01.4: ASCII fallback activates automatically (not from --minimal)
  @US-01 @AC-01.4 @skip
  Scenario: ASCII fallback message does not appear when --minimal is explicitly passed
    Given Yuki runs "chromato start --minimal"
    When the TUI starts
    Then no ASCII fallback informational message appears
    And the session uses ASCII characters because --minimal implies ASCII mode

  # AC-05.4: --minimal mode still shows all required session data
  @US-05 @AC-05.4 @skip
  Scenario: Minimal mode omits no required session information
    Given Yuki runs "chromato start --minimal" with a 25-minute work session
    When the developer reads the second output line
    Then the output includes the current Pomodoro number (e.g. "1 of 4")
    And the remaining time is present (e.g. "24:59")
    And the phase label is present ("WORK")
    And the progress indicator is present (e.g. "[=====>     ]")

  # --minimal with --no-color: redundant flags do not conflict
  @US-05 @AC-05.4 @AC-05.5 @skip
  Scenario: Combining --minimal and --no-color does not produce an error or duplicate output
    When the developer runs "chromato start --minimal --no-color"
    Then the session starts successfully
    And the output contains zero ANSI escape sequences
    And the process exits with code 0 when Ctrl+C is pressed

  # AC-P3: NO_COLOR applies to help output as well
  @US-05 @AC-P3 @property @skip
  Scenario: NO_COLOR suppresses all color from the --help output
    Given the NO_COLOR environment variable is set to "1"
    When the developer runs "chromato --help"
    Then the output contains zero ANSI escape sequences
    And the help text remains fully readable as plain text

  # Minimal mode with custom durations
  @US-05 @AC-05.4 @skip
  Scenario: Minimal mode works correctly with custom work and break durations
    Given Pedro wants a 45-minute work session with a 10-minute break
    When he runs "chromato start --minimal --work 45 --break 10"
    Then the first output line shows "45:00" as the remaining work time
    And the output contains zero ANSI escape sequences
    And the session configuration is correctly reflected in the plain text output
