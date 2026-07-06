/**
 * windowTitle domain unit tests — in-terminal-notifications slice-06 (step 03-01).
 *
 * Traceability: US-06 (AC-06.1, AC-06.5), [D11], DDD-4, DDD-11 — spike-verified
 * byte-level contracts:
 *   set title      OSC 0    = ESC ] 0 ; {title} BEL
 *   save title     XTWINOPS = ESC [ 22 ; 0 t
 *   restore title  XTWINOPS = ESC [ 23 ; 0 t
 *
 * TEST PARADIGM (TS adaptation of the PBT mandate): the title contract is a
 * property — for ANY phase, phaseTitle output is a well-formed OSC 0 payload
 * and the ASCII variant contains only ASCII bytes. fast-check is not a project
 * dependency, so the FULL PomodoroPhase universe is enumerated as a test table.
 * Exact byte sequences and exact copy are EXEMPT: spike-verified exact-byte /
 * owner-validated-copy contract locks.
 *
 * Test budget: 4 behaviors (phase→title map / ASCII variant / OSC builder /
 * XTWINOPS builders) x 2 = 8 max; 6 written (2 parametrized).
 *
 * Port boundary (Mandate 2): pure domain functions ARE their own driving ports.
 */

import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_TITLE,
  oscSetTitle,
  phaseTitle,
  xtwinopsRestoreTitle,
  xtwinopsSaveTitle,
} from '../../../src/domain/windowTitle.js';
import type { PomodoroPhase } from '../../../src/domain/phase.js';

/** The FULL phase universe with the exact owner-validated titles ([D11] copy). */
const PHASE_TITLES: ReadonlyArray<{
  phase: PomodoroPhase;
  emoji: string;
  ascii: string;
}> = [
  { phase: 'WORK', emoji: '🍅 WORK — chromato', ascii: 'WORK - chromato' },
  { phase: 'BREAK', emoji: '☕ BREAK — chromato', ascii: 'BREAK - chromato' },
  { phase: 'LONG_BREAK', emoji: '🌙 LONG BREAK — chromato', ascii: 'LONG BREAK - chromato' },
  { phase: 'OVERDUE', emoji: '⏰ OVERDUE — chromato', ascii: 'OVERDUE - chromato' },
  // IDLE carries no phase story — the neutral title in both variants (DDD-11 spirit).
  { phase: 'IDLE', emoji: NEUTRAL_TITLE, ascii: NEUTRAL_TITLE },
];

function isAsciiOnly(text: string): boolean {
  return [...text].every((ch) => (ch.codePointAt(0) ?? 0) <= 0x7f);
}

describe('windowTitle — phase→title mapping ([D11] copy)', () => {
  it.each(PHASE_TITLES)('$phase maps to the exact emoji and ASCII titles', (row) => {
    expect(phaseTitle(row.phase, false)).toBe(row.emoji);
    expect(phaseTitle(row.phase, true)).toBe(row.ascii);
  });

  // Property over the full phase universe: the ASCII variant NEVER carries a
  // non-ASCII byte (AC-06.5) — grammatical, emoji-free, ASCII hyphen only.
  it.each(PHASE_TITLES)('$phase ASCII variant contains only ASCII characters', ({ phase }) => {
    expect(isAsciiOnly(phaseTitle(phase, true))).toBe(true);
  });

  it('the neutral title is the bare product name (AC-06.3 exit fallback)', () => {
    expect(NEUTRAL_TITLE).toBe('chromato');
    expect(isAsciiOnly(NEUTRAL_TITLE)).toBe(true);
  });
});

describe('windowTitle — escape-sequence builders (spike-verified bytes)', () => {
  // Property over the full phase universe: every phase title wraps into a
  // well-formed OSC 0 payload — ESC ] 0 ; {title} BEL, nothing else.
  it.each(PHASE_TITLES)('$phase title wraps into a well-formed OSC 0 payload', ({ phase }) => {
    for (const useAscii of [false, true]) {
      const title = phaseTitle(phase, useAscii);
      expect(oscSetTitle(title)).toBe(`\x1b]0;${title}\x07`);
    }
  });

  it('oscSetTitle emits the exact OSC 0 byte frame: ESC ] 0 ; title BEL', () => {
    expect(oscSetTitle('chromato')).toBe('\x1b]0;chromato\x07');
  });

  it('XTWINOPS save/restore emit the exact byte sequences: ESC [ 22;0 t / ESC [ 23;0 t', () => {
    expect(xtwinopsSaveTitle()).toBe('\x1b[22;0t');
    expect(xtwinopsRestoreTitle()).toBe('\x1b[23;0t');
  });
});
