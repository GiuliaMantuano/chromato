/**
 * Palette registry — single source of truth for chromato's named color palettes.
 *
 * Domain-pure: imports only PomodoroPhase from phase.ts. No I/O, no external packages.
 * Holds the PALETTES registry (Record<PaletteName, Palette>) plus resolution helpers.
 *
 * Hex values are sourced from docs/architecture/palette-themes/palette-spec.md
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
    gradient: ['#ece4ff', '#c8a9f0', '#a878dd', '#8453c4', '#5e3a93', '#2e2046'],
    phases: {
      WORK:       { fg: '#c8a9f0', bg: '#15101c' },
      BREAK:      { fg: '#7ec8e3', bg: '#15101c' },
      LONG_BREAK: { fg: '#a878dd', bg: '#15101c' },
      OVERDUE:    { fg: '#ff6b9d', bg: '#15101c' },
      IDLE:       { fg: '#6b6480', bg: '#15101c' },
    },
  },
  berry: {
    gradient: ['#ffe3ef', '#f4a6c8', '#e06a9c', '#b83f6f', '#84284e', '#380f22'],
    phases: {
      WORK:       { fg: '#f4a6c8', bg: '#1a0a10' },
      BREAK:      { fg: '#f0c674', bg: '#1a0a10' },
      LONG_BREAK: { fg: '#e06a9c', bg: '#1a0a10' },
      OVERDUE:    { fg: '#ff5555', bg: '#1a0a10' },
      IDLE:       { fg: '#7a5566', bg: '#1a0a10' },
    },
  },
  forest: {
    gradient: ['#dbeec6', '#a3cd7e', '#6faa4e', '#4c7d36', '#305422', '#122009'],
    phases: {
      WORK:       { fg: '#a3cd7e', bg: '#0d130b' },
      BREAK:      { fg: '#7ec8b0', bg: '#0d130b' },
      LONG_BREAK: { fg: '#6faa4e', bg: '#0d130b' },
      OVERDUE:    { fg: '#f08a7a', bg: '#0d130b' },
      IDLE:       { fg: '#5a6b50', bg: '#0d130b' },
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
