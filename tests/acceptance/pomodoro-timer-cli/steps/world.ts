/**
 * Cucumber World object for chromato acceptance tests.
 *
 * Holds shared state across Given/When/Then steps within a single scenario.
 * All scenario state lives here; step files share this via setWorldConstructor.
 *
 * Architecture note (CM-A compliance):
 * Step definitions invoke chromato ONLY through the CLI driving port
 * (spawn 'node dist/index.js' or the 'chromato' binary).
 * No imports from src/domain/, src/application/, or src/adapters/.
 */

import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ESM-compatible __dirname (package.json has "type": "module")
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ChromatoWorld extends World {
  // The chromato process spawned by a When step
  process: ChildProcess | null;
  // Captured stdout output from the spawned process
  capturedOutput: string;
  // Captured stderr output from the spawned process
  capturedStderr: string;
  // Exit code of the last completed process
  exitCode: number | null;
  // Elapsed time in milliseconds for the last command
  elapsedMs: number;
  // Temporary directory created for this scenario (cleaned up after)
  tempDir: string;
  // Path to the state.json file used in this scenario
  stateFilePath: string;
  // Absolute path to the chromato entry point
  chromatoBin: string;
  // Environment variables to pass to spawned chromato processes
  chromatoEnv: NodeJS.ProcessEnv;
}

class ChromatoWorldImpl extends World implements ChromatoWorld {
  process: ChildProcess | null = null;
  capturedOutput: string = '';
  capturedStderr: string = '';
  exitCode: number | null = null;
  elapsedMs: number = 0;
  tempDir: string = '';
  stateFilePath: string = '';
  chromatoBin: string = '';
  chromatoEnv: NodeJS.ProcessEnv = {};

  constructor(options: IWorldOptions) {
    super(options);

    // Resolve the chromato entry point relative to the project root.
    // In CI this is dist/index.js (built artifact).
    // In local development this is src/index.ts (via tsx) or dist/index.js.
    const projectRoot = path.resolve(__dirname, '../../../../');
    const distEntry = path.join(projectRoot, 'dist', 'index.js');
    const srcEntry = path.join(projectRoot, 'src', 'index.ts');

    if (fs.existsSync(distEntry)) {
      this.chromatoBin = distEntry;
    } else if (fs.existsSync(srcEntry)) {
      this.chromatoBin = srcEntry;
    } else {
      throw new Error(
        `chromato entry point not found. Expected ${distEntry} or ${srcEntry}. Run "pnpm build" first.`,
      );
    }

    // Create an isolated temp directory for state files per scenario.
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-accept-'));
    this.stateFilePath = path.join(this.tempDir, 'state.json');

    // Base environment: isolate XDG paths to the temp directory.
    // Remove shell-local color overrides so acceptance scenarios control
    // rendering mode explicitly instead of inheriting the parent terminal.
    const inheritedEnv = { ...process.env };
    delete inheritedEnv.NO_COLOR;
    delete inheritedEnv.FORCE_COLOR;
    // Force Ink off its CI-aware buffered-output path. ci-info treats the
    // literal string 'false' as a hard bypass that overrides every vendor
    // signal (GITHUB_ACTIONS, BUILDKITE, CIRCLECI, ...); ink.js:17 honours
    // the same convention. Deleting CI is insufficient because GH Actions
    // runners set GITHUB_ACTIONS=true, which independently triggers
    // ci-info's vendor detection.
    //
    // Refs:
    //   node_modules/.pnpm/ci-info@3.9.0/node_modules/ci-info/index.js:57
    //   node_modules/ink/build/ink.js:17
    // If ci-info or ink are upgraded, re-verify this bypass still applies.
    inheritedEnv.CI = 'false';

    this.chromatoEnv = {
      ...inheritedEnv,
      XDG_DATA_HOME: this.tempDir,
      XDG_CONFIG_HOME: path.join(this.tempDir, 'config'),
      NODE_ENV: 'test',
      CHROMATO_TELEMETRY: 'false',
      // Ensure a consistent terminal width for width-sensitive tests
      COLUMNS: '80',
      LINES: '24',
    };
  }
}

setWorldConstructor(ChromatoWorldImpl);
