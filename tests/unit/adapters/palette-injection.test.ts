/**
 * Unit tests: palette injection into bannerAdapter and tuiAdapter (Phase A)
 *
 * Feature      : palette-themes / Phase A
 * Wave         : DISTILL — RED-ready
 * Driving port : printBanner(palette, noColor, useAscii) — banner adapter
 *                TimerFrame rendered via ink-testing-library — TUI adapter
 * Traceability : AC-PT-01 (adapters consume injected palette, no hardcoded constants),
 *                AC-PT-02 (ocean refined colors applied to both surfaces)
 *
 * Test budget:
 *   A1 : printBanner uses palette.gradient colors (not hardcoded LOGO_COLORS)
 *   A2 : printBanner with ocean palette produces output containing ocean gradient hex
 *   A3 : TimerFrame with injected palette uses palette.phases[phase].fg for color prop
 *   A4 : TimerFrame WORK phase renders with palette WORK fg color
 *   A5 : TimerFrame BREAK phase renders with palette BREAK fg color
 *   A6 : TuiAdapter constructor accepts a Palette; renders with that palette
 *
 * Error/edge ratio: 0 of 6 — adapter injection tests are structural (happy path only).
 * Error paths (no-color, wrong-type) are covered in configLoader tests and
 * acceptance layer.
 *
 * All tests are .skip — DELIVER enables one at a time.
 * A1 and A3 are the RED anchors (first to enable in Phase A).
 *
 * NOTE: printBanner's new signature is:
 *   printBanner(palette: Palette, noColor: boolean, useAscii?: boolean)
 * TuiAdapter's new constructor is:
 *   new TuiAdapter(palette: Palette)
 * Both are pending DELIVER Phase A. Tests will fail with TypeError until signatures land.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render as inkTestRender } from 'ink-testing-library';
import type { Palette } from '../../../src/domain/palette.js';
import { PALETTES } from '../../../src/domain/palette.js';

// ---------------------------------------------------------------------------
// Test palette: lavender (non-default) — asserting on lavender colors proves
// the injected palette is used, not any hardcoded constant.
// ---------------------------------------------------------------------------
const LAVENDER_GRADIENT_STOP_0 = '#ece4ff'; // palette-spec.md lavender gradient[0]
const OCEAN_GRADIENT_STOP_0 = '#d8f0ff';    // palette-spec.md ocean gradient[0]

// Minimal palette stub for tests that need a Palette before PALETTES has real data.
// Tests that assert exact hex values use PALETTES[name] directly.
const TEST_PALETTE_LAVENDER: Palette = {
  gradient: [
    '#ece4ff', '#c8a9f0', '#a878dd', '#8453c4', '#5e3a93', '#2e2046',
  ],
  phases: {
    WORK:       { fg: '#c8a9f0', bg: '#15101c' },
    BREAK:      { fg: '#7ec8e3', bg: '#15101c' },
    LONG_BREAK: { fg: '#a878dd', bg: '#15101c' },
    OVERDUE:    { fg: '#ff6b9d', bg: '#15101c' },
    IDLE:       { fg: '#6b6480', bg: '#15101c' },
  },
};

const TEST_PALETTE_OCEAN: Palette = {
  gradient: [
    '#d8f0ff', '#8fd4f0', '#4db8e8', '#2a82c0', '#185a8a', '#0c2f4a',
  ],
  phases: {
    WORK:       { fg: '#4db8e8', bg: '#0a1620' },
    BREAK:      { fg: '#f0c674', bg: '#0a1620' },
    LONG_BREAK: { fg: '#2a82c0', bg: '#0a1620' },
    OVERDUE:    { fg: '#ff6b6b', bg: '#0a1620' },
    IDLE:       { fg: '#5a6b7a', bg: '#0a1620' },
  },
};

// ---------------------------------------------------------------------------
// Banner adapter injection
// ---------------------------------------------------------------------------

describe('printBanner palette injection (bannerAdapter — Phase A)', () => {

  it.skip('A1: printBanner accepts a Palette as first parameter (new signature)', async () => {
    // This test verifies the new function signature exists.
    // Fails until DELIVER adds palette parameter to printBanner.
    const { printBanner } = await import('../../../src/adapters/bannerAdapter.js');
    // @ts-expect-error — palette parameter added by DELIVER
    expect(() => printBanner(TEST_PALETTE_OCEAN, true)).not.toThrow();
  });

  it.skip('A2: printBanner in color mode uses palette gradient hex values (not hardcoded constants)', async () => {
    // Capture stdout to assert the output contains lavender gradient stop.
    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    try {
      const { printBanner } = await import('../../../src/adapters/bannerAdapter.js');
      // @ts-expect-error — palette parameter added by DELIVER
      printBanner(TEST_PALETTE_LAVENDER, false, false);
      const allOutput = writes.join('');
      // Lavender gradient[0] appears in chalk output
      expect(allOutput).toContain(LAVENDER_GRADIENT_STOP_0.toLowerCase());
      // Hardcoded ocean stop from old LOGO_COLORS should NOT appear
      expect(allOutput).not.toContain('#023e8a');
    } finally {
      vi.restoreAllMocks();
    }
  });

});

// ---------------------------------------------------------------------------
// TUI adapter injection
// ---------------------------------------------------------------------------

describe('TimerFrame palette injection (tuiAdapter — Phase A)', () => {
  // Import snapshot factory from existing test for consistency
  function makeTestSnapshot(phase: string, useColor: boolean) {
    return {
      phase,
      timer: {
        totalSeconds: 1500,
        elapsedSeconds: 300,
        remainingSeconds: 1200,
        progressFraction: 0.2,
        isOverdue: false,
        overdueElapsedSeconds: 0,
      },
      currentPomodoro: 1,
      completedToday: 0,
      streak: 0,
      config: {
        workDurationSeconds: 1500,
        breakDurationSeconds: 300,
        longBreakDurationSeconds: 900,
        cycleCount: 4,
        useAscii: false,
        useColor,
      },
    };
  }

  it.skip('A3: TimerFrame accepts a palette prop (new FrameProps shape)', async () => {
    const { TimerFrame } = await import('../../../src/adapters/tuiAdapter.js');
    const snapshot = makeTestSnapshot('WORK', true);
    // @ts-expect-error — palette prop added by DELIVER
    expect(() => inkTestRender(React.createElement(TimerFrame, { snapshot, palette: TEST_PALETTE_LAVENDER, columns: 80 }))).not.toThrow();
  });

  it.skip('A4: TimerFrame WORK phase renders with injected palette WORK fg color', async () => {
    const { TimerFrame } = await import('../../../src/adapters/tuiAdapter.js');
    const snapshot = makeTestSnapshot('WORK', true);
    const { lastFrame } = inkTestRender(
      // @ts-expect-error — palette prop added by DELIVER
      React.createElement(TimerFrame, { snapshot, palette: TEST_PALETTE_LAVENDER, columns: 80 }),
    );
    // Output contains lavender WORK fg color (#c8a9f0)
    expect(lastFrame()).toContain('c8a9f0');
    // Output does NOT contain old hardcoded WORK color (#00d7ff)
    expect(lastFrame()).not.toContain('00d7ff');
  });

  it.skip('A5: TimerFrame BREAK phase renders with injected palette BREAK fg color', async () => {
    const { TimerFrame } = await import('../../../src/adapters/tuiAdapter.js');
    const snapshot = makeTestSnapshot('BREAK', true);
    const { lastFrame } = inkTestRender(
      // @ts-expect-error — palette prop added by DELIVER
      React.createElement(TimerFrame, { snapshot, palette: TEST_PALETTE_LAVENDER, columns: 80 }),
    );
    // Lavender BREAK fg color (#7ec8e3)
    expect(lastFrame()).toContain('7ec8e3');
  });

  it.skip('A6: TuiAdapter constructor accepts a Palette argument (new constructor signature)', async () => {
    const { TuiAdapter } = await import('../../../src/adapters/tuiAdapter.js');
    // @ts-expect-error — palette constructor arg added by DELIVER
    expect(() => new TuiAdapter(TEST_PALETTE_OCEAN)).not.toThrow();
  });

});
