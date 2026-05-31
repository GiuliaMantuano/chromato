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
 * Phase A1 (no-op refactor): ocean is set to chromato's CURRENT colors —
 * gradient = the former bannerAdapter LOGO_COLORS (light→dark), phases = the
 * former tuiAdapter PHASE_COLORS. This proves the structural refactor is a
 * byte-identical no-op before Phase A2 switches ocean to the refined spec.
 */
export const PALETTES: Record<PaletteName, Palette> = {
  ocean: {
    gradient: ['#023e8a', '#0077b6', '#0096c7', '#00b4d8', '#90e0ef', '#caf0f8'],
    phases: {
      WORK:       { fg: '#00d7ff', bg: '#00ff00' },
      BREAK:      { fg: '#005fff', bg: '#5f00ff' },
      LONG_BREAK: { fg: '#af00ff', bg: '#00afff' },
      OVERDUE:    { fg: '#ff0000', bg: '#ffaf00' },
      IDLE:       { fg: '#808080', bg: '#808080' },
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
