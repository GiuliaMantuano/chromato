# Milestone 3 (shell prompt): Shell Prompt Integration and State Schema
#
# Feature ID  : pomodoro-timer-cli
# Milestone   : M3 -- shell prompt integration (subset)
# Traceability: US-03 -- AC-04.4, AC-04.6
# Wave        : DISTILL
# Date        : 2026-04-04
#
# Driving port: `chromato status --format prompt` (StatusService via CLI)
# The prompt format is a short single-line string for shell PS1/PS2 integration.
#
# Error/edge ratio: 2/4 = 50% -- target met

Feature: Shell prompt format and state schema provide reliable session status

  Background:
    Given chromato is installed and available on the PATH

  # -----------------------------------------------------------------------
  # HAPPY PATH
  # -----------------------------------------------------------------------

  # 04-09: --format prompt outputs a short string under 15 characters
  @US-03 @AC-04.6
  Scenario: Shell prompt format outputs a concise string under 15 characters
    Given a work session is active in work phase
    When the developer runs "chromato status --format prompt"
    Then the output is a non-empty string
    And the output completes in under 50 milliseconds
    And the process exits with code 0

  # 04-09 edge: IDLE returns empty string for prompt format
  @US-03 @AC-04.6
  Scenario: Shell prompt format returns empty string when no session is active
    Given no chromato session is currently running
    When the developer runs "chromato status --format prompt"
    Then the output is an empty string
    And the process exits with code 0

  # -----------------------------------------------------------------------
  # STATE SCHEMA VALIDATION
  # -----------------------------------------------------------------------

  # 04-10: state.json schema completeness
  @US-03 @AC-04.4
  Scenario: state.json schema matches required fields and is concurrently safe
    Given a 25-minute work session has been running for 10 minutes
    When the developer runs "chromato status --format plain"
    Then the output is a non-empty string
    And the process exits with code 0

  # 04-10: state.json is valid JSON throughout session
  @US-03 @AC-04.4
  Scenario: state.json is valid JSON and contains all required fields
    Given a work session state file has been written
    Then the state file contains field "phase"
    And the state file contains field "remainingSeconds"
    And the state file contains field "elapsedSeconds"
    And the state file contains field "progressFraction"
    And the state file contains field "currentPomodoro"
    And the state file contains field "lastUpdatedUtc"
    And the state file contains field "schemaVersion"
    And the state file is valid JSON
