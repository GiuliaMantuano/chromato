/**
 * WindowTitleAdapter @tty-sim twins — in-terminal-notifications slice-06
 * start group (DELIVER step 03-01).
 *
 * Traceability: US-06 (AC-06.1 start half, AC-06.5, AC-06.8 start path),
 * [D8], [D11], DDD-4.
 *
 * Vitest TWINS of the two @tty-sim SPEC_ONLY scenarios removed from
 * tests/acceptance/in-terminal-notifications/slice-06-window-title.feature by
 * this step (pointer comments left in place): TTY-positive title bytes are
 * unobservable through a piped subprocess ([D8] suppresses them) — the isTTY
 * stub below is the simulated terminal. Same harness convention as
 * bellNotificationAdapter.test.ts (02-03).
 *
 * NOTE (step 03-01 scope): only start() [+ the minimal stop() stale-title
 * mitigation] is implemented here. The notify* phase titles land in 03-02 and
 * the full exit-path ordering in 03-03 — those scenarios keep their @skip in
 * the feature file and are NOT twinned here.
 *
 * TEST PARADIGM: exact byte sequences are EXEMPT (spike-verified exact-byte
 * contract). The [D8] gate is a property — for ANY lifecycle call or moment,
 * non-TTY emits ZERO bytes — enumerated as a full-surface test table
 * (fast-check absent, zero new deps).
 *
 * Test budget: 5 behaviors (start ordering / ASCII titles / [D8] silence /
 * minimal stop ordering / composite safety) x 2 = 10 max; 6 written.
 */

import { describe, expect, it } from 'vitest';
import {
  createWindowTitleAdapter,
  WindowTitleAdapter,
} from '../../../src/adapters/windowTitleAdapter.js';
import { NEUTRAL_TITLE } from '../../../src/domain/windowTitle.js';

const SAVE = '\x1b[22;0t';
const RESTORE = '\x1b[23;0t';
const osc = (title: string): string => `\x1b]0;${title}\x07`;

/** Captures the exact bytes an interactive (or piped) terminal would receive. */
class CapturingStdout {
  readonly writes: string[] = [];
  constructor(readonly isTTY: boolean) {}
  write(chunk: string): boolean {
    if (typeof chunk !== 'string') {
      throw new Error('WindowTitleAdapter must write string chunks');
    }
    this.writes.push(chunk);
    return true;
  }
  bytes(): string {
    return this.writes.join('');
  }
}

function isAsciiOnly(text: string): boolean {
  return [...text].every((ch) => (ch.codePointAt(0) ?? 0) <= 0x7f);
}

