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
 *     constructor(private readonly runner?: CommandRunner) {}
 *     // ...
 *   }
 *
 * The constructor default (no runner arg) uses a real child_process spawn.
 * Tests inject a FakeCommandRunner to capture calls and simulate failures.
 *
 * Test Budget: 10 distinct behaviors
 *   B1 (kept): bell fires on phase change when NODE_ENV=test (existing, still valid)
 *   B2 (kept): bell fires on overdue notification when NODE_ENV=test (existing, still valid)
 *   B3 (NEW):  on macOS, notifyPhaseChange requests osascript with correct title and message
 *   B4 (NEW):  on macOS, notifyOverdue requests osascript with correct title and message
 *   B5 (NEW):  on Linux, notifyPhaseChange requests notify-send with correct title and message
 *   B6 (NEW):  on Linux, notifyOverdue requests notify-send with correct title and message
 *   B7 (NEW):  when command runner fails (non-zero exit), bell fires as fallback
 *   B8 (NEW):  when command runner throws, bell fires as fallback
 *   B9 (NEW):  on unsupported platform, bell fires instead of attempting a command
 *   B10 (NEW): notifyPhaseChange message reflects the from→to phase transition correctly
 *
 * RED classification (all B3–B10 fail against current adapter for the right reason):
 *   B3/B4/B5/B6: MISSING_FUNCTIONALITY — adapter uses node-notifier, not injected runner
 *   B7/B8: MISSING_FUNCTIONALITY — bell fallback is dead code (node-notifier callback never called)
 *   B9: MISSING_FUNCTIONALITY — unsupported platform path does not exist
 *   B10: MISSING_FUNCTIONALITY — runner seam not present, message correctness untestable
 *
 * B3–B10 are marked it.skip pending DELIVER implementation of the runner seam.
 * B1/B2 remain enabled (they pass on current code and must stay green after the fix).
 *
 * Note on Linux scenarios (B5/B6): notify-send behavior is community-validated,
 * unverified by maintainer. The seam tests verify that the adapter *requests* the
 * correct command; actual delivery on a live Linux desktop is outside test scope.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationAdapter } from '../../../src/adapters/notificationAdapter.js';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function captureStderr(): { hasBell: () => boolean; restore: () => void } {
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  return {
    hasBell: () => spy.mock.calls.some((args) => String(args[0]).includes('')),
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

  // B1: kept from original test suite
  it('B1: writes bell to stderr on notifyPhaseChange when running in test environment', () => {
    const { hasBell, restore } = captureStderr();
    const adapter = new NotificationAdapter();

    adapter.notifyPhaseChange('WORK', 'BREAK');

    expect(hasBell()).toBe(true);
    restore();
  });

  // B2: kept from original test suite
  it('B2: writes bell to stderr on notifyOverdue when running in test environment', () => {
    const { hasBell, restore } = captureStderr();
    const adapter = new NotificationAdapter();

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

describe.skip('NotificationAdapter — macOS native notification (B3, B4) [pending runner seam]', () => {
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

  // B3: macOS phase change → osascript requested with title "chromato" and correct message
  it('B3: requests osascript for phase change from WORK to BREAK on macOS', async () => {
    const runner = new FakeCommandRunner();
    // DELIVER: NotificationAdapter constructor must accept runner as optional param
    const adapter = new NotificationAdapter(runner as never);

    adapter.notifyPhaseChange('WORK', 'BREAK');

    // Allow async runner to settle if the implementation is async
    await new Promise((r) => setTimeout(r, 0));

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('osascript');
    // Args must include the display notification AppleScript expression
    const scriptArg = runner.calls[0]!.args.join(' ');
    expect(scriptArg).toContain('display notification');
    expect(scriptArg).toContain('chromato');
    // Message must name both phases
    expect(scriptArg).toContain('Work');
    expect(scriptArg).toContain('Short Break');
  });

  // B4: macOS overdue → osascript requested with overdue message
  it('B4: requests osascript for overdue notification on macOS', async () => {
    const runner = new FakeCommandRunner();
    const adapter = new NotificationAdapter(runner as never);

    adapter.notifyOverdue();

    await new Promise((r) => setTimeout(r, 0));

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('osascript');
    const scriptArg = runner.calls[0]!.args.join(' ');
    expect(scriptArg).toContain('display notification');
    expect(scriptArg).toContain('chromato');
    // Message must mention break / overdue context
    expect(scriptArg.toLowerCase()).toMatch(/break|overdue/);
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

describe.skip('NotificationAdapter — Linux native notification (B5, B6) [pending runner seam]', () => {
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

  // B5: Linux phase change → notify-send requested with title and message
  it('B5: requests notify-send for phase change from WORK to BREAK on Linux', async () => {
    const runner = new FakeCommandRunner();
    const adapter = new NotificationAdapter(runner as never);

    adapter.notifyPhaseChange('WORK', 'BREAK');

    await new Promise((r) => setTimeout(r, 0));

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('notify-send');
    // notify-send "<title>" "<message>": args[0]=title, args[1]=message
    expect(runner.calls[0]!.args[0]).toBe('chromato');
    expect(runner.calls[0]!.args[1]).toContain('Work');
    expect(runner.calls[0]!.args[1]).toContain('Short Break');
  });

  // B6: Linux overdue → notify-send requested
  it('B6: requests notify-send for overdue notification on Linux', async () => {
    const runner = new FakeCommandRunner();
    const adapter = new NotificationAdapter(runner as never);

    adapter.notifyOverdue();

    await new Promise((r) => setTimeout(r, 0));

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('notify-send');
    expect(runner.calls[0]!.args[0]).toBe('chromato');
    expect(runner.calls[0]!.args[1]!.toLowerCase()).toMatch(/break|overdue/);
  });
});

// ---------------------------------------------------------------------------
// B7/B8 — Bell fires as fallback when command runner fails or throws
//
// RED: fails because the current adapter's bell fallback is dead code —
// node-notifier's failure path is a callback that is never passed.
// DELIVER must wire: runner.run() non-zero exit → bell(); runner throws → bell().
// ---------------------------------------------------------------------------

describe.skip('NotificationAdapter — bell fallback on command failure (B7, B8) [pending runner seam]', () => {
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
    const adapter = new NotificationAdapter(runner as never);

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
    const adapter = new NotificationAdapter(runner as never);

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

describe.skip('NotificationAdapter — unsupported platform falls back to bell (B9) [pending runner seam]', () => {
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
    const adapter = new NotificationAdapter(runner as never);

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

describe.skip('NotificationAdapter — phase label correctness in notification message (B10) [pending runner seam]', () => {
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

  it.each([
    ['WORK', 'BREAK', 'Work', 'Short Break'],
    ['WORK', 'LONG_BREAK', 'Work', 'Long Break'],
    ['BREAK', 'WORK', 'Short Break', 'Work'],
    ['LONG_BREAK', 'WORK', 'Long Break', 'Work'],
  ] as const)(
    'B10: notifyPhaseChange(%s → %s) message contains "%s" and "%s"',
    async (from, to, fromLabel, toLabel) => {
      const runner = new FakeCommandRunner();
      const adapter = new NotificationAdapter(runner as never);

      adapter.notifyPhaseChange(from, to);

      await new Promise((r) => setTimeout(r, 0));

      const scriptArg = runner.calls[0]?.args.join(' ') ?? '';
      expect(scriptArg).toContain(fromLabel);
      expect(scriptArg).toContain(toLabel);
    },
  );
});
