/**
 * Composition-root integration test — Reconfigure pre-seed fidelity (R2 / OQ-1).
 *
 * Step 03-02 (returning-home, final step). Closes the B3 / Sentinel-review deferral
 * and asserts the full-feature exit criterion: a Reconfigure re-entry reopens the
 * setup wizard PRE-FILLED with the user's saved settings.
 *
 * What this proves (and how it differs from the 02-02 HomeChoice routing test and
 * the setupWizardAdapter unit test):
 *   - 02-02 (home-interaction RECONF-03) proves ROUTING only: HomeChoice 'reconfigure'
 *     is resolved at the seam.
 *   - the setupWizardAdapter unit test hand-passes `initial: { palette: 'ocean' }`
 *     to the COMPONENT in isolation.
 *   - THIS test proves PRE-SEED FIDELITY through the PRODUCTION composition-root path:
 *     a real on-disk config.json drives the REAL `loadConfig()` port (which resolves
 *     ConfigResult.paletteName in its single parse, DD-4), the seed is derived the
 *     SAME way Reconfigure does in index.ts (`reconfigureSeed`: ConfigResult.paletteName
 *     + seconds→minutes), and that seed is fed to the PRODUCTION `SetupWizardAdapter`.
 *     The wizard's first theme frame is then observed PRE-FILLED with the saved theme.
 *
 * Why ink-testing-library (not a real `chromato setup` subprocess): the full
 * interactive wizard needs a raw-mode TTY for INPUT, which a spawned process lacks.
 * But the pre-seeded INITIAL FRAME renders to stdout WITHOUT any input — so
 * ink-testing-library deterministically observes the pre-filled first frame while
 * exercising the real adapter + the real seed-derivation. (Same harness the
 * setupWizardAdapter contract tests use; SPIKE-proven.)
 *
 * Production seam exercised here (NOT a hand-rolled parallel):
 *   src/configLoader.ts  → loadConfig() (the real config-loading port; resolves
 *                          ConfigResult.paletteName in its single config.json parse)
 *   src/adapters/setupWizardAdapter.tsx → SetupWizardAdapter.run({ initial })
 *                          (the real driving adapter Reconfigure delegates to)
 * `reconfigureSeed` itself lives inline in the composition root (src/index.ts),
 * which is non-importable (it calls program.parse() on load). This test reproduces
 * ONLY its documented mapping using the SAME production helpers it calls — it does
 * not duplicate any business logic those helpers own.
 *
 * TEST PARADIGM: EXEMPT — composition-root integration proof, single-example by
 * design (verifies WIRING, not an invariant). No Hypothesis/fast-check in stack.
 *
 * Port boundary: enters through loadConfig() (config-loading driving port) +
 * SetupWizardAdapter.run() (wizard driving adapter); asserts on the user-observable
 * rendered first frame (the pre-filled theme step). No internal classes touched.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render } from 'ink-testing-library';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SetupWizardAdapter } from '../../../src/adapters/setupWizardAdapter.js';
import { loadConfig, type ConfigResult } from '../../../src/configLoader.js';
import type { ConfigWritePort } from '../../../src/domain/ports.js';
import type { WizardResult } from '../../../src/configTypes.js';

/** In-memory ConfigWritePort — the wizard never writes on the pre-filled first frame. */
class InMemoryConfigWriter implements ConfigWritePort {
  public written: unknown = null;
  write(config: unknown): void {
    this.written = config;
  }
}

/** Ink registers useInput via useEffect (async); flush effects + a render tick. */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

const ENTER = '\r';

/**
 * Reproduce the documented Reconfigure pre-seed mapping (index.ts reconfigureSeed)
 * EXACTLY as production now derives it (DD-4 single-read): the palette NAME comes
 * straight off ConfigResult.paletteName — the typed name resolved during loadConfig's
 * single config.json parse — not a second readConfigFile() reverse-lookup. The
 * seconds→minutes conversion mirrors the composition root's seed (R2 / OQ-1). This
 * is NOT a re-implementation of business logic — loadConfig (the real port) owns the
 * palette resolution; this only mirrors index.ts's field plumbing.
 *
 * `passSeed=false` neutralizes the pre-seed (RED-with-teeth demonstration): the
 * wizard then defaults instead of pre-filling, so the saved-theme marker vanishes.
 */
