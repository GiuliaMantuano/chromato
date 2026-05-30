/**
 * NotificationAdapter: driven port adapter for desktop notifications.
 *
 * Implements NotificationPort using native per-platform OS commands (ADR-010):
 *   - macOS (darwin): `osascript -e 'display notification "<msg>" with title "<title>"'`
 *   - Linux:          `notify-send "<title>" "<message>"`
 *   - any other / failure / headless: terminal bell ( on stderr)
 *
 * The bell fallback fires when:
 *   - NODE_ENV is 'test'
 *   - The DISPLAY environment variable is unset on Linux (headless / server)
 *   - The platform is unsupported (not darwin, not linux)
 *   - The notification command exits non-zero OR the spawn throws
 *
 * Testability seam (ADR-010 / DISTILL acceptance-design):
 *   The adapter accepts an injectable CommandRunner so tests can capture the
 *   requested command + args and simulate success/failure without spawning real
 *   OS processes. The default production runner uses child_process.execFile.
 *
 * Async contract: notifyPhaseChange / notifyOverdue are synchronous (void) from
 * the application layer's perspective. The command runs fire-and-forget; its
 * promise is consumed internally with a .catch so the tick loop never stalls and
 * no rejection escapes the adapter.
 */

import { execFile } from 'child_process';
import type { NotificationPort } from '../domain/ports.js';
import type { PomodoroPhase } from '../domain/phase.js';

export interface CommandRunner {
  run(command: string, args: string[]): Promise<{ exitCode: number }>;
}

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
  process.stderr.write('');
}

function phaseLabel(phase: PomodoroPhase): string {
  if (phase === 'WORK') return 'Work';
  if (phase === 'BREAK') return 'Short Break';
  if (phase === 'LONG_BREAK') return 'Long Break';
  if (phase === 'OVERDUE') return 'Overdue';
  return phase;
}

/**
 * Neutralize characters that would break out of the osascript double-quoted
 * string literal (ADR-010 residual risk). Backslashes are escaped first, then
 * double quotes. Messages are currently static, but the adapter escapes
 * defensively so future dynamic content cannot inject AppleScript.
 */
function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export class NotificationAdapter implements NotificationPort {
  constructor(private readonly runner: CommandRunner = new SpawnCommandRunner()) {}

  notifyPhaseChange(from: PomodoroPhase, to: PomodoroPhase): void {
    if (isHeadlessEnvironment()) {
      bell();
      return;
    }
    this.sendNotification({
      title: 'chromato',
      message: `${phaseLabel(from)} complete -- starting ${phaseLabel(to)}`,
    });
  }

  notifyOverdue(): void {
    if (isHeadlessEnvironment()) {
      bell();
      return;
    }
    this.sendNotification({
      title: 'chromato',
      message: 'Break time is over -- start your next session!',
    });
  }

  private sendNotification(options: { title: string; message: string }): void {
    void this.dispatch(options).catch(() => {
      bell();
    });
  }

  private async dispatch(options: { title: string; message: string }): Promise<void> {
    let result: { exitCode: number };
    if (process.platform === 'darwin') {
      const title = escapeForAppleScript(options.title);
      const message = escapeForAppleScript(options.message);
      const script = `display notification "${message}" with title "${title}"`;
      result = await this.runner.run('osascript', ['-e', script]);
    } else if (process.platform === 'linux') {
      result = await this.runner.run('notify-send', [options.title, options.message]);
    } else {
      bell();
      return;
    }
    if (result.exitCode !== 0) {
      bell();
    }
  }
}
