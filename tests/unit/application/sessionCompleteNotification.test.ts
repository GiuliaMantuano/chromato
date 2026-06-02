/**
 * Unit tests: SessionService session-complete notification wiring — notification-branding
 * US-NB-04 (+ DESIGN CRIT-2 regression guard).
 *
 * Port boundary: enter through the SessionService driving port (tickOnce), wire an
 * in-memory NotificationPort double at the driven boundary, observe the focused-minutes
 * value handed to notifySessionComplete. The real SessionService is the SUT
 * (Pillar 3 — production composition for the application service; only the
 * driven-external NotificationPort is doubled).
 *
 * Behaviour under test:
 *   - On SESSION_COMPLETED, SessionService calls notifySessionComplete with the
 *     SESSION-SCOPED focused minutes = completedThisSession × (workDurationSeconds / 60)
 *     (DESIGN §2.6 (ii), CRIT-2 fix), threaded `config` (CRIT-1 fix).
 *   - The session-scoped counter resets at new Session(...) — so a 2nd same-day
 *     session seeded with a non-zero daily total does NOT over-count (the CRIT-2
 *     regression guard — the highest-value scenario in this slice).
 *   - historyPort.recordSession still receives the DAILY total (unchanged) — the
 *     domain event meaning is preserved.
 *
 * TEST PARADIGM: EXEMPT — application-service wiring test (a representative
 * single-session and a representative second-session drive verify the wiring
 * contract; no Hypothesis/fast-check in the chromato stack).
 *
 * RED classification: MISSING_FUNCTIONALITY — SessionService does not yet call
 * notifySessionComplete, does not thread `config` into processEvents, and has no
 * completedThisSession counter. Specs run RED against current code; DELIVER wires
 * §2.6 to GREEN.
 */

import { describe, it, expect } from 'vitest';
import { SessionService } from '../../../src/application/sessionService.js';
import type {
  RenderPort,
  StatePort,
  NotificationPort,
  HistoryPort,
} from '../../../src/domain/ports.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';
import type { SessionConfig } from '../../../src/domain/config.js';
import type { PomodoroPhase } from '../../../src/domain/phase.js';

class NoopRenderPort implements RenderPort {
  render(_snapshot: SessionSnapshot): void {}
  stop(): void {}
}

class SeededStatePort implements StatePort {
  initialCompletedToday = 0;
  writeState(_snapshot: SessionSnapshot): void {}
  writeIdle(): void {}
  readState(): SessionSnapshot | null {
    return null;
  }
  readCompletedToday(): number {
    return this.initialCompletedToday;
  }
}

class RecordingNotificationPort implements NotificationPort {
  readonly sessionCompleteCalls: number[] = [];
  notifyPhaseChange(_from: PomodoroPhase, _to: PomodoroPhase): void {}
  notifyOverdue(): void {}
  notifySessionComplete(focusedMinutes: number): void {
    this.sessionCompleteCalls.push(focusedMinutes);
  }
}

class RecordingHistoryPort implements HistoryPort {
  readonly recorded: number[] = [];
  recordSession(completedPomodoros: number): void {
    this.recorded.push(completedPomodoros);
  }
  readTodayCount(): number {
    return this.recorded.length;
  }
  readStreak(): number {
    return 0;
  }
}

function makeConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    workDurationSeconds: 25 * 60, // 25 minutes
    breakDurationSeconds: 5 * 60,
    longBreakDurationSeconds: 15 * 60,
    cycleCount: 4,
    useAscii: false,
    useColor: true,
    ...overrides,
  };
}

/** Drives one work period to completion → SESSION_COMPLETED on a fresh session. */
function completeOnePomodoro(service: SessionService, config: SessionConfig): void {
  service.tickOnce(config, 0); // IDLE → WORK
  service.tickOnce(config, config.workDurationSeconds); // work completes → SESSION_COMPLETED
}

describe('SessionService — session-complete notification (US-NB-04)', () => {
  // AC-NB-04.1 — fires with session-scoped focused minutes (1 × 25 = 25)
  it('notifies session-complete with focused minutes = completed × work minutes', () => {
    const notificationPort = new RecordingNotificationPort();
    const service = new SessionService(
      new NoopRenderPort(),
      new SeededStatePort(),
      notificationPort,
      new RecordingHistoryPort(),
    );

    completeOnePomodoro(service, makeConfig({ workDurationSeconds: 25 * 60 }));

    expect(notificationPort.sessionCompleteCalls).toHaveLength(1);
    expect(notificationPort.sessionCompleteCalls[0]).toBe(25);
  });

  // AC-NB-04.2 — focused minutes reflect a custom work duration (1 × 50 = 50)
  it('reflects a custom 50-minute work duration in the focused minutes', () => {
    const notificationPort = new RecordingNotificationPort();
    const service = new SessionService(
      new NoopRenderPort(),
      new SeededStatePort(),
      notificationPort,
      new RecordingHistoryPort(),
    );

    completeOnePomodoro(service, makeConfig({ workDurationSeconds: 50 * 60 }));

    expect(notificationPort.sessionCompleteCalls[0]).toBe(50);
  });

  // CRIT-2 REGRESSION GUARD (highest value) — a 2nd same-day session must NOT
  // over-count. The state port reports 3 pomodoros already done today; the
  // session-scoped counter resets at new Session(...), so the FIRST completion of
  // THIS session reports 1 × 25 = 25 focused minutes, NOT (3 + 1) × 25 = 100.
  it('does not over-count focused minutes when the daily total is already non-zero', () => {
    const notificationPort = new RecordingNotificationPort();
    const statePort = new SeededStatePort();
    statePort.initialCompletedToday = 3; // a 2nd session later the same day
    const historyPort = new RecordingHistoryPort();
    const service = new SessionService(
      new NoopRenderPort(),
      statePort,
      notificationPort,
      historyPort,
    );

    completeOnePomodoro(service, makeConfig({ workDurationSeconds: 25 * 60 }));

    // If completedThisSession wrongly used event.completedPomodoros (the daily total),
    // focusedMinutes would be (3 + 1) × 25 = 100, not 1 × 25 = 25 — this assertion catches it.
    // Session-scoped: only THIS session's focus is reported.
    expect(notificationPort.sessionCompleteCalls[0]).toBe(25);
    // The domain event meaning is unchanged — historyPort still receives the daily
    // total (seeded 3 + 1 completed this session = 4).
    expect(historyPort.recorded[historyPort.recorded.length - 1]).toBe(4);
  });
});