function reconfigureSeed(configResult: ConfigResult): WizardResult {
  const { config, paletteName, notifications } = configResult;
  const toMinutes = (seconds: number): number => Math.round(seconds / 60);
  return {
    palette: paletteName,
    work: toMinutes(config.workDurationSeconds),
    break: toMinutes(config.breakDurationSeconds),
    longBreak: toMinutes(config.longBreakDurationSeconds),
    cycles: config.cycleCount,
    notifications,
  };
}

describe('Reconfigure pre-seed — composition-root integration (R2 / OQ-1)', () => {
  let originalChalkLevel: typeof chalk.level;
  let originalXdg: string | undefined;
  let tempDir: string;
  let configFilePath: string;

  beforeAll(() => {
    originalChalkLevel = chalk.level;
    // SPIKE gotcha: no TTY → chalk.level 0 → no colour to assert on.
    chalk.level = 3;
    originalXdg = process.env['XDG_CONFIG_HOME'];
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-reconfig-preseed-'));
    const xdgConfigHome = path.join(tempDir, 'config');
    configFilePath = path.join(xdgConfigHome, 'chromato', 'config.json');
    fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
    // Pre-existing config.json: Ocean theme + NON-default timings. The non-default
    // timings let us ALSO observe that the saved cadence flows into the wizard
    // (the timing preview), proving the seed is fully derived from disk.
    fs.writeFileSync(
      configFilePath,
      JSON.stringify({
        palette: 'ocean',
        work: 50,
        break: 10,
        longBreak: 20,
        cycles: 6,
        notifications: false,
      }),
      'utf8',
    );
    // Point the production configLoader at this on-disk config.
    process.env['XDG_CONFIG_HOME'] = xdgConfigHome;
  });

  afterAll(() => {
    chalk.level = originalChalkLevel;
    if (originalXdg === undefined) {
      delete process.env['XDG_CONFIG_HOME'];
    } else {
      process.env['XDG_CONFIG_HOME'] = originalXdg;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Mount the PRODUCTION wizard adapter advanced to the Theme step, pre-seeded from
   * the loaded config exactly as the composition root's Reconfigure delegation does.
   * `passSeed=false` strips the seed for the RED-with-teeth demonstration.
   */
  async function mountReconfiguredAtTheme(passSeed: boolean) {
    // PRODUCTION config-loading port (real configLoader.ts) against the on-disk file.
    const configResult = loadConfig({});
    const seed = reconfigureSeed(configResult);

    const writer = new InMemoryConfigWriter();
    let driver: ReturnType<typeof render> | undefined;
    const adapter = new SetupWizardAdapter(writer, (element) => {
      driver = render(element);
      return driver;
    });

    // PRODUCTION adapter.run with the derived pre-seed — exactly the call
    // runSetupWizard(reconfigureSeed(configResult)) makes in index.ts.
    void adapter.run({
      tmuxDetected: false,
      ...(passSeed ? { initial: seed } : {}),
    });
    await flush();
    driver!.stdin.write(ENTER); // Welcome → Theme
    await flush();
    return { driver: driver!, seed };
  }

  it('reopens the wizard pre-filled with the saved Ocean theme via the production seed path', async () => {
    const { driver, seed } = await mountReconfiguredAtTheme(true);

    // The seed itself, derived through the production path, reflects the saved file.
    expect(seed.palette).toBe('ocean');
    expect(seed.work).toBe(50);
    expect(seed.notifications).toBe(false);

    const lines = (driver.lastFrame() ?? '').split('\n');
    const oceanLine = lines.find((l) => l.includes('Ocean')) ?? '';
    const lavenderLine = lines.find((l) => l.includes('Lavender')) ?? '';

    // PRE-SEED FIDELITY (the teeth): the saved palette (ocean) carries the ●
    // saved-marker — it ONLY renders when `initial.palette === name` is wired
    // through. An unsaved option (lavender) does not carry it. Bypassing the seed
    // (mountReconfiguredAtTheme(false)) removes the ● entirely → this assertion
    // fails, which is the RED-with-teeth demonstration.
    expect(oceanLine).toContain('●');
    expect(lavenderLine).not.toContain('●');
    // And the saved theme is the pre-selected (▸) row, not a default fallthrough.
    expect(oceanLine).toMatch(/▸\s*Ocean/i);

    driver.unmount();
  });
});
