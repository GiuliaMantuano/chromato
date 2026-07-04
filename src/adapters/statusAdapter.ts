/**
 * StatusAdapter: formats session state for tmux and shell prompt output.
 *
 * CRITICAL: MUST NOT import ink or react.
 * This file is on the hot path for `chromato status --format tmux` (<50ms).
 * Ink/React cold start adds 15-20ms. Use chalk only.
 *
 * formatTmux(snapshot, maxWidth?): returns a compact string <= maxWidth visible chars (default 20).
 * Returns empty string when snapshot is null or phase is IDLE.
 *
 * formatPrompt(snapshot): returns a short session string (e.g. "(P1 15:00)") under 15 chars.
 * Returns empty string when snapshot is null or phase is IDLE.
 */

import chalk from 'chalk';
import type { SessionSnapshot } from '../domain/types.js';

// Phase colors matching TuiAdapter PHASE_COLORS for consistency (AC-03.3).
// Duplicated here to avoid cross-adapter import violation.
const PHASE_COLORS: Record<string, string> = {
  WORK: '#00d7ff',
  BREAK: '#005fff',
  LONG_BREAK: '#af00ff',
  OVERDUE: '#ff0000',
};

function formatMinSec(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: the \x1b control char is a deliberate part of the ANSI escape pattern this regex strips.
const ANSI_PATTERN = /\x1b\[[0-9;]*[A-Za-z]/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, '');
}

function enforceWidth(colored: string, plain: string, maxWidth: number): string {
  if (plain.length <= maxWidth) {
    return colored;
  }
  // Truncate the plain string to fit and rebuild without color.
  return plain.slice(0, maxWidth);
}

export class StatusAdapter {
  formatTmux(snapshot: SessionSnapshot | null, maxWidth: number = 20): string {
    if (snapshot === null) {
      return '';
    }

    const { phase, timer } = snapshot;

    if (phase === 'IDLE') {
      return '';
    }

    const noColor = process.env['NO_COLOR'] !== undefined;
    const time = formatMinSec(timer.remainingSeconds);

    // Abbreviated label keeps visible length well within budget for all phases.
    const label = phase === 'LONG_BREAK' ? 'LNG' : phase.substring(0, 4);
    const plain = `${time} ${label}`;

    if (noColor) {
      return enforceWidth(plain, plain, maxWidth);
    }

    const color = PHASE_COLORS[phase];
    const colored = color ? chalk.hex(color)(plain) : plain;
    return enforceWidth(colored, stripAnsi(colored), maxWidth);
  }

  formatPlain(snapshot: SessionSnapshot | null): string {
    if (snapshot === null || snapshot.phase === 'IDLE') {
      return '';
    }
    const { phase, timer } = snapshot;
    return `${phase} ${formatMinSec(timer.remainingSeconds)}`;
  }

  formatPrompt(snapshot: SessionSnapshot | null): string {
    if (snapshot === null || snapshot.phase === 'IDLE') {
      return '';
    }
    const { phase, timer, currentPomodoro } = snapshot;
    const time = formatMinSec(timer.remainingSeconds);
    const noColor = process.env['NO_COLOR'] !== undefined;
    // Format: "(P1 15:00)" — 10 chars max, always under 15
    const label = phase === 'OVERDUE' ? '!' : `P${currentPomodoro}`;
    const plain = `(${label} ${time})`;
    if (noColor) return plain;
    const color = PHASE_COLORS[phase];
    return color ? chalk.hex(color)(plain) : plain;
  }
}
