# Non-interactive safety guard
#
# Feature ID : first-run-setup-wizard
# Wave       : DISTILL  | Date: 2026-05-31
# Traceability: US-07 (JS-4 trust), US-01 (trigger), AC-HSS-07 (help perf)
#
# These are the PUREST subprocess scenarios: they need NO TTY by definition,
# so cucumber-js (spawned process, non-TTY stdin) is the perfect harness.
# This is the critical safety contract — the wizard must NEVER ambush a pipe,
# CI job, NO_COLOR, or TTY-less SSH session (Ink throws "Raw mode is not
# supported" without a TTY — SPIKE check 4).

Feature: Setup wizard never ambushes a non-interactive context

  Background:
    Given chromato is installed and available on the PATH
    And no chromato config file exists yet

  # -----------------------------------------------------------------------
  # NI-01: The four non-interactive contexts all skip the wizard safely.
  # -----------------------------------------------------------------------
  @US-07 @real-io @error
  Scenario Outline: A non-interactive invocation skips the wizard and exits cleanly
    When the developer runs "chromato" with "<context>"
    Then the setup wizard does not launch
    And no "Raw mode is not supported" error appears
    And the process exits with code 0

    Examples:
      | context              |
      | piped standard input |
      | NO_COLOR set         |
      | CI set               |

  # -----------------------------------------------------------------------
  # NI-02: An existing config means no auto-launch on bare invocation.
  # -----------------------------------------------------------------------
  @US-01 @real-io
  Scenario: Bare invocation does not launch the wizard when a config already exists
    Given a chromato config file already exists
    When the developer runs "chromato" with "piped standard input"
    Then the setup wizard does not launch
    And the process exits with code 0

  # -----------------------------------------------------------------------
  # NI-03: Help path stays fast and free of the wizard (AC-HSS-07).
  # -----------------------------------------------------------------------
  @US-01 @real-io
  Scenario: The help screen never loads the wizard and stays fast
    When the developer runs "chromato --help"
    Then the help text is shown
    And the help output completes in under 200 milliseconds
    And the process exits with code 0

  # -----------------------------------------------------------------------
  # NI-04: Explicit `chromato setup` in a non-TTY refuses gracefully (US-06 AC-06.4).
  # DEFERRED: this exercises the `chromato setup` SUBCOMMAND's non-TTY refusal
  # (US-06), not the bare-invocation root-action guard delivered in slice 02
  # (step 02-02). Re-enable when US-06 setup-command guidance lands.
  # -----------------------------------------------------------------------
  @US-06 @real-io @error
  Scenario: Running setup without a terminal refuses with guidance instead of crashing
    When the developer runs "chromato setup" with "piped standard input"
    Then a message explains that setup needs an interactive terminal
    And no "Raw mode is not supported" error appears
    And the process exits with a non-zero code
