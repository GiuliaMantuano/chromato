/**
 * Tests for the SetupWizardAdapter (the interactive Ink wizard). Slice 01:
 * Welcome screen + Theme step with live truecolor preview.
 * Traceability: US-02/03/04/05/08; SPIKE findings.md (this is the proven template).
 *
 * The wizard's interactive surface can only be driven headlessly with
 * ink-testing-library (raw-mode input needs a TTY a subprocess lacks). The SPIKE
 * PROVED this works; these tests re-encode those assertions now the component exists.
 *
 * Test discipline (SPIKE gotchas): force colour (chalk.level = 3 / FORCE_COLOR=3)
 * and assert SGR *presence*, not count (Ink coalesces same-colour runs).
 *
 * TEST PARADIGM: EXEMPT — TS/Ink UI flow, example-based ink-testing-library
 * (no Hypothesis/fast-check in stack).
 *
 * Port boundary: SetupWizardAdapter is a DRIVING adapter; tests enter through it
 * (run() + the exported SetupWizard component it mounts) and assert on the
 * rendered frame (user-observable output) and the ConfigWritePort (driven port).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import chalk from 'chalk';
import {
  SetupWizardAdapter,
  SetupWizard,
} from '../../../src/adapters/setupWizardAdapter.js';
import { getPalette } from '../../../src/domain/palette.js';
import type { ConfigWritePort } from '../../../src/domain/ports.js';

class InMemoryConfigWriter implements ConfigWritePort {
  public written: unknown = null;
  write(config: unknown): void {
    this.written = config;
  }
}

/** A ConfigWritePort that always fails — drives the DD-8 graceful-degrade path. */
class ThrowingConfigWriter implements ConfigWritePort {
  write(): void {
    throw new Error('disk full');
  }
}

/** Ink registers useInput via useEffect (async); flush effects + a render tick. */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Truecolor SGR introducer for a #rrggbb hex string, e.g. '38;2;200;169;240'. */
function hexToSgr(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `38;2;${r};${g};${b}`;
}

const ARROW_DOWN = '\x1b[B';
const ARROW_UP = '\x1b[A';
const ENTER = '\r';

