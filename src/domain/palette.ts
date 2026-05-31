/**
 * Palette registry — single source of truth for chromato's named color palettes.
 *
 * Domain-pure: imports only PomodoroPhase from phase.ts. No I/O, no external packages.
 * Holds the PALETTES registry (Record<PaletteName, Palette>) plus resolution helpers.
 *
 * Hex values are sourced from docs/feature/palette-themes/discuss/palette-spec.md
 * (the authoritative spec). The gradient is ordered light (index 0) → dark (index 5).
 *
 * ADR-011 (palette registry placement + adapter injection).
 */

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
  /** 6 hex stops, ordered light (index 0) → dark (index 5). */
  readonly gradient: readonly string[];
  readonly phases: Readonly<Record<PomodoroPhase, PhaseColorEntry>>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_PALETTE_NAME: PaletteName = 'ocean';

export const VALID_PALETTE_NAMES: readonly PaletteName[] = [
  'ocean',
  'lavender',
  'berry',
  'forest',
];

/**
 * Palette registry. All 4 named palettes.
 *
 * ocean (default): refined spec per palette-spec.md. The gradient is ordered
 * light (index 0) → dark (index 5), which folds the fix-logo-gradient-direction
 * flip (OI-PT-01) directly into the data — no branch merge required.
 */
export const PALETTES: Record<PaletteName, Palette> = {
  ocean: {
    gradient: ['#d8f0ff', '#8fd4f0', '#4db8e8', '#2a82c0', '#185a8a', '#0c2f4a'],
    phases: {
      WORK:       { fg: '#4db8e8', bg: '#0a1620' },
      BREAK:      { fg: '#f0c674', bg: '#0a1620' },
      LONG_BREAK: { fg: '#2a82c0', bg: '#0a1620' },
      OVERDUE:    { fg: '#ff6b6b', bg: '#0a1620' },
      IDLE:       { fg: '#5a6b7a', bg: '#0a1620' },
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
// Functions
// ---------------------------------------------------------------------------

/** Type-safe registry lookup. Never returns null. */
export function getPalette(name: PaletteName): Palette {
  return PALETTES[name];
}

/**
 * Parses a raw string input. Returns the typed PaletteName if the value is a
 * valid (exact-case) palette name; returns null otherwise. Hex-pattern strings
 * and unknown names return null (custom-hex deferred per locked decision D4).
 */
export function resolvePaletteName(raw: string): PaletteName | null {
  return VALID_PALETTE_NAMES.includes(raw as PaletteName) ? (raw as PaletteName) : null;
}
