/**
 * Tests for the HomeAdapter render surface (returning-home step 02-01).
 * Renders the saved-config recap + static 3-item menu + footer (the keypress
 * RESOLUTION of HomeChoice is step 02-02). Driven headlessly with
 * ink-testing-library — Ink renders OUTPUT to non-TTY stdout fine; only raw-mode
 * INPUT needs a real TTY, which this step does not exercise.
 *
 * Test discipline (wizard SPIKE findings): force colour (chalk.level = 3) and
 * assert SGR *presence*, not count (Ink coalesces same-colour runs). Strip ANSI
 * when asserting label/value adjacency on a recap row.
 *
 * TEST PARADIGM: EXEMPT — TS/Ink render, example-based ink-testing-library
 * (no Hypothesis/fast-check in stack).
 *
 * Port boundary: HomeAdapter is a DRIVING adapter; the test enters through the
 * exported HomeScreen component it mounts and asserts on the rendered frame
 * (user-observable output). The recap input is the already-loaded ConfigResult
 * prop only — the adapter performs NO loadConfig call (K8).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import chalk from 'chalk';
import { HomeScreen } from '../../../src/adapters/homeAdapter.js';
import type { ConfigResult } from '../../../src/configLoader.js';
import { getPalette, type PaletteName } from '../../../src/domain/palette.js';

/** Truecolor SGR introducer for a #rrggbb hex string, e.g. '38;2;77;184;232'. */
function hexToSgr(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `38;2;${r};${g};${b}`;
}

/** Removes ANSI SGR sequences so plain-text content can be asserted. */
function stripAnsi(frame: string): string {
  // eslint-disable-next-line no-control-regex
  return frame.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Builds a ConfigResult for the recap, mirroring loadConfig()'s output shape.
 * Timing is in domain SECONDS (the recap converts to the prototype's minutes).
 */
function configResultFor(
  paletteName: PaletteName,
  opts: { notifications?: boolean } = {},
): ConfigResult {
  return {
    config: {
      workDurationSeconds: 25 * 60,
      breakDurationSeconds: 5 * 60,
      longBreakDurationSeconds: 15 * 60,
      cycleCount: 4,
      useAscii: false,
      useColor: true,
    },
    autoDetectedAscii: false,
    resolvedPalette: getPalette(paletteName),
    paletteName,
    notifications: opts.notifications ?? true,
  };
}

const CONFIG_PATH = '/home/kai/.config/chromato/config.json';

describe('HomeScreen render (ink-testing-library)', () => {
  let originalChalkLevel: chalk.Level;
  beforeAll(() => {
    originalChalkLevel = chalk.level;
    chalk.level = 3; // SPIKE gotcha: no TTY → chalk.level 0 → no colour to assert on.
  });
  afterAll(() => {
    chalk.level = originalChalkLevel;
  });

  it('renders the recap rows for the saved config: theme label, timing, long break, notifications, footer config-path', () => {
    const harness = render(
      React.createElement(HomeScreen, {
        config: configResultFor('ocean', { notifications: true }),
        tmuxDetected: false,
        configPath: CONFIG_PATH,
      }),
    );
    const plain = stripAnsi(harness.lastFrame() ?? '');

    // Theme label from PALETTE_META[name].label (presentation map).
    expect(plain).toContain('Ocean');
    // Timing cadence verbatim from the prototype recap row.
    expect(plain).toContain('25 · 5 × 4');
    // Long break note (minutes) on the timing row.
    expect(plain).toContain('long break 15m');
    // Notifications On (label + value sit together on the recap row).
    expect(plain).toMatch(/Notifications\s+On/);
    // Footer config-path note: the resolved config file path.
    expect(plain).toContain(CONFIG_PATH);
    harness.unmount();
  });

  it('renders the three-item menu (Start / Reconfigure / Quit) with the saved cadence description', () => {
    const harness = render(
      React.createElement(HomeScreen, {
        config: configResultFor('ocean'),
        tmuxDetected: false,
        configPath: CONFIG_PATH,
      }),
    );
    const plain = stripAnsi(harness.lastFrame() ?? '');

    expect(plain).toContain('Start a focus session');
    expect(plain).toContain('Reconfigure');
    expect(plain).toContain('Quit');
    // The Start option carries the saved-cadence description (prototype MENU).
    expect(plain).toContain('25 · 5 × 4 — your saved cadence');
    harness.unmount();
  });

  it('renders Notifications Off when the saved config disables them', () => {
    const harness = render(
      React.createElement(HomeScreen, {
        config: configResultFor('ocean', { notifications: false }),
        tmuxDetected: false,
        configPath: CONFIG_PATH,
      }),
    );
    const plain = stripAnsi(harness.lastFrame() ?? '');
    expect(plain).toMatch(/Notifications\s+Off/);
    harness.unmount();
  });

  // F1 (D-RH-4): the logo + swatch gradient is sourced from getPalette(name).gradient,
  // NOT from a fixed/same-source wiring. Verified with a SECOND theme (lavender) so a
  // wrong same-source wiring would diverge from Ocean: each frame must carry ITS OWN
  // palette's gradient SGRs and NOT the other palette's distinctive stops.
  it('sources the logo + swatch gradient from getPalette(name).gradient — Ocean vs lavender diverge (F1)', () => {
    const oceanGradient = getPalette('ocean').gradient;
    const lavenderGradient = getPalette('lavender').gradient;

    const oceanFrame =
      render(
        React.createElement(HomeScreen, {
          config: configResultFor('ocean'),
          tmuxDetected: false,
          configPath: CONFIG_PATH,
        }),
      ).lastFrame() ?? '';

    const lavenderFrame =
      render(
        React.createElement(HomeScreen, {
          config: configResultFor('lavender'),
          tmuxDetected: false,
          configPath: CONFIG_PATH,
        }),
      ).lastFrame() ?? '';

    // Each frame carries every stop of ITS OWN palette gradient (logo line-per-stop
    // + swatch), proving the gradient is sourced from getPalette(name).gradient.
    for (const hex of oceanGradient) {
      expect(oceanFrame).toContain(hexToSgr(hex));
    }
    for (const hex of lavenderGradient) {
      expect(lavenderFrame).toContain(hexToSgr(hex));
    }

    // Divergence: a wrong same-source wiring (always Ocean) would NOT carry the
    // lavender-distinctive stops. lavender stop 0 (#ece4ff) is not an ocean stop.
    expect(lavenderFrame).toContain(hexToSgr(lavenderGradient[0]));
    expect(oceanFrame).not.toContain(hexToSgr(lavenderGradient[0]));
    // And the lavender label, not Ocean's, is shown for the lavender config.
    expect(stripAnsi(lavenderFrame)).toContain('Lavender');
    expect(stripAnsi(lavenderFrame)).not.toContain('Ocean');
  });

  // RF-04: the tmux integration row appears iff tmuxDetected.
  it('shows the tmux row iff tmuxDetected', () => {
    const withTmux = stripAnsi(
      render(
        React.createElement(HomeScreen, {
          config: configResultFor('ocean'),
          tmuxDetected: true,
          configPath: CONFIG_PATH,
        }),
      ).lastFrame() ?? '',
    );
    const withoutTmux = stripAnsi(
      render(
        React.createElement(HomeScreen, {
          config: configResultFor('ocean'),
          tmuxDetected: false,
          configPath: CONFIG_PATH,
        }),
      ).lastFrame() ?? '',
    );

    expect(withTmux).toContain('tmux');
    expect(withoutTmux).not.toContain('tmux');
  });
});
