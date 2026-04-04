# Milestone 6: Infrastructure Smoke Tests
#
# Feature ID  : pomodoro-timer-cli
# Milestone   : M6 -- CI pipeline gates and benchmark thresholds
# Traceability: US-05 -- AC-NF1, AC-NF2, AC-NF3, AC-NF5, AC-05.9
# Wave        : DISTILL
# Date        : 2026-03-28
#
# Context: These scenarios validate the CI pipeline quality gates defined in
# DEVOPS ci-cd-pipeline.md. They exercise chromato as an installed artifact
# (not from source), mirroring what end users receive from npm install -g.
#
# Environments validated:
#   - ci (GitHub Actions ubuntu-22.04, macos-12) -- acceptance stage
#   - local (developer workstation pre-push gate)
#
# Driving port: chromato CLI (the installed binary / dist/index.js)
# All measurements are observable: process exit code, stdout content,
# elapsed wall-clock time, RSS memory, CPU percentage.
#
# Error/edge ratio: 4/9 = 44% -- target met

Feature: Infrastructure smoke tests validate CI pipeline gates and performance thresholds

  Background:
    Given the chromato package has been built and is available as "node dist/index.js"
    And the state data directory exists at the XDG data home path

  # -----------------------------------------------------------------------
  # STARTUP AND VERSION CHECKS
  # -----------------------------------------------------------------------

  # AC-NF1 / CI startup benchmark
  @US-05 @AC-NF1 @infrastructure @skip
  Scenario: First TUI frame appears within 100 milliseconds on the CI runner
    Given a clean CI environment with Node.js 20 installed
    When the CI runner executes "chromato start" and measures time to first stdout byte
    Then the first output byte arrives within 100 milliseconds of process start

  # CI cold start benchmark: --version
  @US-05 @infrastructure
  Scenario: Version command cold start completes within 200 milliseconds
    Given a clean CI environment with no warm Node.js caches
    When "chromato --version" is executed 5 times and the median is taken
    Then the median cold start time is under 200 milliseconds
    And each run exits with code 0

  # -----------------------------------------------------------------------
  # PERFORMANCE BENCHMARKS
  # -----------------------------------------------------------------------

  # AC-NF2: CPU below 1% during steady state
  @US-05 @AC-NF2 @infrastructure @skip
  Scenario: chromato uses less than 1 percent CPU during a 30-second steady-state idle tick
    Given a chromato session is running with a 25-minute work duration
    And 30 seconds have elapsed for the process to reach steady state
    When CPU usage is sampled continuously for 30 seconds
    Then the average CPU percentage over the 30-second window is below 1 percent

  # AC-NF3: RSS memory below 35MB steady state
  @US-05 @AC-NF3 @infrastructure @skip
  Scenario: chromato RSS memory stays below 35 megabytes during steady-state operation
    Given a chromato session is running with a 25-minute work duration
    And 30 seconds have elapsed for the process to reach steady state
    When the RSS memory of the chromato process is measured
    Then the RSS memory is less than 35 megabytes

  # AC-NF5: Status command latency below 50ms
  @US-03 @US-04 @AC-NF5 @infrastructure @skip
  Scenario: Status command median latency is under 50 milliseconds in CI environment
    Given a work session state file exists with valid content
    When "chromato status --format tmux" is executed 10 times and the median is taken
    Then the median latency is under 50 milliseconds
    And every individual run completes in under 100 milliseconds

  # -----------------------------------------------------------------------
  # DEPENDENCY AND BINARY VALIDATION
  # -----------------------------------------------------------------------

  # AC-05.9: Binary has zero undeclared runtime dependencies
  @US-05 @AC-05.9 @infrastructure @skip
  Scenario: chromato runs on a clean Node.js 20 environment with only declared dependencies installed
    Given a clean environment with Node.js 20 and only "pnpm install --production" packages
    When the developer runs "chromato --version"
    Then the command succeeds with exit code 0
    And no "Cannot find module" or missing dependency errors appear

  # Architecture boundary: status path does not import Ink
  @US-03 @infrastructure
  Scenario: The status command cold start budget is not violated by heavy library imports
    Given a fresh Node.js process with no module cache
    When "chromato status --format tmux" is executed with an active state file
    Then the command completes in under 50 milliseconds
    And the dependency-cruiser architecture check reports zero violations for the status import path

  # -----------------------------------------------------------------------
  # ERROR / EDGE CASES
  # -----------------------------------------------------------------------

  # CI: architecture check passes (check:arch gate)
  @infrastructure
  Scenario: dependency-cruiser reports zero architecture rule violations in the built source
    Given the source code has been compiled to dist/
    When the architecture check "depcruise --validate .dependency-cruiser.cjs src" is executed
    Then the exit code is 0
    And the output reports zero rule violations

  # CI: tmux version matrix -- status output valid on tmux 2.6
  @US-03 @AC-03.6 @infrastructure @skip
  Scenario: Status command output is compatible with tmux 2.6 color format strings
    Given tmux 2.6 is installed in the CI environment
    And a work session state file exists with valid content
    When "chromato status --format tmux" output is passed to tmux 2.6
    Then tmux 2.6 renders the color-formatted string without error
    And the rendered output shows the correct phase and remaining time

  # CI: tmux version matrix -- status output valid on tmux 2.9
  # tmux 2.9 changed color specifier syntax from 2.8; highest-risk version to validate
  @US-03 @AC-03.6 @infrastructure @skip
  Scenario: Status command output is compatible with tmux 2.9 color format strings
    Given tmux 2.9 is installed in the CI environment
    And a work session state file exists with valid content
    When "chromato status --format tmux" output is passed to tmux 2.9
    Then tmux 2.9 renders the color-formatted string without error
    And the rendered output shows the correct phase and remaining time

  # CI: tmux version matrix -- status output valid on tmux 3.2
  @US-03 @AC-03.6 @infrastructure @skip
  Scenario: Status command output is compatible with tmux 3.2 color format strings
    Given tmux 3.2 is installed in the CI environment
    And a work session state file exists with valid content
    When "chromato status --format tmux" output is passed to tmux 3.2
    Then tmux 3.2 renders the color-formatted string without error
    And the rendered output shows the correct phase and remaining time

  # CI: SIGTERM triggers clean exit (used by benchmark script)
  @US-05 @AC-P6 @infrastructure @skip
  Scenario: SIGTERM causes chromato to exit cleanly with code 0 and write idle state
    Given a work session is active in CI
    When the CI measurement script sends SIGTERM to the chromato process
    Then the process exits with code 0
    And the state file shows phase "IDLE" after exit
    And no child processes remain
