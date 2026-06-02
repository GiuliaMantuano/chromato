/**
 * Cucumber World for returning-home acceptance tests.
 *
 * Mirrors tests/acceptance/first-run-setup-wizard/steps/world.ts (CM-A compliance):
 * steps invoke chromato ONLY through the CLI driving port (spawn node dist/index.js).
 * No imports from src/domain, src/application, or src/adapters.
 *
 * The home screen renders its recap to stdout, so a spawned process captures the
 * rendered text even though its stdin is not a raw-mode TTY. To exercise the
 * interactive (guard-true) branch we force chalk truecolor + an interactive-looking
 * stdout via FORCE_COLOR; the guard's isTTY input is supplied by the composition
 * root from process.stdout.isTTY (DESIGN D-RH-1). Scenarios that want the
 * non-interactive branch override the environment (NO_COLOR / CI / --no-color / pipe).
 */

import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import type { ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ReturningHomeWorld extends World {
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
  /** Seed config.json directly (simulates a prior wizard write). */
  seedConfig(partial: Record<string, unknown>): void;
  /** Seed an invalid config.json (corrupt-config path, AC-RH-07.4). */
  seedCorruptConfig(): void;
}

class ReturningHomeWorldImpl extends World implements ReturningHomeWorld {
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

    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-home-accept-'));
    const xdgConfigHome = path.join(this.tempDir, 'config');
    this.configFilePath = path.join(xdgConfigHome, 'chromato', 'config.json');

    const inheritedEnv = { ...process.env };
    delete inheritedEnv.NO_COLOR;
    delete inheritedEnv.FORCE_COLOR;
    // Force Ink off its CI-aware buffered path (see wizard world.ts rationale).
    // Scenarios that WANT CI behaviour override this.
    inheritedEnv.CI = 'false';
    // The home guard also blocks on TMUX-unrelated env; ensure a clean slate so
    // a tmux row only appears when a scenario explicitly sets TMUX.
    delete inheritedEnv.TMUX;

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

  seedCorruptConfig(): void {
    fs.mkdirSync(path.dirname(this.configFilePath), { recursive: true });
    fs.writeFileSync(this.configFilePath, '{ this is not valid json', 'utf8');
  }
}

setWorldConstructor(ReturningHomeWorldImpl);
