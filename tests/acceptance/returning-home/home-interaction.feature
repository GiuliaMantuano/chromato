# Home screen interaction: navigation, start, reconfigure, quit
#
# Feature ID : returning-home
# Wave       : DISTILL  | Date: 2026-06-02
# Traceability: US-RH-02/03/04, AC-RH-03.*, AC-RH-04.*, AC-RH-05.*, AC-RH-06.*,
#               K8 (single loadConfig), OQ-3 (700ms boundary)
#
# HARNESS NOTE — these scenarios drive RAW-MODE keypresses (↑ ↓ Enter R Q Ctrl+C),
# which need a real TTY stdin that a spawned subprocess does NOT provide. They are
# therefore implemented in DELIVER via ink-testing-library (stdin.write at the
# HomeAdapter boundary), NOT via the cucumber subprocess harness. They are authored
# here as the executable SPECIFICATION (living documentation) and tagged @ink-testing
# @skip so they are NOT picked up by the cucumber runner; DELIVER ports each into a
# vitest + ink-testing-library spec asserting on the HomeChoice union resolved by
# HomeAdapter.run() (the testable seam, D-RH-5) and the delegation the composition
# root performs. We assert observable outcomes at the HomeChoice seam — we never
# reference a `renderHome` export (it does not exist; D5 was illustrative).
#
# DEFERRED VERIFICATION (RECONF-03, R2 / OQ-1): the requirement that Reconfigure
# reopens the setup wizard PRE-SEEDED with the current settings (e.g. Ocean
# pre-selected) is NOT asserted at the HomeChoice seam — that seam only proves the
# choice routes to 'reconfigure'. Pre-seed fidelity is verified by a composition-root
# integration test in DELIVER: a real `chromato setup` subprocess run against a
# pre-existing config.json, observing that the wizard shows the saved values pre-filled.
#
# OQ-3 RESOLUTION: the AC-RH-04.1 "within 700ms" budget is measured FROM the Enter
# keypress on the home screen, INCLUDING home teardown, to the first session frame
# (Enter-keypress-including-home-teardown). It is the same budget as AC-NF1 (start
# first frame). This interactive render-timing target is dogfood-only per D-RH-2
# (NFR-03) and is NOT a CI-gated assertion; the only hard CI latency gate is K3
# (--help < 100ms). DELIVER measures the 700ms boundary as a dogfood quality bar.

