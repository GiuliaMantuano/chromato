/**
 * World TYPE for in-terminal-notifications acceptance tests.
 *
 * IMPORTANT: this module intentionally does NOT call setWorldConstructor.
 * Cucumber has ONE global World constructor per run (last registration wins,
 * following cucumber.config.mjs import order). The returning-home suite
 * registers the runtime World used by every suite in this project; its shape
 * (process/capturedOutput/tempDir/chromatoBin/chromatoEnv, XDG-isolated env,
 * CI='false', COLUMNS=80) is a superset of what these steps need. Registering
 * a second constructor here would silently replace the World for ALL suites
 * (observed: first-run-setup-wizard's seedConfig broke when this suite
 * registered its own World).
 *
 * This interface duck-types the shared fields so the steps stay type-safe
 * without owning the runtime World.
 *
 * CM-A compliance: steps invoke chromato ONLY through the CLI driving port
 * (spawn node dist/index.js). No imports from src/.
 */

import type { World } from '@cucumber/cucumber';
import type { ChildProcess } from 'node:child_process';

export interface NotificationsWorld extends World {
  process: ChildProcess | null;
  capturedOutput: string;
  capturedStderr: string;
  exitCode: number | null;
  /** Per-scenario temp directory (XDG_DATA_HOME for the spawned CLI). */
  tempDir: string;
  /** Absolute path to the chromato entry point (dist/index.js). */
  chromatoBin: string;
  /** Isolated environment for spawned chromato processes. */
  chromatoEnv: NodeJS.ProcessEnv;
}
