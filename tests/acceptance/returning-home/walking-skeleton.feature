# Walking Skeleton: returning-home
#
# Feature ID : returning-home
# Wave       : DISTILL  | Date: 2026-06-02
# Traceability: US-RH-01 (recap), US-RH-02 (start), Slice 01 (R1)
#
# The thinnest end-to-end slice that delivers observable user value: a returning
# user with a saved config, in an interactive colour terminal, types `chromato`
# (bare) and is greeted by the branded home screen, then starts a focus session.
# A non-technical stakeholder confirms: "yes — I open chromato and it welcomes me
# back with my settings, and one keypress starts my timer."
#
# TESTABILITY NOTE (mirrors the wizard's walking-skeleton split):
# The home screen's INTERACTIVE input surface (arrow-key nav, Enter/R/Q) needs
# raw-mode stdin = a real TTY, which a plain spawned process does not provide.
# Ink renders OUTPUT to a non-TTY stdout fine; only raw-mode INPUT needs a TTY.
# So the walking skeleton proves the RENDER + ROUTE wiring end-to-end through the
# real CLI with a forced-interactive stdout; the keypress-driven Start/Reconfigure
# /Quit transitions are proven at the adapter layer with ink-testing-library
# (DELIVER, see home-screen-render.feature for the documented intent). The seam
# joining the halves is the real config.json on disk (real I/O).

Feature: Walking skeleton -- a returning user is welcomed home and can start a session

  Background:
    Given chromato is installed for the home screen

  # -----------------------------------------------------------------------
  # WS-01: The branded home screen renders for a returning user (real I/O).
  # The Given writes a real config.json (the saved setup); the When runs the
  # real CLI bare, in a forced-interactive colour terminal; the Then observes
  # the welcome-back recap rendered with the saved theme. ENABLED -- first to
  # implement; RED until DELIVER (new feature, no impl yet).
  # -----------------------------------------------------------------------
  @walking_skeleton @driving_adapter @real-io @US-RH-01
  Scenario: A returning user sees the branded home screen with their saved setup
    Given a saved setup with theme "ocean", work 25, break 5, cycles 4, long break 15, notifications on
    And the terminal is interactive with colour support
    When the returning user runs "chromato" with no subcommand
    Then the welcome-back recap is shown
    And the recap shows the theme name "Ocean"
    And the recap shows the timing "25 · 5 × 4"
    And the recap shows notifications "On"
    And the home process exits with code 0
