/**
 * Test helper utilities for chromato acceptance tests.
 *
 * Provides:
 * - spawnChromato: starts chromato as a long-lived child process (for TUI scenarios)
 * - runChromato: runs chromato and captures output within a timeout (for command scenarios)
 * - readStateFile: reads and parses the chromato state.json from the test temp directory
 * - waitForOutput: waits for a pattern in the process stdout
 *
 * CM-A compliance: these helpers use only Node.js built-ins (child_process, fs, path).
 * No imports from src/ production code.
 *
 * All chromato invocations use "node {chromatoBin}" so that:
 * 1. The test uses the built dist/index.js (same as end users)
 * 2. No global 'chromato' binary needs to be installed in the test environment
 */

import { spawn, spawnSync, ChildProcess } from 'child_process';
import type { ChromatoWorld } from './world';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Process spawning
// ---------------------------------------------------------------------------

/**
 * Spawns chromato as a long-lived background process (for TUI tests).
 * The caller is responsible for killing the process in the After hook.
 */
export function spawnChromato(
  world: ChromatoWorld,
  args: string[]
): ChildProcess {
  const nodeArgs = [world.chromatoBin, ...args];
  const proc = spawn('node', nodeArgs, {
    env: world.chromatoEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });

  let stdout = '';
  let stderr = '';

  proc.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    world.capturedOutput = stdout;
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    world.capturedStderr = stderr;
  });

  proc.on('exit', (code) => {
    world.exitCode = code;
  });

  world.process = proc;
  return proc;
}

// ---------------------------------------------------------------------------

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Runs chromato and captures all output within a timeout.
 * Sends SIGTERM after the timeout to terminate long-running processes (TUI).
 * Returns when the process exits.
 */
export function runChromato(
  world: ChromatoWorld,
  args: string[],
  timeoutMs: number = 10_000
): Promise<RunResult> {
  return new Promise((resolve) => {
    const nodeArgs = [world.chromatoBin, ...args];
    const proc = spawn('node', nodeArgs, {
      env: world.chromatoEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
    }, timeoutMs);

    proc.on('exit', (code) => {
      clearTimeout(timer);
      world.process = null;
      resolve({
        stdout,
        stderr,
        exitCode: code,
      });
    });

    world.process = proc;
  });
}

// ---------------------------------------------------------------------------

/**
 * Waits for the process stdout to match a pattern, or rejects after timeout.
 */
export function waitForOutput(
  proc: ChildProcess,
  pattern: RegExp,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      if (pattern.test(buffer)) {
        clearTimeout(timer);
        proc.stdout?.off('data', onData);
        resolve();
      }
    };

    const timer = setTimeout(() => {
      proc.stdout?.off('data', onData);
      reject(
        new Error(
          `Timed out after ${timeoutMs}ms waiting for pattern ${pattern} in chromato output.\n` +
            `Captured so far: ${buffer}`
        )
      );
    }, timeoutMs);

    proc.stdout?.on('data', onData);

    // If the process exits before the pattern appears, reject.
    proc.on('exit', () => {
      if (pattern.test(buffer)) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// State file
// ---------------------------------------------------------------------------

/**
 * Reads and parses the chromato state.json from the test temp directory.
 * Returns null if the file does not exist or is not valid JSON.
 */
export function readStateFile(world: ChromatoWorld): Record<string, unknown> | null {
  const stateFile = path.join(world.tempDir, 'chromato', 'state.json');
  if (!fs.existsSync(stateFile)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Timing measurement
// ---------------------------------------------------------------------------

/**
 * Measures the elapsed time (in milliseconds) to receive the first byte of
 * stdout from a spawned process.
 */
export function measureTimeToFirstByte(
  world: ChromatoWorld,
  args: string[],
  timeoutMs: number = 5000
): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const nodeArgs = [world.chromatoBin, ...args];
    const proc = spawn('node', nodeArgs, {
      env: world.chromatoEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Timed out waiting for first byte after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout?.once('data', () => {
      const elapsed = Date.now() - start;
      clearTimeout(timer);
      proc.kill('SIGTERM');
      resolve(elapsed);
    });

    proc.on('exit', () => {
      clearTimeout(timer);
    });

    world.process = proc;
  });
}

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

/**
 * Returns the number of ANSI escape sequences in a string.
 */
export function countAnsiSequences(str: string): number {
  // eslint-disable-next-line no-control-regex
  const matches = str.match(/\x1b\[[0-9;]*[A-Za-z]/g);
  return matches ? matches.length : 0;
}

/**
 * Strips ANSI escape sequences and returns visible text only.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}
