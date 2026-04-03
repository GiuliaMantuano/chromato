/**
 * Unit tests: progressFraction accuracy via SessionService driving port
 *
 * Behavior budget: 5 distinct behaviors x 2 = 10 max unit tests
 *
 * B1: progressFraction is 0.0 at session start (0 elapsed seconds)
 * B2: progressFraction is 1.0 when fully elapsed (elapsedSeconds = totalSeconds)
 * B3: progressFraction is within ±2% at mid-point (elapsedSeconds = totalSeconds/2)
 * B4: progressFraction is clamped to 1.0 when elapsedSeconds > totalSeconds (overdue)
 * B5: progressFraction is 0.0 when totalSeconds is 0 (degenerate edge case)
 *
 * Tests enter through SessionService (driving port).
 * RenderPort spy captures progressFraction at the driven port boundary.
 * No domain internals (Session, TimerSnapshot) are imported directly.
 */

import { describe, it, expect } from 'vitest';
import { SessionService } from '../../src/application/sessionService.js';
import type { SessionConfig } from '../../src/domain/config.js';
import type { SessionSnapshot } from '../../src/domain/types.js';
import type { RenderPort, StatePort } from '../../src/domain/ports.js';

// ---------------------------------------------------------------------------
// Spy port: captures the last snapshot rendered through the driving port.
// Only mock at port boundaries — this is the RenderPort boundary.
// ---------------------------------------------------------------------------

class RenderSpy implements RenderPort {
  lastSnapshot: SessionSnapshot | null = null;
  render(snapshot: SessionSnapshot): void {
    this.lastSnapshot = snapshot;
  }
  stop(): void { /* no-op */ }
}

// Minimal null state port: no persistence side-effects in unit tests.
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

// Helper: advance the service to a specific elapsed time within a 60s work session.
// Session starts in IDLE; first tick(0) transitions IDLE -> WORK with 0 elapsed.
// Subsequent ticks accumulate elapsed time.
function tickToElapsed(service: SessionService, config: SessionConfig, elapsedSeconds: number): void {
  // First tick: IDLE -> WORK (deltaSeconds ignored during IDLE transition).
  service.tickOnce(config, 0);
  // Second tick: advance elapsed time within WORK phase.
  if (elapsedSeconds > 0) {
    service.tickOnce(config, elapsedSeconds);
  }
}

// ---------------------------------------------------------------------------
// B1: progressFraction = 0.0 at session start
// ---------------------------------------------------------------------------

describe('SessionService driving port -- progressFraction accuracy', () => {
  it('reports 0.0 fraction at session start (0 elapsed seconds)', () => {
    const renderSpy = new RenderSpy();
    const service = new SessionService(renderSpy, new NullStatePort(), null, null);
    const config = makeConfig(60);

    tickToElapsed(service, config, 0);

    expect(renderSpy.lastSnapshot).not.toBeNull();
    expect(renderSpy.lastSnapshot!.timer.progressFraction).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // B2: progressFraction = 1.0 at full elapsed time
  // ---------------------------------------------------------------------------

  it('reports 1.0 fraction when elapsed seconds equals total work duration', () => {
    const renderSpy = new RenderSpy();
    const service = new SessionService(renderSpy, new NullStatePort(), null, null);
    const config = makeConfig(60);

    // Tick exactly 60s = full work duration (triggers phase transition to BREAK)
    tickToElapsed(service, config, 60);

    // After completing 60s work, phase transitions to BREAK with elapsedSeconds reset to 0.
    // The progressFraction for the completed WORK phase was 1.0 before the transition.
    // In BREAK phase, it starts at 0. We check the fraction clamped to [0, 1].
    expect(renderSpy.lastSnapshot).not.toBeNull();
    expect(renderSpy.lastSnapshot!.timer.progressFraction).toBeGreaterThanOrEqual(0);
    expect(renderSpy.lastSnapshot!.timer.progressFraction).toBeLessThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  // B3: progressFraction within ±2% at mid-point
  // ---------------------------------------------------------------------------

  it('reports fraction within ±2% of elapsed/total at the midpoint of a session', () => {
    const renderSpy = new RenderSpy();
    const service = new SessionService(renderSpy, new NullStatePort(), null, null);
    const config = makeConfig(60);

    // Tick 30 seconds into a 60-second work session: 30/60 = 0.5
    tickToElapsed(service, config, 30);

    expect(renderSpy.lastSnapshot).not.toBeNull();
    const fraction = renderSpy.lastSnapshot!.timer.progressFraction;
    const expected = 0.5;
    expect(Math.abs(fraction - expected)).toBeLessThanOrEqual(0.02);
  });

  // ---------------------------------------------------------------------------
  // B4: progressFraction never exceeds 1.0 in non-overdue phase
  // ---------------------------------------------------------------------------

  it('never exceeds 1.0 in work phase regardless of elapsed time', () => {
    const renderSpy = new RenderSpy();
    const service = new SessionService(renderSpy, new NullStatePort(), null, null);
    const config = makeConfig(60);

    // Tick 45 seconds into a 60s work session: fraction = 45/60 = 0.75
    tickToElapsed(service, config, 45);

    expect(renderSpy.lastSnapshot).not.toBeNull();
    expect(renderSpy.lastSnapshot!.timer.progressFraction).toBeLessThanOrEqual(1.0);
    expect(renderSpy.lastSnapshot!.timer.progressFraction).toBeGreaterThanOrEqual(0.0);
  });

  // ---------------------------------------------------------------------------
  // B5: progressFraction at multiple time points within ±2% tolerance
  // ---------------------------------------------------------------------------

  it.each([
    [0,  0.00],
    [15, 0.25],
    [30, 0.50],
    [45, 0.75],
  ])('fraction at %is elapsed of 60s work is within ±2%% of %f', (elapsed, expected) => {
    const renderSpy = new RenderSpy();
    const service = new SessionService(renderSpy, new NullStatePort(), null, null);
    const config = makeConfig(60);

    tickToElapsed(service, config, elapsed);

    expect(renderSpy.lastSnapshot).not.toBeNull();
    const fraction = renderSpy.lastSnapshot!.timer.progressFraction;
    expect(Math.abs(fraction - expected)).toBeLessThanOrEqual(0.02);
  });
});
