/**
 * MinimalAdapter: plain-text stdout renderer for --minimal flag.
 *
 * Implements RenderPort. Each render() writes one line to stdout.
 * Emits no ANSI escape sequences (AC-05.4, AC-P3).
 * Uses ASCII progress bar: '=' for filled, '-' for empty.
 *
 * CRITICAL: Must NOT import ink or react.
 * Must NOT emit any ANSI escape sequences.
 */

import type { RenderPort } from '../domain/ports.js';
import type { SessionSnapshot } from '../domain/types.js';

const BAR_WIDTH = 20;

function formatMinSec(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.floor(Math.max(0, totalSeconds) % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderAsciiBar(fraction: number): string {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return '[' + '='.repeat(filled) + '-'.repeat(empty) + ']';
}

export class MinimalAdapter implements RenderPort {
  render(snapshot: SessionSnapshot): void {
    const { phase, timer, currentPomodoro, config } = snapshot;

    if (phase === 'IDLE') {
      return;
    }

    const time = formatMinSec(timer.remainingSeconds);
    const bar = renderAsciiBar(timer.progressFraction);
    const pct = Math.round(timer.progressFraction * 100);
    const badge = `POMODORO ${currentPomodoro} of ${config.cycleCount}`;

    process.stdout.write(`${phase} ${time} ${bar} ${pct}% ${badge}\n`);
  }

  stop(): void {
    // No-op: plain-text line-by-line output has no persistent state to clean up.
  }
}
