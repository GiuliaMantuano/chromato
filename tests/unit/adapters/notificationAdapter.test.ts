/**
 * Unit tests: NotificationAdapter (adapter boundary) — fix-macos-notification-silent
 *
 * Architecture: NotificationAdapter is the driven external port for OS desktop
 * notifications. It is faked in all tests via an injected command-runner seam.
 * The seam is the DELIVER requirement: the adapter must accept an optional
 * CommandRunner parameter so tests can capture what command+args were requested
 * and simulate success or failure without spawning real OS processes.
 *
 * Testability seam contract (DELIVER requirement — see acceptance-design.md):
 *
 *   interface CommandRunner {
 *     run(command: string, args: string[]): Promise<{ exitCode: number }>;
 *   }
 *
 *   class NotificationAdapter implements NotificationPort {
 *     constructor(numbers: NotificationCopyNumbers, runner?: CommandRunner) {}
 *     // ...
 *   }
 *
 * CONTRACT UPDATE (notification-branding — design/upstream-changes.md (e)):
 *   The terse phaseLabel copy ("Work complete -- starting Short Break", app name
 *   "chromato") and the 1-arg ctor `(runner?)` are RETIRED. The adapter now takes
 *   resolved copy numbers FIRST and an optional runner SECOND, and emits the warm
 *   D3 copy (discuss/starting-decisions.md D3 / notificationCopy.test.ts). These
 *   B-series assertions are updated to the NEW contract — this is the authorized
 *   supersession per upstream-changes (e), NOT test-weakening. The STRUCTURAL
 *   intent (delivery mechanism, platform branch, bell fallback, no-spawn-when-
 *   headless) is preserved; only copy-string and ctor-arity expectations change.
 *
 * The constructor default (no runner arg) uses a real child_process spawn.
 * Tests inject a FakeCommandRunner to capture calls and simulate failures.
 *
 * Test Budget: 10 distinct behaviors
 *   B1 (kept): bell fires on phase change when NODE_ENV=test (existing, still valid)
 *   B2 (kept): bell fires on overdue notification when NODE_ENV=test (existing, still valid)
 *   B3 (NEW):  on macOS, notifyPhaseChange requests osascript with the warm D3 copy
 *   B4 (NEW):  on macOS, notifyOverdue requests osascript with the warm D3 overdue copy
 *   B5 (NEW):  on Linux, notifyPhaseChange requests notify-send with the warm D3 copy
 *   B6 (NEW):  on Linux, notifyOverdue requests notify-send with the warm D3 overdue copy
 *   B7 (NEW):  when command runner fails (non-zero exit), bell fires as fallback
 *   B8 (NEW):  when command runner throws, bell fires as fallback
 *   B9 (NEW):  on unsupported platform, bell fires instead of attempting a command
 *   B10 (NEW): notifyPhaseChange copy reflects the from→to phase transition correctly
 *
 * RED classification (all B3–B10 fail against current adapter for the right reason):
 *   B3/B4/B5/B6: MISSING_FUNCTIONALITY — adapter uses 1-arg ctor + terse phaseLabel
 *                copy, not the 2-arg ctor + warm D3 copy these specs require
 *   B7/B8: MISSING_FUNCTIONALITY — bell fallback against the 2-arg ctor seam
 *   B9: MISSING_FUNCTIONALITY — unsupported platform path against the 2-arg ctor
 *   B10: MISSING_FUNCTIONALITY — warm D3 transition copy not present in current adapter
 *
 * B3–B10 are marked it.skip pending DELIVER implementation of the 2-arg ctor seam.
 * B1/B2 remain enabled (they pass on current code and must stay green after the fix).
 *
 * Note on Linux scenarios (B5/B6): notify-send behavior is community-validated,
 * unverified by maintainer. The seam tests verify that the adapter *requests* the
 * correct command; actual delivery on a live Linux desktop is outside test scope.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotificationAdapter,
  type CommandRunner,
} from '../../../src/adapters/notificationAdapter.js';
import type { NotificationCopyNumbers } from '../../../src/domain/notificationCopy.js';

// ---------------------------------------------------------------------------
// FakeCommandRunner — the injected seam double
//
// DELIVER will create this as a first-class type alongside the CommandRunner
// interface in notificationAdapter.ts (or a shared test helper). It is defined
// inline here so the test file is self-contained at RED stage.
//
// Contract: every run() call is recorded in `calls`. The `nextExitCode` field
// controls the simulated outcome (0 = success, non-zero = failure).
// The `shouldThrow` flag simulates a spawn error (command not found, EPERM, etc.).
// ---------------------------------------------------------------------------

interface CommandCall {
  command: string;
  args: string[];
}

class FakeCommandRunner {
  readonly calls: CommandCall[] = [];
  nextExitCode = 0;
  shouldThrow = false;

  async run(command: string, args: string[]): Promise<{ exitCode: number }> {
    this.calls.push({ command, args });
    if (this.shouldThrow) {
      throw new Error('spawn error: ENOENT');
    }
    return { exitCode: this.nextExitCode };
  }
}

// Resolved copy numbers — the PRECONDITION (input state), never the expected output.
// Match the shape the committed notificationBranding.test.ts uses (numbers first).
const NUMBERS: NotificationCopyNumbers = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cycleCount: 4,
};

// The adapter is constructed with (numbers, runner). `as never` mirrors the seam-test
// style while the 2-arg constructor (introduced by DELIVER step 02-01) is being adopted.
function makeAdapter(runner: CommandRunner): NotificationAdapter {
  return new NotificationAdapter(NUMBERS as never, runner as never);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function captureStderr(): { hasBell: () => boolean; restore: () => void } {
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  return {
    hasBell: () => spy.mock.calls.some((args) => String(args[0]).includes('\x07')),
    restore: () => spy.mockRestore(),
  };
}

// ---------------------------------------------------------------------------
// B1/B2 — existing green tests (NODE_ENV=test bell path)
// These MUST remain green after the fix. They document the baseline bell contract.
// ---------------------------------------------------------------------------

describe('NotificationAdapter — bell fallback in test environment (B1, B2)', () => {
  let origNodeEnv: string | undefined;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    vi.restoreAllMocks();
  });

  // B1: kept from original test suite (bell intent unchanged; ctor updated to 2-arg
  // so the file is type-correct against the target signature — the headless bell
  // path ignores the runner).
  it('B1: writes bell to stderr on notifyPhaseChange when running in test environment', () => {
    const { hasBell, restore } = captureStderr();
    const adapter = makeAdapter(new FakeCommandRunner() as never);

    adapter.notifyPhaseChange('WORK', 'BREAK');

    expect(hasBell()).toBe(true);
    restore();
  });

  // B2: kept from original test suite
  it('B2: writes bell to stderr on notifyOverdue when running in test environment', () => {
    const { hasBell, restore } = captureStderr();
    const adapter = makeAdapter(new FakeCommandRunner() as never);

    adapter.notifyOverdue();

    expect(hasBell()).toBe(true);
    restore();
  });
});

// ---------------------------------------------------------------------------
// B3/B4 — macOS: osascript command is requested with correct args
//
// RED: fails because NotificationAdapter does not accept a runner and does not
// route to osascript. DELIVER must implement the runner seam and platform branch.
// ---------------------------------------------------------------------------

describe('NotificationAdapter — macOS native notification (B3, B4) [pending runner seam]', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    // Clear test environment so production notify path is exercised
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    // Simulate darwin platform
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  // B3: macOS phase change → osascript requested with the warm D3 WORK→BREAK copy
  it('B3: requests osascript for phase change from WORK to BREAK on macOS', async () => {
    const runner = new FakeCommandRunner();
    const adapter = makeAdapter(runner);

    adapter.notifyPhaseChange('WORK', 'BREAK');

    // Allow async runner to settle if the implementation is async
    await new Promise((r) => setTimeout(r, 0));

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('osascript');
    // Args must include the display notification AppleScript expression (structural intent)
    const scriptArg = runner.calls[0]!.args.join(' ');
    expect(scriptArg).toContain('display notification');
    // Warm D3 copy (WORK → short BREAK), replacing the retired terse phaseLabel copy
    expect(scriptArg).toContain('Pomodoro complete');
    expect(scriptArg).toContain('Time for a 5-minute break.');
  });

  // B4: macOS overdue → osascript requested with the warm D3 overdue copy
  it('B4: requests osascript for overdue notification on macOS', async () => {
    const runner = new FakeCommandRunner();
    const adapter = makeAdapter(runner);

    adapter.notifyOverdue();

    await new Promise((r) => setTimeout(r, 0));

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('osascript');
    const scriptArg = runner.calls[0]!.args.join(' ');
    expect(scriptArg).toContain('display notification');
    // Warm D3 overdue copy, replacing the retired terse "Break time is over" copy
    expect(scriptArg).toContain('Break ran over');
    expect(scriptArg).toContain('Ready to focus again?');
  });
});

// ---------------------------------------------------------------------------
// B5/B6 — Linux: notify-send command is requested with correct args
//
// RED: fails because NotificationAdapter does not accept a runner and has no
// notify-send branch. DELIVER must implement both.
//
// Note: Linux delivery is community-validated / unverified by maintainer.
// The seam tests verify the adapter *requests* the correct command; actual
// desktop delivery is outside test scope.
// ---------------------------------------------------------------------------

describe('NotificationAdapter — Linux native notification (B5, B6) [pending runner seam]', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    // Set DISPLAY so the adapter does not short-circuit to headless path
    process.env['DISPLAY'] = ':0';
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    delete process.env['DISPLAY'];
    vi.restoreAllMocks();
  });

  // B5: Linux phase change → notify-send requested with the warm D3 copy
  it('B5: requests notify-send for phase change from WORK to BREAK on Linux', async () => {
    const runner = new FakeCommandRunner();
    const adapter = makeAdapter(runner);

    adapter.notifyPhaseChange('WORK', 'BREAK');

    await new Promise((r) => setTimeout(r, 0));

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('notify-send');
    // notify-send carries the warm D3 copy as unescaped execFile args[] (title + body).
    // Exact arg positions are the crafter's detail (an -i <icon> arg also appears on
    // this path per AC-NB-03.1a) — assert presence, not fixed indices.
    const args = runner.calls[0]!.args;
    expect(args).toContain('Pomodoro complete 🍅');
    expect(args).toContain('Time for a 5-minute break.');
  });

  // B6: Linux overdue → notify-send requested with the warm D3 overdue copy
  it('B6: requests notify-send for overdue notification on Linux', async () => {
    const runner = new FakeCommandRunner();
    const adapter = makeAdapter(runner);

    adapter.notifyOverdue();

    await new Promise((r) => setTimeout(r, 0));

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('notify-send');
    const args = runner.calls[0]!.args;
    expect(args).toContain('Break ran over');
    expect(args).toContain('Ready to focus again?');
  });
});

// ---------------------------------------------------------------------------
// B7/B8 — Bell fires as fallback when command runner fails or throws
//
// RED: fails because the current adapter's bell fallback is dead code —
// node-notifier's failure path is a callback that is never passed.
// DELIVER must wire: runner.run() non-zero exit → bell(); runner throws → bell().
// ---------------------------------------------------------------------------

describe('NotificationAdapter — bell fallback on command failure (B7, B8) [pending runner seam]', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  // B7: command exits with non-zero code → bell fires, no silent failure
  it('B7: writes bell to stderr when command runner exits with non-zero code', async () => {
    const runner = new FakeCommandRunner();
    runner.nextExitCode = 1; // simulate osascript/notify-send failure

    const { hasBell, restore } = captureStderr();
    const adapter = makeAdapter(runner);

    adapter.notifyPhaseChange('WORK', 'BREAK');

    await new Promise((r) => setTimeout(r, 10));

    expect(hasBell()).toBe(true);
    restore();
  });

  // B8: command runner throws (ENOENT, EPERM, etc.) → bell fires, no silent failure
  it('B8: writes bell to stderr when command runner throws a spawn error', async () => {
    const runner = new FakeCommandRunner();
    runner.shouldThrow = true;

    const { hasBell, restore } = captureStderr();
    const adapter = makeAdapter(runner);

    adapter.notifyPhaseChange('WORK', 'BREAK');

    await new Promise((r) => setTimeout(r, 10));

    expect(hasBell()).toBe(true);
    restore();
  });
});

// ---------------------------------------------------------------------------
// B9 — Unsupported platform falls through to bell (no command attempted)
//
// RED: fails because the current adapter has no platform dispatch at all.
// DELIVER must add: platform === 'win32' (or unknown) → bell directly.
// ---------------------------------------------------------------------------

describe('NotificationAdapter — unsupported platform falls back to bell (B9) [pending runner seam]', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  it('B9: writes bell to stderr on unsupported platform without invoking command runner', async () => {
    const runner = new FakeCommandRunner();

    const { hasBell, restore } = captureStderr();
    const adapter = makeAdapter(runner);

    adapter.notifyPhaseChange('WORK', 'BREAK');

    await new Promise((r) => setTimeout(r, 10));

    expect(hasBell()).toBe(true);
    // No command was attempted — unsupported platform routes directly to bell
    expect(runner.calls).toHaveLength(0);
    restore();
  });
});

// ---------------------------------------------------------------------------
// B10 — Phase labels in notification message are correct for all phase pairs
//
// RED: fails because runner seam does not exist. Once DELIVER implements the
// seam, this verifies that phase label mapping is correct end-to-end.
// ---------------------------------------------------------------------------

describe('NotificationAdapter — phase label correctness in notification message (B10) [pending runner seam]', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  // Each transition moment maps to its warm D3 title + body (the from→to transition
  // is reflected in the chosen copy, replacing the retired phaseLabel mapping).
  // LONG_BREAK→WORK is break-agnostic — it shares the "Break’s over" copy with
  // short BREAK→WORK (matching notificationCopy.test.ts).
  it.each([
    ['WORK', 'BREAK', 'Pomodoro complete 🍅', 'Time for a 5-minute break.'],
    ['WORK', 'LONG_BREAK', '4 pomodoros done 🎉', 'Take a proper 15-minute break.'],
    ['BREAK', 'WORK', 'Break’s over', 'Back to focus for a 25-minute block.'],
    ['LONG_BREAK', 'WORK', 'Break’s over', 'Back to focus for a 25-minute block.'],
  ] as const)('B10: notifyPhaseChange(%s → %s) message contains the warm D3 copy "%s" / "%s"', async (from, to, title, body) => {
    const runner = new FakeCommandRunner();
    const adapter = makeAdapter(runner);

    adapter.notifyPhaseChange(from, to);

    await new Promise((r) => setTimeout(r, 0));

    const scriptArg = runner.calls[0]?.args.join(' ') ?? '';
    expect(scriptArg).toContain(title);
    expect(scriptArg).toContain(body);
  });
});
