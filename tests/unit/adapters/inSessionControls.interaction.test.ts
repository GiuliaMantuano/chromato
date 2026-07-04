/**
 * In-session controls (feature in-session-controls, Slice 01) — acceptance specs.
 *
 * Feature ID  : in-session-controls
 * Wave        : DISTILL  | Date: 2026-06-03
 * Stories     : US-01 (skip the current rest period), US-02 (q quit + footer hints)
 * Author      : Quinn (acceptance-designer)
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHY ink-testing-library / vitest (NOT cucumber subprocess)  — harness choice
 * ──────────────────────────────────────────────────────────────────────────
 * This feature is fundamentally RAW-MODE KEYPRESSES on the running TUI (`s`,
 * `q`/`Q`, Ctrl+C). A cucumber-spawned subprocess CANNOT drive raw-mode stdin
 * keypresses into an Ink app — exactly the constraint that drove the
 * returning-home + setup-wizard two-harness split (see
 * tests/unit/adapters/homeAdapter.interaction.test.ts and that feature's
 * walking-skeleton.feature TESTABILITY NOTE). DESIGN §9 names the seams
 * explicitly: (1) TimerFrame + a fake SessionControlPort, (2) SessionService
 * skip()/quit() headless, (3) the pure footerHint(phase). All three are
 * ink-testing-library / vitest territory; none is observable from a subprocess
 * (a subprocess can't press `s`). Following the notification-branding precedent
 * (vitest-only when the subprocess can't drive the seam), this slice adds NO
 * cucumber feature — so there is NOTHING to wire into cucumber.config.mjs and no
 * orphan-trap. The walking skeleton below closes the keypress->WORK loop through
 * the production composition path (real TuiAdapter wired to a real SessionService
 * via attachControl), driven through headless raw-mode stdin.
 *
 * TEST PARADIGM: EXEMPT from PBT — interactive Ink keypress flow + a small, fixed
 * phase enumeration ({BREAK, LONG_BREAK, OVERDUE, WORK, IDLE}), NOT a domain-rich
 * input space. Per Mandate 9 (layer 2/3 = example-only) and Mandate 10 (skip
 * Tier B when input space is config-shaped / small enumerable), these are
 * example-only Tier A scenarios. Sad paths (no-op-during-WORK, Ctrl+C
 * non-regression) are named example tests per Mandate 11.
 *
 * Port boundary (Mandate 1): tests enter through driving surfaces only —
 *   - the TUI keypress surface (TimerFrame.useInput) wired to a control port, and
 *   - SessionService as the SessionControlPort driving port (skip()/quit()).
 * Domain internals (Session, PhaseStateMachine) are exercised INDIRECTLY through
 * SessionService + getSnapshot(). No direct PhaseStateMachine.completeBreak() call.
 *
 * RED status: every non-walking-skeleton scenario is it.skip(...) (one-at-a-time
 * DELIVER). The walking skeleton and the first enabled scenarios are RED against
 * the DISTILL scaffolds (Session.skipToWork / SessionService.skip|quit /
 * footerHint all throw "-- RED scaffold").
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TimerFrame, TuiAdapter, footerHint } from '../../../src/adapters/tuiAdapter.js';
import { SessionService } from '../../../src/application/sessionService.js';
import type {
  RenderPort,
  StatePort,
  NotificationPort,
  HistoryPort,
  SessionControlPort,
} from '../../../src/domain/ports.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';
import type { PomodoroPhase } from '../../../src/domain/phase.js';
import type { SessionConfig } from '../../../src/domain/config.js';

// ── Test helpers (style mirrors homeAdapter.interaction + sessionService specs) ──

/** Ink registers useInput via useEffect (async); flush effects + a render tick. */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function stripAnsi(frame: string): string {
  // eslint-disable-next-line no-control-regex
  return frame.replace(/\x1b\[[0-9;]*m/g, '');
}

const CTRL_C = '\x03';

function makeConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    workDurationSeconds: 25 * 60,
    breakDurationSeconds: 5 * 60,
    longBreakDurationSeconds: 15 * 60,
    cycleCount: 4,
    useAscii: false,
    useColor: false,
    ...overrides,
  };
}

