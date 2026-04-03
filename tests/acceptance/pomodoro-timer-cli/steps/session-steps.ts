/**
 * Session lifecycle step definitions for chromato acceptance tests.
 *
 * Domain concept: session -- start, tick, complete, interrupt, configuration
 *
 * CM-A compliance: invokes chromato exclusively through the CLI driving port
 * (spawns the chromato binary/entry-point as a child process).
 * No imports from src/ production code.
 *
 * Hexagonal boundary note:
 * When steps spawn the CLI process. Then steps assert on stdout output
 * and state file content. The state file is a documented public artifact
 * (not an internal detail) -- it is the integration hub for tmux and prompt.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import type { ChromatoWorld } from './world';
import { spawnChromato, runChromato, runChromatoUntilFirstFrame, readStateFile, waitForOutput } from './helpers';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Given: session preconditions
// ---------------------------------------------------------------------------

Given('a {int}-minute work session has just started', async function (
  this: ChromatoWorld,
  minutes: number
) {
  this.process = spawnChromato(this, ['start', '--work', String(minutes)]);
  // Wait for first render frame
  await waitForOutput(this.process, /WORK|POMODORO/, 3000);
});

Given('a work session has been running for {int} minutes of a {int}-minute session', async function (
  this: ChromatoWorld,
  elapsed: number,
  total: number
) {
  // Inject a pre-seeded state file that reflects elapsed time.
  // This avoids waiting real minutes in tests.
  const remainingSeconds = (total - elapsed) * 60;
  const elapsedSeconds = elapsed * 60;
  const progressFraction = elapsedSeconds / (total * 60);
  const stateDir = path.join(this.tempDir, 'chromato');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'state.json'),
    JSON.stringify({
      schemaVersion: 1,
      phase: 'WORK',
      remainingSeconds,
      elapsedSeconds,
      progressFraction,
      currentPomodoro: 1,
      cycleCount: 4,
      completedToday: 0,
      streak: 0,
      isOverdue: false,
      overdueElapsedSeconds: 0,
      lastUpdatedUtc: new Date().toISOString(),
    })
  );
});

Given('a work session is active', async function (this: ChromatoWorld) {
  // Write a representative active work session state file.
  const stateDir = path.join(this.tempDir, 'chromato');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'state.json'),
    JSON.stringify({
      schemaVersion: 1,
      phase: 'WORK',
      remainingSeconds: 1200,
      elapsedSeconds: 300,
      progressFraction: 0.2,
      currentPomodoro: 1,
      cycleCount: 4,
      completedToday: 0,
      streak: 0,
      isOverdue: false,
      overdueElapsedSeconds: 0,
      lastUpdatedUtc: new Date().toISOString(),
    })
  );
  // Spawn the TUI so the session is truly active for scenarios that need it.
  this.process = spawnChromato(this, ['start', '--work', '25']);
  await waitForOutput(this.process, /WORK|POMODORO/, 3000);
});

Given('a work session is active as {string}', async function (
  this: ChromatoWorld,
  badge: string
) {
  // Parse "POMODORO N of M" to extract the session number.
  const match = badge.match(/POMODORO\s+(\d+)\s+of\s+(\d+)/i);
  const pomodoroNumber = match ? parseInt(match[1], 10) : 1;
  const cycleCount = match ? parseInt(match[2], 10) : 4;

  const stateDir = path.join(this.tempDir, 'chromato');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'state.json'),
    JSON.stringify({
      schemaVersion: 1,
      phase: 'WORK',
      remainingSeconds: 1200,
      elapsedSeconds: 300,
      progressFraction: 0.2,
      currentPomodoro: pomodoroNumber,
      cycleCount,
      completedToday: pomodoroNumber - 1,
      streak: 1,
      isOverdue: false,
      overdueElapsedSeconds: 0,
      lastUpdatedUtc: new Date().toISOString(),
    })
  );
  this.process = spawnChromato(this, ['start', '--work', '25']);
  await waitForOutput(this.process, /WORK|POMODORO/, 3000);
});

// NOTE: 'a work session with 2 seconds remaining' (exact text) is defined in
// phase-transition-steps.ts with injection behavior. The parametrized variant
// below was removed to avoid Cucumber ambiguity (WS-04 fix).

Given('a work session timer has reached zero', async function (this: ChromatoWorld) {
  // Inject an overdue state file.
  const stateDir = path.join(this.tempDir, 'chromato');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'state.json'),
    JSON.stringify({
      schemaVersion: 1,
      phase: 'OVERDUE',
      remainingSeconds: 0,
      elapsedSeconds: 1500,
      progressFraction: 1.0,
      currentPomodoro: 1,
      cycleCount: 4,
      completedToday: 0,
      streak: 0,
      isOverdue: true,
      overdueElapsedSeconds: 30,
      lastUpdatedUtc: new Date().toISOString(),
    })
  );
});

Given('{int} seconds have elapsed in overdue state with no user action', function (
  this: ChromatoWorld,
  _seconds: number
) {
  // Overdue state already set by prior Given. This step documents the time context.
});

Given('the developer completed {int} Pomodoros earlier today and quit chromato', function (
  this: ChromatoWorld,
  count: number
) {
  const stateDir = path.join(this.tempDir, 'chromato');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'state.json'),
    JSON.stringify({
      schemaVersion: 1,
      phase: 'IDLE',
      remainingSeconds: 0,
      elapsedSeconds: 0,
      progressFraction: 0,
      currentPomodoro: count + 1,
      cycleCount: 4,
      completedToday: count,
      streak: 1,
      isOverdue: false,
      overdueElapsedSeconds: 0,
      lastUpdatedUtc: new Date().toISOString(),
    })
  );
});

Given('Natasha completed {int} Pomodoros earlier today and quit chromato', function (
  this: ChromatoWorld,
  count: number
) {
  const stateDir = path.join(this.tempDir, 'chromato');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'state.json'),
    JSON.stringify({
      schemaVersion: 1,
      phase: 'IDLE',
      remainingSeconds: 0,
      elapsedSeconds: 0,
      progressFraction: 0,
      currentPomodoro: count + 1,
      cycleCount: 4,
      completedToday: count,
      streak: 1,
      isOverdue: false,
      overdueElapsedSeconds: 0,
      lastUpdatedUtc: new Date().toISOString(),
    })
  );
});

Given('no chromato session is currently running', function (this: ChromatoWorld) {
  // No process to spawn; ensure state file reflects IDLE.
  const stateDir = path.join(this.tempDir, 'chromato');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'state.json'),
    JSON.stringify({
      schemaVersion: 1,
      phase: 'IDLE',
      remainingSeconds: 0,
      elapsedSeconds: 0,
      progressFraction: 0,
      currentPomodoro: 0,
      cycleCount: 4,
      completedToday: 0,
      streak: 0,
      isOverdue: false,
      overdueElapsedSeconds: 0,
      lastUpdatedUtc: new Date().toISOString(),
    })
  );
});

Given('the state file shows phase {string}', function (this: ChromatoWorld, phase: string) {
  const stateDir = path.join(this.tempDir, 'chromato');
  fs.mkdirSync(stateDir, { recursive: true });
  const stateFile = path.join(stateDir, 'state.json');
  const existing = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    : {};
  fs.writeFileSync(stateFile, JSON.stringify({ ...existing, phase }));
});

Given('a work session state file exists with valid content', function (this: ChromatoWorld) {
  const stateDir = path.join(this.tempDir, 'chromato');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'state.json'),
    JSON.stringify({
      schemaVersion: 1,
      phase: 'WORK',
      remainingSeconds: 1200,
      elapsedSeconds: 300,
      progressFraction: 0.2,
      currentPomodoro: 1,
      cycleCount: 4,
      completedToday: 0,
      streak: 0,
      isOverdue: false,
      overdueElapsedSeconds: 0,
      lastUpdatedUtc: new Date().toISOString(),
    })
  );
});

// ---------------------------------------------------------------------------
// When: actions through the CLI driving port
// ---------------------------------------------------------------------------

When('the developer runs {string}', async function (this: ChromatoWorld, command: string) {
  const args = parseCommand(command);
  const start = Date.now();
  const result = await runChromato(this, args);
  this.elapsedMs = Date.now() - start;
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

When('the developer runs {string} with a {int}-minute work duration', async function (
  this: ChromatoWorld,
  command: string,
  minutes: number
) {
  const args = [...parseCommand(command), '--work', String(minutes)];
  const start = Date.now();
  const result = await runChromato(this, args, 3000);
  this.elapsedMs = Date.now() - start;
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

When('Natasha runs {string}', async function (this: ChromatoWorld, command: string) {
  const args = parseCommand(command);
  // Run chromato for 200ms to capture the initial TUI frame, then terminate.
  const result = await runChromato(this, args, 200);
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

When('Natasha runs {string} with default configuration', async function (
  this: ChromatoWorld,
  command: string
) {
  const args = parseCommand(command);
  // Measure time-to-first-frame: spawn and kill as soon as first stdout arrives.
  const result = await runChromatoUntilFirstFrame(this, args, 3000);
  this.elapsedMs = result.firstFrameMs;
  this.capturedOutput = result.stdout;
  this.exitCode = result.exitCode;
});

When('she runs {string}', async function (this: ChromatoWorld, command: string) {
  const args = parseCommand(command);
  const start = Date.now();
  const result = await runChromato(this, args, 3000);
  this.elapsedMs = Date.now() - start;
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

When('he runs {string}', async function (this: ChromatoWorld, command: string) {
  const args = parseCommand(command);
  const start = Date.now();
  const result = await runChromato(this, args, 3000);
  this.elapsedMs = Date.now() - start;
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

When('she presses Ctrl+C', async function (this: ChromatoWorld) {
  if (!this.process) {
    throw new Error('No chromato process is running to send Ctrl+C to.');
  }
  const start = Date.now();
  await new Promise<void>((resolve) => {
    this.process!.on('exit', (code) => {
      this.exitCode = code;
      this.elapsedMs = Date.now() - start;
      resolve();
    });
    this.process!.kill('SIGINT');
  });
});

When('the developer terminates the session via Ctrl+C', async function (this: ChromatoWorld) {
  if (!this.process) {
    throw new Error('No active chromato process to terminate.');
  }
  await new Promise<void>((resolve) => {
    this.process!.on('exit', (code) => {
      this.exitCode = code;
      resolve();
    });
    this.process!.kill('SIGINT');
  });
});

When('Yuki runs {string} with a {int}-minute work session', async function (
  this: ChromatoWorld,
  command: string,
  minutes: number
) {
  const args = [...parseCommand(command), '--work', String(minutes)];
  const start = Date.now();
  const result = await runChromato(this, args, 3000);
  this.elapsedMs = Date.now() - start;
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

When(
  'Aiko has added chromato to her tmux status-right\nAnd a {int}-minute work session is {int}% complete',
  async function (this: ChromatoWorld, _total: number, _percent: number) {
    // State file already set by Given. Run the status command.
    const start = Date.now();
    const result = await runChromato(this, ['status', '--format', 'tmux'], 5000);
    this.elapsedMs = Date.now() - start;
    this.capturedOutput = result.stdout;
    this.exitCode = result.exitCode;
  }
);

// ---------------------------------------------------------------------------
// Then: assertions on observable CLI output and state file
// ---------------------------------------------------------------------------

Then(/^the output shows a semantic version number \(e\.g\. ".*?"\)$/, function (
  this: ChromatoWorld
) {
  assert.match(
    this.capturedOutput,
    /\d+\.\d+\.\d+/,
    `Expected a semantic version number in output but got: ${this.capturedOutput}`
  );
});

Then('the process exits with code {int}', function (this: ChromatoWorld, expectedCode: number) {
  assert.strictEqual(
    this.exitCode,
    expectedCode,
    `Expected exit code ${expectedCode} but got ${this.exitCode}`
  );
});

Then('the first TUI frame appears within {int} milliseconds', function (
  this: ChromatoWorld,
  maxMs: number
) {
  assert.ok(
    this.elapsedMs <= maxMs,
    `Expected first frame within ${maxMs}ms but took ${this.elapsedMs}ms`
  );
});

Then('the first output frame appears within {int} milliseconds of process start', function (
  this: ChromatoWorld,
  maxMs: number
) {
  assert.ok(
    this.elapsedMs <= maxMs,
    `Expected first output within ${maxMs}ms but took ${this.elapsedMs}ms`
  );
});

Then('the phase label reads {string}', function (this: ChromatoWorld, label: string) {
  assert.ok(
    this.capturedOutput.includes(label),
    `Expected phase label "${label}" in output but got:\n${this.capturedOutput}`
  );
});

Then('the timer countdown reads {string}', function (this: ChromatoWorld, time: string) {
  assert.ok(
    this.capturedOutput.includes(time),
    `Expected timer "${time}" in output but got:\n${this.capturedOutput}`
  );
});

Then('the frame shows the work phase timer at {string}', function (this: ChromatoWorld, time: string) {
  assert.ok(
    this.capturedOutput.includes(time),
    `Expected work phase timer "${time}" in TUI frame but got:\n${this.capturedOutput}`
  );
});

Then('the progress bar shows {int}% fill at session start', function (
  this: ChromatoWorld,
  percent: number
) {
  // At 0% the progress bar is empty; check for a '0%' label or empty-bar indicator.
  // The TUI renders a percentage label next to the bar.
  assert.ok(
    this.capturedOutput.includes(`${percent}%`),
    `Expected progress bar at ${percent}% in output but got:\n${this.capturedOutput}`
  );
});

Then('the session badge reads {string}', function (this: ChromatoWorld, badge: string) {
  assert.ok(
    this.capturedOutput.includes(badge) || this.capturedOutput.match(new RegExp(badge, 'i')),
    `Expected session badge "${badge}" in output but got:\n${this.capturedOutput}`
  );
});

Then('the TUI shows {string} as the initial work duration', function (
  this: ChromatoWorld,
  time: string
) {
  assert.ok(
    this.capturedOutput.includes(time),
    `Expected initial work duration "${time}" in output but got:\n${this.capturedOutput}`
  );
});

Then('no configuration wizard or setup prompt appears', function (this: ChromatoWorld) {
  const wizardPatterns = /wizard|setup|configure|Welcome to/i;
  assert.ok(
    !wizardPatterns.test(this.capturedOutput),
    `Unexpected wizard or setup prompt in output:\n${this.capturedOutput}`
  );
});

Then('the output contains zero ANSI escape sequences', function (this: ChromatoWorld) {
  // ANSI escape sequences start with ESC (\x1b) followed by '['
  const ansiPattern = /\x1b\[/;
  assert.ok(
    !ansiPattern.test(this.capturedOutput),
    `Expected zero ANSI escape sequences but found some in output:\n${this.capturedOutput}`
  );
});

Then('the output includes a tmux integration one-liner example', function (
  this: ChromatoWorld
) {
  assert.ok(
    this.capturedOutput.includes('tmux') || this.capturedOutput.includes('status-right'),
    `Expected tmux integration example in help output but got:\n${this.capturedOutput}`
  );
});

Then('the output mentions --minimal mode', function (this: ChromatoWorld) {
  assert.ok(
    this.capturedOutput.includes('--minimal') || this.capturedOutput.includes('minimal'),
    `Expected --minimal mode mention in output but got:\n${this.capturedOutput}`
  );
});

Then('the total output is {int} lines or fewer', function (
  this: ChromatoWorld,
  maxLines: number
) {
  const lineCount = this.capturedOutput.split('\n').filter(Boolean).length;
  assert.ok(
    lineCount <= maxLines,
    `Expected output of ${maxLines} lines or fewer but got ${lineCount} lines`
  );
});

Then('chromato outputs {string}', function (this: ChromatoWorld, expectedText: string) {
  assert.ok(
    this.capturedOutput.includes(expectedText) ||
      this.capturedStderr.includes(expectedText),
    `Expected output to contain "${expectedText}" but got:\nSTDOUT: ${this.capturedOutput}\nSTDERR: ${this.capturedStderr}`
  );
});

Then('no zombie chromato processes remain running', async function (this: ChromatoWorld) {
  // Wait briefly then check that the process is no longer running.
  await new Promise((r) => setTimeout(r, 200));
  const isRunning = this.process && !this.process.killed && this.process.exitCode === null;
  assert.ok(!isRunning, 'Expected chromato process to have exited but it is still running');
});

Then('the state file shows phase {string} after exit', function (
  this: ChromatoWorld,
  phase: string
) {
  const state = readStateFile(this);
  assert.ok(state !== null, 'State file not found or not valid JSON');
  assert.strictEqual(
    state.phase,
    phase,
    `Expected state file phase "${phase}" but got "${state.phase}"`
  );
});

Then('the state file still shows {string}: {int}', function (
  this: ChromatoWorld,
  field: string,
  value: number
) {
  const state = readStateFile(this);
  assert.ok(state !== null, 'State file not found or not valid JSON');
  // Convert camelCase field names for JSON keys.
  const key = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  assert.strictEqual(
    state[key],
    value,
    `Expected state.${key} = ${value} but got ${state[key]}`
  );
});

Then('the TUI shows {string} in the header area', function (
  this: ChromatoWorld,
  text: string
) {
  assert.ok(
    this.capturedOutput.includes(text) ||
      this.capturedOutput.match(new RegExp(text.replace(/\d+/, '\\d+'), 'i')),
    `Expected "${text}" in TUI output but got:\n${this.capturedOutput}`
  );
});

Then('the state file contains the fields: {string}', function (
  this: ChromatoWorld,
  fieldList: string
) {
  const state = readStateFile(this);
  assert.ok(state !== null, 'State file not found or not valid JSON');
  const fields = fieldList.split(',').map((f) => f.trim());
  for (const field of fields) {
    // Support snake_case and camelCase variants.
    const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    assert.ok(
      field in state || camel in state,
      `Expected field "${field}" in state file but it is missing. State: ${JSON.stringify(state)}`
    );
  }
});

Then('the {string} field reads {string}', function (
  this: ChromatoWorld,
  field: string,
  value: string
) {
  const state = readStateFile(this);
  assert.ok(state !== null, 'State file not found or not valid JSON');
  const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const actualValue = state[field] ?? state[camel];
  assert.strictEqual(
    String(actualValue),
    value,
    `Expected state.${field} = "${value}" but got "${actualValue}"`
  );
});

Then('the output includes a usage error message describing the problem', function (
  this: ChromatoWorld
) {
  const combined = this.capturedOutput + this.capturedStderr;
  const hasError = /error|invalid|must be|positive|Usage/i.test(combined);
  assert.ok(hasError, `Expected usage error message but got:\n${combined}`);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCommand(command: string): string[] {
  // Strip leading 'chromato ' prefix and split into args.
  return command
    .replace(/^chromato\s+/, '')
    .split(/\s+/)
    .filter(Boolean);
}
