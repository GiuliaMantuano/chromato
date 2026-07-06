# Slice 04: The wizard and home screen speak the new notification language
#
# Feature ID : in-terminal-notifications
# Wave       : DISTILL | Date: 2026-07-04
# Traceability: US-04 (AC-04.1..AC-04.6), DDD-10, shared artifact mode_display_labels
#
# HARNESS NOTE: the setup wizard needs raw-mode TTY stdin (chromato setup
# refuses non-TTY by design), so every picker-interaction scenario is
# @ink-testing @skip — executable SPECIFICATION ported by DELIVER to vitest +
# ink-testing-library at the SetupWizardAdapter seam (repo precedent:
# returning-home/home-interaction.feature; the enum round-trip through the
# ConfigFileWriterAdapter is asserted there on the written config.json).
# The HOME RECAP renders to stdout, so recap fidelity IS CI-runnable through
# the real CLI (returning-home recap-fidelity precedent, FORCE_COLOR harness).
#
# COORDINATION (recorded in feature-delta DISTILL section): the returning-home
# suite currently pins `Notifications  On/Off` (home-recap-fidelity.feature
# RF-01/RF-03 + its walking skeleton). DELIVER slice-04 MUST update those
# expectations to the mode labels in the same commit that changes the recap.

@in-terminal-notifications @slice-04 @US-04
Feature: The wizard and home screen speak the new notification language

  # AC-04.5: home recap shows the mode label, not On/Off.
  @real-io @env-E9
  Scenario: The home screen recaps the real mode
    Given chromato is installed for the home screen
    And the terminal is interactive with colour support
    And a saved timer setup whose notifications setting is "bell"
    When the returning user runs "chromato" with no subcommand
    # Test-bug fix (Test Integrity reason 1): home recap uses the domain's
    # MODE_LABELS short form ("Bell"), not the wizard-local "... only" wording
    # (NOTIFY_ROW_TITLE) — per setupWizardAdapter.tsx:61 comment (05-01) and
    # DDD-10. "Bell only" here was a copy-paste slip from the adjacent wizard
    # scenarios in this same file.
    Then the recap shows notifications "Bell"

  # AC-04.4/AC-04.5 + [D6]: a legacy boolean recaps as its mapped mode label.
  @real-io @error @kpi @env-E9
  Scenario: A legacy config recaps as its mapped mode
    Given chromato is installed for the home screen
    And the terminal is interactive with colour support
    And a legacy saved setup with notifications turned on
    When the returning user runs "chromato" with no subcommand
    Then the recap shows notifications "Banner + bell"

  # AC-04.1: the four modes with their one-line descriptions, recommended
  # first — "The last wizard step offers the four modes": ported to a vitest
  # twin per [D-DISTILL-4] (picker rendering needs the ink-testing seam, not
  # observable via a piped subprocess — no TTY for raw-mode stdin).
  # TWIN: tests/unit/adapters/setupWizardAdapter.test.ts
  # > "the Notifications screen offers the four modes with descriptions, Banner + bell preselected, and no desktop-notifications wording"

  # AC-04.2: the chosen enum value lands in the config (writer round-trip) —
  # "A deliberate mode choice lands in the config": ported to a vitest twin
  # per [D-DISTILL-4] (selecting a mode needs raw-mode stdin, impossible over
  # a piped subprocess).
  # TWIN: tests/unit/adapters/setupWizardAdapter.test.ts
  # > "selecting Bell only finishes the wizard, shows it in the Summary recap, and persists notifications \"bell\""

  # AC-04.3: skip-with-defaults locks the recommended mode — "Skipping with
  # defaults picks the recommended mode": ported to a vitest twin per
  # [D-DISTILL-4] (same raw-mode-stdin constraint as the S skip keypress).
  # TWIN: tests/unit/adapters/setupWizardAdapter.test.ts
  # > "S on welcome jumps to summary with ocean/default/Banner + bell defaults and persists them on begin"

  # AC-04.4: reconfigure pre-seeds the picker, including legacy-mapped values
  # — "Reconfigure remembers the saved mode": ported to a vitest twin per
  # [D-DISTILL-4] (the pre-seeded first frame is proven via ink-testing-library,
  # same harness as the Reconfigure pre-seed precedent for the Theme step).
  # TWIN: tests/unit/adapters/setupWizardAdapter.test.ts
  # > "reconfigure pre-seeds the Notifications picker from the saved mode (banner highlights Banner only)"

  # AC-04.6: wizard conventions preserved (Esc keeps the selection, Q writes
  # nothing) — "Backing out of the picker loses nothing": ported to a vitest
  # twin per [D-DISTILL-4] (Esc/Q are raw-mode keypresses, impossible over a
  # piped subprocess).
  # TWIN: tests/unit/adapters/setupWizardAdapter.test.ts
  # > "Esc-back from the Notifications step preserves the highlighted mode, and Q afterwards writes no config"

  # AC-04.6 (habit path): Ctrl+C quits the wizard exactly like Q — nothing
  # written — "Interrupting the picker the habitual way writes nothing":
  # ported to a vitest twin per [D-DISTILL-4] (Ctrl+C is a raw-mode signal,
  # impossible over a piped subprocess).
  # TWIN: tests/unit/adapters/setupWizardAdapter.test.ts
  # > "Ctrl+C from the Notifications step quits without writing config, regardless of the highlighted mode"
