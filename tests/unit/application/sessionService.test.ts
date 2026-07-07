/**
 * Unit tests: SessionService application service (driving port)
 *
 * Tests enter through SessionService with in-memory stub ports.
 * Domain internals (Session, PhaseStateMachine, TimerSnapshot) exercised indirectly.
 *
 *   B11: run() removes its SIGINT listener once interrupted, leaking none
 *        across repeated calls (2026-07-07 CI-hang investigation)
 *
 * Test Budget: 11 distinct behaviors x 2 = 22 max unit tests
 *   B1: first tick renders WORK phase and writes WORK state to statePort
 *   B2: progressFraction is 0.5 after half the work duration ticks
 *   B3: PHASE_CHANGED event triggers notificationPort.notifyPhaseChange
 *   B4: interrupt causes clean shutdown (renderPort.stop, statePort.writeIdle)
 *   B5: progressFraction is 1.0 when in OVERDUE state (D2 fix)
 *   B6: SESSION_COMPLETED event triggers historyPort.recordSession (D3 coverage)
 *   B7: exactly one PHASE_CHANGED event and BREAK render per WORK->BREAK transition (WS-04)
 *   B8: tickOnce reads completedToday from statePort at session creation and propagates it to snapshot
 *   B9: second notifyOverdue fires at exactly overdueElapsedSeconds >= 60
 *   B10: no additional notifyOverdue fires after overdueElapsedSeconds > 60 (no-duplicate guard)
 *
 * No imports from src/adapters/. No mocks inside the hexagon.
 */

import { describe, it, expect, vi } from 'vitest';
import { SessionService } from '../../../src/application/sessionService.js';
import type {
  RenderPort,
  StatePort,
  NotificationPort,
  HistoryPort,
} from '../../../src/domain/ports.js';
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
  initialCompletedToday: number = 0;

  writeState(snapshot: SessionSnapshot): void {
    this.written.push(snapshot);
  }

  writeIdle(): void {
    this.idleWritten = true;
  }

  readState(): SessionSnapshot | null {
    return this.written.at(-1) ?? null;
  }

  readCompletedToday(): number {
    return this.initialCompletedToday;
  }
}

class InMemoryNotificationPort implements NotificationPort {
  readonly phaseChanges: Array<{ from: PomodoroPhase; to: PomodoroPhase }> = [];
  overdueNotified = false;
  overdueCallCount = 0;
  // NEW (notification-branding US-NB-04): records session-complete calls so the
  // SessionService wiring scenario can assert the session-scoped focused minutes.
  readonly sessionCompleteCalls: number[] = [];

  notifyPhaseChange(from: PomodoroPhase, to: PomodoroPhase): void {
    this.phaseChanges.push({ from, to });
  }

  notifyOverdue(): void {
    this.overdueNotified = true;
    this.overdueCallCount += 1;
  }

  notifySessionComplete(focusedMinutes: number): void {
    this.sessionCompleteCalls.push(focusedMinutes);
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
  // B1: first tick renders WORK phase and writes WORK state to statePort
  it('renders WORK phase and writes WORK state after first tick on an IDLE session', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig();

    service.tickOnce(config, 0);

    expect(renderPort.snapshots.length).toBeGreaterThan(0);
    expect(renderPort.lastSnapshot().phase).toBe('WORK');
    expect(statePort.written.length).toBeGreaterThan(0);
    expect(statePort.written[statePort.written.length - 1]!.phase).toBe('WORK');
  });

  // B2: progressFraction is 0.5 after half the work duration ticks
  it('renders progressFraction close to 0.5 after half the work duration has elapsed', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig({ workDurationSeconds: 10 });

    service.tickOnce(config, 0); // IDLE -> WORK, elapsed = 0
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
    service.interrupt(); // signal interruption
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

  // B7: exactly one PHASE_CHANGED event and BREAK render per WORK->BREAK transition (WS-04)
  it('emits exactly one PHASE_CHANGED event and renders BREAK phase when WORK period completes', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 5 });

    service.tickOnce(config, 0); // IDLE -> WORK (no PHASE_CHANGED for IDLE->WORK)
    service.tickOnce(config, 2); // work completes -> BREAK