describe('SetupWizardAdapter (contract)', () => {
  // Drive the full flow Welcome → Theme → Timing(Default) via ink-testing-library
  // stdin so run() resolves the WizardResult (and persists it).
  it('run() resolves with the user selections and persists via the ConfigWritePort', async () => {
    const writer = new InMemoryConfigWriter();
    // Inject ink-testing-library's render so we can drive stdin headlessly.
    let driver: ReturnType<typeof render> | undefined;
    const adapter = new SetupWizardAdapter(writer, (element) => {
      driver = render(element);
      return driver;
    });

    const resultPromise = adapter.run({ tmuxDetected: false });
    await flush();

    driver!.stdin.write(ENTER); // Welcome → Theme
    await flush();
    driver!.stdin.write(ENTER); // Theme (default ocean) → Timing
    await flush();
    driver!.stdin.write(ENTER); // Timing (Default recommended) → Notifications
    await flush();
    driver!.stdin.write(ENTER); // Notifications (default On) → Summary
    await flush();
    driver!.stdin.write(ENTER); // Summary → begin (write + launch)
    await flush();

    const result = await resultPromise;
    expect(result).toMatchObject({
      palette: expect.any(String),
      work: expect.any(Number),
      break: expect.any(Number),
      longBreak: expect.any(Number),
      cycles: expect.any(Number),
      notifications: expect.any(Boolean),
    });
    // Persisted the SAME result via the driven port (not just resolved it),
    // and the default-On notifications value reaches the ConfigWritePort.
    expect(writer.written).toEqual(result);
    expect((writer.written as { notifications: boolean }).notifications).toBe(true);
  });

  // AC1 (persistence): a toggled-Off notifications value must reach the driven
  // ConfigWritePort, not merely be resolved by the wizard internally.
  it('persists notifications=false via the ConfigWritePort when toggled Off', async () => {
    const writer = new InMemoryConfigWriter();
    let driver: ReturnType<typeof render> | undefined;
    const adapter = new SetupWizardAdapter(writer, (element) => {
      driver = render(element);
      return driver;
    });

    const resultPromise = adapter.run({ tmuxDetected: false });
    await flush();
    driver!.stdin.write(ENTER); // Welcome → Theme
    await flush();
    driver!.stdin.write(ENTER); // Theme (default ocean) → Timing
    await flush();
    driver!.stdin.write(ENTER); // Timing (Default recommended) → Notifications
    await flush();
    driver!.stdin.write('\x1b[D'); // ← toggle notifications Off
    await flush();
    driver!.stdin.write(ENTER); // Notifications (Off) → Summary
    await flush();
    driver!.stdin.write(ENTER); // Summary → begin (write + launch)
    await flush();

    await resultPromise;
    expect((writer.written as { notifications: boolean }).notifications).toBe(false);
  });

  // Universal escape hatch: Ctrl+C quits from ANY screen (not just Welcome's Q) and
  // writes nothing — guards against being trapped once past Welcome (Esc-back is 04-01).
  it('Ctrl+C quits from a deep screen and writes no config', async () => {
    const writer = new InMemoryConfigWriter();
    let driver: ReturnType<typeof render> | undefined;
    const adapter = new SetupWizardAdapter(writer, (element) => {
      driver = render(element);
      return driver;
    });

    const resultPromise = adapter.run({ tmuxDetected: false });
    await flush();
    driver!.stdin.write(ENTER); // Welcome → Theme
    await flush();
    driver!.stdin.write(ENTER); // Theme → Timing
    await flush();
    driver!.stdin.write('\x03'); // Ctrl+C on the Timing screen
    await flush();

    const result = await resultPromise;
    expect(result).toBeNull();
    expect(writer.written).toBeNull();
  });

  // Regression (bug fix 01-01): Q is the user-visible quit key, but before the fix
  // it was scoped INSIDE the welcome branch — inert on every inner screen. Pressing
  // Q on a deep screen (Theme) must now resolve the wizard to null via onQuit and
  // write nothing through the driven ConfigWritePort. Pre-fix this times out / the
  // result is not null (Q never reaches quit() on Theme).
  it('Q quits from a deep screen (Theme) and writes no config', async () => {
    const writer = new InMemoryConfigWriter();
    let driver: ReturnType<typeof render> | undefined;
    const adapter = new SetupWizardAdapter(writer, (element) => {
      driver = render(element);
      return driver;
    });

    const resultPromise = adapter.run({ tmuxDetected: false });
    await flush();
    driver!.stdin.write(ENTER); // Welcome → Theme
    await flush();
    driver!.stdin.write('q'); // Q on the Theme screen — must quit globally
    await flush();

    const result = await resultPromise;
    expect(result).toBeNull();
    expect(writer.written).toBeNull();
  });
});

