/**
 * Walking-skeleton step definitions for in-terminal-notifications.
 *
 * Domain concept: the warm phase-change copy renders as an in-frame banner
 * inside the live TUI session (spike slice-01 promotion).
 *
 * CM-A compliance: invokes chromato ONLY through the CLI driving port
 * (spawn node dist/index.js). resolveCopy/TuiAdapter are never imported.
 */

import { Given, When, Then, After } from '@cucumber/cucumber';
import { spawn, type ChildProcess } from 'node:child_process';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NotificationsWorld } from './world.js';

/** Waits for a pattern in the spawned process stdout (local copy of the
 * pomodoro-timer-cli helper — suites stay self-contained by convention). */
function waitForOutput(proc: ChildProcess, pattern: RegExp, timeoutMs: number): Promise<void> {
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

    proc.on('exit', (code) => {
      clearTimeout(timer);
      proc.stdout?.off('data', onData);
      if (!pattern.test(buffer)) {
        reject(
          new Error(
            `chromato exited (code ${code}) before pattern ${pattern} appeared.\n` +
              `Captured: ${buffer}`,
          ),
        );
      }
    });
  });
}

// Tag-scoped: cucumber hooks are global; an untagged After would run for every
// scenario in every suite. Cleanup here covers only this feature's scenarios.
After({ tags: '@in-terminal-notifications' }, function (this: NotificationsWorld) {
  if (this.process && !this.process.killed) {
    try {
      this.process.kill('SIGTERM');
    } catch {
      // Process may have already exited — ignore.
    }
  }
  try {
    fs.rmSync(this.tempDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
});

Given('chromato is installed for in-terminal notifications', function (this: NotificationsWorld) {
  fs.mkdirSync(path.join(this.tempDir, 'chromato'), { recursive: true });
  fs.mkdirSync(path.join(this.tempDir, 'config', 'chromato'), { recursive: true });
});

When(
  'the user starts a session whose work phase lasts 2 seconds',
  async function (this: NotificationsWorld) {
    // CHROMATO_WORK_SECONDS compresses the work phase; NODE_ENV=acceptance
    // disables the TUI 1-frame test-mode early exit so the session keeps
    // rendering through the WORK->BREAK transition (established pattern in
    // pomodoro-timer-cli/steps/phase-transition-steps.ts).
    const env = { ...this.chromatoEnv, NODE_ENV: 'acceptance', CHROMATO_WORK_SECONDS: '2' };
    const proc = spawn('node', [this.chromatoBin, 'start'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });
    proc.stdout?.on('data', (chunk: Buffer) => {
      this.capturedOutput += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      this.capturedStderr += chunk.toString();
    });
    proc.on('exit', (code) => {
      this.exitCode = code;
    });
    this.process = proc;
    await waitForOutput(proc, /WORK/, 5000);
  },
);

When('the work timer completes', async function (this: NotificationsWorld) {
  // The 2-second work phase transitions to BREAK; the banner (rendered on the
  // PHASE_CHANGED notification) must appear in the frames that follow. Check
  // already-captured output first (the transition may have raced this step).
  assert.ok(this.process, 'Expected a running chromato session');
  const bannerPattern = /Pomodoro complete/;
  if (!bannerPattern.test(this.capturedOutput)) {
    await waitForOutput(this.process, bannerPattern, 15_000);
  }
});

Then(
  'the in-frame banner shows the warm copy {string}',
  function (this: NotificationsWorld, copyTitle: string) {
    assert.ok(
      this.capturedOutput.includes(copyTitle),
      `Expected banner title "${copyTitle}" in TUI output but got:\n${this.capturedOutput}`,
    );
  },
);

Then('the banner body reads {string}', function (this: NotificationsWorld, copyBody: string) {
  assert.ok(
    this.capturedOutput.includes(copyBody),
    `Expected banner body "${copyBody}" in TUI output but got:\n${this.capturedOutput}`,
  );
});

Then(
  'the timer frame still shows the {string} phase label',
  function (this: NotificationsWorld, phaseLabel: string) {
    assert.ok(
      this.capturedOutput.includes(phaseLabel),
      `Expected phase label "${phaseLabel}" in TUI output (banner renders INSIDE the frame) ` +
        `but got:\n${this.capturedOutput}`,
    );
  },
);
