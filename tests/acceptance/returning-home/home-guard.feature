# Home screen guard truth-table (observed at the CLI port)
#
# Feature ID : returning-home
# Wave       : DISTILL  | Date: 2026-06-02
# Traceability: US-RH-05, AC-RH-01.*, AC-RH-07.*, AC-RH-08.3, K4 (0 false positives)
#
# The guard `shouldShowHome()` is a pure internal function; we do NOT call it
# directly (Mandate 1 — test through the driving port). We observe its decision
# at the only place a user can: the bare `chromato` invocation either shows the
# branded welcome-back recap (guard true) or falls through to the plain Commander
# help (guard false). The FALSE branches are the bulk of error/edge coverage and
# are the K4 false-positive guard: the home must NEVER ambush a pipe, NO_COLOR,
# --no-color, or CI context.
#
# The home's interactive input needs a TTY, but its OUTPUT (the recap text) renders
# to a forced-interactive stdout in a spawned process — enough to observe whether
# the guard let the recap render or not.

Feature: Bare chromato shows the home screen only for an interactive returning user

  Background:
    Given chromato is installed for the home screen

  # -----------------------------------------------------------------------
  # GUARD-01 (happy): config present + interactive colour TTY -> home renders.
  # This is the one TRUE branch of the truth-table.
  # -----------------------------------------------------------------------
  @US-RH-01 @real-io
  Scenario: The home screen renders when a config exists in an interactive colour terminal
    Given a saved setup with theme "ocean", work 25, break 5, cycles 4, long break 15, notifications on
    And the terminal is interactive with colour support
    When the returning user runs "chromato" with no subcommand
    Then the welcome-back recap is shown
    And the home process exits with code 0

  # -----------------------------------------------------------------------
  # GUARD-02 (error/edge): the FALSE branches all fall through to plain help.
  # Each row is a K4 false-positive guard. "no config" routes to the wizard
  # path instead (existing behaviour) — covered separately in GUARD-03.
  # -----------------------------------------------------------------------
  @US-RH-05 @real-io @error
  Scenario Outline: A non-interactive or colour-suppressed context never shows the home screen
    Given a saved setup with theme "ocean", work 25, break 5, cycles 4, long break 15, notifications on
    When the returning user runs "chromato" with "<context>"
    Then the welcome-back recap is not shown
    And the plain command listing is shown instead
    And the home process exits with code 0

    Examples:
      | context              |
      | piped standard input |
      | NO_COLOR set         |
      | the --no-color flag  |
      | CI set               |

  # -----------------------------------------------------------------------
  # GUARD-03 (edge): no config + interactive TTY -> first-run wizard path,
  # NOT the home screen (AC-RH-01.5 / AC-RH-08.3). The home is for returning
  # users only; a brand-new user still meets the wizard.
  # -----------------------------------------------------------------------
  @US-RH-05 @real-io @error
  Scenario: A brand-new user with no saved setup does not see the home screen
    Given no saved setup exists
    And the terminal is interactive with colour support
    When the returning user runs "chromato" with no subcommand
    Then the welcome-back recap is not shown
