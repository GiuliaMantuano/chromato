/**
 * Shared helpers for in-terminal-notifications acceptance steps (DISTILL).
 *
 * CM-A compliance: every session runs through the CLI driving port
 * (spawn node dist/index.js). No imports from src/.
 *
 * The runtime Cucumber World is registered by the returning-home suite
 * (see steps/world.ts for the one-constructor-per-run rationale); this
 * interface duck-types the superset of fields these steps rely on,
 * including the config-seeding helpers the shared World provides.
 */

import { spawn } from 'node:child_process';
import * as assert from 'node:assert';
import type { World } from '@cucumber/cucumber';
import type { ChildProcess } from 'node:child_process';

export interface NotificationSessionWorld extends World {
  process: ChildProcess | null;
  capturedOutput: string;
  capturedStderr: string;
  exitCode: number | null;
  /** Per-scenario temp directory (XDG_DATA_HOME for the spawned CLI). */
  tempDir: string;
  /** $XDG_CONFIG_HOME/chromato/config.json for this scenario. */
  configFilePath: string;
  /** Absolute path to the chromato entry point (dist/index.js). */
  chromatoBin: string;
  /** Isolated environment for spawned chromato processes. */
  chromatoEnv: NodeJS.ProcessEnv;
  /** Seed config.json directly (simulates a prior wizard write). */
  seedConfig(partial: Record<string, unknown>): void;
  /** Output-length marker used by appended-after-this-point assertions. */
  outputMark?: number;
}

/** OSC 0 title-set prefix (ESC ] 0 ;) — spike-verified byte sequence. */
export const OSC_TITLE_PREFIX = '\x1b]0;';
/** XTWINOPS 22 save-title / 23 restore-title sequences. */
export const XTWINOPS_SAVE = '\x1b[22;0t';
export const XTWINOPS_RESTORE = '\x1b[23;0t';

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Spawn `chromato start` with compressed timing. NODE_ENV=acceptance keeps
 * the TUI alive past the first frame (skeleton pattern); the spawned stdout
 * is a pipe — exactly the E2/E9 environment CI sees.
 */
export function startSession(
  world: NotificationSessionWorld,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
): void {
  const env = { ...world.chromatoEnv, NODE_ENV: 'acceptance', ...extraEnv };
  const proc = spawn('node', [world.chromatoBin, 'start', ...args], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });
  proc.stdout?.on('data', (chunk: Buffer) => {
    world.capturedOutput += chunk.toString();
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    world.capturedStderr += chunk.toString();
  });
  proc.on('exit', (code) => {
    world.exitCode = code;
  });
  world.process = proc;
}

/** Poll the captured output until `pattern` appears or `timeoutMs` elapses. */
export async function waitForCaptured(
  world: NotificationSessionWorld,
  pattern: RegExp,
  timeoutMs: number,
  what: string,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pattern.test(world.capturedOutput)) {
      return;
    }
    await delay(100);
  }
  assert.fail(
    `Timed out after ${timeoutMs}ms waiting for ${what} (${pattern}).\n` +
      `Captured output:\n${world.capturedOutput}\nCaptured stderr:\n${world.capturedStderr}`,
  );
}

/** SIGTERM the running session and wait for it to exit (bounded). */
export async function endSession(world: NotificationSessionWorld): Promise<void> {
  const proc = world.process;
  if (!proc || proc.exitCode !== null) {
    return;
  }
  const exited = new Promise<void>((resolve) => {
    proc.once('exit', () => resolve());
  });
  proc.kill('SIGTERM');
  await Promise.race([exited, delay(3000)]);
}

/**
 * Assert no bell byte in `output`, ignoring BEL bytes that merely terminate
 * an OSC sequence (the OSC 0 title terminator is also 0x07 — a title is not
 * a ding).
 */
export function assertNoBell(output: string, context: string): void {
  const withoutOsc = output.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
  assert.ok(
    !withoutOsc.includes('\x07'),
    `Expected no bell character in ${context}, but found one.\nCaptured:\n${JSON.stringify(output.slice(0, 2000))}`,
  );
}

/** Assert zero window-title / XTWINOPS escape bytes in `output`. */
export function assertNoTitleEscapes(output: string, context: string): void {
  for (const seq of [OSC_TITLE_PREFIX, XTWINOPS_SAVE, XTWINOPS_RESTORE]) {
    assert.ok(
      !output.includes(seq),
      `Expected no window-title escape sequences in ${context}, ` +
        `but found ${JSON.stringify(seq)}.`,
    );
  }
}
