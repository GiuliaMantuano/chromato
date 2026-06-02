/**
 * NotificationAdapter: driven port adapter for desktop notifications.
 *
 * Implements NotificationPort using native per-platform OS commands under ADR-016
 * Option C (zero new dependencies — platform-gated dispatch, NOT an availability
 * probe):
 *   - Linux  (process.platform === 'linux', DISPLAY set):
 *       `notify-send -i <…/icon-timer-ring.png> "<title>" "<body>"`
 *       — title/body passed as separate execFile args[] (NO shell, NO escaping).
 *   - macOS  (process.platform === 'darwin'):
 *       `osascript -e 'display notification "<body>" with title "<title>"'`
 *       — title/body are backslash-escaped (escapeForAppleScript) because they are
 *       interpolated into a double-quoted AppleScript string literal. NO custom-icon
 *       argument (osascript cannot set one).
 *   - any other platform / headless / NODE_ENV=test / command failure / spawn error:
 *       terminal bell (BEL on stderr).
 *
 * The bell fallback fires when:
 *   - NODE_ENV is 'test'
 *   - The DISPLAY environment variable is unset on Linux (headless / server)
 *   - The platform is unsupported (not darwin, not linux)
 *   - The notification command exits non-zero OR the spawn throws
 *
 * Branded copy (US-NB / D3) is resolved via resolveCopy(moment, numbers): the
 * adapter receives the resolved copy NUMBERS (work/break/longBreak minutes + cycle
 * count) at construction (decision 7, mirrors TuiAdapter(resolvedPalette)) and maps
 * each notification moment to its warm-voice title/body. The terse phaseLabel copy
 * and the 1-arg ctor are RETIRED (design/upstream-changes.md (e)).
 *
 * Testability seam (ADR-010 / DISTILL acceptance-design):
 *   The adapter accepts an injectable CommandRunner so tests can capture the
 *   requested command + args and simulate success/failure without spawning real
 *   OS processes. The default production runner uses child_process.execFile.
 *
 * Async contract: notifyPhaseChange / notifyOverdue / notifySessionComplete are
 * synchronous (void) from the application layer's perspective. The command runs
 * fire-and-forget; its promise is consumed internally with a .catch so the tick
 * loop never stalls and no rejection escapes the adapter.
 */

import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import type { NotificationPort } from '../domain/ports.js';
import type { PomodoroPhase } from '../domain/phase.js';
import {
  resolveCopy,
  type NotificationCopy,
  type NotificationCopyNumbers,
  type NotificationMoment,
} from '../domain/notificationCopy.js';

export interface CommandRunner {
  run(command: string, args: string[]): Promise<{ exitCode: number }>;
}

/**
 * Absolute path to the single static timer-ring icon (ADR-016 / AC-NB-03.2).
 * Resolved from this module's location so it works under `dist/` and dev `tsx`:
 * package-root/assets/icon-timer-ring.png.
 */
const TIMER_RING_ICON_PATH = fileURLToPath(
  new URL('../../assets/icon-timer-ring.png', import.meta.url),
);

/**
 * Default production runner: spawns the command via child_process.execFile.
 * A non-zero exit resolves with that exit code; a spawn error rejects (which the
 * adapter treats as a failure → bell).
 */
class SpawnCommandRunner implements CommandRunner {
  run(command: string, args: string[]): Promise<{ exitCode: number }> {
    return new Promise((resolve, reject) => {
      execFile(command, args, (error) => {
        if (error) {
          // execFile sets error.code to the process exit code for non-zero
          // exits, or to a string (e.g. 'ENOENT') for spawn failures.
          const code = (error as NodeJS.ErrnoException).code;
          if (typeof code === 'number') {
            resolve({ exitCode: code });
            return;
          }
          reject(error);
          return;
        }
        resolve({ exitCode: 0 });
      });
    });
  }
}

function isHeadlessEnvironment(): boolean {
  if (process.env['NODE_ENV'] === 'test') {
    return true;
  }
  // On Linux, DISPLAY must be set for GUI notifications
  const display = process.env['DISPLAY'];
  const isLinux = process.platform === 'linux';
  if (isLinux && (!display || display.trim() === '')) {
    return true;
  }
  return false;
}

function bell(): void {
  process.stderr.write('\x07');
}

/**
 * Neutralize characters that would break out of the osascript double-quoted
 * string literal (ADR-010 / C-NB-3 residual risk). Backslashes are escaped first,
 * then double quotes. Applied ONLY on the osascript path to RESOLVED dynamic copy,
 * so future/forced dynamic content cannot inject AppleScript. The notify-send path
 * passes args via execFile[] (no shell) and is NEVER escaped.
 */
function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export class NotificationAdapter implements NotificationPort {
  private readonly numbers: NotificationCopyNumbers;
  private readonly runner: CommandRunner;

  constructor(numbers: NotificationCopyNumbers, runner: CommandRunner = new SpawnCommandRunner()) {
    this.numbers = numbers;
    this.runner = runner;
  }

  notifyPhaseChange(from: PomodoroPhase, to: PomodoroPhase): void {
    this.deliver({ kind: 'PHASE_CHANGE', from, to });
  }

  notifyOverdue(): void {
    this.deliver({ kind: 'OVERDUE' });
  }

  notifySessionComplete(focusedMinutes: number): void {
    this.deliver({ kind: 'SESSION_COMPLETE', focusedMinutes });
  }

  /**
   * Headless/test check FIRST → bell (no spawn). Otherwise resolve the branded
   * copy and dispatch via the platform branch. Fire-and-forget: the promise is
   * consumed with .catch(bell) so no rejection escapes.
   */
  private deliver(moment: NotificationMoment): void {
    if (isHeadlessEnvironment()) {
      bell();
      return;
    }
    const copy = resolveCopy(moment, this.numbers);
    void this.dispatch(copy).catch(() => {
      bell();
    });
  }

  private async dispatch(copy: NotificationCopy): Promise<void> {
    if (process.platform === 'darwin') {
      await this.dispatchDarwin(copy);
      return;
    }
    if (process.platform === 'linux') {
      await this.dispatchLinux(copy);
      return;
    }
    bell();
  }

  private async dispatchDarwin(copy: NotificationCopy): Promise<void> {
    const title = escapeForAppleScript(copy.title);
    const body = escapeForAppleScript(copy.body);
    const script = `display notification "${body}" with title "${title}"`;
    const result = await this.runner.run('osascript', ['-e', script]);
    if (result.exitCode !== 0) {
      bell();
    }
  }

  private async dispatchLinux(copy: NotificationCopy): Promise<void> {
    // notify-send args[] via execFile — NO shell, NO escaping (C-NB-3 / HIGH-3).
    const result = await this.runner.run('notify-send', [
      '-i',
      TIMER_RING_ICON_PATH,
      copy.title,
      copy.body,
    ]);
    if (result.exitCode !== 0) {
      bell();
    }
  }
}
