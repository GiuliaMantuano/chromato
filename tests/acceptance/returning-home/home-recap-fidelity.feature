# Home screen recap fidelity (rendered output observed at the CLI port)
#
# Feature ID : returning-home
# Wave       : DISTILL  | Date: 2026-06-02
# Traceability: US-RH-01, AC-RH-02.1/02.2/02.3/02.5, K6 (recap fidelity), K7 (swatch fidelity)
#
# The home screen renders its recap to stdout, which a spawned process captures
# even without raw-mode INPUT. So recap fidelity (the displayed values match the
# saved config) and palette fidelity (the swatch colours match getPalette(theme)
# .gradient — F1) are observable here via real I/O. The keypress-driven menu
# transitions are NOT observable here (they need a TTY) and live in DELIVER's
# ink-testing-library suite (see home-interaction.feature for the documented intent).

Feature: The home recap faithfully reflects the saved configuration

  Background:
    Given chromato is installed for the home screen
    And the terminal is interactive with colour support

  # -----------------------------------------------------------------------
  # RF-01 (K6, AC-RH-02.2): every recap row matches the saved config values.
  # -----------------------------------------------------------------------
  @US-RH-01 @real-io
  Scenario: The recap rows match the saved theme, timing, and notifications
    Given a saved setup with theme "ocean", work 25, break 5, cycles 4, long break 15, notifications on
    When the returning user runs "chromato" with no subcommand
    Then the recap shows the theme name "Ocean"
    And the recap shows the timing "25 · 5 × 4"
    And the recap shows the long break "15m"
    And the recap shows notifications "On"
    And the footer note shows the resolved config file path

  # -----------------------------------------------------------------------
  # RF-02 (K7 + F1, AC-RH-02.1): the logo + swatch gradient match
  # getPalette(theme).gradient — sourced from src/domain/palette.ts (domain),
  # NOT from a meta map. Lavender exercises a different saved theme so a wrong
  # "same source" wiring would diverge.
  # -----------------------------------------------------------------------
  @US-RH-01 @real-io
  Scenario: The logo and swatch use the saved theme gradient
    Given a saved setup with theme "lavender", work 25, break 5, cycles 4, long break 15, notifications on
    When the returning user runs "chromato" with no subcommand
    Then the recap shows the theme name "Lavender"
    And the logo is rendered in the lavender gradient
    And the swatch colours match the lavender gradient

  # -----------------------------------------------------------------------
  # RF-03 (AC-RH-02.2): notifications Off is reflected accurately.
  # -----------------------------------------------------------------------
  @US-RH-01 @real-io
  Scenario: The recap reflects notifications turned off
    Given a saved setup with theme "forest", work 50, break 10, cycles 6, long break 20, notifications off
    When the returning user runs "chromato" with no subcommand
    Then the recap shows the timing "50 · 10 × 6"
    And the recap shows the long break "20m"
    And the recap shows notifications "Off"

  # -----------------------------------------------------------------------
  # RF-04 (AC-RH-02.3, edge): the tmux row appears only inside a tmux session.
  # -----------------------------------------------------------------------
  @US-RH-01 @real-io
  Scenario: The tmux row appears when running inside a tmux session
    Given a saved setup with theme "ocean", work 25, break 5, cycles 4, long break 15, notifications on
    And the terminal is running inside tmux
    When the returning user runs "chromato" with no subcommand
    Then a tmux row is shown in the recap

  @US-RH-01 @real-io @error
  Scenario: The tmux row is absent when not inside a tmux session
    Given a saved setup with theme "ocean", work 25, break 5, cycles 4, long break 15, notifications on
    And the terminal is not running inside tmux
    When the returning user runs "chromato" with no subcommand
    Then no tmux row is shown in the recap
