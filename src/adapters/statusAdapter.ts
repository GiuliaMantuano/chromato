/**
 * StatusAdapter: formats session state for tmux and shell prompt output.
 *
 * CRITICAL: MUST NOT import ink or react.
 * This file is on the hot path for `chromato status --format tmux` (<50ms).
 * Ink/React cold start adds 15-20ms. Use chalk only.
 *
 * formatTmux(snapshot): returns a compact string <= 20 visible chars.
 * Returns empty string when snapshot is null (no active session).
 */

import chalk from 'chalk';
import type { SessionSnapshot } from '../domain/types.js';

function formatMinSec(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export class StatusAdapter {
  formatTmux(snapshot: SessionSnapshot | null): string {
    if (snapshot === null) {
      return '';
    }

    const { phase, timer } = snapshot;

    if (phase === 'IDLE') {
      return '';
    }

    const noColor = process.env['NO_COLOR'] !== undefined && process.env['NO_COLOR'] !== '';
    const time = formatMinSec(timer.remainingSeconds);

    // Format: "🍅 MM:SS WORK" -- max visible chars = 2+1+5+1+9 = 18 (LONG_BREAK worst case)
    // Use plain label to keep within 20 chars for all phases.
    const label = phase === 'LONG_BREAK' ? 'LNG' : phase.substring(0, 4);

    if (noColor) {
      return `${time} ${label}`;
    }

    switch (phase) {
      case 'WORK':
        return chalk.cyan(`${time} ${label}`);
      case 'BREAK':
        return chalk.blue(`${time} ${label}`);
      case 'LONG_BREAK':
        return chalk.magenta(`${time} ${label}`);
      case 'OVERDUE':
        return chalk.red(`${time} ${label}`);
      default:
        return `${time} ${label}`;
    }
  }

  formatPlain(snapshot: SessionSnapshot | null): string {
    if (snapshot === null || snapshot.phase === 'IDLE') {
      return '';
    }
    const { phase, timer } = snapshot;
    return `${phase} ${formatMinSec(timer.remainingSeconds)}`;
  }
}