    expect(notificationPort.phaseChanges.length).toBe(1);
    expect(notificationPort.phaseChanges[0]!.from).toBe('WORK');
    expect(notificationPort.phaseChanges[0]!.to).toBe('BREAK');
    expect(renderPort.lastSnapshot().phase).toBe('BREAK');
  });

  // B8: tickOnce reads completedToday from statePort at session creation and propagates it to snapshot
  it('initializes completedToday from statePort.readCompletedToday() when creating the first session', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    statePort.initialCompletedToday = 2;
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig();

    service.tickOnce(config, 0); // IDLE -> WORK (session created here)

    expect(renderPort.lastSnapshot().completedToday).toBe(2);
  });

  // B9: second notifyOverdue fires at exactly overdueElapsedSeconds >= 60
  it('calls notifyOverdue a second time when overdueElapsedSeconds reaches 60 seconds', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 2 });

    service.tickOnce(config, 0); // IDLE -> WORK
    service.tickOnce(config, 2); // WORK -> BREAK (PHASE_CHANGED + SESSION_COMPLETED)
    service.tickOnce(config, 3); // BREAK -> OVERDUE (OVERDUE_ACTIVATED, first notifyOverdue)

    const overdueCallsAfterFirst = notificationPort.overdueCallCount;

    service.tickOnce(config, 60); // overdueElapsedSeconds reaches 60 -> second notifyOverdue

    expect(notificationPort.overdueCallCount).toBe(overdueCallsAfterFirst + 1);
  });

  // B10: no additional notifyOverdue fires after overdueElapsedSeconds > 60 (no-duplicate guard)
  it('does not call notifyOverdue a third time after overdueElapsedSeconds exceeds 60 seconds', () => {
    const { renderPort, statePort, notificationPort, historyPort } = makePorts();
    const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
    const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 2 });

    service.tickOnce(config, 0); // IDLE -> WORK
    service.tickOnce(config, 2); // WORK -> BREAK
    service.tickOnce(config, 3); // BREAK -> OVERDUE (first notifyOverdue)
    service.tickOnce(config, 60); // second notifyOverdue at 60s

    const callsAfterSecond = notificationPort.overdueCallCount;

    service.tickOnce(config, 30); // overdueElapsedSeconds = 90 -> no additional call
    service.tickOnce(config, 30); // overdueElapsedSeconds = 120 -> no additional call

    expect(notificationPort.overdueCallCount).toBe(callsAfterSecond);
  });

  // B11: run() registers a real process-level SIGINT listener and must remove
  // it once interrupted -- left unremoved, this accumulates across every
  // call to run() for the life of the process (2026-07-07 CI-hang
  // investigation). Uses fake timers and a directly-invoked captured
  // callback -- no real signal is ever emitted and no real 1s wait occurs,
  // so this test cannot itself exercise the class of fragility it guards
  // against. Asserts a before/after DELTA (not an absolute count) so it
  // stays meaningful regardless of what else is registered in this worker.
  it('run() removes its SIGINT listener after being interrupted, leaking none across calls', async () => {
    vi.useFakeTimers();
    const onSpy = vi.spyOn(process, 'on');
    const baseline = process.listenerCount('SIGINT');
    try {
      const { renderPort, statePort, notificationPort, historyPort } = makePorts();
      const service = new SessionService(renderPort, statePort, notificationPort, historyPort);
      const config = makeConfig();

      const runPromise = service.run(config);

      // Retrieve the exact callback run() registered -- call it directly as a
      // plain function, never through process.emit/process.kill, so no real
      // signal-delivery path is exercised.
      const sigintCall = onSpy.mock.calls.find(([event]) => event === 'SIGINT');
      const handler = sigintCall?.[1] as (() => void) | undefined;
      expect(handler).toBeDefined();
      handler!();

      // Let the tick loop's setTimeout fire deterministically (no real wait).
      await vi.advanceTimersByTimeAsync(1000);
      await runPromise;

      expect(process.listenerCount('SIGINT')).toBe(baseline);
    } finally {
      onSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
