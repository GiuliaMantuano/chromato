/**
 * Cucumber World for first-run-setup-wizard acceptance tests.
 *
 * Mirrors tests/acceptance/pomodoro-timer-cli/steps/world.ts (CM-A compliance):
 * steps invoke chromato ONLY through the CLI driving port (spawn node dist/index.js).
 * No imports from src/domain, src/application, or src/adapters.
 *
 * Difference from the pomodoro world: this feature is config-centric, so the
 * world exposes the config.json path under the isolated XDG_CONFIG_HOME and a
 * helper to seed it directly (simulating a wizard write — the real write port is
 * unit-tested separately, so Givens must not depend on the not-yet-implemented adapter).
 */

import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import type { ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SetupWizardWorld extends World {
  process: ChildProcess | null;
  capturedOutput: string;
  capturedStderr: string;
  exitCode: number | null;
  elapsedMs: number;
  tempDir: string;
  /** $XDG_CONFIG_HOME/chromato/config.json for this scenario. */
  configFilePath: string;
  chromatoBin: string;
  chromatoEnv: NodeJS.ProcessEnv;
  /** Seed config.json directly (simulates a wizard write). */
  seedConfig(partial: Record<string, unknown>): void;
}

class SetupWizardWorldImpl extends World implements SetupWizardWorld {
  process: ChildProcess | null = null;
  capturedOutput = '';
  capturedStderr = '';
  exitCode: number | null = null;
  elapsedMs = 0;
  tempDir = '';
  configFilePath = '';
  chromatoBin = '';
  chromatoEnv: NodeJS.ProcessEnv = {};

  constructor(options: IWorldOptions) {
    super(options);

    const projectRoot = path.resolve(__dirname, '../../../../');
    const distEntry = path.join(projectRoot, 'dist', 'index.js');
    const srcEntry = path.join(projectRoot, 'src', 'index.ts');
    if (fs.existsSync(distEntry)) {
      this.chromatoBin = distEntry;
    } else if (fs.existsSync(srcEntry)) {
      this.chromatoBin = srcEntry;
    } else {
      throw new Error(`chromato entry point not found. Run "pnpm build" first.`);
    }

    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-setup-accept-'));
    const xdgConfigHome = path.join(this.tempDir, 'config');
    this.configFilePath = path.join(xdgConfigHome, 'chromato', 'config.json');

    const inheritedEnv = { ...process.env };
    delete inheritedEnv.NO_COLOR;
    delete inheritedEnv.FORCE_COLOR;
    // Force Ink off its CI-aware buffered path (see pomodoro world.ts for the
    // ci-info/ink rationale). Scenarios that WANT CI behaviour override this.
    inheritedEnv.CI = 'false';

    this.chromatoEnv = {
      ...inheritedEnv,
      XDG_DATA_HOME: this.tempDir,
      XDG_CONFIG_HOME: xdgConfigHome,
      NODE_ENV: 'test',
      CHROMATO_TELEMETRY: 'false',
      COLUMNS: '80',
      LINES: '24',
    };
  }

  seedConfig(partial: Record<string, unknown>): void {
    fs.mkdirSync(path.dirname(this.configFilePath), { recursive: true });
    fs.writeFileSync(this.configFilePath, JSON.stringify(partial, null, 2), 'utf8');
  }
}

setWorldConstructor(SetupWizardWorldImpl);
