# Slice 05: Plain-text parity (--minimal, NO_COLOR, ASCII)
#
# Feature ID : in-terminal-notifications
# Wave       : DISTILL | Date: 2026-07-04
# Traceability: US-05 (AC-05.1..AC-05.5), [D8], [D9], [D11], AC-P3, NFR-05.1,
#               DDD-5, DDD-8, moment-priority pin (spike/upstream-issues.md #1)
#
# Every scenario here runs through the real CLI. The piped variants (E2) are
# exactly what CI runners see; NO_COLOR (E3) and ASCII (E4) ride env vars on
# the spawned process. The one TTY-only concern — the persistent line
# interleaving with the \r live-timer overwrite without corruption (AC-05.1,
# E5) — is proven by a DELIVER vitest twin with a simulated TTY; its piped
# complement (newline-terminated persistent line) is pinned here.
#
# MOMENT-PRIORITY PIN (minimal half — DISTILL decision): in --minimal BOTH
# the phase-change line and the session-summary line print (persistent lines
# stack; no single-slot constraint). The TUI half lives in slice-01-banner.

@in-terminal-notifications @slice-05 @US-05
Feature: Notifications reach plain-text and no-color sessions too

  # AC-05.1 (piped complement) / AC-05.2: one plain-text line per moment.
  @real-io @env-E2
  Scenario: A minimal session announces the transition on its own line
    Given chromato is installed for in-terminal notifications
    When the user runs a piped minimal session through its first transition
    Then a plain notification line "Pomodoro complete 🍅 — Time for a 5-minute break." is printed on its own row

  # AC-05.2 / [D8]: piped output is a clean logfile — newline-terminated,
  # zero ANSI, zero BEL.
  @real-io @error @env-E2
  Scenario: Piped output carries the notification cleanly
    Given chromato is installed for in-terminal notifications
    When the user runs a piped minimal session through its first transition
    Then the notification line ends with a newline
    And the captured output contains no ANSI escape sequences
    And the captured output contains no bell character

  # AC-05.3 / AC-P3 / SC-3: colour-suppressed output stays zero-ANSI with
  # ASCII emphasis markers.
  @real-io @error @env-E3
  Scenario: NO_COLOR readers get the same information
    Given chromato is installed for in-terminal notifications
    When the user runs a NO_COLOR session through its first transition
    Then the notification is printed between ">>>" and "<<<" emphasis markers
    And the captured output contains no ANSI escape sequences

  # AC-05.4 / [D11]: ASCII mode strips emoji, stays grammatical. The separator
  # is the ASCII hyphen (not the em dash used in non-ASCII scenarios above) —
  # stripNonAscii degrades the em dash to "-" the same way it does for window
  # titles (DDD-8 single-sourcing), so this line is ASCII end-to-end.
  @real-io @error @env-E4
  Scenario: ASCII mode keeps the copy grammatical
    Given chromato is installed for in-terminal notifications
    When the user runs an ASCII-terminal minimal session through its first transition
    Then a plain notification line "Pomodoro complete - Time for a 5-minute break." is printed on its own row
    And the notification output contains only ASCII characters

  # AC-05.5 / [D9]: the mode enum means the same thing in minimal as in TUI.
  @real-io @error @env-E2
  Scenario: Mode semantics hold in minimal sessions
    Given a saved timer setup whose notifications setting is "bell"
    When the user runs a piped minimal session through its first transition
    Then no notification line is printed
    And the captured output contains no bell character

  # DISTILL PIN (minimal half of the moment-priority policy) + AC-01.6: the
  # session summary is visible to the user — in minimal, where lines stack.
  @real-io @distill-pin @env-E2
  Scenario: Completing a work block tells the whole story in minimal
    Given chromato is installed for in-terminal notifications
    When the user runs a piped minimal session through its first transition
    Then a plain notification line "Pomodoro complete 🍅 — Time for a 5-minute break." is printed on its own row
    And a session summary line containing "min focused. Well done." is also printed
