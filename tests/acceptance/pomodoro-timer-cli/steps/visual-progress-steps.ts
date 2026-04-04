/**
 * Step definitions for AC-01.2 (progress bar update cadence) and
 * AC-01.4 (ASCII fallback mode).
 *
 * Driving port: SessionService (application service) for tick cadence steps.
 * CLI process (chromato binary) for ASCII fallback steps.
 *
 * Hexagonal boundary: test enters through SessionService (driving port).
 * RenderPort spy captures snapshots at the driven port boundary.
 * No domain internals imported directly.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import type { ChromatoWorld } from './world';
import * as assert from 'assert';
import { SessionService } from '../../../../src/application/sessionService.js';
import type { SessionConfig } from '../../../../src/domain/config.js';
import type { SessionSnapshot } from '../../../../src/domain/types.js';
import type { RenderPort, StatePort } from '../../../../src/domain/ports.js';

// ---------------------------------------------------------------------------
// RenderPort spy: captures all snapshots rendered through the driving port.
// Only mock at port boundaries -- this is the RenderPort boundary.
// ---------------------------------------------------------------------------

class RenderCaptureSpy implements RenderPort {
  readonly snapshots: SessionSnapshot[] = [];
  render(snapshot: SessionSnapshot): void {
    this.snapshots.push(snapshot);
  }
  stop(): void { /* no-op */ }
}

class NullStatePort implements StatePort {
  writeState(_snapshot: SessionSnapshot): void { /* no-op */ }
  writeIdle(): void { /* no-op */ }
  readState(): SessionSnapshot | null { return null; }
  readCompletedToday(): number { return 0; }
}

// Module-level context per scenario: keyed by world instance reference.
// Avoids modifying ChromatoWorld (which is outside files_to_modify).
const scenarioContext = new WeakMap<ChromatoWorld, {
  service: SessionService;
  renderSpy: RenderCaptureSpy;
  config: SessionConfig;
}>();

// ---------------------------------------------------------------------------
// Given: a N-second work session has just started
// ---------------------------------------------------------------------------

Given('a {int}-second work session has just started', function (
  this: ChromatoWorld,
  durationSeconds: number
) {
  const renderSpy = new RenderCaptureSpy();
  const config: SessionConfig = {
    workDurationSeconds: durationSeconds,
    breakDurationSeconds: 300,
    longBreakDurationSeconds: 900,
    cycleCount: 4,
    useAscii: false,
    useColor: true,
  };
  const service = new SessionService(renderSpy, new NullStatePort(), null, null);

  // First tick: transitions IDLE -> WORK, renders first frame.
  service.tickOnce(config, 0);

  // Clear initial frame so subsequent ticks represent elapsed seconds.
  renderSpy.snapshots.length = 0;

  scenarioContext.set(this, { service, renderSpy, config });
});

// ---------------------------------------------------------------------------
// When: N seconds elapse (simulate N ticks of 1 second each)
// ---------------------------------------------------------------------------

When('{int} seconds elapse', function (this: ChromatoWorld, seconds: number) {
  const ctx = scenarioContext.get(this);
  assert.ok(ctx, 'Session context not initialized -- run "Given a N-second work session has just started" first');

  for (let tick = 0; tick < seconds; tick++) {
    ctx.service.tickOnce(ctx.config, 1);
  }
});

// ---------------------------------------------------------------------------
// Then: the TUI has rendered at least N distinct frames
// ---------------------------------------------------------------------------

Then('the TUI has rendered at least {int} distinct frames', function (
  this: ChromatoWorld,
  minFrames: number
) {
  const ctx = scenarioContext.get(this);
  assert.ok(ctx, 'Session context not initialized');

  const frameCount = ctx.renderSpy.snapshots.length;
  assert.ok(
    frameCount >= minFrames,
    `Expected at least ${minFrames} rendered frames but got ${frameCount}`
  );
});

// ---------------------------------------------------------------------------
// Then: each frame shows a higher fill percentage than the previous frame
// ---------------------------------------------------------------------------

Then('each frame shows a higher fill percentage than the previous frame', function (
  this: ChromatoWorld
) {
  const ctx = scenarioContext.get(this);
  assert.ok(ctx, 'Session context not initialized');

  const snapshots = ctx.renderSpy.snapshots;
  assert.ok(
    snapshots.length >= 2,
    `Need at least 2 frames to compare fill progression, got ${snapshots.length}`
  );

  for (let index = 1; index < snapshots.length; index++) {
    const previous = snapshots[index - 1].timer.progressFraction;
    const current = snapshots[index].timer.progressFraction;
    assert.ok(
      current > previous,
      `Frame ${index} progressFraction (${current}) is not higher than frame ${index - 1} (${previous})`
    );
  }
});

// ---------------------------------------------------------------------------
// AC-01.4: ASCII fallback mode assertions
// ---------------------------------------------------------------------------

Then('chromato outputs an informational message about ASCII fallback mode', function (
  this: ChromatoWorld
) {
  const combined = this.capturedOutput + (this.capturedStderr ?? '');
  assert.ok(
    /Unicode not detected|ASCII progress bar|ascii/i.test(combined),
    `Expected informational ASCII fallback message in output but got:\n${combined}`
  );
});

Then('the progress bar uses ASCII characters ("=" for filled, "-" for empty)', function (
  this: ChromatoWorld
) {
  // The progress bar content is rendered by Ink (TUI) and captured in stdout.
  // Verify that ASCII chars ('=' and '-') appear and Unicode block chars do not.
  const output = this.capturedOutput;
  assert.ok(
    output.includes('=') || output.includes('-'),
    `Expected ASCII progress bar characters in output but got:\n${output}`
  );
  assert.ok(
    !output.includes('█') && !output.includes('░'),
    `Expected no Unicode block characters in ASCII mode but found them in:\n${output}`
  );
});

Then('the informational ASCII fallback message does not appear', function (
  this: ChromatoWorld
) {
  const combined = this.capturedOutput + (this.capturedStderr ?? '');
  assert.ok(
    !/Unicode not detected — using ASCII progress bar/.test(combined),
    `Expected no ASCII fallback informational message but found one in:\n${combined}`
  );
});

Then('the session runs normally with ASCII progress bar characters', function (
  this: ChromatoWorld
) {
  // Verify the session started (WORK phase visible) and ASCII characters are present.
  const output = this.capturedOutput;
  assert.ok(
    /WORK|POMODORO/i.test(output),
    `Expected session to have started (WORK/POMODORO visible) but got:\n${output}`
  );
  assert.ok(
    output.includes('=') || output.includes('-'),
    `Expected ASCII progress bar characters in output but got:\n${output}`
  );
});
