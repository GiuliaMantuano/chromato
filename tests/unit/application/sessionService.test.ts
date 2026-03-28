/**
 * Unit tests: SessionService application service (driving port)
 *
 * Tests enter through SessionService with in-memory stub ports.
 * Domain internals (Session, PhaseStateMachine, TimerSnapshot) exercised indirectly.
 *
 * Test Budget: 7 distinct behaviors x 2 = 14 max unit tests
 *   B1: first tick transitions phase from IDLE to WORK (render called)
 *   B2: progressFraction is 0.5 after half the work duration ticks
 *   B3: PHASE_CHANGED event triggers notificationPort.notifyPhaseChange
 *   B4: interrupt causes clean shutdown (renderPort.stop, statePort.writeIdle)
 *   B5: progressFraction is 1.0 when in OVERDUE state (D2 fix)
 *   B6: SESSION_COMPLETED event triggers historyPort.recordSession (D3 coverage)
 *   B7: exactly one PHASE_CHANGED event per WORK->BREAK transition (WS-04)
 *
 * No imports from src/adapters/. No mocks inside the hexagon.
 */

import { describe, it, expect } from 'vitest';
import { SessionService } from '../../../src/application/sessionService.js';
import type { RenderPort, StatePort, NotificationPort, HistoryPort } from '../../../src/domain/ports.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';
import type { PomodoroPhase } from '../../../src/domain/phase.js';
import type { SessionConfig } from '../../../src/domain/config.js';

// --- Stub port implementations ---

class InMemoryRenderPort implements RenderPort {
  readonly snapshots: SessionSnapshot[] = [];
  stopped = false;

  render(snapshot: SessionSnapshot): void {
    this.snapshots.push(snapshot);
  }

  stop(): void {
    this.stopped = true;
  }

  lastSnapshot(): SessionSnapshot {
    return this.snapshots[this.snapshots.length - 1]!;
  }
}

class InMemoryStatePort implements StatePort {
  readonly written: SessionSnapshot[] = [];
  idleWritten = false;

  writeState(snapshot: SessionSnapshot): void {
    this.written.push(snapshot);
  }

  writeIdle(): void {
    this.idleWritten = true;
  }

  readState(): SessionSnapshot | null {
    return this.written.at(-1) ?? null;
  }
}

class InMemoryNotificationPort implements NotificationPort {
  readonly phaseChanges: Array<{ from: PomodoroPhase; to: PomodoroPhase }> = [];
  overdueNotified = false;

  notifyPhaseChange(from: PomodoroPhase, to: PomodoroPhase): void {
    this.phaseChanges.push({ from, to });
  }

  notifyOverdue(): void {
    this.overdueNotified = true;
  }
}

class InMemoryHistoryPort implements HistoryPort {
  readonly recorded: number[] = [];

  recordSession(completedPomodoros: number): void {
    this.recorded.push(completedPomodoros);
  }

  readTodayCount(): number {
    return this.recorded.length;
  }

  readStreak(): number {
    return 1;
  }
}

// --- Test helpers ---

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

function makePorts(): {
  renderPort: InMemoryRenderPort;
  statePort: InMemoryStatePort;
  notificationPort: InMemoryNotificationPort;
  historyPort: InMemoryHistoryPort;
} {
  return {
    renderPort: new InMemoryRenderPort(),
    statePort: new InMemoryStatePort(),
    notificationPort: new InMemoryNotificationPort(),
    historyPort: new InMemoryHistoryPort(),
  };
}

// --- Tests ---

describe('SessionService (driving port)', () => {
  // B1: first tick transitions phase from IDLE to WORK
  it('renders WORK phase snapshot after first tick on an IDLE session', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig();

    service.tickOnce(config, 0);

    expect(renderPort.snapshots.length).toBeGreaterThan(0);
    expect(renderPort.lastSnapshot().phase).toBe('WORK');
  });

  it('writes WORK phase state to statePort after first tick', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig();

    service.tickOnce(config, 0);

    expect(statePort.written.length).toBeGreaterThan(0);
    expect(statePort.written[statePort.written.length - 1]!.phase).toBe('WORK');
  });

  // B2: progressFraction is 0.5 after half the work duration ticks
  it('renders progressFraction close to 0.5 after half the work duration has elapsed', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig({ workDurationSeconds: 10 });

    service.tickOnce(config, 0);  // IDLE -> WORK, elapsed = 0
    service.tickOnce(config, 5); // advance 5s into 10s work period

    expect(renderPort.lastSnapshot().timer.progressFraction).toBeCloseTo(0.5, 1);
  });

  // B3: PHASE_CHANGED event triggers notificationPort.notifyPhaseChange
  it('notifies notificationPort of phase change when work period completes', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig({ workDurationSeconds: 2 });

    service.tickOnce(config, 0); // IDLE -> WORK
    service.tickOnce(config, 2); // work period completes -> BREAK

    expect(notificationPort.phaseChanges.length).toBeGreaterThan(0);
    expect(notificationPort.phaseChanges[0]!.from).toBe('WORK');
    expect(notificationPort.phaseChanges[0]!.to).toBe('BREAK');
  });

  // B4: interrupt causes clean shutdown
  it('stops renderPort and writes idle state when session is interrupted', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig();

    service.tickOnce(config, 0); // IDLE -> WORK
    service.interrupt();          // signal interruption
    service.tickOnce(config, 1); // process interrupted state

    expect(renderPort.stopped).toBe(true);
    expect(statePort.idleWritten).toBe(true);
  });

  // B5: progressFraction is 1.0 when in OVERDUE state (D2 fix)
  it('renders progressFraction of 1.0 when session is in OVERDUE state', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    // short break so it expires quickly -> OVERDUE
    const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 2 });

    service.tickOnce(config, 0); // IDLE -> WORK
    service.tickOnce(config, 2); // work completes -> BREAK
    service.tickOnce(config, 3); // break expires -> OVERDUE

    const snapshot = renderPort.lastSnapshot();
    expect(snapshot.phase).toBe('OVERDUE');
    expect(snapshot.timer.progressFraction).toBeCloseTo(1.0, 5);
  });

  // B6: SESSION_COMPLETED event triggers historyPort.recordSession (D3 coverage)
  it('records session in historyPort when SESSION_COMPLETED event is emitted after work completes', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig({ workDurationSeconds: 2 });

    service.tickOnce(config, 0); // IDLE -> WORK
    service.tickOnce(config, 2); // work completes -> SESSION_COMPLETED emitted

    expect(historyPort.recorded.length).toBe(1);
    expect(historyPort.recorded[0]).toBe(1);
  });

  // B7: exactly one PHASE_CHANGED event per WORK->BREAK transition (WS-04)
  it('emits exactly one PHASE_CHANGED event when WORK period completes and transitions to BREAK', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig({ workDurationSeconds: 2 });

    service.tickOnce(config, 0); // IDLE -> WORK (no PHASE_CHANGED for IDLE->WORK)
    service.tickOnce(config, 2); // work completes -> BREAK

    expect(notificationPort.phaseChanges.length).toBe(1);
    expect(notificationPort.phaseChanges[0]!.from).toBe('WORK');
    expect(notificationPort.phaseChanges[0]!.to).toBe('BREAK');
  });

  // B7: render snapshot phase is BREAK immediately after work period completes
  it('renders BREAK phase snapshot immediately after work period completes (single render cycle)', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 5 });

    service.tickOnce(config, 0); // IDLE -> WORK
    service.tickOnce(config, 2); // work completes -> BREAK render

    expect(renderPort.lastSnapshot().phase).toBe('BREAK');
  });
});