/** A fake driving control port — records the control requests a keypress produces. */
class FakeControl implements SessionControlPort {
  skipCalls = 0;
  quitCalls = 0;
  skip(): void {
    this.skipCalls += 1;
  }
  quit(): void {
    this.quitCalls += 1;
  }
}

// In-memory driven ports for headless SessionService specs (real production class
// under test; only the I/O-bound driven ports are doubled, per Pillar 3).
class InMemoryRenderPort implements RenderPort {
  readonly snapshots: SessionSnapshot[] = [];
  stopped = false;
  render(snapshot: SessionSnapshot): void {
    this.snapshots.push(snapshot);
  }
  stop(): void {
    this.stopped = true;
  }
  last(): SessionSnapshot {
    return this.snapshots[this.snapshots.length - 1]!;
  }
}

class InMemoryStatePort implements StatePort {
  readonly written: SessionSnapshot[] = [];
  idleWritten = false;
  initialCompletedToday = 0;
  writeState(snapshot: SessionSnapshot): void {
    this.written.push(snapshot);
  }
  writeIdle(): void {
    this.idleWritten = true;
  }
  readState(): SessionSnapshot | null {
    return this.written.at(-1) ?? null;
  }
  readCompletedToday(): number {
    return this.initialCompletedToday;
  }
}

class InMemoryNotificationPort implements NotificationPort {
  readonly phaseChanges: Array<{ from: PomodoroPhase; to: PomodoroPhase }> = [];
  overdueCallCount = 0;
  readonly sessionCompleteCalls: number[] = [];
  notifyPhaseChange(from: PomodoroPhase, to: PomodoroPhase): void {
    this.phaseChanges.push({ from, to });
  }
  notifyOverdue(): void {
    this.overdueCallCount += 1;
  }
  notifySessionComplete(focusedMinutes: number): void {
    this.sessionCompleteCalls.push(focusedMinutes);
  }
}

class InMemoryHistoryPort implements HistoryPort {
  readonly recorded: number[] = [];
  recordSession(completedPomodoros: number): void {
    this.recorded.push(completedPomodoros);
  }
  readTodayCount(): number {
    return this.recorded.length;
  }
  readStreak(): number {
    return 0;
  }
}

function makePorts() {
  return {
    renderPort: new InMemoryRenderPort(),
    statePort: new InMemoryStatePort(),
    notificationPort: new InMemoryNotificationPort(),
    historyPort: new InMemoryHistoryPort(),
  };
}

/**
 * Drive a headless SessionService through tickOnce(...) to a target rest phase,
 * so skip()/quit() operate on a live active session — the production driving
 * port, only the driven I/O ports doubled. Returns the service + ports.
 *
 * NOTE: tickOnce binds the active session lazily; the design contract (§8.1)
 * requires run()/the control methods to publish/read `this.session`. These
 * helpers reach a phase via tickOnce so the scenarios stay headless (no setTimeout
 * loop). DELIVER wires run() to publish this.session for the live-loop path.
 */
function serviceInWork(config: SessionConfig = makeConfig({ workDurationSeconds: 4, breakDurationSeconds: 2 })) {
  const ports = makePorts();
  const service = new SessionService(ports.renderPort, ports.statePort, ports.notificationPort, ports.historyPort);
  service.tickOnce(config, 0); // IDLE -> WORK
  return { service, config, ...ports };
}

function serviceInShortBreak() {
  const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 300 });
  const ports = makePorts();
  ports.statePort.initialCompletedToday = 1; // finished her 2nd pomodoro context
  const service = new SessionService(ports.renderPort, ports.statePort, ports.notificationPort, ports.historyPort);
  service.tickOnce(config, 0); // IDLE -> WORK
  service.tickOnce(config, 2); // WORK -> BREAK
  return { service, config, ...ports };
}