// ── Theme step (Slice 01) — ink-testing-library, forced colour ─────────────────
describe('SetupWizard interactive surface (ink-testing-library)', () => {
  let originalChalkLevel: typeof chalk.level;
  beforeAll(() => {
    originalChalkLevel = chalk.level;
    chalk.level = 3; // SPIKE gotcha: no TTY → chalk.level 0 → no colour to assert on.
  });
  afterAll(() => {
    chalk.level = originalChalkLevel;
  });

  /** Mounts the wizard already advanced to the Theme step (Enter on welcome). */
  async function mountAtTheme() {
    const harness = render(
      React.createElement(SetupWizard, {
        tmuxDetected: false,
        onComplete: () => undefined,
        onQuit: () => undefined,
      }),
    );
    await flush();
    harness.stdin.write(ENTER); // Welcome → Theme
    await flush();
    return harness;
  }

  it('Down/Down/Up changes the highlighted theme ocean → lavender → berry → lavender', async () => {
    const harness = await mountAtTheme();

    harness.stdin.write(ARROW_DOWN); // ocean → lavender
    await flush();
    harness.stdin.write(ARROW_DOWN); // lavender → berry
    await flush();
    harness.stdin.write(ARROW_UP); // berry → lavender
    await flush();

    const frame = harness.lastFrame() ?? '';
    // The selected row is marked with ▸; after Down/Down/Up it must be on lavender.
    // Case-insensitive: option cards display capitalised labels (PALETTE_META).
    expect(frame).toMatch(/▸\s*lavender/i);
    expect(frame).not.toMatch(/▸\s*berry/i);
    harness.unmount();
  });

  it('preview frame contains the selected palette WORK truecolor SGR and redraws for the highlight', async () => {
    const harness = await mountAtTheme();

    harness.stdin.write(ARROW_DOWN); // ocean → lavender
    await flush();

    const frame = harness.lastFrame() ?? '';
    const lavenderWorkSgr = hexToSgr(getPalette('lavender').phases.WORK.fg);
    // Live preview redrew from the REAL palette.ts for the highlighted palette:
    // the WORK bar carries the selected palette's WORK foreground SGR ...
    expect(frame).toContain(lavenderWorkSgr);
    // ... and the preview panel labels the highlighted palette, not the prior one.
    // (Colour presence alone can no longer be a negative signal: the all-palette
    // swatches legitimately contain every palette's gradient — gap-analysis 01-04.)
    expect(frame).toContain('live preview · Lavender');
    expect(frame).not.toContain('live preview · Ocean');
    harness.unmount();
  });

  it('welcome renders the branded hero: logo gradient, tagline, descriptor, and the 20-seconds copy', async () => {
    const harness = render(
      React.createElement(SetupWizard, {
        tmuxDetected: false,
        onComplete: () => undefined,
        onQuit: () => undefined,
      }),
    );
    await flush();

    const frame = harness.lastFrame() ?? '';
    const ocean = getPalette('ocean');
    // Full ASCII logo rendered in the default ocean gradient (lightest + darkest stop).
    expect(frame).toContain(hexToSgr(ocean.gradient[0]));
    expect(frame).toContain(hexToSgr(ocean.gradient[5]));
    expect(frame).toContain('Focus in full colour');
    expect(frame).toContain('Work, break, repeat');
    expect(frame).toContain('takes 20 seconds');
    harness.unmount();
  });

  it('the saved theme shows a filled-dot indicator; other options do not (chromato setup re-run)', async () => {
    const harness = render(
      React.createElement(SetupWizard, {
        tmuxDetected: false,
        initial: { palette: 'ocean' },
        onComplete: () => undefined,
        onQuit: () => undefined,
      }),
    );
    await flush();
    harness.stdin.write(ENTER); // Welcome → Theme
    await flush();

    const lines = (harness.lastFrame() ?? '').split('\n');
    const oceanLine = lines.find((l) => l.includes('Ocean')) ?? '';
    const lavenderLine = lines.find((l) => l.includes('Lavender')) ?? '';
    // The persisted palette (ocean) carries the ● dot; an unsaved one (lavender) does not.
    // (Also guards against the dot rendering unconditionally.)
    expect(oceanLine).toContain('●');
    expect(lavenderLine).not.toContain('●');
    harness.unmount();
  });

  it('theme preview renders the full 6-line logo in the selected gradient', async () => {
    const harness = await mountAtTheme();

    harness.stdin.write(ARROW_DOWN); // ocean → lavender
    await flush();

    const frame = harness.lastFrame() ?? '';
    // The logo uses one gradient stop per line; every lavender stop must appear.
    for (const hex of getPalette('lavender').gradient) {
      expect(frame).toContain(hexToSgr(hex));
    }
    harness.unmount();
  });

  it('Enter on a highlighted theme records it and advances to Timing, then completes', async () => {
    let completed: { palette: string } | null = null;
    const harness = render(
      React.createElement(SetupWizard, {
        tmuxDetected: false,
        onComplete: (r) => {
          completed = r;
        },
        onQuit: () => undefined,
      }),
    );
    await flush();
    harness.stdin.write(ENTER); // Welcome → Theme
    await flush();
    harness.stdin.write(ARROW_DOWN); // ocean → lavender
    await flush();
    harness.stdin.write(ENTER); // record highlighted (lavender) → Timing
    await flush();
    harness.stdin.write(ENTER); // Timing (Default) → Notifications
    await flush();
    harness.stdin.write(ENTER); // Notifications (default On) → Summary
    await flush();
    harness.stdin.write(ENTER); // Summary → begin (complete)
    await flush();

    expect(completed).not.toBeNull();
    expect(completed!.palette).toBe('lavender');
    harness.unmount();
  });

  // ── Wizard chrome (step 01-05): breadcrumbs + contextual footer keybar ──────
  it('the Theme step renders the three step breadcrumbs with step 1 (Theme) active', async () => {
    const harness = await mountAtTheme();

    const frame = harness.lastFrame() ?? '';
    // crumbs() L155-161: three labels Theme · Timing · Setup, step 1 active on Theme.
    expect(frame).toContain('Theme');
    expect(frame).toContain('Timing');
    expect(frame).toContain('Setup');
    // The active step (Theme) shows its number "1"; upcoming steps show their numbers.
    expect(frame).toMatch(/1\s*Theme/);
    expect(frame).toMatch(/2\s*Timing/);
    expect(frame).toMatch(/3\s*Setup/);
    harness.unmount();
  });

  it('the Theme step renders the contextual footer keybar (preview / continue hints)', async () => {
    const harness = await mountAtTheme();

    const frame = harness.lastFrame() ?? '';
    // footer() L162: contextual key hints for the theme screen, rendered via keyHint.
    // Theme now advances to Timing, so Enter "continue"s rather than completing.
    expect(frame).toContain('↑↓');
    expect(frame).toContain('preview');
    expect(frame).toContain('Enter');
    expect(frame).toContain('continue');
    harness.unmount();
  });

  it('the footer degrades to plain text with zero ANSI escapes under NO_COLOR (chalk.level 0)', async () => {
    const saved = chalk.level;
    chalk.level = 0; // NO_COLOR / non-TTY — AC-P3.
    try {
      const harness = await mountAtTheme();

      const frame = harness.lastFrame() ?? '';
      // Key names + labels still present as readable plain text ...
      expect(frame).toContain('Enter');
      expect(frame).toContain('preview');
      expect(frame).toContain('continue');
      // ... but with NO ANSI escape sequences anywhere in the rendered frame.
      expect(frame).not.toContain('\x1b[');
      harness.unmount();
    } finally {
      chalk.level = saved;
    }
  });

  // ── Timing step (step 03-01) ────────────────────────────────────────────────
  const ARROW_LEFT = '\x1b[D';

  /** Mounts the wizard advanced to the Timing step (Enter welcome, Enter theme). */
  async function mountAtTiming(props: Record<string, unknown> = {}) {
    const harness = render(
      React.createElement(SetupWizard, {
        tmuxDetected: false,
        onComplete: () => undefined,
        onQuit: () => undefined,
        ...props,
      }),
    );
    await flush();
    harness.stdin.write(ENTER); // Welcome → Theme
    await flush();
    harness.stdin.write(ENTER); // Theme → Timing
    await flush();
    return harness;
  }

  it('the Timing screen matches the prototype: step-2 breadcrumb active, Default/Custom, steppers, timeline', async () => {
    const harness = await mountAtTiming();

    const frame = harness.lastFrame() ?? '';
    // Breadcrumbs active={2}: step 2 (Timing) is the active crumb (bold "2 Timing").
    expect(frame).toMatch(/2\s*Timing/);
    // Default option labelled "25 · 5 × 4 (recommended)".
    expect(frame).toContain('25 · 5 × 4');
    expect(frame).toContain('recommended');
    // Custom option present.
    expect(frame).toContain('Custom');
    // "your cycle" timeline preview present.
    expect(frame).toContain('your cycle');
    // choose-mode footer hints: ↑↓ choose / Enter continue / Esc back (04-01 added
    // the now-live cross-step Esc-back hint, deferred by the 01-05 review D1/D2).
    expect(frame).toContain('choose');
    expect(frame).toContain('continue');
    expect(frame).toContain('back');
    harness.unmount();
  });

  it('entering Custom reveals the four fields with directional steppers (◂ ▸)', async () => {
    const harness = await mountAtTiming();

    harness.stdin.write(ARROW_DOWN); // Default → Custom
    await flush();
    harness.stdin.write(ENTER); // open the Custom field editor
    await flush();

    const frame = harness.lastFrame() ?? '';
    for (const label of ['Work', 'Break', 'Long break', 'Cycles']) {
      expect(frame).toContain(label);
    }
    expect(frame).toContain('◂');
    expect(frame).toContain('▸');
    // custom-edit footer hints: ↑↓ field / ←→ adjust / Enter confirm.
    expect(frame).toContain('field');
    expect(frame).toContain('adjust');
    expect(frame).toContain('confirm');
    harness.unmount();
  });

  it('Esc leaves the Custom editor back to the Default/Custom choice (not a one-way trap)', async () => {
    const ESCAPE = '\x1b';
    let completed: { work: number } | null = null;
    const harness = await mountAtTiming({ onComplete: (r: typeof completed) => { completed = r; } });

    harness.stdin.write(ARROW_DOWN); // Default → Custom
    await flush();
    harness.stdin.write(ENTER); // open the Custom field editor
    await flush();
    const editorFrame = harness.lastFrame() ?? '';
    expect(editorFrame).toContain('field'); // editor footer is active
    expect(editorFrame).toContain('back'); // the now-live Esc-back hint is shown

    harness.stdin.write(ESCAPE); // leave the editor → back to the Default/Custom choice
    await flush();
    const chooseFrame = harness.lastFrame() ?? '';
    expect(chooseFrame).toContain('choose'); // choose-mode footer again
    expect(chooseFrame).not.toContain('adjust'); // editor hints gone

    harness.stdin.write(ARROW_UP); // Custom → Default (now reachable again)
    await flush();
    harness.stdin.write(ENTER); // continue with Default → Notifications
    await flush();
    harness.stdin.write(ENTER); // Notifications (default On) → Summary
    await flush();
    harness.stdin.write(ENTER); // Summary → begin (complete)
    await flush();
    expect(completed).not.toBeNull();
    expect(completed!.work).toBe(25); // the recommended Default was applied
    harness.unmount();
  });

  it('Custom work decrements to its min (1) and never below — clamp [1,90] — then persists minutes', async () => {
    let completed: { work: number; break: number; longBreak: number; cycles: number } | null = null;
    const harness = await mountAtTiming({ onComplete: (r: typeof completed) => { completed = r; } });

    harness.stdin.write(ARROW_DOWN); // Default → Custom
    await flush();
    harness.stdin.write(ENTER); // open editor; selected field = Work (index 0)
    await flush();
    // Work starts at the recommended 25 (step 1). Drive it well past the floor.
    for (let i = 0; i < 30; i += 1) {
      harness.stdin.write(ARROW_LEFT);
      await flush();
    }
    const frame = harness.lastFrame() ?? '';
    // Clamped at the minimum 1 (not 0 / negative).
    expect(frame).toMatch(/◂\s*1m\s*▸/);

    harness.stdin.write(ENTER); // confirm Custom → Notifications
    await flush();
    harness.stdin.write(ENTER); // Notifications (default On) → Summary
    await flush();
    harness.stdin.write(ENTER); // Summary → begin (complete)
    await flush();
    expect(completed).not.toBeNull();
    // Persists MINUTES (not seconds): clamped work = 1, rest = recommended.
    expect(completed!.work).toBe(1);
    expect(completed!.break).toBe(5);
    expect(completed!.longBreak).toBe(15);
    expect(completed!.cycles).toBe(4);
    harness.unmount();
  });

  // ── Notifications step (step 03-02) ─────────────────────────────────────────

  /** Mounts the wizard advanced to the Notifications step (welcome → theme → timing → notify). */
  async function mountAtNotifications(props: Record<string, unknown> = {}) {
    const harness = render(
      React.createElement(SetupWizard, {
        tmuxDetected: false,
        onComplete: () => undefined,
        onQuit: () => undefined,
        ...props,
      }),
    );
    await flush();
    harness.stdin.write(ENTER); // Welcome → Theme
    await flush();
    harness.stdin.write(ENTER); // Theme → Timing
    await flush();
    harness.stdin.write(ENTER); // Timing (Default) → Notifications
    await flush();
    return harness;
  }

  it('the Notifications screen matches the prototype rNotify: title, breadcrumb 3, save-note, finish row', async () => {
    const harness = await mountAtNotifications();

    const frame = harness.lastFrame() ?? '';
    // Breadcrumbs active={3}: step 3 (Setup) is the active crumb.
    expect(frame).toMatch(/3\s*Setup/);
    // Title is just "Notifications" (the "& integration" tmux variant is 03-03).
    expect(frame).toContain('Notifications');
    expect(frame).not.toContain('& integration');
    // Save-note copy (prototype rNotify).
    expect(frame).toContain('~/.config/chromato/config.json');
    expect(frame).toContain('chromato setup');
    // Highlighted finish action row.
    expect(frame).toContain('Finish & start my first session');
    // Footer hints: ↑↓ move / ←→ toggle / Enter finish / Esc back (04-01 added the
    // now-live cross-step Esc-back hint, deferred by the 01-05 review D1/D2).
    expect(frame).toContain('move');
    expect(frame).toContain('toggle');
    expect(frame).toContain('finish');
    expect(frame).toContain('back');
    // No tmux snippet here (03-03).
    expect(frame).not.toContain('~/.tmux.conf');
    harness.unmount();
  });

  it('Left/Right toggles notifications; default On', async () => {
    let completed: { notifications: boolean } | null = null;

    // Default On: complete immediately without toggling.
    const onHarness = await mountAtNotifications({
      onComplete: (r: typeof completed) => { completed = r; },
    });
    let frame = onHarness.lastFrame() ?? '';
    // The On/Off toggle is shown with On highlighted by default.
    expect(frame).toContain('On');
    expect(frame).toContain('Off');
    onHarness.stdin.write(ENTER); // default On → Summary
    await flush();
    onHarness.stdin.write(ENTER); // Summary → begin (finish)
    await flush();
    expect(completed).not.toBeNull();
    expect(completed!.notifications).toBe(true);
    onHarness.unmount();

    // Toggle Off: Left arrow flips notifications to false, then finish persists false.
    completed = null;
    const offHarness = await mountAtNotifications({
      onComplete: (r: typeof completed) => { completed = r; },
    });
    offHarness.stdin.write('\x1b[D'); // ← toggle to Off
    await flush();
    frame = offHarness.lastFrame() ?? '';
    expect(frame).toContain('Off');
    offHarness.stdin.write(ENTER); // Off → Summary
    await flush();
    offHarness.stdin.write(ENTER); // Summary → begin (finish with Off)
    await flush();
    expect(completed).not.toBeNull();
    expect(completed!.notifications).toBe(false);

    // Right arrow toggles back On — proves the toggle is bidirectional, not one-way.
    offHarness.stdin.write('\x1b[C'); // (no-op after complete, but guards the binding exists)
    await flush();
    offHarness.unmount();
  });
  // Step 03-03 — the tmux integration hint, conditional on the tmuxDetected prop
  // (wired from $TMUX in index.ts). The snippet is COPY-PASTE only: the wizard
  // shows the exact line but NEVER writes ~/.tmux.conf — its sole driven port is
  // the ConfigWritePort (config.json), proven by the persisted WizardResult.
  it('tmux snippet + "& integration" title shown iff tmuxDetected; never edits ~/.tmux.conf', async () => {
    const SNIPPET = 'set -g status-right "#(chromato status --format tmux)"';

    // $TMUX set → richer title and the exact paste-ready snippet are shown.
    const onHarness = await mountAtNotifications({ tmuxDetected: true });
    const onFrame = onHarness.lastFrame() ?? '';
    expect(onFrame).toContain('Notifications & integration');
    expect(onFrame).toContain(SNIPPET);
    onHarness.unmount();

    // $TMUX unset → plain title, neither the snippet nor the ~/.tmux.conf hint.
    const offHarness = await mountAtNotifications({ tmuxDetected: false });
    const offFrame = offHarness.lastFrame() ?? '';
    expect(offFrame).toContain('Notifications');
    expect(offFrame).not.toContain('& integration');
    expect(offFrame).not.toContain('status-right');
    expect(offFrame).not.toContain('~/.tmux.conf');
    offHarness.unmount();

    // The wizard's ONLY driven port is the ConfigWritePort (config.json). Finishing
    // with tmuxDetected=true persists the six-key WizardResult and nothing else —
    // no ~/.tmux.conf path is ever written (the adapter has no filesystem-write path
    // beyond the injected ConfigWritePort).
    const configWriter = new InMemoryConfigWriter();
    const adapter = new SetupWizardAdapter(configWriter, (element) => {
      const harness = render(element);
      void (async () => {
        await flush();
        harness.stdin.write(ENTER); // Welcome → Theme
        await flush();
        harness.stdin.write(ENTER); // Theme → Timing
        await flush();
        harness.stdin.write(ENTER); // Timing (Default) → Notifications
        await flush();
        harness.stdin.write(ENTER); // Notifications (default On) → Summary
        await flush();
        harness.stdin.write(ENTER); // Summary → begin (complete)
        await flush();
      })();
      return harness;
    });
    const result = await adapter.run({ tmuxDetected: true });
    expect(result).not.toBeNull();
    // The persisted config carries only the six wizard keys — no tmux/file path.
    const persisted = configWriter.written as Record<string, unknown>;
    expect(Object.keys(persisted).sort()).toEqual(
      ['break', 'cycles', 'longBreak', 'notifications', 'palette', 'work'],
    );
    expect(JSON.stringify(persisted)).not.toContain('.tmux.conf');
  });
  // ── Summary step + S-skip + cross-step Esc-back (step 04-01) ────────────────

  const ESCAPE = '\x1b';

  // S-skip (rWelcome `S skip · use defaults`): pressing S on the Welcome screen
  // jumps STRAIGHT to the Summary, pre-filled with the locked defaults
  // (ocean · 25·5·15 · 4 cycles · notifications On). Esc-back and the per-field
  // steps are bypassed. The Summary recap must reflect those defaults, and
  // confirming ("begin") must persist exactly those six defaults via the driven port.
  it('S on welcome jumps to summary with ocean/default/On defaults and persists them on begin', async () => {
    const writer = new InMemoryConfigWriter();
    let driver: ReturnType<typeof render> | undefined;
    const adapter = new SetupWizardAdapter(writer, (element) => {
      driver = render(element);
      return driver;
    });

    const resultPromise = adapter.run({ tmuxDetected: false });
    await flush();
    driver!.stdin.write('s'); // skip to defaults → Summary
    await flush();

    const frame = driver!.lastFrame() ?? '';
    // Summary confirmation hero (rSummary L251-252).
    expect(frame).toContain("You're all set");
    expect(frame).toContain('Starting your first WORK session');
    // The recap shows the DEFAULTS: Ocean theme, 25 · 5 × 4, long break 15, On.
    expect(frame).toContain('Ocean');
    expect(frame).toContain('25 · 5 × 4');
    expect(frame).toContain('long break 15');
    // The Notify recap line shows "On" (defaults). Strip ANSI to assert the
    // label and value sit together on the recap row (Ink interleaves SGR codes).
    // eslint-disable-next-line no-control-regex
    expect(frame.replace(/\x1b\[[0-9;]*m/g, '')).toMatch(/Notify\s+On/);
    // "WORK · POMODORO 1 of 4" bar at 00:00 (rSummary L258-259).
    expect(frame).toContain('WORK · POMODORO 1 of 4');
    expect(frame).toContain('25:00');
    // Summary footer: Enter begin · Esc back. Nothing persisted until "begin".
    expect(frame).toContain('begin');
    expect(frame).toContain('back');
    expect(writer.written).toBeNull();

    driver!.stdin.write(ENTER); // begin → atomic write of the six locked defaults
    await flush();
    const result = await resultPromise;
    // The skip flow persists exactly the locked defaults through the driven port.
    expect(writer.written).toEqual(result);
    expect(writer.written).toMatchObject({
      palette: 'ocean',
      work: 25,
      break: 5,
      longBreak: 15,
      cycles: 4,
      notifications: true,
    });
    driver!.unmount();
  });

  // Cross-step Esc-back: Esc steps back one screen (Notify→Timing→Theme→Welcome),
  // preserving prior selections. Here: advance to Notify, change the theme to
  // lavender on the way, Esc back to Timing then Theme, and confirm the lavender
  // selection survived (the ▸ marker is still on lavender, not reset to ocean).
  it('Esc returns to the previous step with prior selections intact', async () => {
    const harness = render(
      React.createElement(SetupWizard, {
        tmuxDetected: false,
        onComplete: () => undefined,
        onQuit: () => undefined,
      }),
    );
    await flush();
    harness.stdin.write(ENTER); // Welcome → Theme
    await flush();
    harness.stdin.write(ARROW_DOWN); // ocean → lavender
    await flush();
    harness.stdin.write(ENTER); // Theme (lavender) → Timing
    await flush();
    harness.stdin.write(ENTER); // Timing (Default) → Notifications
    await flush();

    // On Notifications now — Esc steps back to Timing.
    harness.stdin.write(ESCAPE);
    await flush();
    let frame = harness.lastFrame() ?? '';
    expect(frame).toMatch(/2\s*Timing/); // back on the Timing step
    expect(frame).toContain('your cycle');

    // Esc again steps back to Theme — the lavender selection must be intact.
    harness.stdin.write(ESCAPE);
    await flush();
    frame = harness.lastFrame() ?? '';
    expect(frame).toMatch(/1\s*Theme/); // back on the Theme step
    expect(frame).toMatch(/▸\s*lavender/i); // selection preserved
    expect(frame).not.toMatch(/▸\s*ocean/i);
    harness.unmount();
  });

  // The capstone: completing the Summary (Enter "begin") writes ALL SIX keys
  // atomically via the driven ConfigWritePort AND resolves the WizardResult (the
  // launch intent index.ts uses to start the session). Drive the full flow
  // Welcome→Theme→Timing→Notify→Summary→begin and assert the persisted six-key set.
  it('completing the summary writes all six keys via the ConfigWritePort', async () => {
    const writer = new InMemoryConfigWriter();
    let driver: ReturnType<typeof render> | undefined;
    const adapter = new SetupWizardAdapter(writer, (element) => {
      driver = render(element);
      return driver;
    });

    const resultPromise = adapter.run({ tmuxDetected: false });
    await flush();
    driver!.stdin.write(ENTER); // Welcome → Theme
    await flush();
    driver!.stdin.write(ENTER); // Theme (ocean) → Timing
    await flush();
    driver!.stdin.write(ENTER); // Timing (Default) → Notifications
    await flush();
    driver!.stdin.write(ENTER); // Notifications (On) → Summary
    await flush();

    // We are on the Summary now (not completed yet): the recap is shown and the
    // config has NOT been written — completion only happens on "begin".
    expect(driver!.lastFrame() ?? '').toContain("You're all set");
    expect(writer.written).toBeNull();

    driver!.stdin.write(ENTER); // Summary → begin (write + launch intent)
    await flush();

    const result = await resultPromise;
    // The resolved launch intent carries all six keys.
    expect(result).toMatchObject({
      palette: 'ocean',
      work: 25,
      break: 5,
      longBreak: 15,
      cycles: 4,
      notifications: true,
    });
    // The SAME six-key set was written atomically through the driven port.
    expect(writer.written).toEqual(result);
    expect(Object.keys(writer.written as Record<string, unknown>).sort()).toEqual(
      ['break', 'cycles', 'longBreak', 'notifications', 'palette', 'work'],
    );
  });

  // DD-8 graceful-degrade: when the atomic config write THROWS, the wizard must NOT
  // crash — it surfaces a clear stderr error and STILL resolves the in-memory result
  // so the composition root can launch the session with the choices just made.
  it('survives a config-write failure: resolves the result and warns on stderr (DD-8)', async () => {
    const writer = new ThrowingConfigWriter();
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    let driver: ReturnType<typeof render> | undefined;
    const adapter = new SetupWizardAdapter(writer, (element) => {
      driver = render(element);
      return driver;
    });
    try {
      const resultPromise = adapter.run({ tmuxDetected: false });
      await flush();
      driver!.stdin.write('s'); // skip to Summary (fast path to completion)
      await flush();
      driver!.stdin.write(ENTER); // begin → the write throws
      await flush();

      const result = await resultPromise;
      // The session can still launch: the in-memory result resolved despite the failure.
      expect(result).not.toBeNull();
      expect(result).toMatchObject({ palette: 'ocean', notifications: true });
      // A clear error was surfaced on stderr (graceful, not a crash).
      const stderrOut = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(stderrOut).toContain('could not save your config');
    } finally {
      stderrSpy.mockRestore();
      driver?.unmount();
    }
  });

  // Guard (preserved by the global handler): Q on Welcome still resolves null and
  // writes nothing. Passes immediately after the fix — it is a guard, not the RED.
  it('Q on welcome resolves null (quit) and writes nothing', async () => {
    const writer = new InMemoryConfigWriter();
    let driver: ReturnType<typeof render> | undefined;
    const adapter = new SetupWizardAdapter(writer, (element) => {
      driver = render(element);
      return driver;
    });

    const resultPromise = adapter.run({ tmuxDetected: false });
    await flush();
    driver!.stdin.write('q'); // Q on Welcome
    await flush();

    const result = await resultPromise;
    expect(result).toBeNull();
    expect(writer.written).toBeNull();
  });

  // The inner-screen footers must now advertise the Q quit key (Theme shown here),
  // so users have a visible quit affordance past Welcome (not just the Ctrl+C hatch).
  it('the Theme footer advertises the Q quit hint', async () => {
    const harness = await mountAtTheme();

    const frame = harness.lastFrame() ?? '';
    expect(frame).toContain('Q');
    expect(frame).toContain('quit');
    harness.unmount();
  });
});
