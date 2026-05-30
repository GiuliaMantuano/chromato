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
});
