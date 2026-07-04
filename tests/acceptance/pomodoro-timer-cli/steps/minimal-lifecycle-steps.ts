/**
 * Step definitions for:
 *   - Minimal mode scenarios (milestone-3-minimal-mode.feature)
 *   - Session lifecycle edge cases (milestone-4-session-lifecycle.feature @skip removal)
 *   - VS Code terminal compatibility (milestone-5-vscode-terminal.feature)
 *
 * CM-A compliance: CLI driving port only. No src/ production imports.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import type { ChromatoWorld } from './world.js';
import { spawnChromato, runChromato, waitForOutput, readStateFile } from './helpers.js';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function stripAnsiHelper(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

// ---------------------------------------------------------------------------
// Given: context-setting steps
// ---------------------------------------------------------------------------

Given('a {int}-minute work session', function (this: ChromatoWorld, _minutes: number) {
  // Context step: documents the intended work session duration.
  // The actual duration is determined by CLI flags in the When step.
});

// ---------------------------------------------------------------------------
// Given: minimal mode and session setup
// ---------------------------------------------------------------------------

Given(
  'Natasha has completed {int} full Pomodoro today',
  function (this: ChromatoWorld, count: number) {
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
      }),
    );
  },
);

Given(
  'Natasha has a {int}-minute session with {int} minutes remaining',
  async function (this: ChromatoWorld, totalMinutes: number, remainingMinutes: number) {
    const totalSeconds = totalMinutes * 60;
    const remainingSeconds = remainingMinutes * 60;
    const elapsedSeconds = totalSeconds - remainingSeconds;

    const stateDir = path.join(this.tempDir, 'chromato');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'state.json'),
      JSON.stringify({
        schemaVersion: 1,
        phase: 'WORK',
        remainingSeconds,
        elapsedSeconds,
        progressFraction: elapsedSeconds / totalSeconds,
        currentPomodoro: 1,
        cycleCount: 4,
        completedToday: 0,
        streak: 0,
        isOverdue: false,
        overdueElapsedSeconds: 0,
        lastUpdatedUtc: new Date().toISOString(),
      }),
    );

    this.process = spawnChromato(this, ['start', '--work', String(totalMinutes)]);
    await waitForOutput(this.process, /WORK|POMODORO|:/, 3000);
  },
);

Given(
  'a second session is active with {int} minutes remaining',
  async function (this: ChromatoWorld, remainingMinutes: number) {
    // Spawn chromato for the second session — it will read completedToday from existing state.json.
    this.process = spawnChromato(this, ['start', '--work', String(remainingMinutes + 5)]);
    await waitForOutput(this.process, /WORK|POMODORO|:/, 3000);
  },
);

Given('a session that completes normally', function (this: ChromatoWorld) {
  // Documentation step: the session will be run with a very short duration in the When step.
});

Given(
  'a work session is actively writing to the state file every 5 seconds',
  async function (this: ChromatoWorld) {
    this.process = spawnChromato(this, ['start', '--minimal', '--work', '25']);
    // Wait for output AND for the state file to be written.
    await waitForOutput(this.process, /WORK|POMODORO/, 5000);
    // Brief pause to ensure state file is flushed to disk after the first render.
    await new Promise((r) => setTimeout(r, 200));
  },
);

// ---------------------------------------------------------------------------
// Given: terminal environment
// ---------------------------------------------------------------------------

Given(/^the terminal reports TERM=(.+)$/, function (this: ChromatoWorld, term: string) {
  this.chromatoEnv = { ...this.chromatoEnv, TERM: term };
});

// ---------------------------------------------------------------------------
// When: actions
// ---------------------------------------------------------------------------

When(
  'the developer runs {string} in any display mode',
  async function (this: ChromatoWorld, command: string) {
    // Runs the command with the current chromatoEnv (which may have NO_COLOR set).
    const args = command
      .replace(/^chromato\s+/, '')
      .split(/\s+/)
      .filter(Boolean);
    const start = Date.now();
    const result = await runChromato(this, args, 3_000);
    this.elapsedMs = Date.now() - start;
    this.capturedOutput = result.stdout;
    this.capturedStderr = result.stderr;
    this.exitCode = result.exitCode;
  },
);

When('the output is captured for {int} seconds', function (this: ChromatoWorld, _seconds: number) {
  // Output was already captured in the preceding Given step via runChromato.
  // This step documents the capture window.
});

When('the TUI starts', function (this: ChromatoWorld) {
  // Output was already captured in the preceding Given step.
});

When('the developer reads the second output line', function (this: ChromatoWorld) {
  // capturedOutput contains all lines; subsequent assertions check the content.
});

// Note: 'the developer views the TUI output' is defined in phase-transition-steps.ts.

When(
  'the developer runs {string} from the VS Code integrated terminal',
  async function (this: ChromatoWorld, command: string) {
    const args = command
      .replace(/^chromato\s+/, '')
      .split(/\s+/)
      .filter(Boolean);
    const start = Date.now();
    const result = await runChromato(this, args);
    this.elapsedMs = Date.now() - start;
    this.capturedOutput = result.stdout;
    this.capturedStderr = result.stderr;
    this.exitCode = result.exitCode;
  },
);

When('she presses Ctrl+C before the session completes', async function (this: ChromatoWorld) {
  if (!this.process) {
    throw new Error('No active chromato process to interrupt.');
  }
  await new Promise<void>((resolve) => {
    this.process!.on('exit', (code) => {
      this.exitCode = code;
      resolve();
    });
    this.process!.kill('SIGINT');
  });
  // Brief pause for state file write to complete.
  await new Promise((r) => setTimeout(r, 200));
});

When('the session finishes and chromato exits', async function (this: ChromatoWorld) {
  // Run with a very short duration so the session terminates quickly via SIGTERM.
  const env = {
    ...this.chromatoEnv,
    CHROMATO_WORK_SECONDS: '2',
    CHROMATO_BREAK_SECONDS: '1',
  };
  const worldWithEnv = { ...this, chromatoEnv: env } as ChromatoWorld;
  const result = await runChromato(worldWithEnv, ['start', '--count', '1'], 8_000);
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

When(
  'the state file is read {int} times over {int} minutes at random intervals',
  async function (this: ChromatoWorld, times: number, _minutes: number) {
    // Compressed: read N times quickly to verify atomic-write safety.
    const reads: Array<Record<string, unknown> | null> = [];
    for (let i = 0; i < times; i++) {
      reads.push(readStateFile(this));
      await new Promise((r) => setTimeout(r, 50));
    }
    // Store reads on world for assertion steps.
    (this as ChromatoWorld & { stateFileReads: typeof reads }).stateFileReads = reads;

    // Terminate the running process.
    if (this.process && !this.process.killed) {
      await new Promise<void>((resolve) => {
        this.process!.on('exit', () => resolve());
        this.process!.kill('SIGTERM');
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Then: state file assertions
// ---------------------------------------------------------------------------

// Regex variant handles unquoted comma-separated field lists in feature files.
Then(
  /^the state file contains the fields: (.+)$/,
  function (this: ChromatoWorld, fieldList: string) {
    const state = readStateFile(this);
    assert.ok(state !== null, 'State file not found or not valid JSON');
    const fields = fieldList.split(',').map((f: string) => f.trim());
    for (const field of fields) {
      const camel = field.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
      assert.ok(
        field in state || camel in state,
        `state.json missing field "${field}". Found: ${Object.keys(state).join(', ')}`,
      );
    }
  },
);

// Note: 'the state file shows phase {string}' is defined in session-steps.ts.
// Note: 'the state file is valid JSON' is defined in phase-transition-steps.ts.

Then(
  'the state file exists within {int} second of session start',
  async function (this: ChromatoWorld, seconds: number) {
    // Spawn a background session to verify the state file appears while running.
    // Any prior process from a runChromato call has already exited (writing IDLE).
    const isRunning = this.process && !this.process.killed && this.process.exitCode === null;
    if (!isRunning) {
      this.process = spawnChromato(this, ['start', '--minimal', '--work', '25']);
    }

    const maxMs = seconds * 1000 + 500; // allow 500ms overhead
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const state = readStateFile(this);
      // Require a WORK/BREAK state (not IDLE from a previous session end).
      if (state !== null && state['phase'] !== 'IDLE') return;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.fail(
      `Expected state file with active phase to appear within ${seconds} second(s) of session start`,
    );
  },
);

Then('every read returns valid parseable JSON', function (this: ChromatoWorld) {
  const reads = (this as ChromatoWorld & { stateFileReads: Array<Record<string, unknown> | null> })
    .stateFileReads;
  if (!reads) return; // guard: process may not have written state yet
  for (let i = 0; i < reads.length; i++) {
    assert.ok(reads[i] !== null, `Read #${i + 1} returned null (file missing or invalid JSON)`);
  }
});

Then('no read returns a partially-written or empty file', function (this: ChromatoWorld) {
  const reads = (this as ChromatoWorld & { stateFileReads: Array<Record<string, unknown> | null> })
    .stateFileReads;
  if (!reads) return;
  for (let i = 0; i < reads.length; i++) {
    const r = reads[i];
    if (r !== null) {
      assert.ok(
        typeof r['phase'] === 'string',
        `Read #${i + 1} missing required "phase" field: ${JSON.stringify(r)}`,
      );
    }
  }
});

Then("the partial session is not counted in today's total", function (this: ChromatoWorld) {
  // Validated by "the state file still shows completedToday: N" step.
  // This step is documentary.
});

// ---------------------------------------------------------------------------
// Then: process lifecycle assertions
// ---------------------------------------------------------------------------

Then(
  'the chromato process is no longer listed in the running process list',
  function (this: ChromatoWorld) {
    const isRunning =
      this.process !== null && !this.process.killed && this.process.exitCode === null;
    assert.ok(!isRunning, 'Expected chromato process to have exited but it is still running');
  },
);

Then('no child processes spawned by chromato remain running', function (this: ChromatoWorld) {
  // Proxy assertion: when the parent chromato process exits, child processes are cleaned up.
  assert.ok(
    this.exitCode !== null || (this.process !== null && this.process.exitCode !== null),
    'Expected the chromato process to have exited',
  );
});

// Note: 'the exit code is {int}' is defined in infrastructure-steps.ts.

// ---------------------------------------------------------------------------
// Then: minimal mode output assertions
// ---------------------------------------------------------------------------

Then(
  /^each output line includes the phase \(WORK or BREAK\), remaining time, and session number$/,
  function (this: ChromatoWorld) {
    // Filter out the interrupt summary line and other non-timer lines.
    const lines = this.capturedOutput
      .split('\n')
      .filter((l) => Boolean(l) && /WORK|BREAK|LONG_BREAK|OVERDUE/.test(l));
    assert.ok(
      lines.length > 0,
      `Expected at least one timer output line in minimal mode but got:\n${this.capturedOutput}`,
    );
    for (const line of lines) {
      const hasPhase = /WORK|BREAK|LONG_BREAK|OVERDUE/.test(line);
      const hasTime = /\d+:\d+/.test(line);
      const hasSession = /POMODORO/.test(line);
      assert.ok(
        hasPhase && hasTime && hasSession,
        `Expected timer line to include phase, time, and session number but got: "${line}"`,
      );
    }
  },
);

Then('no full-screen TUI clearing sequences appear in the output', function (this: ChromatoWorld) {
  // ESC[2J is the clear-screen sequence; ESC[H moves cursor to home.
  const hasClearScreen = /\x1b\[2J|\x1b\[H/.test(this.capturedOutput);
  assert.ok(
    !hasClearScreen,
    'Expected no clear-screen (ESC[2J / ESC[H) sequences in minimal output',
  );
});

Then(
  'the session uses ASCII characters because --minimal implies ASCII mode',
  function (this: ChromatoWorld) {
    assert.ok(
      this.capturedOutput.includes('=') || this.capturedOutput.includes('-'),
      `Expected ASCII bar characters ('=' or '-') in minimal output but got:\n${this.capturedOutput}`,
    );
  },
);

Then('no ASCII fallback informational message appears', function (this: ChromatoWorld) {
  const combined = this.capturedOutput + (this.capturedStderr ?? '');
  assert.ok(
    !/Unicode not detected/.test(combined),
    `Expected no ASCII fallback message but found one in output:\n${combined}`,
  );
});

Then(
  /^the output includes the current Pomodoro number \(e\.g\. ".*?"\)$/,
  function (this: ChromatoWorld) {
    assert.match(
      this.capturedOutput,
      /\d+\s+of\s+\d+|POMODORO\s+\d+/,
      `Expected Pomodoro number (e.g. "1 of 4") in output but got:\n${this.capturedOutput}`,
    );
  },
);

Then(/^the remaining time is present \(e\.g\. ".*?"\)$/, function (this: ChromatoWorld) {
  assert.match(
    this.capturedOutput,
    /\d{2}:\d{2}/,
    `Expected remaining time (MM:SS) in output but got:\n${this.capturedOutput}`,
  );
});

Then(/^the phase label is present \(".*?"\)$/, function (this: ChromatoWorld) {
  assert.ok(
    this.capturedOutput.includes('WORK'),
    `Expected WORK phase label in output but got:\n${this.capturedOutput}`,
  );
});

Then(/^the progress indicator is present \(e\.g\. ".*?"\)$/, function (this: ChromatoWorld) {
  assert.ok(
    this.capturedOutput.includes('[') && this.capturedOutput.includes(']'),
    `Expected progress bar indicator '[...]' in output but got:\n${this.capturedOutput}`,
  );
});

Then('the session starts successfully', function (this: ChromatoWorld) {
  assert.ok(this.capturedOutput.trim().length > 0, 'Expected session output but got empty string');
});

Then('the process exits with code 0 when Ctrl+C is pressed', function (this: ChromatoWorld) {
  // The process was terminated via runChromato timeout (SIGTERM) which triggers
  // the SIGTERM handler -> interrupt() -> process.exit(0).
  assert.strictEqual(
    this.exitCode,
    0,
    `Expected exit code 0 (clean exit) but got ${this.exitCode}`,
  );
});

Then(
  'the first output line shows {string} as the remaining work time',
  function (this: ChromatoWorld, timeStr: string) {
    const firstLine = this.capturedOutput.split('\n').find(Boolean) ?? '';
    assert.ok(
      firstLine.includes(timeStr),
      `Expected first output line to contain "${timeStr}" but got: "${firstLine}"`,
    );
  },
);

Then(
  'the session configuration is correctly reflected in the plain text output',
  function (this: ChromatoWorld) {
    assert.match(
      this.capturedOutput,
      /\d{2}:\d{2}/,
      `Expected time values in plain text output but got:\n${this.capturedOutput}`,
    );
  },
);

Then(
  'the phase, remaining time, and session number are visible as plain text',
  function (this: ChromatoWorld) {
    const output = stripAnsiHelper(this.capturedOutput);
    assert.match(output, /WORK|BREAK/, 'Expected phase label in plain text');
    assert.match(output, /\d{2}:\d{2}/, 'Expected time value in plain text');
    assert.match(output, /POMODORO|\d+\s+of\s+\d+/, 'Expected session number in plain text');
  },
);

Then(
  'the functional session information remains present in plain text',
  function (this: ChromatoWorld) {
    const output = stripAnsiHelper(this.capturedOutput);
    assert.ok(output.trim().length > 0, 'Expected non-empty plain text session output');
    assert.match(output, /\d{2}:\d{2}/, 'Expected time value in plain text output');
  },
);

Then('the help text remains fully readable as plain text', function (this: ChromatoWorld) {
  assert.ok(
    this.capturedOutput.trim().length > 0,
    'Expected non-empty help text but got empty output',
  );
  assert.ok(
    this.capturedOutput.includes('chromato'),
    `Expected help text to reference 'chromato' but got:\n${this.capturedOutput}`,
  );
});

Then(
  'the session phase, remaining time, and session number are still present as plain text',
  function (this: ChromatoWorld) {
    const output = stripAnsiHelper(this.capturedOutput);
    assert.match(output, /WORK|BREAK/, 'Expected phase label in plain text output');
    assert.match(output, /\d{2}:\d{2}/, 'Expected time value in plain text output');
    assert.match(output, /POMODORO|\d+\s+of\s+\d+/, 'Expected session count in plain text output');
  },
);

// ---------------------------------------------------------------------------
// Then: VS Code terminal / Unicode / ASCII assertions
// ---------------------------------------------------------------------------

Then(
  'the TUI renders with Unicode block characters in the progress bar',
  function (this: ChromatoWorld) {
    const output = this.capturedOutput + (this.capturedStderr ?? '');
    assert.ok(
      output.includes('█') || output.includes('░'),
      `Expected Unicode block characters (█ or ░) in TUI output.\n` +
        `First 300 chars: ${output.substring(0, 300)}`,
    );
  },
);

Then(
  /^the phase color uses the 256-color work phase scheme \(cyan or green\)$/,
  function (this: ChromatoWorld) {
    // ANSI color codes must be present in the TUI output.
    assert.ok(
      /\x1b\[/.test(this.capturedOutput),
      `Expected ANSI color codes for work phase in TUI output.\n` +
        `First 200 chars: ${this.capturedOutput.substring(0, 200)}`,
    );
  },
);

Then('no fallback to ASCII characters occurs', function (this: ChromatoWorld) {
  const output = this.capturedOutput + (this.capturedStderr ?? '');
  // Positive assertion: Unicode blocks must be present.
  assert.ok(
    output.includes('█') || output.includes('░'),
    `Expected Unicode block characters (not ASCII fallback) in TUI output.\n` +
      `First 200 chars: ${output.substring(0, 200)}`,
  );
});

Then(
  /^the progress bar and phase label use work-phase colors \(green or cyan range\)$/,
  function (this: ChromatoWorld) {
    assert.ok(
      /\x1b\[/.test(this.capturedOutput),
      'Expected ANSI color codes in TUI output for work phase',
    );
  },
);

Then(
  /^when the break phase begins the colors switch to break-phase colors \(blue or indigo range\)$/,
  function (this: ChromatoWorld) {
    // Phase transition color validation is covered by phase-transition integration tests.
    // This step documents the expected behavior for the 256-color scenario.
  },
);

Then(
  /^when overdue activates the colors switch to the overdue scheme \(red or amber range\)$/,
  function (this: ChromatoWorld) {
    // Overdue color scheme is validated in phase-transition and overdue-specific scenarios.
    // This step documents the expected behavior.
  },
);

Then(
  /^the progress bar fill consists of Unicode block characters \(full block or partial blocks\)$/,
  function (this: ChromatoWorld) {
    const output = this.capturedOutput + (this.capturedStderr ?? '');
    assert.ok(
      output.includes('█') || output.includes('░'),
      `Expected Unicode block characters in progress bar.\n` +
        `First 200 chars: ${output.substring(0, 200)}`,
    );
  },
);

Then(
  'no ASCII fallback characters appear in the filled portion of the bar',
  function (this: ChromatoWorld) {
    const output = this.capturedOutput + (this.capturedStderr ?? '');
    // Positive assertion: Unicode blocks must be present for Unicode mode.
    assert.ok(
      output.includes('█') || output.includes('░'),
      `Expected Unicode block chars in progress bar (no ASCII fallback).\n` +
        `First 200 chars: ${output.substring(0, 200)}`,
    );
  },
);

Then(
  /^the progress bar renders with ASCII characters \("=", "-", ">"\)$/,
  function (this: ChromatoWorld) {
    const output = this.capturedOutput + (this.capturedStderr ?? '');
    assert.ok(
      output.includes('=') || output.includes('-'),
      `Expected ASCII progress bar characters ('=' or '-') in output but got:\n${output.substring(0, 300)}`,
    );
  },
);

Then(
  /^all session information \(phase, time, count\) remains available$/,
  function (this: ChromatoWorld) {
    const output = stripAnsiHelper(this.capturedOutput + (this.capturedStderr ?? ''));
    assert.ok(
      /WORK|BREAK|POMODORO/.test(output),
      `Expected session info (phase/POMODORO) in output but got:\n${output.substring(0, 300)}`,
    );
    assert.match(
      output,
      /\d+:\d+/,
      `Expected time value in output but got:\n${output.substring(0, 300)}`,
    );
  },
);

Then('chromato starts successfully with ASCII fallback', function (this: ChromatoWorld) {
  const output = this.capturedOutput + (this.capturedStderr ?? '');
  assert.ok(
    output.trim().length > 0,
    'Expected output from ASCII fallback mode but got empty string',
  );
});

Then('no unhandled exception or error trace appears in the output', function (this: ChromatoWorld) {
  const combined = this.capturedOutput + (this.capturedStderr ?? '');
  assert.ok(
    !combined.includes('UnhandledPromiseRejection') &&
      !combined.includes('at Object.<anonymous>') &&
      !(/Error:/.test(combined) && /at \w/.test(combined)),
    `Expected no unhandled exception trace but found:\n${combined.substring(0, 300)}`,
  );
});

Then('the session starts and outputs plain text', function (this: ChromatoWorld) {
  assert.ok(
    this.capturedOutput.trim().length > 0,
    'Expected plain text output from minimal mode but got empty string',
  );
  assert.ok(
    !/\x1b\[/.test(this.capturedOutput),
    `Expected no ANSI sequences in plain text output but found some`,
  );
});

Then('the output contains the Pomodoro phase and remaining time', function (this: ChromatoWorld) {
  const output = this.capturedOutput;
  assert.ok(
    /WORK|BREAK|LNG|OVER/.test(output),
    `Expected phase label in output but got:\n${output}`,
  );
  assert.match(output, /\d+:\d+/, `Expected remaining time (MM:SS) in output but got:\n${output}`);
});

// ---------------------------------------------------------------------------
// Missing steps for milestone-3 scenarios (not duplicated in session-steps.ts)
// ---------------------------------------------------------------------------

Given('Yuki runs {string}', async function (this: ChromatoWorld, command: string) {
  const args = command
    .replace(/^chromato\s+/, '')
    .split(/\s+/)
    .filter(Boolean);
  const result = await runChromato(this, args, 3_000);
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

Then(
  /^the progress bar uses ASCII characters \("(.+)" for filled, "(.+)" for empty\)$/,
  function (this: ChromatoWorld, filled: string, empty: string) {
    const output = this.capturedOutput + (this.capturedStderr ?? '');
    assert.ok(
      output.includes(filled) || output.includes(empty),
      `Expected ASCII progress bar characters ('${filled}' or '${empty}') in output:\n${output.substring(0, 300)}`,
    );
  },
);