describe('WindowTitleAdapter — session start group (DDD-4)', () => {
  // ── Twin of: "The window announces the session from the start" ────────────
  // AC-06.1 + AC-06.8 (start half): IDLE→WORK emits no PHASE_CHANGED, so the
  // composition root calls start() — which must SAVE the user's title
  // (XTWINOPS 22) BEFORE any title set, then set the WORK phase title.
  it('start() saves the user title first, then sets "🍅 WORK — chromato" (exact bytes, exact order)', () => {
    const tty = new CapturingStdout(true);
    new WindowTitleAdapter(false, tty).start();
    expect(tty.writes.join('')).toBe(SAVE + osc('🍅 WORK — chromato'));
    // The save sequence strictly precedes the first OSC title set.
    expect(tty.bytes().indexOf(SAVE)).toBeLessThan(tty.bytes().indexOf('\x1b]0;'));
  });

  // ── Twin of: "ASCII sessions title without emoji" (AC-06.5 / [D11]) ───────
  it('with useAscii the start title is "WORK - chromato" and every emitted title is ASCII-only', () => {
    const tty = new CapturingStdout(true);
    const adapter = new WindowTitleAdapter(true, tty);
    adapter.start();
    expect(tty.bytes()).toContain(osc('WORK - chromato'));
    adapter.stop(); // the whole lifecycle stays ASCII-only
    expect(isAsciiOnly(tty.bytes())).toBe(true);
  });

  // ── Minimal stop() stale-title mitigation (full exit-path pin is 03-03) ───
  // AC-06.3 ordering: neutral "chromato" FIRST, then XTWINOPS 23 restore — a
  // restore-less terminal is left neutral, never wearing a stale phase title.
  it('stop() emits the neutral title BEFORE the restore sequence (exact bytes, exact order)', () => {
    const tty = new CapturingStdout(true);
    const adapter = new WindowTitleAdapter(false, tty);
    adapter.start();
    tty.writes.length = 0; // observe only the stop bytes
    adapter.stop();
    expect(tty.writes.join('')).toBe(osc('chromato') + RESTORE);
  });

  // ── [D8] property: for ANY lifecycle call or moment, a pipe gets ZERO bytes ─
  const SURFACE: ReadonlyArray<{ name: string; fire: (a: WindowTitleAdapter) => void }> = [
    { name: 'start()', fire: (a) => a.start() },
    { name: 'stop()', fire: (a) => a.stop() },
    { name: 'notifyPhaseChange()', fire: (a) => a.notifyPhaseChange('WORK', 'BREAK') },
    { name: 'notifyOverdue()', fire: (a) => a.notifyOverdue() },
    { name: 'notifySessionComplete()', fire: (a) => a.notifySessionComplete(50) },
  ];
  it.each(SURFACE)('$name emits nothing when stdout is not a TTY ([D8])', ({ fire }) => {
    const pipe = new CapturingStdout(false);
    fire(new WindowTitleAdapter(false, pipe));
    expect(pipe.writes).toHaveLength(0);
  });

  // ── Composite compatibility: the NotificationPort methods never throw ─────
  // in the composite fan-out (their byte output is pinned by the 03-02 twins
  // below).
  it('the NotificationPort methods are composite-safe on a TTY (no throw)', () => {
    const tty = new CapturingStdout(true);
    const adapter = new WindowTitleAdapter(false, tty);
    expect(() => {
      adapter.notifyPhaseChange('WORK', 'BREAK');
      adapter.notifyOverdue();
      adapter.notifySessionComplete(50);
    }).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Step 03-02 twins — the title follows every notification moment (AC-06.1,
// DDD-11). Twins of the three @tty-sim scenarios removed from
// slice-06-window-title.feature: "The title follows the break", "The title
// follows the overdue moment", "Finishing the session sets the neutral title".
// Exact-title byte contracts per moment (EXEMPT), compensated by the 03-01
// well-formedness property on the adjacent domain slot. "Within 1 second" is
// satisfied by construction: the OSC write is synchronous inside the notify
// call, which SessionService drains on the transition frame.
// ════════════════════════════════════════════════════════════════════════════

describe('WindowTitleAdapter — the title follows every notification moment (03-02)', () => {
  // ── Twin of: "The title follows the break" (AC-06.1) ──────────────────────
  // Parametrized over the destination-phase universe: the title is keyed on
  // the DESTINATION phase, honouring the ASCII variant on every moment.
  const DESTINATIONS: ReadonlyArray<{
    to: Parameters<WindowTitleAdapter['notifyPhaseChange']>[1];
    from: Parameters<WindowTitleAdapter['notifyPhaseChange']>[0];
    emoji: string;
    ascii: string;
  }> = [
    { from: 'WORK', to: 'BREAK', emoji: '☕ BREAK — chromato', ascii: 'BREAK - chromato' },
    {
      from: 'WORK',
      to: 'LONG_BREAK',
      emoji: '🌙 LONG BREAK — chromato',
      ascii: 'LONG BREAK - chromato',
    },
    { from: 'BREAK', to: 'WORK', emoji: '🍅 WORK — chromato', ascii: 'WORK - chromato' },
    { from: 'OVERDUE', to: 'WORK', emoji: '🍅 WORK — chromato', ascii: 'WORK - chromato' },
  ];
  it.each(
    DESTINATIONS,
  )('notifyPhaseChange($from -> $to) retitles the window to "$emoji" (ASCII: "$ascii")', ({
    from,
    to,
    emoji,
    ascii,
  }) => {
    const tty = new CapturingStdout(true);
    new WindowTitleAdapter(false, tty).notifyPhaseChange(from, to);
    expect(tty.writes).toEqual([osc(emoji)]);

    const asciiTty = new CapturingStdout(true);
    new WindowTitleAdapter(true, asciiTty).notifyPhaseChange(from, to);
    expect(asciiTty.writes).toEqual([osc(ascii)]);
  });

  // ── Twin of: "The title follows the overdue moment" (AC-06.1) ─────────────
  it('notifyOverdue() sets "⏰ OVERDUE — chromato" (ASCII: "OVERDUE - chromato")', () => {
    const tty = new CapturingStdout(true);
    new WindowTitleAdapter(false, tty).notifyOverdue();
    expect(tty.writes).toEqual([osc('⏰ OVERDUE — chromato')]);

    const asciiTty = new CapturingStdout(true);
    new WindowTitleAdapter(true, asciiTty).notifyOverdue();
    expect(asciiTty.writes).toEqual([osc('OVERDUE - chromato')]);
  });

  // ── Twin of: "Finishing the session sets the neutral title" (DDD-11 pin) ──
  // Session complete has no phase — the title goes neutral "chromato" (DESIGN
  // open question 2, pinned as a byte assertion by DISTILL).
  it('notifySessionComplete() sets the neutral "chromato" title', () => {
    const tty = new CapturingStdout(true);
    new WindowTitleAdapter(false, tty).notifySessionComplete(50);
    expect(tty.writes).toEqual([osc('chromato')]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Step 03-05 twin — same-drain session-complete collision (DDD-13 fix,
// corrected). WORK→rest transitionPhase() pushes BOTH PHASE_CHANGED and
// SESSION_COMPLETED into the SAME event batch on EVERY work block, not just
// the final one (session.ts; "session complete" here means "one pomodoro
// finished," not "the whole run is over" — feature-delta.md Upstream Issue
// 1). SessionService.processEvents() drains each event individually and
// invokes the corresponding NotificationPort method, so the adapter itself
// must arbitrate: PHASE_CHANGE wins ([D-DISTILL-1]), mirroring the banner's
// existing arbitration in src/adapters/tuiAdapter.tsx.
//
// Test budget: 1 behavior (same-drain suppression) x 2 = 2 max; 1 written
// (parametrized over BREAK/LONG_BREAK destinations, Mandate 5). The
// standalone-complete guard (no preceding phase change -> still neutral) is
// already covered by the 03-02 twin above ("notifySessionComplete() sets the
// neutral \"chromato\" title") — not duplicated here.
// ════════════════════════════════════════════════════════════════════════════

describe('WindowTitleAdapter — same-drain session-complete collision (03-05, DDD-13 fix)', () => {
  it.each([
    { to: 'BREAK' as const, phaseEmoji: '☕ BREAK — chromato' },
    { to: 'LONG_BREAK' as const, phaseEmoji: '🌙 LONG BREAK — chromato' },
  ])('notifyPhaseChange(WORK -> $to) then a same-drain notifySessionComplete() leaves the title on "$phaseEmoji", not neutral', ({
    to,
    phaseEmoji,
  }) => {
    const tty = new CapturingStdout(true);
    const adapter = new WindowTitleAdapter(false, tty);
    adapter.notifyPhaseChange('WORK', to);
    adapter.notifySessionComplete(25);
    expect(tty.writes).toEqual([osc(phaseEmoji)]);
    expect(tty.bytes()).not.toContain(osc(NEUTRAL_TITLE));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Step 03-03 twins — exit-path lifecycle, stale-title protection, off
// suppression. Twins of the four @tty-sim scenarios removed from
// slice-06-window-title.feature: "Quitting with Q gives the window its name
// back", "Interrupting with Ctrl+C still restores the title", "A terminated
// session still restores the title", "No terminal is left wearing a stale
// phase title", plus the off-mode wiring gate for "Off means the title stays
// yours too".
//
// DDD-4: launchSession (src/index.ts) calls a SINGLE stop() after
// service.run() resolves, covering every exit path (Q keypress ->
// SessionControlPort.quit(), Ctrl+C -> SessionService.run()'s own SIGINT
// handler, SIGTERM -> service.interrupt(), natural completion) because all of
// them converge on session.isInterrupted() — the ONLY thing the tick loop
// checks before resolving. From WindowTitleAdapter's own driving-port surface
// the exit mechanism is invisible; what is testable and load-bearing HERE is
// that stop() always ends neutral-then-restore regardless of what
// notification moment was active when the exit fired (DDD-12: the one
// dangerous substrate lie — a terminal ignoring XTWINOPS — is made benign by
// construction, never inverted).
//
// TEST PARADIGM: property-viable per the step's design note — enumerated as a
// full-surface table (fast-check absent from this project's stack, zero new
// deps, same convention as the [D8] SURFACE test above) rather than a
// generative property test.
//
// Test budget: 3 behaviors (exit-path ordering / general stale-title pin /
// off-mode gate) x 2 = 6 max; 3 written (each parametrized, Mandate 5).
// ════════════════════════════════════════════════════════════════════════════

describe('WindowTitleAdapter — exit-path lifecycle (03-03, DDD-4/DDD-12)', () => {
  // ── Twins of: "Quitting with Q...", "Interrupting with Ctrl+C...", "A
  // terminated session still restores the title" (AC-06.2 + AC-06.8) ────────
  // One parametrized test covers all three exit paths (Mandate 5): the
  // adapter's stop() contract is exit-mechanism-agnostic, so the only
  // meaningful variation is WHICH notification moment was last active when
  // the exit fired.
  const EXIT_PATHS: ReadonlyArray<{
    scenario: string;
    priorActivity: (a: WindowTitleAdapter) => void;
  }> = [
    { scenario: 'Q', priorActivity: (a) => a.notifyPhaseChange('WORK', 'BREAK') },
    { scenario: 'Ctrl+C (SIGINT)', priorActivity: (a) => a.notifyOverdue() },
    { scenario: 'SIGTERM', priorActivity: (a) => a.notifySessionComplete(25) },
  ];
  it.each(
    EXIT_PATHS,
  )('$scenario exit: a neutral "chromato" title is emitted and then the saved title is restored', ({
    priorActivity,
  }) => {
    const tty = new CapturingStdout(true);
    const adapter = new WindowTitleAdapter(false, tty);
    adapter.start();
    priorActivity(adapter);
    tty.writes.length = 0; // observe only the exit-time stop() bytes
    adapter.stop();
    expect(tty.writes.join('')).toBe(osc(NEUTRAL_TITLE) + RESTORE);
  });

  // ── Twin of: "No terminal is left wearing a stale phase title" (AC-06.3) ──
  // Generalizes the ordering pin across EVERY notification moment that could
  // be the last thing active before exit.
  const LAST_MOMENT_BEFORE_EXIT: ReadonlyArray<{
    name: string;
    fire: (a: WindowTitleAdapter) => void;
  }> = [
    { name: 'notifyPhaseChange()', fire: (a) => a.notifyPhaseChange('WORK', 'BREAK') },
    { name: 'notifyOverdue()', fire: (a) => a.notifyOverdue() },
    { name: 'notifySessionComplete()', fire: (a) => a.notifySessionComplete(25) },
    { name: 'no prior notification', fire: () => undefined },
  ];
  it.each(
    LAST_MOMENT_BEFORE_EXIT,
  )('the session exits by any path: neutral precedes restore, and no phase title is the last title ever set ($name)', ({
    fire,
  }) => {
    const tty = new CapturingStdout(true);
    const adapter = new WindowTitleAdapter(false, tty);
    adapter.start();
    fire(adapter);
    adapter.stop();
    const bytes = tty.bytes();
    // The restore sequence is unconditionally the final bytes written — no
    // phase-title OSC (or anything else) follows it.
    expect(bytes.endsWith(RESTORE)).toBe(true);
    expect(bytes.lastIndexOf(osc(NEUTRAL_TITLE))).toBeLessThan(bytes.lastIndexOf(RESTORE));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Step 06-05 — notifyOverdue() consistency fix (Upstream Issue 3, reviewer
// finding). Both notifyPhaseChange(BREAK|LONG_BREAK -> OVERDUE) and
// notifyOverdue() already wrote the IDENTICAL "⏰ OVERDUE — chromato" title
// (no user-visible bug), but notifyOverdue() lacked the phaseChangedThisDrain
// check-and-clear that notifySessionComplete() already has -- an
// accidental-safety-only asymmetry. This pins that notifyOverdue() now checks
// the same flag, mirroring BellNotificationAdapter's notifyOverdue() exactly:
// the same-drain pairing emits the OVERDUE title exactly once, not twice.
//
// Test budget: 1 behavior (same-drain single-emit consistency) x 2 = 2 max;
// 1 test written (parametrized over BREAK/LONG_BREAK destinations, Mandate 5).
// ════════════════════════════════════════════════════════════════════════════

describe('WindowTitleAdapter — same-drain OVERDUE title consistency (06-05, Upstream Issue 3)', () => {
  it.each([
    { from: 'BREAK' as const },
    { from: 'LONG_BREAK' as const },
  ])('notifyPhaseChange($from -> OVERDUE) then a same-drain notifyOverdue() emits the OVERDUE title exactly once (no accidental duplicate OSC write)', ({
    from,
  }) => {
    const tty = new CapturingStdout(true);
    const adapter = new WindowTitleAdapter(false, tty);
    adapter.notifyPhaseChange(from, 'OVERDUE');
    adapter.notifyOverdue();
    expect(tty.writes).toEqual([osc('⏰ OVERDUE — chromato')]);
  });
});

describe('WindowTitleAdapter — off suppression (03-03, AC-06.6)', () => {
  // ── Twin of: "Off means the title stays yours too" ────────────────────────
  // Mirrors src/index.ts launchSession's off-mode wiring gate: when
  // notifications is false, the composition root never constructs a
  // WindowTitleAdapter at all — start()/notify*/stop() are never called, so
  // zero title/XTWINOPS bytes are ever emitted, on a TTY or otherwise (output
  // byte-identical to pre-feature).
  it.each([
    { notifications: true, expectAdapter: true },
    { notifications: false, expectAdapter: false },
  ])('createWindowTitleAdapter($notifications) returns an adapter only when notifications are on', ({
    notifications,
    expectAdapter,
  }) => {
    const result = createWindowTitleAdapter(notifications, false);
    expect(result instanceof WindowTitleAdapter).toBe(expectAdapter);
  });
});
