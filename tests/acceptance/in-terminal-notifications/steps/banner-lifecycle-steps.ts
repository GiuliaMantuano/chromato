/**
 * Banner-lifecycle assertion steps (DISTILL slice-01 supplement).
 *
 * Domain concepts: auto-clear, supersession (at most one banner), and the
 * DISTILL-pinned moment-priority policy (phase-change copy wins on the TUI
 * banner path; the co-fired session summary never steals the slot).
 */

import { Then } from '@cucumber/cucumber';
import * as assert from 'node:assert';
import { delay, type NotificationSessionWorld } from './session-helpers.js';

Then(
  'the banner clears on its own within {int} seconds',
  { timeout: 25_000 },
  async function (this: NotificationSessionWorld, seconds: number) {
    // The banner is already visible (previous step waited for its copy).
    // Wait past the auto-clear horizon, then inspect only the frames
    // rendered AFTER that horizon.
    await delay(seconds * 1000 - 1500);
    const mark = this.capturedOutput.length;
    await delay(2500);
    const framesAfterClear = this.capturedOutput.slice(mark);
    assert.ok(
      framesAfterClear.length > 0,
      'Expected the session to still be rendering frames after the auto-clear horizon.',
    );
    assert.ok(
      !framesAfterClear.includes('Pomodoro complete'),
      `Expected the banner to have cleared, but its copy is still in the frames ` +
        `rendered after ${seconds}s:\n${framesAfterClear}`,
    );
  },
);

Then(
  'the pomodoro-complete banner is no longer shown',
  async function (this: NotificationSessionWorld) {
    // outputMark was set when the overdue moment was observed; the frames after
    // it must carry the NEW banner only (at most one banner, AC-01.3).
    const mark = this.outputMark ?? 0;
    await delay(1000);
    const framesAfterOverdue = this.capturedOutput.slice(mark);
    assert.ok(
      framesAfterOverdue.includes('Break ran over'),
      `Expected the overdue banner in the frames after the overdue moment:\n${framesAfterOverdue}`,
    );
    assert.ok(
      !framesAfterOverdue.includes('Pomodoro complete'),
      `Expected the superseded pomodoro-complete banner to be gone, but it is still ` +
        `rendered alongside the overdue banner:\n${framesAfterOverdue}`,
    );
  },
);

Then('the banner renders below the timer frame content', function (this: NotificationSessionWorld) {
  // AC-01.7 (owner-locked placement): within the frame that carries the
  // banner, the frame content — phase label, then footer hints — precedes
  // the banner copy. The footer's "quit" hint is the last frame element
  // before the banner, so ordering label < hint < banner proves "below".
  const bannerAt = this.capturedOutput.indexOf('Pomodoro complete');
  assert.ok(bannerAt !== -1, `Expected the banner copy in the captured frames.`);
  const frameBeforeBanner = this.capturedOutput.slice(0, bannerAt);
  const labelAt = frameBeforeBanner.lastIndexOf('BREAK');
  const hintAt = frameBeforeBanner.lastIndexOf('quit');
  assert.ok(
    labelAt !== -1 && hintAt !== -1 && labelAt < hintAt,
    `Expected the banner to render BELOW the frame (phase label, then footer ` +
      `hints, then banner), but the frame element ordering does not show it:\n` +
      `label@${labelAt}, footer-hint@${hintAt}, banner@${bannerAt}\n` +
      `${this.capturedOutput.slice(Math.max(0, bannerAt - 600), bannerAt + 200)}`,
  );
});

Then(
  'no session summary copy appears inside the timer frame',
  async function (this: NotificationSessionWorld) {
    // The summary co-fires with the phase change; give it two ticks to show up
    // if the pin were violated.
    await delay(2000);
    assert.ok(
      !this.capturedOutput.includes('min focused'),
      `Moment-priority pin violated: the session summary copy reached the TUI banner.\n` +
        `Captured:\n${this.capturedOutput.slice(-1500)}`,
    );
  },
);
