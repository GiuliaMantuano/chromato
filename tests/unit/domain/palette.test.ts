/**
 * Unit tests: palette registry + resolver (src/domain/palette.ts)
 *
 * Feature      : palette-themes
 * Wave         : DISTILL — RED-ready (all tests skip until DELIVER turns them GREEN)
 * Driving port : palette.ts public API — pure domain functions, no I/O
 * Traceability : AC-PT-01 (single registry source), AC-PT-03 (all 4 palettes),
 *                AC-PT-08 (resolvePaletteName boundary)
 *
 * Test budget (phase A/B — registry):
 *   R1 : PALETTES has exactly the 4 named palettes
 *   R2 : each palette has a gradient with exactly 6 stops
 *   R3 : each palette has all 5 phases with fg and bg entries
 *   R4 : ocean gradient matches palette-spec.md (light→dark, OI-PT-01 flip absorbed)
 *   R5 : getPalette('ocean') returns the ocean palette
 *   R6 : all 4 palettes are visually distinct (gradient[0] differs across palettes)
 *   R7 : each palette phase OVERDUE color is distinct from WORK color (alert invariant)
 *
 * resolvePaletteName (AC-PT-08 boundary):
 *   N1 : valid name 'ocean' returns 'ocean'
 *   N2 : valid name 'lavender' returns 'lavender'
 *   N3 : valid name 'berry' returns 'berry'
 *   N4 : valid name 'forest' returns 'forest'
 *   N5 : unknown name 'catppuccin-latte' returns null
 *   N6 : empty string returns null
 *   N7 : hex-pattern string (custom-hex deferred D4) returns null
 *   N8 : name with wrong casing returns null (names are lowercase)
 *
 * Error/edge ratio: 3 of 15 = 20% — note: pure-data unit tests have limited
 * error paths by nature; error path coverage for the driving port (configLoader)
 * is in configLoader.palette.test.ts which carries the full error budget.
 *
 * All tests are .skip — DELIVER enables one at a time.
 * First test (R1) is enabled — it is the RED anchor for Phase A.
 */

import { describe, it, expect } from 'vitest';
import {
  PALETTES,
  VALID_PALETTE_NAMES,
  DEFAULT_PALETTE_NAME,
  getPalette,
  resolvePaletteName,
} from '../../../src/domain/palette.js';

// ---------------------------------------------------------------------------
// Registry shape (Phase A/B)
// ---------------------------------------------------------------------------

