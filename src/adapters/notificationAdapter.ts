/**
 * NotificationAdapter: driven port adapter for desktop notifications.
 *
 * Implements NotificationPort using node-notifier for OS-level desktop
 * notifications. Falls back to a terminal bell (\a on stderr) when:
 *   - NODE_ENV is 'test'
 *   - The DISPLAY environment variable is unset (headless / server environment)
 *   - node-notifier fails for any reason
 *
 * Architecture rule: node-notifier MUST NOT be imported anywhere except
 * this file (enforced by dependency-cruiser check:arch).
 *
 * node-notifier uses CommonJS. We load it via createRequire to stay
 * compatible with this project's ESM module system.
 */

import { createRequire } from 'module';
import type { NotificationPort } from '../domain/ports.js';
import type { PomodoroPhase } from '../domain/phase.js';

const require = createRequire(import.meta.url);

function isHeadlessEnvironment(): boolean {
  if (process.env['NODE_ENV'] === 'test') {
    return true;
  }
  // On Linux/macOS, DISPLAY must be set for GUI notifications
  const display = process.env['DISPLAY'];
  const isLinux = process.platform === 'linux';
  if (isLinux && (!display || display.trim() === '')) {
    return true;
  }
  return false;
}

function bell(): void {
  process.stderr.write('\u0007');
}

function phaseLabel(phase: PomodoroPhase): string {
  if (phase === 'WORK') return 'Work';
  if (phase === 'BREAK') return 'Short Break';
  if (phase === 'LONG_BREAK') return 'Long Break';
  if (phase === 'OVERDUE') return 'Overdue';
  return phase;
}

export class NotificationAdapter implements NotificationPort {
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
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const notifier = require('node-notifier');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      notifier.notify(options);
    } catch {
      // Notification failed (display server gone, permission denied, etc.)
      // Fall back to terminal bell to ensure user still gets feedback.
      bell();
    }
  }
}
