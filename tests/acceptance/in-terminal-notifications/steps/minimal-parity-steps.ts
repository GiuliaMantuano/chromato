/**
 * Plain-text parity steps (DISTILL slices 02/05/06 piped scenarios).
 *
 * Domain concepts: the minimal session's persistent notification line, piped
 * byte-cleanliness ([D8]), NO_COLOR ASCII emphasis (AC-P3), ASCII copy
 * degradation ([D11]), and the minimal half of the moment-priority pin.
 */

import { Then, When } from '@cucumber/cucumber';
import * as assert from 'node:assert';
import {
  assertNoBell,
  assertNoTitleEscapes,
  delay,
  endSession,
  startSession,
  waitForCaptured,
  type NotificationSessionWorld,
} from './session-helpers.js';

/** Run a compressed session to just past its first WORK→BREAK transition. */
async function runThroughFirstTransition(
  world: NotificationSessionWorld,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<void> {
  startSession(world, args, { CHROMATO_WORK_SECONDS: '2', ...extraEnv });
  await waitForCaptured(world, /BREAK/, 15_000, 'the BREAK phase label');
  await delay(1500);
  await endSession(world);
}

When(
  'the user runs a piped minimal session through its first transition',
  async function (this: NotificationSessionWorld) {
    await runThroughFirstTransition(this, ['--minimal']);
  },
);

When(
  'the user runs a NO_COLOR session through its first transition',
  async function (this: NotificationSessionWorld) {
    await runThroughFirstTransition(this, [], { NO_COLOR: '1' });
  },
);

When(
  'the user runs an ASCII-terminal minimal session through its first transition',
  async function (this: NotificationSessionWorld) {
    await runThroughFirstTransition(this, ['--minimal'], { LANG: 'C', LC_ALL: 'C' });
  },
);

// ── Thens ───────────────────────────────────────────────────────────────────

Then(
  'a plain notification line {string} is printed on its own row',
  function (this: NotificationSessionWorld, line: string) {
    assert.ok(
      this.capturedOutput.includes(`${line}\n`),
      `Expected the notification line ${JSON.stringify(line)} on its own ` +
        `newline-terminated row, but the captured output does not contain it:\n` +
        `${this.capturedOutput}`,
    );
  },
);

Then('the notification line ends with a newline', function (this: NotificationSessionWorld) {
  const index = this.capturedOutput.indexOf('Pomodoro complete');
  assert.ok(index !== -1, `Expected a notification line, got:\n${this.capturedOutput}`);
  const restOfLine = this.capturedOutput.slice(index);
  assert.ok(restOfLine.includes('\n'), 'Expected the notification line to be newline-terminated.');
});

Then('no notification line is printed', function (this: NotificationSessionWorld) {
  for (const copy of ['Pomodoro complete', 'Break ran over', 'min focused. Well done']) {
    assert.ok(
      !this.capturedOutput.includes(copy),
      `Expected no notification line in this mode, but found ${JSON.stringify(copy)}:\n` +
        `${this.capturedOutput}`,
    );
  }
});

Then(
  'a session summary line containing {string} is also printed',
  function (this: NotificationSessionWorld, fragment: string) {
    assert.ok(
      this.capturedOutput.includes(fragment),
      `Moment-priority pin (minimal half): expected the session summary line ` +
        `containing ${JSON.stringify(fragment)} to print alongside the phase-change ` +
        `line, got:\n${this.capturedOutput}`,
    );
  },
);

Then(
  'the notification is printed between {string} and {string} emphasis markers',
  function (this: NotificationSessionWorld, open: string, close: string) {
    const re = new RegExp(
      `${open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*Pomodoro complete.*${close.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      )}`,
    );
    assert.ok(
      re.test(this.capturedOutput),
      `Expected the notification between ${open} … ${close} ASCII emphasis markers, ` +
        `got:\n${this.capturedOutput}`,
    );
  },
);

Then(
  'the captured output contains no ANSI escape sequences',
  function (this: NotificationSessionWorld) {
    assert.ok(
      !this.capturedOutput.includes('\x1b'),
      `Expected zero ANSI escape sequences (AC-P3), but the captured output ` +
        `contains an ESC byte:\n${JSON.stringify(this.capturedOutput.slice(0, 1500))}`,
    );
  },
);

Then(
  'the notification output contains only ASCII characters',
  function (this: NotificationSessionWorld) {
    const line = this.capturedOutput
      .split('\n')
      .find((candidate) => candidate.includes('Pomodoro complete'));
    assert.ok(line !== undefined, `Expected a notification line, got:\n${this.capturedOutput}`);
    assert.ok(
      /^[\x20-\x7e]*$/.test(line),
      `Expected an ASCII-only notification line ([D11]), got: ${JSON.stringify(line)}`,
    );
  },
);

Then('the captured output contains no bell character', function (this: NotificationSessionWorld) {
  assertNoBell(this.capturedOutput, 'the piped session output');
});

Then(
  'no window-title escape sequences appear in the output',
  function (this: NotificationSessionWorld) {
    assertNoTitleEscapes(this.capturedOutput, 'the piped session output');
  },
);
