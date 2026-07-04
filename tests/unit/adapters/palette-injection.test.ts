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

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render as inkTestRender } from 'ink-testing-library';
import { render as inkRender } from 'ink';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import type { Palette } from '../../../src/domain/palette.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';

// ---------------------------------------------------------------------------
// Color observation helper.
//
// chalk encodes a hex color as a truecolor ANSI sequence using DECIMAL RGB
// (\x1b[38;2;R;G;Bm), NOT the literal hex string. To assert that an injected
// palette color is actually applied, we convert the palette hex to its
// "38;2;R;G;B" sequence and look for it in the rendered output.
//
// ink-testing-library renders in debug mode which strips truecolor codes, so
// color verification uses a real Ink render against a custom stream with
// chalk.level=3 forced — the same proven technique as tuiAdapter.test.ts.
// ---------------------------------------------------------------------------
function hexToTruecolorSeq(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `38;2;${r};${g};${b}`;
}

class FakeStdout extends EventEmitter {
  readonly columns = 80;
  private _lastFrame = '';
  write(frame: string): void { this._lastFrame = frame; }
  lastFrame(): string { return this._lastFrame; }
}

async function renderWithColor(element: React.ReactElement): Promise<string> {
  const stdout = new FakeStdout();
  const instance = inkRender(element, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stdout: stdout as any,
    debug: false,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  instance.unmount();
  return stdout.lastFrame();
}

// ---------------------------------------------------------------------------
// Test palette: lavender (non-default) — asserting on lavender colors proves
// the injected palette is used, not any hardcoded constant.
// ---------------------------------------------------------------------------
const LAVENDER_GRADIENT_STOP_0 = '#ece4ff'; // palette-spec.md lavender gradient[0]

// Reference palettes (lavender = non-default) for injection assertions.
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

  it('A1: printBanner accepts a Palette as first parameter (new signature)', async () => {
    // Verifies the new function signature exists and runs without throwing.
    const { printBanner } = await import('../../../src/adapters/bannerAdapter.js');
    expect(() => printBanner(TEST_PALETTE_OCEAN, true)).not.toThrow();
  });

  it('A2: printBanner in color mode uses palette gradient hex values (not hardcoded constants)', async () => {
    // printBanner short-circuits when NODE_ENV==='test'; force production so it
    // actually emits the gradient. chalk.level=3 forces truecolor ANSI output.
    const writes: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
    const origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    const origChalkLevel = chalk.level;
    chalk.level = 3;

    try {
      const { printBanner } = await import('../../../src/adapters/bannerAdapter.js');
      printBanner(TEST_PALETTE_LAVENDER, false, false);
      const allOutput = writes.join('');
      // chalk encodes the lavender gradient[0] (#ece4ff) as a truecolor sequence.
      expect(allOutput).toContain(hexToTruecolorSeq(LAVENDER_GRADIENT_STOP_0));
      // The old hardcoded ocean LOGO_COLORS stop (#023e8a) must NOT appear.
      expect(allOutput).not.toContain(hexToTruecolorSeq('#023e8a'));
    } finally {
      chalk.level = origChalkLevel;
      process.env['NODE_ENV'] = origNodeEnv;
      vi.restoreAllMocks();
    }
  });

});

// ---------------------------------------------------------------------------
// TUI adapter injection
// ---------------------------------------------------------------------------

describe('TimerFrame palette injection (tuiAdapter — Phase A)', () => {
  let origChalkLevel: typeof chalk.level;
  beforeAll(() => { origChalkLevel = chalk.level; chalk.level = 3; });
  afterAll(() => { chalk.level = origChalkLevel; });

  // Import snapshot factory from existing test for consistency
  function makeTestSnapshot(phase: SessionSnapshot['phase'], useColor: boolean) {
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

  it('A3: TimerFrame accepts a palette prop (new FrameProps shape)', async () => {
    const { TimerFrame } = await import('../../../src/adapters/tuiAdapter.js');
    const snapshot = makeTestSnapshot('WORK', true);
    expect(() => inkTestRender(React.createElement(TimerFrame, { snapshot, palette: TEST_PALETTE_LAVENDER, columns: 80 }))).not.toThrow();
  });

  it('A4: TimerFrame WORK phase renders with injected palette WORK fg color', async () => {
    const { TimerFrame } = await import('../../../src/adapters/tuiAdapter.js');
    const snapshot = makeTestSnapshot('WORK', true);
    const frame = await renderWithColor(
      React.createElement(TimerFrame, { snapshot, palette: TEST_PALETTE_LAVENDER, columns: 80 }),
    );
    // Lavender WORK fg (#c8a9f0) appears as a truecolor ANSI sequence.
    expect(frame).toContain(hexToTruecolorSeq('#c8a9f0'));
    // The old hardcoded WORK color (#00d7ff) must NOT appear.
    expect(frame).not.toContain(hexToTruecolorSeq('#00d7ff'));
  });

  it('A5: TimerFrame BREAK phase renders with injected palette BREAK fg color', async () => {
    const { TimerFrame } = await import('../../../src/adapters/tuiAdapter.js');
    const snapshot = makeTestSnapshot('BREAK', true);
    const frame = await renderWithColor(
      React.createElement(TimerFrame, { snapshot, palette: TEST_PALETTE_LAVENDER, columns: 80 }),
    );
    // Lavender BREAK fg (#7ec8e3) appears as a truecolor ANSI sequence.
    expect(frame).toContain(hexToTruecolorSeq('#7ec8e3'));
  });

  it('A6: TuiAdapter constructor accepts a Palette argument (new constructor signature)', async () => {
    const { TuiAdapter } = await import('../../../src/adapters/tuiAdapter.js');
    expect(() => new TuiAdapter(TEST_PALETTE_OCEAN)).not.toThrow();
  });

});
