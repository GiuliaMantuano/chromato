/**
 * Palette registry — RED scaffold (created by DISTILL wave, palette-themes).
 *
 * DELIVER replaces all stub bodies with real implementations.
 * Remove this file header comment (and __SCAFFOLD__) once all stubs are replaced.
 */

export const __SCAFFOLD__ = true;

import type { PomodoroPhase } from './phase.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaletteName = 'ocean' | 'lavender' | 'berry' | 'forest';

export interface PhaseColorEntry {
  readonly fg: string;
  readonly bg: string;
}

export interface Palette {
  readonly gradient: readonly string[];
  readonly phases: Readonly<Record<PomodoroPhase, PhaseColorEntry>>;
}

// ---------------------------------------------------------------------------
// Constants — stubs; DELIVER fills real hex values from palette-spec.md
// ---------------------------------------------------------------------------

export const DEFAULT_PALETTE_NAME: PaletteName = 'ocean';

export const VALID_PALETTE_NAMES: readonly PaletteName[] = [
  'ocean',
  'lavender',
  'berry',
  'forest',
];

/** Minimal stub — all 4 keys present so TypeScript is satisfied; hex values are placeholders. */
export const PALETTES: Record<PaletteName, Palette> = {
  ocean: {
    gradient: ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
    phases: {
      WORK:       { fg: '#000000', bg: '#000000' },
      BREAK:      { fg: '#000000', bg: '#000000' },
      LONG_BREAK: { fg: '#000000', bg: '#000000' },
      OVERDUE:    { fg: '#000000', bg: '#000000' },
      IDLE:       { fg: '#000000', bg: '#000000' },
    },
  },
  lavender: {
    gradient: ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
    phases: {
      WORK:       { fg: '#000000', bg: '#000000' },
      BREAK:      { fg: '#000000', bg: '#000000' },
      LONG_BREAK: { fg: '#000000', bg: '#000000' },
      OVERDUE:    { fg: '#000000', bg: '#000000' },
      IDLE:       { fg: '#000000', bg: '#000000' },
    },
  },
  berry: {
    gradient: ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
    phases: {
      WORK:       { fg: '#000000', bg: '#000000' },
      BREAK:      { fg: '#000000', bg: '#000000' },
      LONG_BREAK: { fg: '#000000', bg: '#000000' },
      OVERDUE:    { fg: '#000000', bg: '#000000' },
      IDLE:       { fg: '#000000', bg: '#000000' },
    },
  },
  forest: {
    gradient: ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000'],
    phases: {
      WORK:       { fg: '#000000', bg: '#000000' },
      BREAK:      { fg: '#000000', bg: '#000000' },
      LONG_BREAK: { fg: '#000000', bg: '#000000' },
      OVERDUE:    { fg: '#000000', bg: '#000000' },
      IDLE:       { fg: '#000000', bg: '#000000' },
    },
  },
};

// ---------------------------------------------------------------------------
// Functions — stubs throw so tests classify as RED (not BROKEN)
// ---------------------------------------------------------------------------

/**
 * Type-safe registry lookup. Never returns null.
 * DELIVER replaces stub with: return PALETTES[name];
 */
export function getPalette(_name: PaletteName): Palette {
  throw new Error('Not yet implemented -- RED scaffold');
}

/**
 * Parses a raw string input. Returns null if the value is not a valid palette name.
 * DELIVER replaces stub with: return VALID_PALETTE_NAMES.includes(raw as PaletteName) ? raw as PaletteName : null;
 */
export function resolvePaletteName(_raw: string): PaletteName | null {
  throw new Error('Not yet implemented -- RED scaffold');
}
