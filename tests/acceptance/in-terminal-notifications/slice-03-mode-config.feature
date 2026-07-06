# Slice 03: One setting, four modes (config enum + legacy mapping)
#
# Feature ID : in-terminal-notifications
# Wave       : DISTILL | Date: 2026-07-04
# Traceability: US-03 (AC-03.1..AC-03.6), [D6], [D10], OQ-D, DDD-1/DDD-2, kpi-3
#
# Driving port: hand-edited ~/.config/chromato/config.json + `chromato start`
# (spawned CLI, XDG-isolated config, compressed timing — skeleton pattern).
# Banner presence/absence per mode IS observable in CI-captured TUI frames
# (E9); the bell half of each mode is TTY-gated and proven by the slice-02
# @tty-sim vitest twins — these scenarios pin the visual half plus the
# piped-byte complements.
#
# Legacy-mapping scenarios are tagged @kpi: they ARE the kpi-3 guardrail
# ("100% of legacy boolean configs behave per [D6]") enforced on every CI run
# (docs/product/kpi-contracts.yaml).

@in-terminal-notifications @slice-03 @US-03
Feature: One setting chooses how loudly chromato speaks — and old configs keep working

  # AC-03.1: absent key -> default "banner+bell": the banner half must show.
  @real-io @env-E9
  Scenario: The default speaks with a banner
    Given a saved timer setup with no notifications setting
    When the user starts a session whose work phase lasts 2 seconds
    And the work timer completes
    Then the in-frame banner shows the warm copy "Pomodoro complete"

  # AC-03.3: "banner" -> banner yes; nothing rings (pipe complement of the
  # @tty-sim bell-absence twin).
  @real-io @env-E9
  Scenario: Banner-only keeps the office quiet
    Given a saved timer setup whose notifications setting is "banner"
    When the user starts a session whose work phase lasts 2 seconds
    And the work timer completes
    Then the in-frame banner shows the warm copy "Pomodoro complete"
    And the captured output contains no bell character

  # AC-03.3: "bell" -> nothing drawn.
  @real-io @error @env-E9
  Scenario: Bell-only draws nothing
    Given a saved timer setup whose notifications setting is "bell"
    When the user starts a session whose work phase lasts 2 seconds
    And the work block ends
    Then no notification banner appears
    And the timer frame still shows the "BREAK" phase label

  # AC-03.3 + OQ-D: "off" means everything off — banner, bell AND title.
  @real-io @error @env-E9
  Scenario: Off means silence
    Given a saved timer setup whose notifications setting is "off"
    When the user starts a session whose work phase lasts 2 seconds
    And the work block ends
    Then no notification banner appears
    And the captured output contains no bell character
    And no window-title escape sequences appear in the output

  # AC-03.2 / [D6] / kpi-3: legacy true behaves as "banner+bell", no rewrite.
  @real-io @kpi @env-E9
  Scenario: Yesterday's "true" keeps notifying
    Given a legacy saved setup with notifications turned on
    When the user starts a session whose work phase lasts 2 seconds
    And the work timer completes
    Then the in-frame banner shows the warm copy "Pomodoro complete"

  # AC-03.2 / [D6] / kpi-3: legacy false stays fully silent.
  @real-io @error @kpi @env-E9
  Scenario: Yesterday's "false" stays silent
    Given a legacy saved setup with notifications turned off
    When the user starts a session whose work phase lasts 2 seconds
    And the work block ends
    Then no notification banner appears
    And the captured output contains no bell character

  # AC-03.4 / [D10]: a hand-edit typo warns once and never kills the timer.
  # (Split per final-gate review: one action per scenario.)
  @real-io @error @env-E9
  Scenario: A typo warns once and the timer still starts
    Given a saved timer setup whose notifications setting is the unknown value "loud"
    When the user starts a session whose work phase lasts 2 seconds
    Then a single warning naming the valid notification modes appears on standard error
    And the session still starts into its timer frame

  # AC-03.4 / [D10] (recovery half): after the warning, the session behaves
  # exactly as the default "banner+bell".
  @real-io @error @env-E9
  Scenario: A typo falls back to the default notifications
    Given a saved timer setup whose notifications setting is the unknown value "loud"
    When the user starts a session whose work phase lasts 2 seconds
    And the work timer completes
    Then the in-frame banner shows the warm copy "Pomodoro complete"

  # AC-03.6 / SC-4: the status pull channel is untouched by the new setting.
  @real-io @env-E2
  Scenario: The status line stays untouched by the new setting
    Given a saved timer setup whose notifications setting is "bell"
    When the user asks for the tmux status line
    Then the status command answers cleanly with no warning
