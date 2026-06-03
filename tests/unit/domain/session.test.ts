/**
 * Unit tests: Session domain aggregate root
 *
 * These tests construct `Session` directly. This is the documented TDD-Mandate-2
 * exception for a complex standalone algorithm: the Pomodoro state machine
 * (phase transitions, internal event queue, overdue tracking) with a stable
 * public interface (tick, getSnapshot, drainEvents, interrupt, isInterrupted).
 *
 * Scope is deliberately the domain contract the driving-port test cannot reach:
 *   B1: IDLE baseline before any tick
 *   B2: WORK-start progress baseline (progressFraction 0)
 *   B3: drainEvents() queue-clearing contract (not merely that an event fires)
 *   B4: interrupt() marks the session and resets the snapshot to IDLE
 *   B5: WORK->LONG_BREAK transition after cycleCount (no port-level equivalent)
 *   B6: currentPomodoro overflow bound (regression: fix-pomodoro-counter-overflow)
 *   B7: skipToWork() — pure-domain half of in-session-controls Slice 01 (01-01).
 *       Drives the rest-phase -> WORK transition the SessionService.skip() driving
 *       port (01-02) delegates to. Asserted through getSnapshot()/drainEvents()
 *       only (DN-3: no private-field reach-in). skipToWork() IS the domain driving
 *       port here (stable public method) — the documented TDD-Mandate-2 exception.
 *
 * Behaviors already exercised through SessionService (IDLE->WORK transition,
 * 0.5 progressFraction) were removed from here to avoid duplication; see
 * tests/unit/application/sessionService.test.ts B1/B2.
 *
 * No imports from src/adapters/. No mocks inside the hexagon.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Session } from '../../../src/domain/session.js';
import type { SessionConfig } from '../../../src/domain/config.js';

function makeConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    workDurationSeconds: 10,
    breakDurationSeconds: 5,
    longBreakDurationSeconds: 15,
    cycleCount: 4,
    useAscii: false,
    useColor: true,
    ...overrides,
  };
}

describe('Session aggregate root', () => {
  // B1: IDLE baseline before any tick (IDLE->WORK transition covered by SessionService B1)
  it('starts with IDLE phase before any tick', () => {
    const session = new Session(makeConfig());
    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('IDLE');
  });

  // B2: WORK-start progress baseline (0.5 case covered by SessionService B2)
  it('returns progressFraction of 0 at the start of WORK phase', () => {
    const session = new Session(makeConfig({ workDurationSeconds: 10 }));
    session.tick(1); // transitions to WORK
    const snapshot = session.getSnapshot();
    expect(snapshot.timer.progressFraction).toBeCloseTo(0, 5);
  });

  // B3: drainEvents() returns PhaseChangedEvent after work period completes
  it('emits a PhaseChangedEvent when work period completes', () => {
    const session = new Session(makeConfig({ workDurationSeconds: 2 }));
    session.tick(1); // IDLE -> WORK
    session.tick(2); // advance through 2-second work period
    const events = session.drainEvents();
    const phaseChangedEvent = events.find((e) => e.type === 'PHASE_CHANGED');
    expect(phaseChangedEvent).toBeDefined();
    expect(phaseChangedEvent?.type).toBe('PHASE_CHANGED');
  });

  it('drainEvents() clears the event queue after being called', () => {
    const session = new Session(makeConfig({ workDurationSeconds: 2 }));
    session.tick(1);
    session.tick(2);
    session.drainEvents(); // first drain
    const secondDrain = session.drainEvents();
    expect(secondDrain).toHaveLength(0);
  });

  // B4: interrupt() marks session as interrupted
  it('marks session as interrupted when interrupt() is called', () => {
    const session = new Session(makeConfig());
    session.tick(1);
    session.interrupt();
    expect(session.isInterrupted()).toBe(true);
  });

  it('getSnapshot() returns IDLE phase after interrupt()', () => {
    const session = new Session(makeConfig());
    session.tick(1);
    session.interrupt();
    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('IDLE');
  });

  // B5: WORK->LONG_BREAK transition after cycleCount completed work sessions
  it('transitions to LONG_BREAK phase after cycleCount work sessions complete', () => {
    // cycleCount=2: after 2 completed work sessions, next break should be LONG_BREAK
    const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 1, cycleCount: 2 });
    const session = new Session(config, 1); // already 1 completed today (simulates 3rd Pomodoro context)
    session.tick(1); // IDLE -> WORK
    session.tick(2); // completes work (completedToday 1->2, 2 % 2 === 0 => LONG_BREAK)
    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('LONG_BREAK');
  });

  it('transitions to BREAK phase (not LONG_BREAK) before cycleCount is reached', () => {
    const config = makeConfig({ workDurationSeconds: 2, cycleCount: 4 });
    const session = new Session(config);
    session.tick(1); // IDLE -> WORK
    session.tick(2); // completes first work (1 % 4 !== 0 => BREAK)
    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('BREAK');
  });

  // B6: currentPomodoro is bounded to cycleCount when initialCompletedToday exceeds cycleCount
  it('currentPomodoro is bounded to cycleCount when initialCompletedToday exceeds cycleCount', () => {
    // Bug scenario: 9 sessions completed today with cycleCount=4 produces currentPomodoro=10
    const config = makeConfig({ cycleCount: 4 });
    const session = new Session(config, 9); // initialCompletedToday=9 exceeds cycleCount=4
    session.tick(1); // IDLE -> WORK
    const snapshot = session.getSnapshot();
    expect(snapshot.currentPomodoro).toBeLessThanOrEqual(snapshot.config.cycleCount);
  });

  // ── B7: skipToWork() — pure-domain rest-phase -> WORK (01-01) ──────────────
  // skipToWork() is the domain driving port; assertions go through getSnapshot()
  // and drainEvents() — never private fields (DN-3 / Mandate 1).
  describe('skipToWork()', () => {
    // Drive the session to LONG_BREAK after the 4th pomodoro (cycleCount=4).
    function sessionInLongBreak() {
      const config = makeConfig({ workDurationSeconds: 2, longBreakDurationSeconds: 100, cycleCount: 4 });
      const session = new Session(config, 3); // 3 done today; the 4th completes -> LONG_BREAK
      session.tick(1); // IDLE -> WORK (4th pomodoro)
      session.tick(2); // WORK completes -> completedToday 4, count 4, 4%4==0 -> LONG_BREAK
      session.drainEvents(); // discard the WORK-completion events; isolate skip's emission
      return { session, config };
    }

    // Drive the session to a short BREAK after the 2nd pomodoro.
    function sessionInShortBreak() {
      const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 300, cycleCount: 4 });
      const session = new Session(config, 1); // 1 done; the 2nd completes -> BREAK
      session.tick(1); // IDLE -> WORK
      session.tick(2); // WORK completes -> count 2, 2%4!=0 -> BREAK
      session.drainEvents();
      return { session, config };
    }

    // Drive the session into OVERDUE with a non-zero overdue count-up.
    function sessionInOverdue() {
      const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 2 });
      const session = new Session(config, 0);
      session.tick(1); // IDLE -> WORK
      session.tick(2); // WORK -> BREAK
      session.tick(3); // BREAK timer expires -> OVERDUE
      session.tick(763); // accumulate overdue count-up (+12:43)
      session.drainEvents();
      return { session, config };
    }

    // B7.1: LONG_BREAK -> WORK; remaining resets to work duration; badge "1 of 4";
    // completedToday unchanged (a skipped break is not a completed pomodoro).
    it('starts a fresh cycle from LONG_BREAK (phase WORK, remaining = work duration, badge 1 of 4, completedToday unchanged)', () => {
      const { session, config } = sessionInLongBreak();
      const todayBefore = session.getSnapshot().completedToday;
      expect(session.getSnapshot().phase).toBe('LONG_BREAK');

      session.skipToWork();

      const after = session.getSnapshot();
      expect(after.phase).toBe('WORK');
      expect(after.timer.remainingSeconds).toBe(config.workDurationSeconds);
      expect(after.currentPomodoro).toBe(1); // (4 % 4) + 1 = 1
      expect(after.completedToday).toBe(todayBefore);
    });

    // B7.2: short BREAK -> WORK; badge advances to the next pomodoro ("3 of 4").
    it('advances to the next pomodoro from a short BREAK (phase WORK, badge 3 of 4)', () => {
      const { session, config } = sessionInShortBreak();
      expect(session.getSnapshot().phase).toBe('BREAK');

      session.skipToWork();

      const after = session.getSnapshot();
      expect(after.phase).toBe('WORK');
      expect(after.timer.remainingSeconds).toBe(config.workDurationSeconds);
      expect(after.currentPomodoro).toBe(3); // (2 % 4) + 1 = 3
    });

    // B7.3: OVERDUE -> WORK; the private overdue count-up is cleared to 0 (HARD #2).
    it('escapes OVERDUE and clears the overdue count-up to 0 (HARD #2)', () => {
      const { session, config } = sessionInOverdue();
      expect(session.getSnapshot().phase).toBe('OVERDUE');
      expect(session.getSnapshot().timer.overdueElapsedSeconds).toBeGreaterThan(0);

      session.skipToWork();

      const after = session.getSnapshot();
      expect(after.phase).toBe('WORK');
      expect(after.timer.overdueElapsedSeconds).toBe(0);
      expect(after.timer.remainingSeconds).toBe(config.workDurationSeconds);
    });

    // B7.4: no-op during WORK / IDLE (phase + countdown unchanged). Same behavior,
    // two phase inputs -> one parametrized test (Mandate 5).
    it.each([
      ['IDLE', (s: Session) => { /* never ticked: stays IDLE */ }],
      ['WORK', (s: Session) => { s.tick(1); /* IDLE -> WORK */ }],
    ])('is a no-op during %s (phase and countdown unchanged)', (_label, reach) => {
      const session = new Session(makeConfig({ workDurationSeconds: 10 }));
      reach(session);
      session.drainEvents();
      const before = session.getSnapshot();

      session.skipToWork();

      const after = session.getSnapshot();
      expect(after.phase).toBe(before.phase);
      expect(after.timer.remainingSeconds).toBe(before.timer.remainingSeconds);
      expect(session.drainEvents()).toHaveLength(0); // no spurious events on no-op
    });

    // B7.5: emits exactly ONE PHASE_CHANGED(from, to=WORK) and NO SESSION_COMPLETED.
    it('emits exactly one PHASE_CHANGED to WORK and no SESSION_COMPLETED', () => {
      const { session } = sessionInLongBreak();

      session.skipToWork();

      const events = session.drainEvents();
      const phaseChanges = events.filter((e) => e.type === 'PHASE_CHANGED');
      expect(phaseChanges).toHaveLength(1);
      expect(phaseChanges[0]).toMatchObject({ type: 'PHASE_CHANGED', from: 'LONG_BREAK', to: 'WORK' });
      expect(events.some((e) => e.type === 'SESSION_COMPLETED')).toBe(false);
    });
  });
});
