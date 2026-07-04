/**
 * Helper utilities for help-splash-screen acceptance tests.
 *
 * Provides a synchronous runChromato via spawnSync — appropriate for help-path
 * tests where chromato exits quickly and we need all stdout captured reliably.
 * The async spawn variant (runChromato from pomodoro helpers) resolves on the
 * 'exit' event, which can fire before all piped stdout data has been drained.
 * spawnSync waits for the process to fully close, guaranteeing complete output.
 *
 * CM-A compliance: no imports from src/ production code.
 */

import { spawnSync } from 'node:child_process';
import type { ChromatoHelpWorld } from './world.js';

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Runs chromato synchronously and captures complete stdout/stderr.
 * Suitable for short-lived commands (help, version) that exit quickly.
 */
export function runChromato(
  world: ChromatoHelpWorld,
  args: string[],
  timeoutMs: number = 10_000,
): Promise<RunResult> {
  const result = spawnSync('node', [world.chromatoBin, ...args], {
    env: world.chromatoEnv,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });
  return Promise.resolve({
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  });
}

// Re-export shared utilities from the pomodoro test suite.
export {
  countAnsiSequences,
  stripAnsi,
  measureTimeToFirstByte,
  runChromatoUntilFirstFrame,
} from '../../pomodoro-timer-cli/steps/helpers.js';
