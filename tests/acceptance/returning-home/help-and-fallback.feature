# --help isolation + corrupt-config graceful fallback
#
# Feature ID : returning-home
# Wave       : DISTILL  | Date: 2026-06-02
# Traceability: AC-RH-08.1 (--help unchanged, D4/K3), AC-RH-07.4 (corrupt config, C2/D-RH-8),
#               AC-RH-08.2 (start unchanged), NFR-02/K3 (<100ms help)
#
# These are the purest subprocess scenarios — no TTY required by definition. They
# protect the two contracts the home feature must NOT break: the discovery `--help`
# path (Devon's CI / a newcomer's discoverability) and graceful degradation when a
# returning user's config.json is corrupt.

Feature: The home feature never breaks the help path and degrades gracefully

  Background:
    Given chromato is installed for the home screen

  # -----------------------------------------------------------------------
  # HF-01 (D4/K3): `chromato --help` is byte-for-byte unchanged and stays fast.
  # The home guard is never consulted on the --help path. Timing budget follows
  # the wizard's existing subprocess precedent (200ms wall-clock under spawn);
  # the binding KPI is K3 (<100ms) measured by the dedicated CI perf test, not
  # re-asserted at the sub-100ms boundary here (F-004 flakiness avoidance).
  # -----------------------------------------------------------------------
  @US-RH-05 @real-io
  Scenario: The help screen is shown unchanged for a returning user and stays fast
    Given a saved setup with theme "ocean", work 25, break 5, cycles 4, long break 15, notifications on
    When the returning user runs "chromato --help"
    Then the full command listing is shown
    And the welcome-back recap is not shown
    And the help output completes within 200 milliseconds on the home path
    And the home process exits with code 0

  # -----------------------------------------------------------------------
  # HF-02 (AC-RH-08.2): `chromato start` is unchanged regardless of config.
  # -----------------------------------------------------------------------
  @US-RH-05 @real-io
  Scenario: Starting a session directly is unchanged by the home feature
    Given a saved setup with theme "ocean", work 25, break 5, cycles 4, long break 15, notifications on
    When the returning user runs "chromato start" with a 1-minute work duration
    Then the welcome-back recap is not shown
    And the started session is rendered in the ocean work colour

  # -----------------------------------------------------------------------
  # HF-03 (error, AC-RH-07.4 / C2 / D-RH-8): a corrupt config.json passes the
  # existence-only guard, then loadConfig() throws while parsing; the bare-action
  # try/catch around loadConfig() ONLY catches it, no Ink mounts, and it falls
  # through to plain Commander help with EXIT 0 (never a crash). Contrast with
  # `chromato start` on a corrupt config, which exits non-zero (explicit run intent).
  # -----------------------------------------------------------------------
  @US-RH-05 @real-io @error
  Scenario: A corrupt saved config falls through to plain help without crashing
    Given a corrupt saved config exists
    And the terminal is interactive with colour support
    When the returning user runs "chromato" with no subcommand
    Then the welcome-back recap is not shown
    And the plain command listing is shown instead
    And no "Raw mode is not supported" error appears on the home path
    And the home process exits with code 0
