# Help Splash Screen
#
# Feature ID  : help-splash-screen
# Traceability: US-HSS-01 -- AC-HSS-01 to AC-HSS-08
# Wave        : DISTILL
# Date        : 2026-04-05
#
# Driving port: chromato CLI (`chromato` no-args, `chromato --help`)
# All Then steps assert observable output through the CLI driving port.
# Internal components (bannerAdapter, helpAdapter) are never called directly.
#
# Error/edge ratio target: >= 40%
# Happy path scenarios: 4 (walking skeleton, --help parity, tagline, performance)
# Error/edge scenarios: 3 (NO_COLOR, piped output, unicode fallback)
# Ratio: 3/7 = 43% -- target met

Feature: Help splash screen shows banner and help on bare invocation

  Background:
    Given chromato is built and available

  # -----------------------------------------------------------------------
  # WALKING SKELETON
  # -----------------------------------------------------------------------

  # AC-HSS-01.1, AC-HSS-02.1, AC-HSS-02.2, AC-HSS-02.3, AC-HSS-07.1, AC-HSS-08.1, AC-HSS-08.2
  @walking_skeleton @US-HSS-01 @AC-HSS-01.1
  Scenario: Kai sees the banner and help text on first invocation
    Given Kai's terminal has color support enabled
    And the NO_COLOR environment variable is not set
    When Kai runs chromato with no subcommand
    Then the ASCII art logo appears at the top of the output
    And the output contains ANSI color sequences on the logo lines
    And the tagline "The Pomodoro timer your terminal deserves" appears in the output
    And the Commander help text appears below the banner
    And the process exits with code 0
    And the first output byte arrives within 100 milliseconds

  # -----------------------------------------------------------------------
  # HAPPY PATH
  # -----------------------------------------------------------------------

  # AC-HSS-01.2
  @US-HSS-01 @AC-HSS-01.2
  Scenario: --help flag produces the same output as no-args invocation
    Given Kai's terminal has color support enabled
    When Kai runs chromato with the --help flag
    And Kai runs chromato with no subcommand
    Then both outputs are identical

  # AC-HSS-05.1
  @US-HSS-01 @AC-HSS-05.1
  Scenario: Tagline appears exactly once in the output
    Given Kai's terminal has color support enabled
    When Kai runs chromato with no subcommand
    Then the tagline "The Pomodoro timer your terminal deserves" appears exactly once in the output

  # AC-HSS-07.1, AC-HSS-07.2
  @US-HSS-01 @AC-HSS-07.1
  Scenario: Help path completes within cold-start budget
    When Kai runs chromato with no subcommand
    Then the first output byte arrives within 100 milliseconds

  # -----------------------------------------------------------------------
  # ERROR / EDGE PATH  (3 of 7 = 43%)
  # -----------------------------------------------------------------------

  # AC-HSS-03.1, AC-HSS-03.3
  @US-HSS-01 @AC-HSS-03.1
  Scenario: NO_COLOR suppresses all ANSI sequences in banner and help
    Given the NO_COLOR environment variable is set to "1"
    When Kai runs chromato with no subcommand
    Then no ANSI escape sequences appear in the output
    And the ASCII art logo is present as plain text
    And the tagline "The Pomodoro timer your terminal deserves" is present as plain text
    And the Commander help text is present as plain text
    And the process exits with code 0

  # AC-HSS-04.1, AC-HSS-04.2
  @US-HSS-01 @AC-HSS-04.1
  Scenario: Piped stdout produces plain text without ANSI
    Given chromato output is captured through a pipe
    When Kai runs chromato with no subcommand
    Then no ANSI escape sequences appear in the output
    And the ASCII art logo is present as plain text
    And the tagline "The Pomodoro timer your terminal deserves" is present as plain text

  # AC-HSS-06.1, AC-HSS-06.2
  @US-HSS-01 @AC-HSS-06.1
  Scenario: Unicode fallback replaces box-drawing divider on unsupported terminals
    Given the terminal is set to dumb mode with an ASCII-only locale
    When Kai runs chromato with no subcommand
    Then the output does not contain the Unicode divider character "─"
    And the tagline "The Pomodoro timer your terminal deserves" is still present
    And the ASCII art logo is still present
