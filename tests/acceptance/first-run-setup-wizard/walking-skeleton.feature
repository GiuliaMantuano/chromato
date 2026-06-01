# Walking Skeleton: first-run setup wizard
#
# Feature ID : first-run-setup-wizard
# Wave       : DISTILL  | Date: 2026-05-31
# Traceability: US-02 (theme), US-05 (persist + start), Slice 01
#
# The thinnest end-to-end slice that delivers observable user value:
# the theme chosen in setup is persisted and the next `chromato start`
# renders in that theme. A non-technical stakeholder confirms:
# "yes — I pick a colour in setup and my timer uses it."
#
# TESTABILITY NOTE (DISTILL finding — see distill/upstream-issues.md):
# The wizard's INTERACTIVE surface (arrow-key nav, live preview) requires
# raw-mode stdin = a real TTY, which a plain spawned process does not provide
# (without a TTY the guard correctly SKIPS the wizard — that is US-07). So the
# walking skeleton is split:
#   - PRODUCE half (wizard emits a result → config written): proven at the
#     adapter layer with ink-testing-library (tests/unit/adapters/setupWizardAdapter.test.ts),
#     exactly as the SPIKE proved it.
#   - CONSUME half (persisted config drives the real session via the real CLI):
#     proven here via subprocess. Ink renders OUTPUT to a non-TTY stdout fine;
#     only raw-mode INPUT needs a TTY.
# The seam joining the halves is the real config.json on disk (real I/O both sides).

Feature: Walking skeleton -- the chosen theme persists and drives the next session

  Background:
    Given chromato is installed for the setup wizard
    And no chromato config file exists yet

  # -----------------------------------------------------------------------
  # WS-01: Persisted theme drives the real session (CONSUME half, real I/O)
  # The Given writes config.json through the REAL ConfigFileWriterAdapter
  # (Mandate 6 @real-io for the write port); the When runs the real CLI which
  # reads it back through configLoader (@real-io read).
  # ENABLED -- first to implement.
  # -----------------------------------------------------------------------
  @walking_skeleton @driving_adapter @real-io @US-02 @US-05
  Scenario: A theme saved by setup is used by the next session
    Given the setup wizard has saved the theme "berry" to the config file
    When the developer runs setup-wizard "chromato start" with a 1-minute work duration
    Then the rendered output uses the berry work colour
    And the process starts the session without error
