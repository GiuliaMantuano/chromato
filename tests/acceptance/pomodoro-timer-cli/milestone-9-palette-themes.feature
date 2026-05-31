# Milestone 9: Palette Themes (palette-themes)
#
# Feature ID  : palette-themes
# Traceability: AC-PT-04 (--palette flag), AC-PT-05 (CHROMATO_PALETTE env),
#               AC-PT-06 (config.json key), AC-PT-07 (precedence),
#               AC-PT-08 (unknown name error), AC-PT-09 (NO_COLOR),
#               AC-PT-10 (--help)
# ADR         : ADR-011 (palette registry placement + adapter injection)
# Wave        : DISTILL — RED-ready scaffold
# Date        : 2026-05-31
# Story       : US-PT-01
#
# Driving port: chromato CLI binary (subprocess invocation) — Phase C user journeys.
#
# Test tier strategy:
# These scenarios exercise the CLI driving port (subprocess) for Phase C
# user-facing behavior: flag, env, config, precedence, error, help.
# They are at layer 3 (subprocess/FS acceptance) — example-only (no PBT),
# sad paths are explicitly named per Mandate 11.
#
# Scenarios asserting ACTUAL rendered terminal color (gradient hex visible
# in terminal output) are tagged @skip @manual-verify-only — headless CI
# cannot assert palette ANSI output. The load-bearing enforcement is the
# vitest unit layer (palette.test.ts, configLoader.palette.test.ts,
# palette-injection.test.ts).
#
# Error/edge ratio: 6 of 11 scenarios = 55% — target met (>= 40%)
# Happy path: 5 (M9-01 WS, M9-02, M9-03, M9-04, M9-10)
# Error/edge: 6 (M9-05, M9-06, M9-07, M9-08, M9-09, M9-11)
#
# Pending scenarios (.skip tag) — DELIVER enables one at a time.
# M9-01 (walking skeleton) is the first to enable.

