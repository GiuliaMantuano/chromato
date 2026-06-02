/**
 * Regression test: silent notification failure (fix-macos-notification-silent)
 *
 * Root cause: NotificationAdapter.sendNotification() wraps node-notifier's
 * notify() in a try/catch with NO callback. node-notifier reports failures
 * via a callback it never received — so any notification failure produces
 * no banner AND no bell (total silence). The bell fallback is dead code.
 *
 * On macOS 14+ (Darwin 25+), node-notifier's bundled terminal-notifier uses
 * NSUserNotificationCenter (removed in macOS 14) — the call returns success
 * but never shows a banner ("ghost delivery"). node-notifier cannot detect
 * this, so the try/catch never fires, and the bell never rings.
 *
 * Invariant under test (the bug reproduced as a RED test):
 *   When the notification command fails, the user hears a terminal bell.
 *   No failure must be silent.
 *
 * Failure mode (current code):
 *   The bell fallback is inside a try/catch that never fires because
 *   node-notifier swallows errors via an uncalled callback. The adapter
 *   exposes no injectable seam so this cannot be tested without real OS
 *   side effects. After the fix, the bell fires deterministically when the
 *   injected runner reports failure.
 *
 * Test Budget: 2 regression scenarios
 *   R1: command failure → bell fires (not silent) — the core regression
 *   R2: notifyOverdue command failure → bell fires (not silent)
 *
 * Both tests are RED against the current adapter for the right reason:
 *   MISSING_FUNCTIONALITY — the injectable runner seam does not exist yet.
 *   Classification: RED (not BROKEN) once DELIVER adds the seam.
 *
 * These are marked it.skip until DELIVER unskips them one at a time.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotificationAdapter,
  type CommandRunner,
} from '../../../src/adapters/notificationAdapter.js';
import type { NotificationCopyNumbers } from '../../../src/domain/notificationCopy.js';

// ---------------------------------------------------------------------------
// FakeCommandRunner (same seam contract as unit tests)
// Once DELIVER extracts this to a shared helper, both test files import it.
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
      throw new Error('spawn error: command not found');
    }
    return { exitCode: this.nextExitCode };
  }
}

// Resolved copy numbers — the PRECONDITION (input state). The 1-arg ctor (runner?)
// is RETIRED (design/upstream-changes.md (e)); the adapter now takes numbers first,
// runner second. These regression scenarios assert the BELL fallback only (never the
// copy text), so only the ctor arity changes — the regression intent (no silent
// failure) is unchanged.
const NUMBERS: NotificationCopyNumbers = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cycleCount: 4,
};

function makeAdapter(runner: CommandRunner): NotificationAdapter {
  return new NotificationAdapter(NUMBERS as never, runner as never);
}

// ---------------------------------------------------------------------------
// Regression tests
//
// These tests fail against current code because the seam does not exist.
// They classify as RED (not BROKEN) once the seam is introduced, and go
// GREEN when the bell-on-failure logic is wired.
// ---------------------------------------------------------------------------

describe('Regression: bell fires when notification command fails (R1, R2) [pending runner seam]', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    // Use darwin so the macOS branch is exercised (most likely failure platform)
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  // R1: bell fires when osascript exits non-zero (macOS ghost delivery / permission denied)
  it('R1: bell fires on stderr when osascript command exits with a non-zero code', async () => {
    const runner = new FakeCommandRunner();
    runner.nextExitCode = 1; // osascript failure (e.g. permission denied, no notification center)

    const stderrWrites: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrWrites.push(String(chunk));
      return true;
    });

    // DELIVER: NotificationAdapter takes (numbers, runner?) per upstream-changes (e)
    const adapter = makeAdapter(runner);
    adapter.notifyPhaseChange('WORK', 'BREAK');

    // Allow async runner to settle
    await new Promise((r) => setTimeout(r, 10));

    const hasBell = stderrWrites.some((s) => s.includes('\x07'));
    expect(hasBell).toBe(true);
    spy.mockRestore();
  });

  // R2: bell fires on notifyOverdue when command fails (overdue is equally important)
  it('R2: bell fires on stderr when notification command fails during overdue notification', async () => {
    const runner = new FakeCommandRunner();
    runner.nextExitCode = 127; // command not found

    const stderrWrites: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrWrites.push(String(chunk));
      return true;
    });

    const adapter = makeAdapter(runner);
    adapter.notifyOverdue();

    await new Promise((r) => setTimeout(r, 10));

    const hasBell = stderrWrites.some((s) => s.includes('\x07'));
    expect(hasBell).toBe(true);
    spy.mockRestore();
  });
});
