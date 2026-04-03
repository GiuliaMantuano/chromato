/**
 * Unit tests: tick cadence contract via SessionService driving port
 *
 * Step 03-02: 1-second progress bar update cadence
 *
 * Test Budget: 2 distinct behaviors x 2 = 4 max unit tests
 *
 * B1: N tickOnce() calls produce exactly N render() calls (one render per tick)
 * B2: progressFraction advances monotonically across consecutive ticks
 *
 * Tests enter through SessionService (driving port).
 * RenderPort spy captures snapshots at the driven port boundary.
 * No domain internals (Session, TimerSnapshot) imported directly.
 */

import { describe, it, expect } from 'vitest';
import { SessionService } from '../../src/application/sessionService.js';
import type { SessionConfig } from '../../src/domain/config.js';
import type { SessionSnapshot } from '../../src/domain/types.js';
import type { RenderPort, StatePort } from '../../src/domain/ports.js';

// ---------------------------------------------------------------------------
// RenderPort spy: captures all snapshots at the driven port boundary.
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

function makeConfig(workDurationSeconds: number): SessionConfig {
  return {
    workDurationSeconds,
    breakDurationSeconds: 300,
    longBreakDurationSeconds: 900,
    cycleCount: 4,
    useAscii: false,
    useColor: true,
  };
}

// ---------------------------------------------------------------------------
// B1: Each tickOnce() call produces exactly one render() call
// ---------------------------------------------------------------------------

describe('SessionService driving port -- tick cadence (B1)', () => {
  it.each([1, 3, 5, 10])(
    'produces exactly %i render calls after %i tick(s)',
    (ticks: number) => {
      const renderSpy = new RenderCaptureSpy();
      const config = makeConfig(300);
      const service = new SessionService(renderSpy, new NullStatePort(), null, null);

      // First tick transitions IDLE -> WORK; counts as one render.
      for (let tick = 0; tick < ticks; tick++) {
        service.tickOnce(config, 1);
      }

      expect(renderSpy.snapshots).toHaveLength(ticks);
    }
  );
});

// ---------------------------------------------------------------------------
// B2: progressFraction increases monotonically across consecutive ticks
// ---------------------------------------------------------------------------

describe('SessionService driving port -- tick cadence (B2)', () => {
  it('progressFraction advances monotonically across 5 consecutive 1-second ticks', () => {
    const renderSpy = new RenderCaptureSpy();
    const config = makeConfig(60);
    const service = new SessionService(renderSpy, new NullStatePort(), null, null);

    // First tick: IDLE -> WORK (deltaSeconds=0, fraction=0)
    service.tickOnce(config, 0);

    // 5 subsequent ticks of 1 second each
    for (let tick = 0; tick < 5; tick++) {
      service.tickOnce(config, 1);
    }

    // Snapshots: frames 0 through 5 (frame 0 is the IDLE->WORK transition)
    const fractions = renderSpy.snapshots.map((s) => s.timer.progressFraction);

    // Each tick within WORK phase must increase progressFraction
    for (let index = 1; index < fractions.length; index++) {
      expect(fractions[index]).toBeGreaterThan(fractions[index - 1]);
    }
  });
});
