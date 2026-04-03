/**
 * Unit tests: Session domain aggregate root
 *
 * Tests enter through SessionService (driving port) with in-memory stub ports.
 * Domain internals (PhaseStateMachine, TimerSnapshot) exercised indirectly.
 *
 * Test Budget: 5 distinct behaviors x 2 = 10 max unit tests
 *   B1: tick() transitions phase from IDLE to WORK
 *   B2: getSnapshot() returns correct progressFraction after N ticks
 *   B3: drainEvents() returns PhaseChangedEvent after work period completes
 *   B4: interrupt() marks session as interrupted
 *   B5: WORK->LONG_BREAK transition after cycleCount completed work sessions
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
  // B1: tick() transitions phase from IDLE to WORK
  it('transitions to WORK phase when tick() is called on an IDLE session', () => {
    const session = new Session(makeConfig());
    session.tick(1);
    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('WORK');
  });

  it('starts with IDLE phase before any tick', () => {
    const session = new Session(makeConfig());
    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('IDLE');
  });

  // B2: getSnapshot() returns correct progressFraction after N ticks
  it('returns progressFraction of 0 at the start of WORK phase', () => {
    const session = new Session(makeConfig({ workDurationSeconds: 10 }));
    session.tick(1); // transitions to WORK
    const snapshot = session.getSnapshot();
    expect(snapshot.timer.progressFraction).toBeCloseTo(0, 5);
  });

  it('returns progressFraction close to 0.5 after half the work duration has elapsed', () => {
    const session = new Session(makeConfig({ workDurationSeconds: 10 }));
    session.tick(1); // transitions IDLE -> WORK, starts timer
    session.tick(5); // advance 5 seconds into 10-second work period
    const snapshot = session.getSnapshot();
    expect(snapshot.timer.progressFraction).toBeCloseTo(0.5, 1);
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
});