Feature: User selects a named color palette that applies to every chromato surface

  Background:
    Given chromato is installed and runnable from the command line

  # -------------------------------------------------------------------------
  # WALKING SKELETON — Phase C integration proof
  # -------------------------------------------------------------------------
  # @skip — pending DELIVER Phase C implementation.
  # This is the outer-loop anchor: proves --palette flag is wired from CLI
  # through configLoader to the composition root. Enable first.

  @AC-PT-04 @walking_skeleton @driving_port
  Scenario: M9-01 User applies a named palette via the flag and the session starts
    Given no palette is set in the environment or config file
    When the user runs "chromato start --palette lavender" and the session initializes
    Then chromato starts a Pomodoro session without error
    And the process exits with code 0 after the session ends
    And no error message appears on standard error

  # -------------------------------------------------------------------------
  # HAPPY PATH — Phase C flag, env, config, precedence
  # -------------------------------------------------------------------------

  # AC-PT-04: --palette flag wires through to session start
  @AC-PT-04
  Scenario: M9-02 Flag overrides config file palette (flag beats config)
    Given the user has written '{"palette":"lavender"}' to the chromato config file
    When the user runs "chromato start --palette ocean" and the session initializes
    Then chromato starts a Pomodoro session without error
    And no mention of "lavender" appears in standard error

  # AC-PT-05: env var applies when no flag set
  @AC-PT-05
  Scenario: M9-03 Environment variable applies the palette when no flag is set
    Given the CHROMATO_PALETTE environment variable is set to "berry"
    And no --palette flag is used
    When the user runs "chromato start" and the session initializes
    Then chromato starts a Pomodoro session without error

  # AC-PT-06 + AC-PT-07: config.json key applies at lowest precedence
  @AC-PT-06 @AC-PT-07
  Scenario: M9-04 Config file palette key applies when no flag or env var is set
    Given the user has written '{"palette":"forest"}' to the chromato config file
    And no CHROMATO_PALETTE environment variable is set
    And no --palette flag is used
    When the user runs "chromato start" and the session initializes
    Then chromato starts a Pomodoro session without error

  # AC-PT-07: full precedence chain verification (flag > env > config > default)
  @AC-PT-07
  Scenario: M9-05 Flag beats env var beats config in the precedence chain
    Given the CHROMATO_PALETTE environment variable is set to "berry"
    And the user has written '{"palette":"lavender"}' to the chromato config file
    When the user runs "chromato start --palette forest" and the session initializes
    Then chromato starts a Pomodoro session without error
    And the session starts with the forest palette (flag is highest precedence)

  # -------------------------------------------------------------------------
  # ERROR PATHS (AC-PT-08)
  # -------------------------------------------------------------------------

  # Sad_UnknownPaletteName — explicit name per Mandate 11
  @AC-PT-08 @error
  Scenario: Sad_UnknownPaletteName: unknown --palette name exits with code 1 and names valid palettes
    Given no palette is set in the environment or config file
    When the user runs "chromato start --palette catppuccin-latte"
    Then the process exits with code 1
    And the error output contains the unknown palette name "catppuccin-latte"
    And the error output lists all 4 valid palette names: ocean, lavender, berry, forest
    And no Pomodoro session is started

  # Sad_UnknownEnvPalette
  @AC-PT-08 @error
  Scenario: Sad_UnknownEnvPalette: unknown palette in env var exits with code 1
    Given the CHROMATO_PALETTE environment variable is set to "dracula"
    When the user runs "chromato start"
    Then the process exits with code 1
    And the error output contains the unknown palette name "dracula"
    And the error output lists all 4 valid palette names: ocean, lavender, berry, forest

  # Sad_InvalidConfigJson
  @AC-PT-06 @error
  Scenario: Sad_InvalidConfigJson: malformed config.json causes exit 1 (not silent)
    Given the chromato config file contains invalid JSON content
    When the user runs "chromato start"
    Then the process exits with code 1
    And the error output indicates a configuration file parse error

  # Sad_UnknownConfigPalette
  @AC-PT-06 @AC-PT-08 @error
  Scenario: Sad_UnknownConfigPalette: unknown palette name in config.json exits with code 1
    Given the user has written '{"palette":"nord"}' to the chromato config file
    And no CHROMATO_PALETTE environment variable is set
    And no --palette flag is used
    When the user runs "chromato start"
    Then the process exits with code 1
    And the error output contains the unknown palette name "nord"
    And the error output lists all 4 valid palette names: ocean, lavender, berry, forest

  # -------------------------------------------------------------------------
  # NO_COLOR (AC-PT-09)
  # -------------------------------------------------------------------------

  # Sad_NoColorSuppressesPalette — palette is configured but suppressed by NO_COLOR
  @AC-PT-09 @error
  Scenario: Sad_NoColorSuppressesPalette: NO_COLOR suppresses all palette rendering
    Given the CHROMATO_PALETTE environment variable is set to "lavender"
    And the NO_COLOR environment variable is set
    When the user runs "chromato start --minimal" and the session initializes
    Then chromato starts a Pomodoro session without error
    And no ANSI color sequences appear in standard output
    And functional text output (phase label and timer) is visible in standard output

  # -------------------------------------------------------------------------
  # HELP DOCUMENTATION (AC-PT-10)
  # -------------------------------------------------------------------------

  @AC-PT-10
  Scenario: M9-10 --help documents the --palette flag with valid names and config path
    When the user runs "chromato --help"
    Then the output includes "--palette" with valid palette names listed
    And the output includes at least one named-palette example command
    And the output documents the config.json file path for palette configuration
    And the output documents the precedence order for palette resolution

  # -------------------------------------------------------------------------
  # VISUAL RENDERING — manual verification only (CI cannot assert ANSI colors)
  # -------------------------------------------------------------------------

  # @skip @manual-verify-only — headless CI cannot assert gradient hex in ANSI output.
  # These scenarios document the INTENDED visual behavior.
  # Verified manually: render chromato start --palette <name> in a real terminal
  # and visually confirm the logo gradient and phase bar match palette-spec.md.

  @AC-PT-03 @skip @manual-verify-only @requires_external
  Scenario: M9-11 Named palette renders visually coherent logo and progress bar
    Given the user runs "chromato start --palette lavender" in a real terminal
    When the session renders its first frame
    Then the ASCII art logo gradient uses lavender hex stops from palette-spec.md
    And the TUI progress bar phase color matches the lavender palette phases map
    And both surfaces are visually coherent with no per-adapter color divergence
