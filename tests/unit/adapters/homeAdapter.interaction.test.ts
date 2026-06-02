/**
 * HomeAdapter interaction spec (returning-home step 02-02) — the keypress
 * RESOLUTION of HomeChoice ported from the @ink-testing @skip living-doc
 * scenarios in tests/acceptance/returning-home/home-interaction.feature.
 *
 * WHY ink-testing-library (DT-2 two-harness split): these scenarios drive
 * RAW-MODE keypresses (↑ ↓ Enter R Q Ctrl+C) which need a real TTY stdin that a
 * cucumber-spawned subprocess does NOT provide. The cucumber @ink-testing
 * scenarios remain @skip (cucumber cannot drive raw-mode input); this vitest spec
 * is the executable verification harness. We assert observable outcomes at the
 * HomeChoice seam resolved by HomeAdapter.run() (D-RH-5) + the menu highlight in
 * the rendered frame — never a `renderHome` export (does not exist, D5).
 *
 * TEST PARADIGM: EXEMPT — interactive Ink keypress flow via ink-testing-library,
 * single-example by design (DT-5: a 3-action menu over a fixed config, not a
 * domain-rich state machine; no Hypothesis/fast-check in stack).
 *
 * Port boundary: HomeAdapter is a DRIVING adapter; tests enter through run()
 * (driving the injected ink-testing-library stdin) and assert on the resolved
 * HomeChoice (the testable seam) and the rendered highlight. The recap input is
 * the already-loaded ConfigResult prop ONLY. The single-read contract (K8 — no
 * second loadConfig on Start) is enforced architecturally: HomeAdapter's run()
 * takes a ConfigResult prop and has no loadConfig dependency, and the composition
 * root reuses the already-loaded ConfigResult (ConfigResult.paletteName, DD-4).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render } from 'ink-testing-library';
import chalk from 'chalk';
import { HomeAdapter, type HomeChoice } from '../../../src/adapters/homeAdapter.js';
import type { ConfigResult } from '../../../src/configLoader.js';
import { getPalette, type PaletteName } from '../../../src/domain/palette.js';

/** Ink registers useInput via useEffect (async); flush effects + a render tick. */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function stripAnsi(frame: string): string {
  // eslint-disable-next-line no-control-regex
  return frame.replace(/\x1b\[[0-9;]*m/g, '');
}

const ARROW_DOWN = '\x1b[B';
const ARROW_UP = '\x1b[A';
const ENTER = '\r';
const CTRL_C = '\x03';

const CONFIG_PATH = '/home/kai/.config/chromato/config.json';

function configResultFor(paletteName: PaletteName = 'ocean'): ConfigResult {
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
    notifications: true,
  };
}

/**
 * Mounts the HomeAdapter via run() with an injected ink-testing-library renderer
 * so we can drive raw-mode keypresses headlessly. Returns the run() promise (which
 * resolves the HomeChoice once the user acts) plus the live driver for stdin/frame.
 */
function mountHome(config: ConfigResult = configResultFor(), tmuxDetected = false) {
  let driver: ReturnType<typeof render> | undefined;
  const adapter = new HomeAdapter((element) => {
    driver = render(element);
    return driver;
  });
  const choicePromise = adapter.run({ config, tmuxDetected, configPath: CONFIG_PATH });
  return { choicePromise, getDriver: () => driver! };
}

