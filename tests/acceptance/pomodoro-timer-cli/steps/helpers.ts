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

import { spawn, type ChildProcess } from 'node:child_process';
import type { ChromatoWorld } from './world.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Process spawning
// ---------------------------------------------------------------------------

/**
 * Spawns chromato as a long-lived background process (for TUI tests).
 * The caller is responsible for killing the process in the After hook.
 */
export function spawnChromato(world: ChromatoWorld, args: string[]): ChildProcess {
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

export interface FirstFrameResult {
  firstFrameMs: number;
  stdout: string;
  exitCode: number | null;
}

/**
 * Runs chromato and measures the time until the first stdout output arrives.
 * Kills the process immediately after the first output chunk (or after safetyTimeoutMs).
 * Returns elapsed ms from process spawn to first stdout byte, plus captured output.
 *
 * Used to test AC-05.1: first TUI frame within 100ms.
 */
export function runChromatoUntilFirstFrame(
  world: ChromatoWorld,
  args: string[],
  safetyTimeoutMs: number = 3000,
): Promise<FirstFrameResult> {
  return new Promise((resolve) => {
    const nodeArgs = [world.chromatoBin, ...args];
    const start = Date.now();
    const proc = spawn('node', nodeArgs, {
      env: world.chromatoEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    let stdout = '';
    let firstFrameMs = -1;
    let resolved = false;

    const finish = (code: number | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(safetyTimer);
      world.process = null;
      resolve({
        firstFrameMs: firstFrameMs >= 0 ? firstFrameMs : Date.now() - start,
        stdout,
        exitCode: code,
      });
    };

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (firstFrameMs < 0) {
        firstFrameMs = Date.now() - start;
        // Kill after capturing first frame — we have the measurement we need.
        if (!proc.killed) proc.kill('SIGTERM');
      }
    });

    const safetyTimer = setTimeout(() => {
      if (!proc.killed) proc.kill('SIGTERM');
    }, safetyTimeoutMs);

    proc.on('exit', (code) => finish(code));
    world.process = proc;
  });
}

/**
 * Runs chromato and captures all output within a timeout.
 * Sends SIGTERM after the timeout to terminate long-running processes (TUI).
 * Returns when the process exits.
 */
export function runChromato(
  world: ChromatoWorld,
  args: string[],
  timeoutMs: number = 10_000,
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
  timeoutMs: number,
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
            `Captured so far: ${buffer}`,
        ),
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
/**
 * Minimal structural shape measureTimeToFirstByte needs. Both ChromatoWorld
 * and the help-splash ChromatoHelpWorld satisfy it (interface segregation),
 * so the helper can time either suite's world without a coupling cast.
 */
export interface FirstByteWorld {
  chromatoBin: string;
  chromatoEnv: NodeJS.ProcessEnv;
  process: ChildProcess | null;
}

export function measureTimeToFirstByte(
  world: FirstByteWorld,
  args: string[],
  timeoutMs: number = 5000,
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

/**
 * Strips all ANSI/VT CSI escape sequences using the full ECMA-48 pattern.
 * Parameter bytes: 0x20–0x3F (includes '?', '<', '=', '>' for DEC private modes)
 * Final byte: 0x40–0x7E
 *
 * This is a strict superset of stripAnsi: it also strips DEC private mode
 * sequences such as \x1b[?1049h (alternate-screen enter) and \x1b[?1049l
 * (alternate-screen exit) that stripAnsi leaves intact.
 */
export function stripAllEscapes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[\x20-\x3F]*[\x40-\x7E]/g, '');
}
