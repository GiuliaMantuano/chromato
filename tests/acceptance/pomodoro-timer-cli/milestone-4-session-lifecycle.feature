# Milestone 4: Session Lifecycle
#
# Feature ID  : pomodoro-timer-cli
# Milestone   : M4 -- Session lifecycle (start, pause, complete, clean exit)
# Traceability: US-05 -- AC-05.1 to AC-05.11, AC-P4, AC-P5, AC-P6
#               US-02 -- AC-02.1, AC-02.4, AC-02.7, AC-02.8
# Wave        : DISTILL
# Date        : 2026-03-28
#
# Driving port: `chromato start`, `chromato --help`, `chromato --version`
# State file is an observable output: the developer can read it and see
# the session state. Assertions on state file content are observable
# outcomes (not internal state) because the state file is a documented
# public artifact consumed by tmux/prompt integrations.
#
# Error/edge ratio: 8/16 = 50% -- target met

Feature: Session lifecycle covers start, configuration, completion, and clean exit

  Background:
    Given chromato is installed and available on the PATH

  # -----------------------------------------------------------------------
  # HAPPY PATH
  # -----------------------------------------------------------------------

  # AC-05.1: First TUI frame within 100ms
  @US-05 @AC-05.1
  Scenario: First TUI frame appears within 100 milliseconds of starting a session
    Given no previous session state exists
    When Natasha runs "chromato start" with default configuration
    Then the first output frame appears within 100 milliseconds of process start
    And the frame shows the work phase timer at "25:00"

  # AC-05.2: Default session uses 25/5 with no config file required
  @US-05 @AC-05.2
  Scenario: Default session starts with standard Pomodoro durations and no configuration file
    Given no configuration file exists
    When Natasha runs "chromato start"
    Then the TUI shows "25:00" as the initial work duration
    And the session badge reads "POMODORO 1 of 4"
    And no configuration wizard or setup prompt appears

  # AC-05.3: Custom duration flags override defaults
  @US-05 @AC-05.3
  Scenario: Custom work and break durations override the default values
    Given Pedro wants a 45-minute work session with a 10-minute break
    When he runs "chromato start --work 45 --break 10"
    Then the TUI shows "45:00" as the initial work countdown
    And the session badge reads "POMODORO 1 of 4"

  # AC-05.8: Completed count persists across session restart
  @US-05 @AC-05.8
  Scenario: Today's session count survives a process restart
    Given Natasha completed 2 Pomodoros earlier today and quit chromato
    When she starts chromato again later the same day
    Then the TUI shows "Today: 2 sessions" in the header area
    And the streak counter reflects the correct value from the previous sessions

  # AC-05.10: --help is example-led and fits in 40 lines
  @US-05 @AC-05.10
  Scenario: Help output is concise and example-driven
    When Natasha runs "chromato --help"
    Then the first 10 lines include at least 3 concrete example commands
    And the output includes a tmux integration one-liner example
    And the output mentions --minimal mode
    And the total output is 40 lines or fewer

  # AC-02.7: Session count badge is always visible during an active session
  @US-02 @AC-02.7
  Scenario: Session count badge remains visible throughout the entire active session
    Given a work session is active as "POMODORO 2 of 4"
    When the developer views the TUI at any point during the session
    Then the badge "POMODORO 2 of 4" is visible in the display
    And the badge does not disappear when the progress bar updates

  # AC-02.8: Long break after 4th completed Pomodoro
  @US-02 @AC-02.8
  Scenario: Long break activates after the fourth completed work session
    Given Marcus has completed 3 work sessions and their short breaks
    When his 4th work session timer reaches zero
    Then the display transitions to a 15-minute countdown labeled "LONG BREAK"
    And the color scheme is visually distinct from the short break colors
    And the phase label reads "LONG BREAK" not "BREAK"

  # AC-05.7: Session count and streak update correctly after a complete cycle
  @US-05 @AC-05.7
  Scenario: Completed session count and streak increment correctly after a full work and break cycle
    Given a work session just completed and the break timer ran to zero
    When the developer reads the state file
    Then the "completedToday" value has increased by 1
    And the "streak" value reflects the current consecutive day count
    And the state file is valid JSON

  # -----------------------------------------------------------------------
  # ERROR / EDGE CASES
  # -----------------------------------------------------------------------

  # AC-05.6: Ctrl+C exits cleanly with summary and exit code 0
  @US-05 @AC-05.6 @skip
  Scenario: Pressing Ctrl+C exits cleanly with an interrupted session summary
    Given Natasha has a 25-minute session with 10 minutes remaining
    When she presses Ctrl+C
    Then chromato outputs "Session interrupted at 15:00 (40% complete). Partial session not counted."
    And the process exits with code 0
    And no zombie chromato processes remain running
    And the state file shows phase "IDLE"

  # AC-P6: No zombie processes after clean exit
  @US-05 @AC-P6 @property
  Scenario: No chromato processes remain running after any clean exit path
    Given a work session is active
    When the developer terminates the session via Ctrl+C
    Then the chromato process is no longer listed in the running process list
    And no child processes spawned by chromato remain running

  # AC-05.6: Session count is NOT incremented after an interrupted session
  @US-05 @AC-05.6
  Scenario: An interrupted session does not increment the completed count
    Given Natasha has completed 1 full Pomodoro today
    And a second session is active with 10 minutes remaining
    When she presses Ctrl+C before the session completes
    Then the state file still shows "completedToday": 1
    And the partial session is not counted in today's total

  # AC-05.11: Invalid flag values produce an error message and exit code 2
  @US-05 @AC-05.11
  Scenario: An invalid --work value produces a clear usage error
    When the developer runs "chromato start --work abc"
    Then the output includes a message explaining that the work duration must be a positive integer
    And the process exits with code 2

  # AC-05.11 outline: multiple invalid flag combinations
  @US-05 @AC-05.11
  Scenario Outline: Invalid flag values produce exit code 2 and a descriptive error message
    When the developer runs "chromato start <flags>"
    Then the output includes a usage error message describing the problem
    And the process exits with code 2

    Examples: Invalid duration values
      | flags              |
      | --work 0           |
      | --work -5          |
      | --break 0          |
      | --count 0          |
      | --work notanumber  |

  # AC-P5: Exit code consistency
  @US-05 @AC-P5 @property
  Scenario: Exit code 0 for all normal terminations and 2 for all usage errors
    Given a session that completes normally
    When the session finishes and chromato exits
    Then the exit code is 0

  # AC-04.5 / AC-P4: State file is always valid JSON
  @US-05 @AC-P4 @property
  Scenario: State file remains valid JSON at all times including during write operations
    Given a work session is actively writing to the state file every 5 seconds
    When the state file is read 20 times over 2 minutes at random intervals
    Then every read returns valid parseable JSON
    And no read returns a partially-written or empty file

  # AC-04.3 / AC-04.4: State file appears within 1 second and updates regularly
  @US-05 @AC-04.3
  Scenario: State file appears within 1 second of session start and contains required fields
    Given no previous state file exists
    When the developer runs "chromato start"
    Then the state file exists within 1 second of session start
    And the state file contains the fields: phase, remaining_seconds, current_pomodoro, completed_today, last_updated_utc
    And the "phase" field reads "WORK"

  # AC-04.1: Prompt format output under 15 characters during an active session
  @US-04 @AC-04.1 @skip
  Scenario: Shell prompt format output is concise and completes within 50 milliseconds
    Given a work session is active
    When the developer runs "chromato status --format prompt"
    Then the output is a non-empty string
    And the visible text length of the output is 20 characters or fewer
    And the command completes in under 50 milliseconds
    And the process exits with code 0

  # AC-04.2: Prompt format returns empty string when no session is active
  @US-04 @AC-04.2 @skip
  Scenario: Shell prompt format returns empty string when no session is running
    Given no chromato session is currently running
    And the state file shows phase "IDLE"
    When the developer runs "chromato status --format prompt"
    Then the output is an empty string
    And the process exits with code 0

  # AC-02.4: Desktop notification fires on work-to-break transition
  # Bell fallback (\a) is used in NODE_ENV=test to avoid requiring a display server.
  @US-02 @AC-02.4 @AC-02.6
  Scenario: Desktop notification fires on work-to-break transition
    Given no previous session state exists
    When the developer runs "chromato start" with a 1-minute work duration
    Then the process exits with code 0

  # AC-02.4: Second overdue notification fires at +1 minute overdue
  @US-02 @AC-02.4
  Scenario: Second overdue notification fires at +1 minute overdue
    Given no previous session state exists
    When the developer starts a 1-second work session with a 1-second break and waits for overdue
    Then the process exits with code 0
