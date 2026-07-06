/**
 * Session-running and config-seeding steps for in-terminal-notifications
 * (DISTILL slices 01/02/03/06 + KPI observability).
 *
 * Domain concepts: how a session is started (mode config, timing compression,
 * piped vs TUI renderer) and how notification moments are reached (work block
 * ends, break runs over, session falls overdue).
 *
 * CM-A compliance: chromato is invoked ONLY through the CLI driving port.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { spawnSync } from 'node:child_process';
import * as assert from 'node:assert';
import {
  delay,
  endSession,
  startSession,
  waitForCaptured,
  type NotificationSessionWorld,
} from './session-helpers.js';

// ── Givens: the saved notification setting ──────────────────────────────────

const BASE_CONFIG = { palette: 'ocean', work: 25, break: 5, longBreak: 15, cycles: 4 };

Given(
  'a saved timer setup with no notifications setting',
  function (this: NotificationSessionWorld) {
    this.seedConfig({ ...BASE_CONFIG });
  },
);

Given(
  'a saved timer setup whose notifications setting is {string}',
  function (this: NotificationSessionWorld, mode: string) {
    this.seedConfig({ ...BASE_CONFIG, notifications: mode });
  },
);

Given(
  'a saved timer setup whose notifications setting is the unknown value {string}',
  function (this: NotificationSessionWorld, value: string) {
    this.seedConfig({ ...BASE_CONFIG, notifications: value });
  },
);

Given(
  'a legacy saved setup with notifications turned on',
  function (this: NotificationSessionWorld) {
    this.seedConfig({ ...BASE_CONFIG, notifications: true });
  },
);

Given(
  'a legacy saved setup with notifications turned off',
  function (this: NotificationSessionWorld) {
    this.seedConfig({ ...BASE_CONFIG, notifications: false });
  },
);

// ── Whens: reaching the notification moments ────────────────────────────────

When(
  'the user starts a session whose work and break phases last 2 seconds each',
  function (this: NotificationSessionWorld) {
    startSession(this, [], { CHROMATO_WORK_SECONDS: '2', CHROMATO_BREAK_SECONDS: '2' });
  },
);

When('the work block ends', async function (this: NotificationSessionWorld) {
  // Transition observed via the phase label; then one extra beat so a banner
  // (if any) has rendered — making "no banner appears" assertions meaningful.
  await waitForCaptured(this, /BREAK/, 15_000, 'the BREAK phase label');
  await delay(1500);
});

When('the break runs over', async function (this: NotificationSessionWorld) {
  await waitForCaptured(this, /OVERDUE/, 20_000, 'the OVERDUE phase label');
  // Mark the tail so supersession assertions look only at frames rendered
  // AFTER the overdue moment.
  this.outputMark = this.capturedOutput.length;
  await delay(2500);
});

When(
  'the user runs a session that falls overdue and then ends it',
  async function (this: NotificationSessionWorld) {
    startSession(this, ['--minimal'], {
      CHROMATO_WORK_SECONDS: '1',
      CHROMATO_BREAK_SECONDS: '1',
    });
    await waitForCaptured(this, /OVERDUE/, 15_000, 'the OVERDUE phase label');
    await delay(1200);
    await endSession(this);
  },
);

When('the user asks for the tmux status line', function (this: NotificationSessionWorld) {
  const res = spawnSync('node', [this.chromatoBin, 'status', '--format', 'tmux'], {
    env: this.chromatoEnv,
    encoding: 'utf8',
    timeout: 10_000,
  });
  this.capturedOutput = res.stdout ?? '';
  this.capturedStderr = res.stderr ?? '';
  this.exitCode = res.status;
});

// ── Thens: mode-selection outcomes ──────────────────────────────────────────

Then('no notification banner appears', function (this: NotificationSessionWorld) {
  for (const copy of ['Pomodoro complete', 'Break ran over', 'min focused. Well done']) {
    assert.ok(
      !this.capturedOutput.includes(copy),
      `Expected no notification banner, but found the copy ${JSON.stringify(copy)} ` +
        `in the captured frames.`,
    );
  }
});

Then(
  'a single warning naming the valid notification modes appears on standard error',
  async function (this: NotificationSessionWorld) {
    // The warning is written at config parse, strictly before the first frame:
    // once WORK is visible, the warning (if implemented) has been emitted.
    await waitForCaptured(this, /WORK/, 10_000, 'the WORK phase label');
    const stderr = this.capturedStderr;
    assert.ok(
      stderr.includes('banner+bell') && stderr.includes('off'),
      `Expected one stderr warning naming the valid notification modes ` +
        `(banner, banner+bell, bell, off), got stderr:\n${JSON.stringify(stderr)}`,
    );
    const occurrences = stderr.split('banner+bell').length - 1;
    assert.strictEqual(occurrences, 1, `Expected exactly one warning, saw ${occurrences}.`);
  },
);

Then(
  'the session still starts into its timer frame',
  async function (this: NotificationSessionWorld) {
    await waitForCaptured(this, /WORK/, 10_000, 'the WORK phase label');
    assert.strictEqual(this.exitCode, null, 'Expected the session to keep running.');
  },
);

Then(
  'the status command answers cleanly with no warning',
  function (this: NotificationSessionWorld) {
    assert.strictEqual(this.exitCode, 0, `status exited ${this.exitCode}: ${this.capturedStderr}`);
    assert.strictEqual(
      this.capturedStderr.trim(),
      '',
      `Expected empty stderr from status, got: ${this.capturedStderr}`,
    );
  },
);
