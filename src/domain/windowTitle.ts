/**
 * windowTitle: pure phase→title mapping (with ASCII variants) and the
 * escape-sequence builders for OSC 0 title set + XTWINOPS save/restore
 * (DDD-4, spike-verified byte sequences):
 *   set title      OSC 0    = ESC ] 0 ; {title} BEL
 *   save title     XTWINOPS = ESC [ 22 ; 0 t
 *   restore title  XTWINOPS = ESC [ 23 ; 0 t
 *
 * Domain-pure: imports the domain phase type only.
 */

import type { PomodoroPhase } from './phase.js';
import { stripNonAscii } from './notificationCopy.js';

/** The exit fallback title — never a stale phase title (AC-06.3, DDD-11). */
export const NEUTRAL_TITLE = 'chromato';

/**
 * Owner-validated title copy ([D11]): emoji variant with em-dash. The
 * emoji-free ASCII variant (AC-06.5) is derived from it via the shared
 * stripNonAscii single-sourced ASCII-degradation helper (DDD-8, step 06-02) —
 * not a second local map — so the em-dash-to-hyphen + emoji-stripping rule
 * lives in exactly one place (notificationCopy.ts). IDLE carries no phase
 * story — it maps to the neutral title in both variants (DDD-11 spirit).
 */
const EMOJI_TITLES: Record<PomodoroPhase, string> = {
  WORK: '🍅 WORK — chromato',
  BREAK: '☕ BREAK — chromato',
  LONG_BREAK: '🌙 LONG BREAK — chromato',
  OVERDUE: '⏰ OVERDUE — chromato',
  IDLE: NEUTRAL_TITLE,
};

const ASCII_TITLES: Record<PomodoroPhase, string> = {
  WORK: stripNonAscii(EMOJI_TITLES.WORK),
  BREAK: stripNonAscii(EMOJI_TITLES.BREAK),
  LONG_BREAK: stripNonAscii(EMOJI_TITLES.LONG_BREAK),
  OVERDUE: stripNonAscii(EMOJI_TITLES.OVERDUE),
  IDLE: NEUTRAL_TITLE,
};

/** Phase title copy: "🍅 WORK — chromato", …; ASCII variant emoji-free ([D11]). */
export function phaseTitle(phase: PomodoroPhase, useAscii: boolean): string {
  if (useAscii) {
    return ASCII_TITLES[phase];
  }
  return EMOJI_TITLES[phase];
}

/** OSC 0 set-title byte sequence: ESC ] 0 ; {title} BEL. */
export function oscSetTitle(title: string): string {
  return `\x1b]0;${title}\x07`;
}

/** XTWINOPS 22 save-title byte sequence: ESC [ 22 ; 0 t. */
export function xtwinopsSaveTitle(): string {
  return '\x1b[22;0t';
}

/** XTWINOPS 23 restore-title byte sequence: ESC [ 23 ; 0 t. */
export function xtwinopsRestoreTitle(): string {
  return '\x1b[23;0t';
}
