# Milestone 8: Native OS Notification (fix-macos-notification-silent)
#
# Feature ID  : pomodoro-timer-cli / fix-macos-notification-silent
# Milestone   : M8 -- Native notification via osascript / notify-send (ADR-010)
# Traceability: AC-02.4 (notification fires within 1s of phase transition)
#               AC-02.6 (graceful bell fallback)
# ADR         : ADR-010 (supersedes node-notifier selection in technology-stack.md:83-93)
# Wave        : DISTILL (bugfix)
# Date        : 2026-05-30
#
# Driving port: NotificationPort (notifyPhaseChange / notifyOverdue), exercised
# by SessionService. The OS notifier is a driven external port → faked in tests.
#
# Note on desktop banner verification:
# Scenarios asserting an actual desktop banner (M8-01, M8-02) are tagged @skip
# because banner delivery requires a live OS notification daemon which is not
# available in headless CI. These scenarios document the INTENDED behavior and
# must be verified manually on a real macOS 14+ and Linux desktop environment.
# The load-bearing regression coverage is in tests/unit/adapters/ and
# tests/regression/notification/ (vitest, injected runner seam).
#
# Error/edge ratio: 5 of 8 scenarios = 63% — target met (>= 40%)
# Happy path: 3 (M8-01, M8-02, M8-05)
# Error/edge: 5 (M8-03, M8-04, M8-06, M8-07, M8-08)

Feature: Phase transitions reach the user through the platform notification channel

  Background:
    Given the timer is configured with a 25-minute work session and 5-minute break

  # -----------------------------------------------------------------------
  # HAPPY PATH -- manual verification required (headless CI cannot assert banner)
  # -----------------------------------------------------------------------

  # AC-02.4: notification fires within 1 second of phase transition
  # @skip — banner delivery requires live OS notification daemon; verify manually
  # on macOS 14+ (Darwin 25.5.0 or later) after DELIVER.
  @AC-02.4 @skip @requires_external @manual-verify-only
  Scenario: M8-01 Work phase completion triggers a desktop notification on macOS
    Given the user is running a timer on macOS
    And the work session has just completed
    When the session transitions from Work to Short Break
    Then a desktop notification banner appears with title "chromato"
    And the notification message names the completed phase and the upcoming phase
    And the notification appears within 1 second of the transition

  # AC-02.4: Linux notification delivery
  # @skip — banner delivery requires a live Linux desktop with notify-send installed;
  # community-validated, unverified by maintainer.
  @AC-02.4 @skip @requires_external @manual-verify-only @linux-community-validated
  Scenario: M8-02 Work phase completion triggers a desktop notification on Linux
    Given the user is running a timer on Linux with a graphical desktop environment
    And the work session has just completed
    When the session transitions from Work to Short Break
    Then a desktop notification appears with title "chromato"
    And the notification message names the completed phase and the upcoming phase

  # -----------------------------------------------------------------------
  # ERROR / FALLBACK — load-bearing scenarios
  # The bell fallback is the regression fix. These scenarios drive the
  # vitest unit tests that are the real enforcement mechanism.
  # -----------------------------------------------------------------------

  # AC-02.6: graceful bell fallback when notification command fails
  # This is the ROOT CAUSE scenario. The bug is that the bell never fires.
  # Documented here for stakeholder communication; enforced by vitest unit tests B7/B8.
  @AC-02.6 @skip @error @in-memory
  Scenario: M8-03 User hears a terminal bell when the notification command fails
    Given the notification mechanism encounters an error on this machine
    When a phase transition occurs
    Then the user hears a terminal bell through the terminal
    And no notification failure goes completely unnoticed

  # AC-02.6: graceful bell fallback on unsupported or headless platform
  @AC-02.6 @skip @error @in-memory
  Scenario: M8-04 User hears a terminal bell on a headless or unsupported platform
    Given the timer is running in a headless environment without a display server
    When a phase transition occurs
    Then the user hears a terminal bell through the terminal
    And no silent failure occurs

  # AC-02.6: overdue notification also uses bell as fallback
  @AC-02.6 @skip @error @in-memory
  Scenario: M8-05 Overdue notification falls back to bell when the notification command fails
    Given the break phase has ended and the user has not started the next session
    And the notification mechanism encounters an error on this machine
    When the overdue reminder is triggered
    Then the user hears a terminal bell through the terminal

  # -----------------------------------------------------------------------
  # EDGE CASES
  # -----------------------------------------------------------------------

  # Notification content: both phases named in the message
  @AC-02.4 @skip @in-memory
  Scenario: M8-06 Notification message names both the completed phase and the upcoming phase
    Given the work session has just completed
    When the session transitions from Work to Short Break
    Then the notification message includes the name of the phase that ended
    And the notification message includes the name of the phase that is starting

  # Long break transition: message is distinct
  @AC-02.4 @skip @in-memory
  Scenario: M8-07 Notification message correctly names Long Break when the fourth pomodoro completes
    Given four consecutive pomodoro cycles have been completed
    When the session transitions from Work to Long Break
    Then the notification message includes the name "Long Break"

  # Bell fires at most once per event (no double-ring on partial failure paths)
  @AC-02.6 @skip @in-memory @error
  Scenario: M8-08 Exactly one bell fires when notification fails, not multiple bells
    Given the notification mechanism encounters an error on this machine
    When a phase transition occurs
    Then the terminal bell sounds exactly once