describe('palette registry (palette.ts)', () => {
  // R1 — enabled: RED anchor. The structural presence of all 4 keys is correct
  // in the scaffold (registry exists). However, the first gradient stop for ocean
  // must be #d8f0ff per palette-spec.md — the stub uses #000000, so this assertion
  // is RED until DELIVER fills real hex values.
  it('R1: PALETTES has exactly the 4 named palettes with the correct ocean gradient start', () => {
    const names = Object.keys(PALETTES).sort();
    expect(names).toEqual(['berry', 'forest', 'lavender', 'ocean']);
    expect(VALID_PALETTE_NAMES).toHaveLength(4);
    expect(DEFAULT_PALETTE_NAME).toBe('ocean');
    // RED: stub uses #000000 placeholder; real ocean gradient[0] must be #d8f0ff
    expect(PALETTES['ocean'].gradient[0]).toBe('#d8f0ff');
  });

  it('R2: each palette gradient has exactly 6 stops (light→dark)', () => {
    for (const name of VALID_PALETTE_NAMES) {
      const palette = PALETTES[name];
      expect(palette.gradient).toHaveLength(6);
    }
  });

  it('R3: each palette has all 5 phases with fg and bg entries', () => {
    const requiredPhases: string[] = ['WORK', 'BREAK', 'LONG_BREAK', 'OVERDUE', 'IDLE'];
    for (const name of VALID_PALETTE_NAMES) {
      const { phases } = PALETTES[name];
      for (const phase of requiredPhases) {
        expect(phases[phase as keyof typeof phases]).toBeDefined();
        expect(typeof phases[phase as keyof typeof phases].fg).toBe('string');
        expect(typeof phases[phase as keyof typeof phases].bg).toBe('string');
        expect(phases[phase as keyof typeof phases].fg).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(phases[phase as keyof typeof phases].bg).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('R4: ocean gradient matches palette-spec.md (light→dark, gradient-direction fix absorbed)', () => {
    // Source of truth: docs/architecture/palette-themes/palette-spec.md
    // gradient: #d8f0ff #8fd4f0 #4db8e8 #2a82c0 #185a8a #0c2f4a
    const expected = ['#d8f0ff', '#8fd4f0', '#4db8e8', '#2a82c0', '#185a8a', '#0c2f4a'];
    expect(PALETTES['ocean'].gradient).toEqual(expected);
    // First stop is lightest — light-top invariant (OI-PT-01 fix absorbed)
    expect(PALETTES['ocean'].gradient[0]).toBe('#d8f0ff');
    // Last stop is darkest
    expect(PALETTES['ocean'].gradient[5]).toBe('#0c2f4a');
  });

  it('R4b: ocean phase colors match palette-spec.md', () => {
    const { phases } = PALETTES['ocean'];
    expect(phases['WORK'].fg).toBe('#4db8e8');
    expect(phases['BREAK'].fg).toBe('#f0c674');
    expect(phases['LONG_BREAK'].fg).toBe('#2a82c0');
    expect(phases['OVERDUE'].fg).toBe('#ff6b6b');
    expect(phases['IDLE'].fg).toBe('#5a6b7a');
  });

  it('R5: getPalette("ocean") returns the ocean palette struct', () => {
    const palette = getPalette('ocean');
    expect(palette).toBe(PALETTES['ocean']);
    expect(palette.gradient).toHaveLength(6);
  });

  it('R6: all 4 palettes have distinct gradient stop [0] (visually different primaries)', () => {
    const lightStops = VALID_PALETTE_NAMES.map((n) => PALETTES[n].gradient[0]);
    const unique = new Set(lightStops);
    expect(unique.size).toBe(4);
  });

  it('R7: OVERDUE phase color is distinct from WORK color for each palette (alert invariant)', () => {
    for (const name of VALID_PALETTE_NAMES) {
      const { phases } = PALETTES[name];
      expect(phases['OVERDUE'].fg).not.toBe(phases['WORK'].fg);
    }
  });
});

// ---------------------------------------------------------------------------
// resolvePaletteName (AC-PT-08 boundary)
// ---------------------------------------------------------------------------

describe('resolvePaletteName (palette.ts)', () => {
  it('N1: "ocean" resolves to PaletteName "ocean"', () => {
    expect(resolvePaletteName('ocean')).toBe('ocean');
  });

  it('N2: "lavender" resolves to PaletteName "lavender"', () => {
    expect(resolvePaletteName('lavender')).toBe('lavender');
  });

  it('N3: "berry" resolves to PaletteName "berry"', () => {
    expect(resolvePaletteName('berry')).toBe('berry');
  });

  it('N4: "forest" resolves to PaletteName "forest"', () => {
    expect(resolvePaletteName('forest')).toBe('forest');
  });

  it('N5: unknown name "catppuccin-latte" returns null', () => {
    expect(resolvePaletteName('catppuccin-latte')).toBeNull();
  });

  it('N6: empty string returns null', () => {
    expect(resolvePaletteName('')).toBeNull();
  });

  it('N7: hex-pattern string (custom-hex, deferred D4) returns null', () => {
    // Per locked decision D4: custom hex is out of scope for v1.
    // resolvePaletteName treats any non-matching string as null.
    expect(resolvePaletteName('#d8f0ff,#8fd4f0,#4db8e8,#2a82c0,#185a8a,#0c2f4a')).toBeNull();
  });

  it('N8: wrong-cased name "Ocean" returns null (names are lowercase)', () => {
    expect(resolvePaletteName('Ocean')).toBeNull();
  });
});
