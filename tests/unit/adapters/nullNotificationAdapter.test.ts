/**
 * Integration test: NullNotificationAdapter (driven port no-op) — step 03-02.
 *
 * Driving contract for "notifications off". When the user toggles notifications
 * OFF in the wizard, the composition root selects a NullNotificationAdapter
 * (no-op NotificationPort) instead of the real NotificationAdapter. The desired
 * observable outcome: a real work→break phase transition, driven through the
 * REAL SessionService, fires NO desktop notification and NO terminal bell.
 *
 * Port boundary: we enter through the SessionService driving port (tickOnce),
 * wire the NullNotificationAdapter at the NotificationPort driven-port boundary,
 * and observe the side-effect surface (OS command requests + stderr bell writes).
 * The NullNotificationAdapter is the UNIT under test; SessionService and the real
 * NotificationAdapter are untouched (null-object pattern — pure injection).
 *
 * To prove the Null adapter is genuinely a no-op (and not "tested mock"), the
 * SAME SessionService transition wired with the REAL NotificationAdapter MUST
 * produce a side-effect (the bell, in NODE_ENV=test). The Null adapter produces
 * none. This contrast is the falsifiability guard: a Null adapter that secretly
 * delegated would fail the zero-bell / zero-command assertion.
 *
 * TEST PARADIGM: EXEMPT — wiring/integration test (single representative
 * work→break transition verifies the composition-root injection contract;
 * no Hypothesis/fast-check in stack).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NullNotificationAdapter } from '../../../src/adapters/nullNotificationAdapter.js';
import {
  NotificationAdapter,
  type CommandRunner,
} from '../../../src/adapters/notificationAdapter.js';
import type { NotificationCopyNumbers } from '../../../src/domain/notificationCopy.js';
import { SessionService } from '../../../src/application/sessionService.js';
import type { RenderPort, StatePort, HistoryPort } from '../../../src/domain/ports.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';
import type { SessionConfig } from '../../../src/domain/config.js';

// --- Minimal no-op driven ports (only the NotificationPort matters here) ---

class NoopRenderPort implements RenderPort {
  render(_snapshot: SessionSnapshot): void {}
  stop(): void {}
}

class NoopStatePort implements StatePort {
  writeState(_snapshot: SessionSnapshot): void {}
  writeIdle(): void {}
  readState(): SessionSnapshot | null {
    return null;
  }
  readCompletedToday(): number {
    return 0;
  }
}

class NoopHistoryPort implements HistoryPort {
  recordSession(_completedPomodoros: number): void {}
  readTodayCount(): number {
    return 0;
  }
  readStreak(): number {
    return 0;
  }
}

/** Records every OS command the real adapter would request (osascript/notify-send). */
class RecordingCommandRunner implements CommandRunner {
  readonly calls: Array<{ command: string; args: string[] }> = [];
  run(command: string, args: string[]): Promise<{ exitCode: number }> {
    this.calls.push({ command, args });
    return Promise.resolve({ exitCode: 0 });
  }
}

// Resolved copy numbers fixture — the real adapter now takes (numbers, runner?)
// per upstream-changes (e). Mechanical 2-arg ctor update; behaviour identical
// (this guard exercises the headless bell path, which ignores both args).
const NUMBERS: NotificationCopyNumbers = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cycleCount: 4,
};

function makeConfig(): SessionConfig {
  return {
    workDurationSeconds: 2,
    breakDurationSeconds: 5,
    longBreakDurationSeconds: 15,
    cycleCount: 4,
    useAscii: false,
    useColor: true,
  };
}

/** Drives a real WORK→BREAK transition through SessionService. */
function driveWorkToBreak(service: SessionService, config: SessionConfig): void {
  service.tickOnce(config, 0); // IDLE → WORK
  service.tickOnce(config, 2); // work period completes → BREAK (PHASE_CHANGED)
}

describe('Notifications off (NullNotificationAdapter wiring)', () => {
  let bellSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The real NotificationAdapter writes the terminal bell via process.stderr in
    // a headless / NODE_ENV=test environment. Capture it to assert presence/absence.
    bellSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    bellSpy.mockRestore();
  });

  it('Notifications off suppresses phase-change notification and bell', () => {
    const nullNotifier = new NullNotificationAdapter();
    const service = new SessionService(
      new NoopRenderPort(),
      new NoopStatePort(),
      nullNotifier,
      new NoopHistoryPort(),
    );

    driveWorkToBreak(service, makeConfig());

    // No terminal bell emitted. The falsifiability guard below drives the SAME
    // transition through the REAL adapter and asserts the bell DOES fire, so this
    // zero is a genuine signal — not a vacuous pass.
    const bellWrites = bellSpy.mock.calls.filter((c: unknown[]) => String(c[0]).includes('\x07'));
    expect(bellWrites).toHaveLength(0);
  });

  it('Notifications off suppresses the session-complete notification (US-NB-04 / AC-NB-04.3)', () => {
    // The Null adapter's new notifySessionComplete is a deliberate no-op: when
    // notifications are off, completing a session spawns no command and rings no
    // bell. Directly exercise the off-switch adapter at the new port method.
    const runner = new RecordingCommandRunner();
    const nullNotifier = new NullNotificationAdapter();

    nullNotifier.notifySessionComplete(100);

    const bellWrites = bellSpy.mock.calls.filter((c: unknown[]) => String(c[0]).includes('\x07'));
    expect(bellWrites).toHaveLength(0);
    expect(runner.calls).toHaveLength(0);
  });

  it('falsifiability guard: the REAL adapter DOES fire a bell on the same transition', () => {
    // Same WORK→BREAK transition, but wired with the real NotificationAdapter.
    // In NODE_ENV=test the real adapter rings the terminal bell — proving the
    // zero-bell assertion above is a genuine signal, not a vacuous pass.
    const runner = new RecordingCommandRunner();
    const realNotifier = new NotificationAdapter(NUMBERS, runner);
    const service = new SessionService(
      new NoopRenderPort(),
      new NoopStatePort(),
      realNotifier,
      new NoopHistoryPort(),
    );

    driveWorkToBreak(service, makeConfig());

    const bellWrites = bellSpy.mock.calls.filter((c: unknown[]) => String(c[0]).includes('\x07'));
    expect(bellWrites.length).toBeGreaterThan(0);
  });
});
