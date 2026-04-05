/**
 * Cucumber World object for help-splash-screen acceptance tests.
 *
 * Holds shared state across Given/When/Then steps within a single scenario.
 *
 * CRITICAL OVERRIDES from pomodoro-timer-cli world:
 * - NODE_ENV is set to 'production' (NOT 'test') so printBanner() and
 *   printHelpSplash() do not return early due to the NODE_ENV guard.
 * - FORCE_COLOR is set to '2' by default so chalk emits ANSI in piped tests
 *   that assert color presence. Scenarios testing color suppression must
 *   explicitly remove FORCE_COLOR and set NO_COLOR.
 *
 * Architecture note (CM-A compliance):
 * Step definitions invoke chromato ONLY through the CLI driving port
 * (spawn 'node dist/index.js'). No imports from src/.
 */

import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import type { ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ChromatoHelpWorld extends World {
  process: ChildProcess | null;
  capturedOutput: string;
  capturedStderr: string;
  exitCode: number | null;
  elapsedMs: number;
  tempDir: string;
  chromatoBin: string;
  chromatoEnv: NodeJS.ProcessEnv;
  // Secondary capture for --help vs no-args comparison
  secondOutput: string;
  secondExitCode: number | null;
}

class ChromatoHelpWorldImpl extends World implements ChromatoHelpWorld {
  process: ChildProcess | null = null;
  capturedOutput: string = '';
  capturedStderr: string = '';
  exitCode: number | null = null;
  elapsedMs: number = 0;
  tempDir: string = '';
  chromatoBin: string = '';
  chromatoEnv: NodeJS.ProcessEnv = {};
  secondOutput: string = '';
  secondExitCode: number | null = null;

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
      throw new Error(
        `chromato entry point not found. Expected ${distEntry} or ${srcEntry}. Run "pnpm build" first.`
      );
    }

    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-help-accept-'));

    // CRITICAL: NODE_ENV must be 'production' (not 'test') so printBanner()
    // and printHelpSplash() do not skip output due to the NODE_ENV guard.
    // FORCE_COLOR: '2' ensures chalk emits ANSI even over a pipe (default
    // for scenarios that test color presence). Override in steps for
    // NO_COLOR / no-ANSI scenarios.
    this.chromatoEnv = {
      ...process.env,
      XDG_DATA_HOME: this.tempDir,
      XDG_CONFIG_HOME: path.join(this.tempDir, 'config'),
      NODE_ENV: 'production',
      CHROMATO_TELEMETRY: 'false',
      FORCE_COLOR: '2',
      COLUMNS: '80',
      LINES: '24',
    };
  }
}

setWorldConstructor(ChromatoHelpWorldImpl);
