# Walking Skeleton: chromato core Pomodoro loop
#
# Feature ID : pomodoro-timer-cli
# Milestone  : Walking Skeleton (all milestones)
# Traceability: US-01, US-02, US-03, US-04, US-05
# Wave       : DISTILL
# Date       : 2026-03-28
#
# Each scenario here covers the thinnest end-to-end slice that delivers
# observable user value. A non-technical stakeholder can confirm
# "yes, that is what users need" for every scenario.
#
# Hexagonal boundary: all When steps invoke through the chromato CLI
# (driving port: src/index.ts via commander.js). Internal components
# (Session, PhaseStateMachine, PersistenceAdapter) are exercised
# indirectly as a consequence of the CLI invocation.
#
# ONE scenario is enabled; the rest are @skip.
# Enable one, implement, commit, repeat (Outside-In TDD outer loop).

Feature: Walking skeleton -- chromato delivers a complete Pomodoro loop

  Background:
    Given chromato is installed and available on the PATH
    And no previous session state exists

  # -----------------------------------------------------------------------
  # WS-01: Installation verification
  # Validates: US-05 (zero-friction install and first contact)
  # ENABLED -- first to implement
  # -----------------------------------------------------------------------
  @walking_skeleton @US-05
  Scenario: Developer verifies chromato is installed and ready to use
    When the developer runs "chromato --version"
    Then the output shows a semantic version number (e.g. "1.0.0")
    And the process exits with code 0

  # -----------------------------------------------------------------------
  # WS-02: First session launch and progress bar render
  # Validates: US-01 (animated progress bar), US-05 (session start)
  # -----------------------------------------------------------------------
  @walking_skeleton @US-01 @US-05
  Scenario: Developer starts a session and sees the progress bar fill
    When the developer runs "chromato start" with a 1-minute work duration
    Then the first TUI frame appears within 700 milliseconds
    And the progress bar shows 0% fill at session start
    And the timer countdown reads "01:00"
    And the phase label reads "WORK"
    And the session badge reads "POMODORO 1 of 4"

  # -----------------------------------------------------------------------
  # WS-03: Status command produces tmux-compatible output
  # Validates: US-03 (tmux integration)
  # -----------------------------------------------------------------------
  @walking_skeleton @US-03
  Scenario: Developer checks session status and receives a tmux-ready string
    Given a work session has been running for 10 minutes of a 25-minute session
    When the developer runs "chromato status --format tmux"
    Then the output is a non-empty string
    And the output is 20 characters or fewer
    And the output completes in under 200 milliseconds
    And the process exits with code 0

  # -----------------------------------------------------------------------
  # WS-04: Phase color transition is unmissable
  # Validates: US-02 (color phase transitions)
  # Note: atomicity (single render frame) is an integration-test concern
  # (ink-testing-library). This acceptance test verifies the observable outcome:
  # the break phase is shown after the work timer completes.
  # -----------------------------------------------------------------------
  @walking_skeleton @US-02 @skip
  Scenario: Work timer completes and the display switches to break phase
    Given a work session with 2 seconds remaining
    When the work timer reaches zero
    Then the phase label reads "BREAK"
    And the phase color scheme changes from work colors to break colors
    And the break timer reads "05:00"

  # -----------------------------------------------------------------------
  # WS-05: Session count is confirmed after a complete cycle
  # Validates: US-01 + US-02 (session complete, Today count)
  # -----------------------------------------------------------------------
  @walking_skeleton @US-01 @US-02
  Scenario: Developer completes a Pomodoro cycle and sees the session count
    Given the developer completed 1 work session and its break
    When the completed session summary is displayed
    Then the display shows "Today: 1 session"
    And the state file records 1 completed session for today
    And the next session would start as "POMODORO 2 of 4"