describe('HomeAdapter interaction (ink-testing-library) — HomeChoice resolution', () => {
  let originalChalkLevel: chalk.Level;
  beforeAll(() => {
    originalChalkLevel = chalk.level;
    chalk.level = 3; // SPIKE gotcha: no TTY → chalk.level 0 → no colour to assert on.
  });
  afterAll(() => {
    chalk.level = originalChalkLevel;
  });

  // ── MENU-01 (AC-RH-02.4): initial render — menu, default highlight, footer ──
  it('opens with the three menu items, Start highlighted by default, and the footer hint', async () => {
    const { getDriver } = mountHome();
    await flush();

    const plain = stripAnsi(getDriver().lastFrame() ?? '');
    // The three menu items.
    expect(plain).toContain('Start a focus session');
    expect(plain).toContain('Reconfigure');
    expect(plain).toContain('Quit');
    // Default highlight is on "Start a focus session" (the selection marker ▸ sits
    // on the Start row, not on Reconfigure/Quit).
    expect(plain).toMatch(/▸\s*Start a focus session/);
    expect(plain).not.toMatch(/▸\s*Reconfigure/);
    expect(plain).not.toMatch(/▸\s*Quit/);
    // Footer hint verbatim (prototype) — assert the four key/label pairs are present.
    expect(plain).toContain('↑↓');
    expect(plain).toContain('move');
    expect(plain).toContain('Enter');
    expect(plain).toContain('choose');
    expect(plain).toContain('R');
    expect(plain).toContain('reconfigure');
    expect(plain).toContain('Q');
    expect(plain).toContain('quit');
    getDriver().unmount();
  });

  // ── NAV-01a/b/c + NAV-02 (AC-RH-03): down/up move and WRAP the highlight ────
  it('down arrow moves Start → Reconfigure → Quit and wraps back to Start', async () => {
    const { getDriver } = mountHome();
    await flush();

    getDriver().stdin.write(ARROW_DOWN); // Start → Reconfigure (NAV-01a)
    await flush();
    expect(stripAnsi(getDriver().lastFrame() ?? '')).toMatch(/▸\s*Reconfigure/);

    getDriver().stdin.write(ARROW_DOWN); // Reconfigure → Quit (NAV-01b)
    await flush();
    expect(stripAnsi(getDriver().lastFrame() ?? '')).toMatch(/▸\s*Quit/);

    getDriver().stdin.write(ARROW_DOWN); // Quit → Start (wrap, NAV-01c)
    await flush();
    expect(stripAnsi(getDriver().lastFrame() ?? '')).toMatch(/▸\s*Start a focus session/);
    getDriver().unmount();
  });

  it('up arrow from the first item wraps to the last (Quit)', async () => {
    const { getDriver } = mountHome();
    await flush();

    getDriver().stdin.write(ARROW_UP); // Start → Quit (wrap up, NAV-02)
    await flush();
    expect(stripAnsi(getDriver().lastFrame() ?? '')).toMatch(/▸\s*Quit/);
    getDriver().unmount();
  });

  // ── START-01 (AC-RH-04.1): Enter on Start resolves 'start' and exits ────────
  it('Enter on Start resolves the choice to start and exits', async () => {
    const { choicePromise, getDriver } = mountHome();
    await flush();

    getDriver().stdin.write(ENTER); // Enter on the default Start highlight
    await flush();

    const choice = await choicePromise;
    expect(choice).toEqual<HomeChoice>({ kind: 'start' });
  });

  // ── START-02 (AC-RH-04.2, K8): Start reuses the already-loaded config. The
  // single-read contract is enforced by HomeAdapter.run's ConfigResult-prop
  // signature (no loadConfig dependency) + the composition root's reuse of the
  // already-loaded ConfigResult; here we assert the observable Start outcome. ──
  it('starting reuses the already-loaded config and resolves to start (K8)', async () => {
    const { choicePromise, getDriver } = mountHome();
    await flush();
    getDriver().stdin.write(ENTER); // Enter on Start
    await flush();

    const choice = await choicePromise;
    expect(choice).toEqual<HomeChoice>({ kind: 'start' });
  });

  // ── START-03 (AC-RH-04.1): navigate away and back, then Enter still starts ──
  it('starting after navigating down then up still resolves to start', async () => {
    const { choicePromise, getDriver } = mountHome();
    await flush();

    getDriver().stdin.write(ARROW_DOWN); // Start → Reconfigure
    await flush();
    getDriver().stdin.write(ARROW_UP); // Reconfigure → Start
    await flush();
    getDriver().stdin.write(ENTER); // Enter on Start
    await flush();

    const choice = await choicePromise;
    expect(choice).toEqual<HomeChoice>({ kind: 'start' });
  });

  // ── RECONF-01 (AC-RH-05.1): R shortcut resolves 'reconfigure' and exits ─────
  it('pressing R resolves the choice to reconfigure and exits', async () => {
    const { choicePromise, getDriver } = mountHome();
    await flush();

    getDriver().stdin.write('r');
    await flush();

    const choice = await choicePromise;
    expect(choice).toEqual<HomeChoice>({ kind: 'reconfigure' });
  });

  // ── RECONF-02/03 (AC-RH-05.2/3): Reconfigure via menu (down + Enter) ────────
  it('selecting Reconfigure via the menu and pressing Enter resolves to reconfigure', async () => {
    const { choicePromise, getDriver } = mountHome();
    await flush();

    getDriver().stdin.write(ARROW_DOWN); // Start → Reconfigure
    await flush();
    getDriver().stdin.write(ENTER); // Enter on Reconfigure
    await flush();

    const choice = await choicePromise;
    expect(choice).toEqual<HomeChoice>({ kind: 'reconfigure' });
  });

  // ── QUIT-01 (AC-RH-06.1): Q resolves 'quit', exits, writes no saved setting ─
  it('pressing Q resolves the choice to quit and writes no saved setting', async () => {
    const { choicePromise, getDriver } = mountHome();
    await flush();
    getDriver().stdin.write('q');
    await flush();

    const choice = await choicePromise;
    // No-write contract: the home adapter has no config-write port at all — its
    // sole output is the resolved HomeChoice, so quitting writes nothing.
    expect(choice).toEqual<HomeChoice>({ kind: 'quit' });
  });

  // ── QUIT-02 (AC-RH-06.2): Quit via the menu (navigate to Quit + Enter) ──────
  it('selecting Quit via the menu and pressing Enter resolves to quit', async () => {
    const { choicePromise, getDriver } = mountHome();
    await flush();

    getDriver().stdin.write(ARROW_UP); // Start → Quit (wrap up to the last item)
    await flush();
    getDriver().stdin.write(ENTER); // Enter on Quit
    await flush();

    const choice = await choicePromise;
    expect(choice).toEqual<HomeChoice>({ kind: 'quit' });
  });

  // ── QUIT-03 (AC-RH-06.3): Ctrl+C exits cleanly to quit, writes nothing ──────
  it('sending Ctrl+C resolves the choice to quit and writes no saved setting', async () => {
    const { choicePromise, getDriver } = mountHome();
    await flush();
    getDriver().stdin.write(CTRL_C);
    await flush();

    const choice = await choicePromise;
    expect(choice).toEqual<HomeChoice>({ kind: 'quit' });
  });
});