function serviceInOverdue() {
  const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 2 });
  const ports = makePorts();
  const service = new SessionService(ports.renderPort, ports.statePort, ports.notificationPort, ports.historyPort);
  service.tickOnce(config, 0); // IDLE -> WORK
  service.tickOnce(config, 2); // WORK -> BREAK
  service.tickOnce(config, 3); // BREAK timer expires -> OVERDUE (enters; counter still 0)
  service.tickOnce(config, 763); // accumulate the count-up (+12:43), the trap to escape
  return { service, config, ...ports };
}

// ── Snapshot fixtures for footer (presentation) scenarios ───────────────────

function snapshotFor(phase: PomodoroPhase): SessionSnapshot {
  return {
    phase,
    timer: {
      totalSeconds: phase === 'OVERDUE' ? 1 : 1500,
      elapsedSeconds: phase === 'OVERDUE' ? 1 : 300,
      remainingSeconds: phase === 'OVERDUE' ? 0 : 1200,
      progressFraction: phase === 'OVERDUE' ? 1 : 0.2,
      isOverdue: phase === 'OVERDUE',
      overdueElapsedSeconds: phase === 'OVERDUE' ? 763 : 0, // +12:43
    },
    currentPomodoro: 1,
    completedToday: 4,
    streak: 0,
    config: makeConfig(),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// US-01: Skip the current rest period and start work
// ════════════════════════════════════════════════════════════════════════════

describe('US-01 — skip the current rest period and start work', () => {
  // ── WALKING SKELETON (ENABLED, RED) ──────────────────────────────────────
  // @walking_skeleton @driving_adapter @US-01
  // Closes the keypress->WORK loop through the PRODUCTION composition path: a real
  // TuiAdapter wired to a real SessionService via attachControl(), driven by a
  // headless raw-mode keypress. A non-technical stakeholder confirms: "yes — I'm
  // on a break, I press s, and I'm back in a fresh work session."
  it('[walking-skeleton] pressing s on a break starts a fresh work session (keypress -> WORK, production path)', async () => {
    const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 300 });
    const ports = makePorts();
    const tui = new TuiAdapter();
    const service = new SessionService(tui, ports.statePort, ports.notificationPort, ports.historyPort);
    tui.attachControl(service); // composition-root late injection (ADR-017 §8)

    // Drive the session into a BREAK headlessly, then render the live frame and
    // press `s` through the real TUI keypress surface.
    service.tickOnce(config, 0); // IDLE -> WORK
    service.tickOnce(config, 2); // WORK -> BREAK

    const { stdin } = render(
      React.createElement(TimerFrame, { snapshot: service.getSnapshot()!, columns: 80, control: service }),
    );
    await flush();
    stdin.write('s'); // user presses the skip key
    await flush();

    // Observable outcome at the driving port: the active session is now WORK.
    expect(service.getSnapshot()!.phase).toBe('WORK');
  });

  // ── Scenario: Skipping a long break starts a fresh new cycle (US-01 ex.1) ──
  // @US-01 — the reported trigger. completedToday stays 4; badge -> 1 of 4.
  it('skipping a long break starts a fresh new cycle (POMODORO 1 of 4, Today unchanged)', () => {
    // Given Kai is on a LONG BREAK after his 4th pomodoro, "Today: 4 sessions".
    // Seed 3 completed pomodoros, then complete the 4th WORK: completeWork(4)
    // hits 4 % cycleCount(4) === 0 -> LONG_BREAK. completedToday becomes 4.
    const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 100 });
    const ports = makePorts();
    ports.statePort.initialCompletedToday = 3;
    const service = new SessionService(ports.renderPort, ports.statePort, ports.notificationPort, ports.historyPort);
    service.tickOnce(config, 0); // IDLE -> WORK (the 4th pomodoro)
    service.tickOnce(config, 2); // WORK completes -> LONG_BREAK; completedToday -> 4
    const before = service.getSnapshot()!;
    expect(before.phase).toBe('LONG_BREAK');
    const todayBefore = before.completedToday;

    // When he presses the skip key
    service.skip();

    // Then phase -> WORK, countdown -> work duration, badge 1 of 4, Today unchanged
    const after = service.getSnapshot()!;
    expect(after.phase).toBe('WORK');
    expect(after.timer.remainingSeconds).toBe(config.workDurationSeconds);
    expect(after.currentPomodoro).toBe(1); // (4 % 4) + 1 = 1 -> "1 of 4"
    expect(after.completedToday).toBe(todayBefore); // skipped break != completed work
  });

  // ── Scenario: Skipping a short break advances to the next pomodoro (ex.2) ──
  // @US-01 — chained narrative: Given reuses the short-break state.
  it('skipping a short break advances to the next pomodoro (POMODORO 3 of 4)', () => {
    // Given Aiko is on a BREAK after her 2nd pomodoro (completedToday seeded to 1:
    // Session(config,1) -> PhaseStateMachine(1) -> completeWork() -> count 2 -> 2nd done)
    const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 300 });
    const ports = makePorts();
    ports.statePort.initialCompletedToday = 1;
    const service = new SessionService(ports.renderPort, ports.statePort, ports.notificationPort, ports.historyPort);
    service.tickOnce(config, 0); // IDLE -> WORK
    service.tickOnce(config, 2); // WORK -> BREAK
    expect(service.getSnapshot()!.phase).toBe('BREAK');

    // When she presses the skip key
    service.skip();

    // Then phase -> WORK, badge -> next pomodoro (3 of 4)
    const after = service.getSnapshot()!;
    expect(after.phase).toBe('WORK');
    expect(after.timer.remainingSeconds).toBe(config.workDurationSeconds);
    expect(after.currentPomodoro).toBe(3); // (2 % 4) + 1 = 3 -> "3 of 4"
  });

  // ── Scenario: Skipping from OVERDUE escapes the count-up trap (ex. core bug) ─
  // @US-01 — the reported "+MM:SS counts up forever" trap. HARD #2.
  it('skipping from OVERDUE escapes the count-up trap (overdue counter cleared)', () => {
    // Given Kai let his long break run over and the phase is OVERDUE
    const { service, config } = serviceInOverdue();
    const before = service.getSnapshot()!;
    expect(before.phase).toBe('OVERDUE');
    expect(before.timer.overdueElapsedSeconds).toBeGreaterThan(0);

    // When he presses the skip key
    service.skip();

    // Then phase -> WORK, overdue counter reset to 0, countdown -> work duration
    const after = service.getSnapshot()!;
    expect(after.phase).toBe('WORK');
    expect(after.timer.overdueElapsedSeconds).toBe(0); // HARD #2: +MM:SS gone
    expect(after.timer.remainingSeconds).toBe(config.workDurationSeconds);
  });

  // ── Scenario: Skipping a break does not count as a completed work session ──
  // @US-01 — completedToday invariant across skip.
  it('skipping a break leaves the completed-today count unchanged', () => {
    // Given the phase is BREAK with a known completed-today count
    const { service } = serviceInShortBreak(); // completedToday seeded to 1
    const todayBefore = service.getSnapshot()!.completedToday;

    // When Kai presses the skip key
    service.skip();

    // Then the "Today" count is unchanged
    expect(service.getSnapshot()!.completedToday).toBe(todayBefore);
  });

  // ── Scenario: Skip during a work session is ignored in this slice (ex.3) ───
  // @US-01 — SAD/boundary (Mandate 11 named example): no-op during WORK.
  it('pressing s during a WORK session is a no-op (phase and countdown unchanged)', () => {
    // Given the phase is WORK with time remaining
    const { service } = serviceInWork();
    const before = service.getSnapshot()!;
    expect(before.phase).toBe('WORK');
    const remainingBefore = before.timer.remainingSeconds;

    // When Priya fat-fingers the skip key
    service.skip();

    // Then the phase remains WORK and the countdown is unchanged
    const after = service.getSnapshot()!;
    expect(after.phase).toBe('WORK');
    expect(after.timer.remainingSeconds).toBe(remainingBefore);
  });

  // ── Scenario: skip with no active session is a safe no-op (ADR-017 null guard) ─
  // @US-01 — SAD/boundary (Mandate 11 named example): skip() before any session is
  // bound (this.session === null) must not throw and must not render anything.
  // ADR-017 + wave-decisions.md document "skip is a no-op ... when there is no
  // active session" — this closes that documented guard (was only covered for WORK).
  it('pressing s with no active session is a safe no-op (does not throw, nothing rendered)', () => {
    // Given a SessionService that has never been ticked (this.session is null)
    const ports = makePorts();
    const service = new SessionService(ports.renderPort, ports.statePort, ports.notificationPort, ports.historyPort);

    // When the skip key is pressed before any session exists
    // Then it does not throw, and nothing is rendered
    expect(() => service.skip()).not.toThrow();
    expect(ports.renderPort.snapshots).toHaveLength(0);
  });

  // ── Scenario: quit with no active session is a safe no-op (ADR-017 null guard) ─
  // @US-02 — SAD/boundary (Mandate 11 named example): quit() before any session is
  // bound (this.session === null) must not throw and must tear nothing down. Mirrors
  // the skip() null-guard above; closes the documented quit no-op contract (D2).
  it('pressing q with no active session is a safe no-op (does not throw, nothing torn down)', () => {
    // Given a SessionService that has never been ticked (this.session is null)
    const ports = makePorts();
    const service = new SessionService(ports.renderPort, ports.statePort, ports.notificationPort, ports.historyPort);

    // When the quit key is pressed before any session exists
    // Then it does not throw, and no teardown is performed
    expect(() => service.quit()).not.toThrow();
    expect(ports.renderPort.stopped).toBe(false);
  });

  // ── Scenario: state.json reflects WORK within one event-loop turn (DN-2) ───
  // @US-01 — DESIGN DN-2: read-back of persisted state phase == WORK after skip.
  it('persists WORK to the state read-back within one event-loop turn of a skip (DN-2)', () => {
    // Given the phase is OVERDUE (a worst-case: counts up forever today)
    const { service, statePort } = serviceInOverdue();

    // When the user presses the skip key
    service.skip();

    // Then the persisted state read-back reports WORK (not one tick late)
    const persisted = statePort.readState();
    expect(persisted).not.toBeNull();
    expect(persisted!.phase).toBe('WORK');
  });

  // ── Scenario: skip flushes the phase-change on the keypress frame (HARD #5) ─
  // @US-01 — processEvents-on-skip-frame: notification fires now, not a tick late.
  it('flushes the phase change on the skip frame (notification fires immediately, not a tick late)', () => {
    // Given the phase is a short BREAK
    const { service, notificationPort } = serviceInShortBreak();
    const phaseChangesBefore = notificationPort.phaseChanges.length;

    // When the user presses the skip key
    service.skip();

    // Then a BREAK -> WORK phase change is observed on this frame (drained now)
    expect(notificationPort.phaseChanges.length).toBe(phaseChangesBefore + 1);
    const latest = notificationPort.phaseChanges[notificationPort.phaseChanges.length - 1]!;
    expect(latest.to).toBe('WORK');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// US-01 / US-02: Phase-aware footer hints (presentation — pure footerHint helper)
// ════════════════════════════════════════════════════════════════════════════

describe('US-01/US-02 — phase-aware footer hints', () => {
  // footerHint(phase) now returns a KeyHint[] (the shared tui/components type) so
  // the running footer renders through the SAME <Footer> key-cap component the
  // wizard + home use. The footer advertises action keys + quit ONLY — never
  // Ctrl+C (matches wizard/home, where Ctrl+C also works unadvertised).

  // ── Scenario: The skip key is advertised in the footer during a break ─────
  // @US-01 — break footer carries an uppercase S skip-break hint AND a Q quit hint,
  // and NO Ctrl+C entry (the hint is dropped; the 0x03 handler stays functional).
  it('footer advertises the S skip-break hint and the Q quit hint (no Ctrl+C) during a break', () => {
    const breakHints = footerHint('BREAK');
    expect(breakHints).toContainEqual({ key: 'S', label: 'skip break' });
    expect(breakHints).toContainEqual({ key: 'Q', label: 'quit' });
    // No Ctrl+C hint anywhere in the key-caps or labels.
    const flattened = breakHints.map((h) => `${h.key} ${h.label}`).join(' ').toLowerCase();
    expect(flattened).not.toContain('ctrl');
    expect(flattened).not.toContain('^c');
  });

  // ── Scenario: OVERDUE footer says "start work", not "skip break" ──────────
  // @US-01 — phase-aware wording (US-01 OVERDUE scenario).
  it('footer says "start work" (not "skip break") during OVERDUE', () => {
    const overdueHints = footerHint('OVERDUE');
    expect(overdueHints).toContainEqual({ key: 'S', label: 'start work' });
    expect(overdueHints).toContainEqual({ key: 'Q', label: 'quit' });
    expect(overdueHints.some((h) => h.label === 'skip break')).toBe(false);
  });

  // ── Scenario: skip hint is SUPPRESSED during WORK (HARD #3 / US-01 ex.3) ──
  // @US-01 — SAD/boundary (Mandate 11): no skip hint while working, only quit.
  it('footer suppresses the skip hint during WORK and advertises only the Q quit key', () => {
    const workHints = footerHint('WORK');
    expect(workHints).toEqual([{ key: 'Q', label: 'quit' }]);
    expect(workHints.some((h) => h.label.includes('skip') || h.label.includes('start work'))).toBe(false);
  });

  // ── Scenario: the quit key is advertised in the footer (US-02) ────────────
  // @US-02 — footer shows a hint to quit with Q (uppercase key-cap, home convention).
  it('footer advertises the Q quit key during WORK', () => {
    const workHints = footerHint('WORK');
    expect(workHints).toContainEqual({ key: 'Q', label: 'quit' });
  });

  // ── Scenario: compact (<40 col) footer fits and keeps the per-phase keys ──
  // @US-01 @US-02 — HARD #3: phase-aware key-cap hint in the compact branch, no overflow.
  it('compact (<40 col) footer fits the column budget and shows the break skip + quit key-caps', () => {
    const snapshot = snapshotFor('BREAK');
    const { lastFrame } = render(
      React.createElement(TimerFrame, { snapshot, columns: 30 }),
    );
    const plain = stripAnsi(lastFrame() ?? '');
    const lines = plain.split('\n').filter((l) => l.trim().length > 0);
    // No line overflows the 30-column compact budget.
    expect(lines.filter((l) => l.length > 30)).toHaveLength(0);
    // The footer still advertises skip + quit key-caps in compact mode, never Ctrl+C.
    expect(plain.toLowerCase()).toContain('skip');
    expect(plain).toContain('Q');
    expect(plain).not.toContain('Ctrl+C');
  });

  // ── Scenario: standard-layout footer renders the phase-aware hint ─────────
  // @US-01 @US-02 — HARD #3: phase-aware key-cap hint in the standard branch, no Ctrl+C.
  it('standard-layout footer renders the OVERDUE start-work key-cap hint without Ctrl+C', () => {
    const snapshot = snapshotFor('OVERDUE');
    const { lastFrame } = render(
      React.createElement(TimerFrame, { snapshot, columns: 80 }),
    );
    const plain = stripAnsi(lastFrame() ?? '');
    expect(plain.toLowerCase()).toContain('start work');
    expect(plain).toContain('S'); // uppercase key-cap
    expect(plain).toContain('Q'); // quit key-cap
    expect(plain).not.toContain('Ctrl+C');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// US-02: Quit the running timer with q
// ════════════════════════════════════════════════════════════════════════════

describe('US-02 — quit the running timer with q', () => {
  // ── Scenario: pressing q routes a quit request through the control port ───
  // @US-02 @driving_adapter — keypress surface drives control.quit().
  it('pressing q in the running timer requests a quit through the control port', async () => {
    const control = new FakeControl();
    const snapshot = snapshotFor('WORK');
    const { stdin } = render(
      React.createElement(TimerFrame, { snapshot, columns: 80, control }),
    );
    await flush();

    stdin.write('q'); // Kai presses q
    await flush();

    expect(control.quitCalls).toBe(1);
    expect(control.skipCalls).toBe(0);
  });

  // ── Scenario: uppercase Q also quits (US-02 — mirrors homeAdapter q/Q) ────
  // @US-02 @driving_adapter
  it('pressing uppercase Q in the running timer also requests a quit', async () => {
    const control = new FakeControl();
    const snapshot = snapshotFor('LONG_BREAK');
    const { stdin } = render(
      React.createElement(TimerFrame, { snapshot, columns: 80, control }),
    );
    await flush();

    stdin.write('Q'); // Aiko presses Q during a long break
    await flush();

    expect(control.quitCalls).toBe(1);
  });

  // ── Scenario: a q quit stops the session cleanly with exit code 0 ─────────
  // @US-02 — headless: quit() -> interrupt -> next tick teardown (stop + idle).
  it('a q quit stops the session cleanly (renderer stopped, idle persisted, no zombie)', () => {
    // Given a running WORK session
    const { service, config, renderPort, statePort } = serviceInWork();

    // When the user quits via q (control port)
    service.quit();
    service.tickOnce(config, 1); // the next tick finalizes teardown (Ctrl+C parity)

    // Then the renderer is stopped and idle state is persisted (clean exit-0 path)
    expect(renderPort.stopped).toBe(true);
    expect(statePort.idleWritten).toBe(true);
  });

  // ── Scenario: q quits regardless of phase (US-02 ex.2) ────────────────────
  // @US-02 — quit works from a LONG BREAK too.
  it('a q quit stops the session cleanly regardless of phase (during a break)', () => {
    // Given a running session that has reached a BREAK
    const { service, config, renderPort, statePort } = serviceInShortBreak();

    // When the user quits via q
    service.quit();
    service.tickOnce(config, 1);

    // Then the teardown is clean, same as from WORK
    expect(renderPort.stopped).toBe(true);
    expect(statePort.idleWritten).toBe(true);
  });

  // ── Scenario: Ctrl+C still quits unchanged (NON-REGRESSION GUARD) ─────────
  // @US-02 — SAD/regression (Mandate 11 named example): the 0x03 listener owns
  // Ctrl+C (DN-1). Pressing Ctrl+C emits SIGINT; it must NOT go through the
  // control port (no double-interrupt). Mirrors tuiAdapter R1 regression test.
  it('Ctrl+C still emits SIGINT and does NOT route through the control port (non-regression)', async () => {
    // `false as never`: @types/node types some process.emit overloads as
    // returning `this` (Process), so vitest infers the mock return type as
    // Process rather than boolean. The return value is irrelevant here (we only
    // assert emit was called); `as never` satisfies the mis-inferred overload
    // without a blanket any/@ts-ignore.
    const emitSpy = vi.spyOn(process, 'emit').mockReturnValue(false as never);
    const control = new FakeControl();
    try {
      const { stdin } = render(
        React.createElement(TimerFrame, { snapshot: snapshotFor('WORK'), columns: 80, control }),
      );
      await flush();

      stdin.write(CTRL_C); // Priya presses Ctrl+C out of habit
      await flush();

      // SIGINT is emitted by the separate raw-stdin listener (unchanged path)...
      expect(emitSpy).toHaveBeenCalledWith('SIGINT');
      // ...and the control port quit() was NOT invoked (DN-1: useInput ignores Ctrl+C).
      expect(control.quitCalls).toBe(0);
    } finally {
      emitSpy.mockRestore();
    }
  });
});