@ink-testing
Feature: A returning user navigates the home screen and chooses an action

  Background:
    Given the home screen is rendered for a returning user with an Ocean setup

  # -----------------------------------------------------------------------
  # AC-RH-02.4: the initial render shows the three menu items, the default
  # highlight, and the footer key-hint (verbatim from the prototype).
  # -----------------------------------------------------------------------
  @US-RH-01 @in-memory @skip
  Scenario: The home screen opens with its menu, default highlight, and footer hint
    Then the menu shows "Start a focus session", "Reconfigure…", and "Quit"
    And "Start a focus session" is highlighted by default
    And the footer shows "↑↓ move  Enter choose  R reconfigure  Q quit"

  # -----------------------------------------------------------------------
  # NAV-01a (AC-RH-03.1): down from Start moves the highlight to Reconfigure.
  # -----------------------------------------------------------------------
  @US-RH-01 @in-memory @skip
  Scenario: Pressing down from the first item highlights Reconfigure
    Given "Start a focus session" is highlighted by default
    When the user presses the down-arrow key
    Then "Reconfigure…" is highlighted

  # -----------------------------------------------------------------------
  # NAV-01b (AC-RH-03.1): down from Reconfigure moves the highlight to Quit.
  # -----------------------------------------------------------------------
  @US-RH-01 @in-memory @skip
  Scenario: Pressing down from Reconfigure highlights Quit
    Given "Reconfigure…" is highlighted
    When the user presses the down-arrow key
    Then "Quit" is highlighted

  # -----------------------------------------------------------------------
  # NAV-01c (AC-RH-03.1): down from the last item wraps back to the top.
  # -----------------------------------------------------------------------
  @US-RH-01 @in-memory @skip
  Scenario: Pressing down from the last item wraps to the top
    Given "Quit" is highlighted
    When the user presses the down-arrow key
    Then "Start a focus session" is highlighted

  # -----------------------------------------------------------------------
  # NAV-02 (AC-RH-03.2): up-arrow wraps to the last item.
  # -----------------------------------------------------------------------
  @US-RH-02 @in-memory @skip
  Scenario: Pressing up from the first item wraps to the last
    Given "Start a focus session" is highlighted by default
    When the user presses the up-arrow key
    Then "Quit" is highlighted

  # -----------------------------------------------------------------------
  # START-01 (AC-RH-04.1, US-RH-02): Enter on Start resolves to the start choice.
  # -----------------------------------------------------------------------
  @US-RH-02 @in-memory @skip
  Scenario: Pressing Enter on Start chooses to begin a focus session
    Given "Start a focus session" is highlighted by default
    When the user presses Enter
    Then the home screen resolves the choice to start a focus session
    And the home screen exits

  # -----------------------------------------------------------------------
  # START-02 (AC-RH-04.2, K8): Start uses the already-loaded config, no second read.
  # -----------------------------------------------------------------------
  @US-RH-02 @in-memory @skip
  Scenario: Starting a session reuses the configuration already read for the recap
    When the user presses Enter on "Start a focus session"
    Then the session uses the configuration already loaded
    And the session starts in the ocean theme shown in the recap

  # -----------------------------------------------------------------------
  # START-03 (AC-RH-04.1, US-RH-02): navigate away and back, then start.
  # -----------------------------------------------------------------------
  @US-RH-02 @in-memory @skip
  Scenario: Starting after navigating away and back still begins a session
    Given "Start a focus session" is highlighted by default
    When the user presses the down-arrow key
    And the user presses the up-arrow key
    And the user presses Enter
    Then the home screen resolves the choice to start a focus session

  # -----------------------------------------------------------------------
  # RECONF-01 (AC-RH-05.1, US-RH-03): R shortcut resolves to reconfigure.
  # -----------------------------------------------------------------------
  @US-RH-03 @in-memory @skip
  Scenario: Pressing R chooses to reconfigure
    When the user presses R
    Then the home screen resolves the choice to reconfigure
    And the home screen exits

  # -----------------------------------------------------------------------
  # RECONF-02 (AC-RH-05.2): Reconfigure via menu navigation.
  # -----------------------------------------------------------------------
  @US-RH-03 @in-memory @skip
  Scenario: Selecting Reconfigure and pressing Enter chooses to reconfigure
    Given "Start a focus session" is highlighted by default
    When the user presses the down-arrow key
    And the user presses Enter
    Then the home screen resolves the choice to reconfigure

  # -----------------------------------------------------------------------
  # RECONF-03 (AC-RH-05.3, SC-05): reconfigure resolves to the reconfigure
  # choice and exits the home screen (observable at the HomeChoice seam).
  # NOTE: pre-seed verification (R2 / OQ-1 — the setup wizard opens with the
  # current Ocean values pre-filled) is NOT asserted here at the HomeChoice
  # seam. It is deferred to a composition-root integration test in DELIVER:
  # a real `chromato setup` subprocess run against a pre-existing config.json
  # showing Ocean pre-selected. The HomeChoice seam only proves the routing.
  # -----------------------------------------------------------------------
  @US-RH-03 @in-memory @skip
  Scenario: Reconfigure resolves to the reconfigure choice and exits the home screen
    When the user chooses to reconfigure
    Then the home screen resolves the choice to reconfigure
    And the home screen exits

  # -----------------------------------------------------------------------
  # QUIT-01 (AC-RH-06.1, US-RH-04): Q resolves to quit, no writes.
  # -----------------------------------------------------------------------
  @US-RH-04 @in-memory @skip
  Scenario: Pressing Q chooses to quit cleanly
    When the user presses Q
    Then the home screen resolves the choice to quit
    And the home screen exits
    And no saved setting is written or modified

  # -----------------------------------------------------------------------
  # QUIT-02 (AC-RH-06.2): Quit via menu.
  # -----------------------------------------------------------------------
  @US-RH-04 @in-memory @skip
  Scenario: Selecting Quit and pressing Enter chooses to quit
    Given "Quit" is highlighted
    When the user presses Enter
    Then the home screen resolves the choice to quit

  # -----------------------------------------------------------------------
  # QUIT-03 (AC-RH-06.3, error): Ctrl+C during the home screen exits cleanly.
  # -----------------------------------------------------------------------
  @US-RH-04 @in-memory @error @skip
  Scenario: Sending Ctrl+C while the home screen is open exits cleanly
    When the user sends Ctrl+C
    Then the home screen resolves the choice to quit
    And no saved setting is written or modified
