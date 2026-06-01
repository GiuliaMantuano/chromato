# Config persistence & precedence (consume side)
#
# Feature ID : first-run-setup-wizard
# Wave       : DISTILL  | Date: 2026-05-31
# Traceability: US-03 (timing persists + honoured), US-05 (persist), DD-4/DD-6/DD-7
#
# Subprocess scenarios proving the persisted config drives the runtime and that
# the new read path (readConfigFile, DD-4) does not regress the existing
# flag>env>config>default precedence (D-OPEN-4 / AC-03.4). The wizard WRITE is
# simulated by the real ConfigFileWriterAdapter in the Given (real I/O).

Feature: Persisted setup choices drive the runtime

  Background:
    Given chromato is installed and available on the PATH
    And no chromato config file exists yet

  # -----------------------------------------------------------------------
  # CR-01: Saved timing is honoured by a flagless start (DD-4 read extension).
  # -----------------------------------------------------------------------
  @US-03 @real-io
  Scenario: A saved work duration is used when no flag is given
    Given the setup wizard has saved a 50-minute work duration to the config file
    When the developer runs "chromato start" with no duration flags
    Then the work timer counts down from "50:00"

  # -----------------------------------------------------------------------
  # CR-02: An explicit flag still overrides the saved value (precedence guard).
  # -----------------------------------------------------------------------
  @US-03 @real-io
  Scenario: An explicit duration flag overrides the saved value
    Given the setup wizard has saved a 50-minute work duration to the config file
    When the developer runs setup-wizard "chromato start" with a 10-minute work duration
    Then the work timer counts down from "10:00"

  # -----------------------------------------------------------------------
  # CR-03: Saved palette resolves when no --palette flag is given (regression —
  # palette read already exists today; guards DD-4 consolidation didn't break it).
  # -----------------------------------------------------------------------
  @US-02 @real-io @skip
  Scenario: A saved palette is used when no palette flag is given
    Given the setup wizard has saved the theme "forest" to the config file
    When the developer runs "chromato start" with a 1-minute work duration
    Then the rendered output uses the forest work colour

  # -----------------------------------------------------------------------
  # CR-04: Atomic write leaves config.json valid (K5 / AC-05.2).
  # -----------------------------------------------------------------------
  @US-05 @real-io @skip
  Scenario: The saved config file is always valid JSON
    Given the setup wizard has saved a full configuration to the config file
    Then the config file contains valid JSON with the keys palette, work, break, longBreak, cycles, notifications

  # -----------------------------------------------------------------------
  # CR-05 (error): a hand-corrupted config must not crash the runtime.
  # Regression guard — the new readConfigFile() (DD-4) must preserve the
  # existing "invalid JSON → clear error, exit 1" behaviour.
  # -----------------------------------------------------------------------
  @US-05 @real-io @error @skip
  Scenario: A corrupted config file produces a clear error, not a crash
    Given a corrupted config file exists
    When the developer runs "chromato start" with a 1-minute work duration
    Then chromato reports an error mentioning the config file
    And the process exits with a non-zero code

  # -----------------------------------------------------------------------
  # CR-06 (error): an unknown saved theme is reported with the valid choices.
  # Regression guard — preserves UnknownPaletteError behaviour through the
  # consolidated read path.
  # -----------------------------------------------------------------------
  @US-02 @real-io @error @skip
  Scenario: An unknown saved theme is reported with the valid choices
    Given the config file names an unknown theme "neon"
    When the developer runs "chromato start" with a 1-minute work duration
    Then chromato reports an error listing the valid palette names
    And the process exits with a non-zero code
