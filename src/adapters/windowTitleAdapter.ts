/**
 * WindowTitleAdapter: NotificationPort methods PLUS a lifecycle — start()
 * (XTWINOPS 22 save + initial WORK title, called by the composition root
 * before service.run() because IDLE→WORK emits no PHASE_CHANGED) and stop()
 * (neutral title FIRST, then XTWINOPS 23 restore — a restore-less terminal
 * is left neutral, never wearing a stale phase title; AC-06.3, DDD-4/DDD-11).
 * All writes TTY-gated internally ([D8]). Constructed for non-off modes only
 * (OQ-D: "off" means everything off).
 *
 * The title follows every notification moment (03-02, AC-06.1): phase changes
 * retitle to the DESTINATION phase, overdue wears the OVERDUE title, and
 * session-complete goes neutral (DDD-11 — no phase is running). Titles are
 * single-sourced from domain/windowTitle.ts. The full exit-path ordering
 * (Q / Ctrl+C / SIGTERM) is pinned in 03-03.
 *
 * 03-05 fix (corrected DDD-13): WORK→rest transitionPhase() pushes BOTH
 * PHASE_CHANGED and SESSION_COMPLETED into the SAME event batch on EVERY work
 * block (not just the final one) — "session complete" there means "one
 * pomodoro finished," not "the whole run is over." SessionService drains
 * each event individually, so this adapter arbitrates the same-drain
 * collision itself: PHASE_CHANGE wins ([D-DISTILL-1]), mirroring the
 * banner's arbitration in tuiAdapter.tsx. See notifySessionComplete().
 *
 * The stdout seam is injectable for the @tty-sim twins
 * (tests/unit/adapters/windowTitleAdapter.test.ts); production uses the
 * process.stdout default — same convention as BellNotificationAdapter.
 *
 * CRITICAL: must NOT import ink/react (rides the minimal path, Rule 3 family).
 */

import type { NotificationPort } from '../domain/ports.js';
import type { PomodoroPhase } from '../domain/phase.js';
import {
  NEUTRAL_TITLE,
  oscSetTitle,
  phaseTitle,
  xtwinopsRestoreTitle,
  xtwinopsSaveTitle,
} from '../domain/windowTitle.js';

/** The minimal stdout surface the title needs: TTY detection + byte writes. */
export interface TitleStdout {
  readonly isTTY?: boolean | undefined;
  write(chunk: string): boolean;
}

/**
 * The minimal process surface the exit safety net needs: register/unregister
 * an 'exit' listener. Injectable seam mirroring TitleStdout — production passes
 * the real `process`, the @tty-sim twins pass a fake emitter.
 */
export interface ExitSignalSource {
  on(event: 'exit', listener: () => void): unknown;
  off(event: 'exit', listener: () => void): unknown;
}

export class WindowTitleAdapter implements NotificationPort {
  /** Consumed by notifySessionComplete() to arbitrate the same-drain collision (03-05). */
  private phaseChangedThisDrain = false;

  constructor(
    private readonly useAscii: boolean,
    private readonly stdout: TitleStdout = process.stdout,
  ) {}

  /** Save the user's title and set the initial WORK title (session start). */
  start(): void {
    this.emit(xtwinopsSaveTitle());
    this.emit(oscSetTitle(phaseTitle('WORK', this.useAscii)));
  }

  /** Emit the neutral title, then restore the saved one (every exit path). */
  stop(): void {
    this.emit(oscSetTitle(NEUTRAL_TITLE));
    this.emit(xtwinopsRestoreTitle());
  }

  /** AC-06.1: retitle to the DESTINATION phase on every transition. */
  notifyPhaseChange(_from: PomodoroPhase, to: PomodoroPhase): void {
    this.phaseChangedThisDrain = true;
    this.emit(oscSetTitle(phaseTitle(to, this.useAscii)));
  }

  /**
   * AC-06.1: the overdue moment wears the OVERDUE title. Mirrors
   * BellNotificationAdapter's notifyOverdue() (step 06-05, Upstream Issue 3
   * consistency fix): skip the emit when a same-drain notifyPhaseChange()
   * already set this exact title (BREAK/LONG_BREAK -> OVERDUE always fires
   * both in the same drain) — no functional title change (both calls already
   * wrote the identical string), just removes an accidental-safety-only
   * asymmetry with notifySessionComplete()'s existing check-and-clear.
   */
  notifyOverdue(): void {
    if (this.phaseChangedThisDrain) {
      this.phaseChangedThisDrain = false;
      return;
    }
    this.emit(oscSetTitle(phaseTitle('OVERDUE', this.useAscii)));
  }

  /**
   * DDD-11 (corrected, 03-05): session complete has no phase — the title
   * goes neutral, UNLESS a same-drain PHASE_CHANGED just fired (WORK→rest
   * transitionPhase() pushes both events into the same batch on every work
   * block — session.ts). In that collision the destination-phase title set
   * by notifyPhaseChange() wins; this call becomes a no-op and consumes the
   * flag so a later, genuinely-standalone session-complete still goes
   * neutral.
   */
  notifySessionComplete(_focusedMinutes: number): void {
    if (this.phaseChangedThisDrain) {
      this.phaseChangedThisDrain = false;
      return;
    }
    this.emit(oscSetTitle(NEUTRAL_TITLE));
  }

  /** Title escapes reach an interactive terminal only ([D8]) — pipes stay byte-clean. */
  private emit(bytes: string): void {
    if (!this.stdout.isTTY) {
      return;
    }
    this.stdout.write(bytes);
  }
}

/**
 * Off-mode wiring gate (03-03, AC-06.6): the composition root
 * (src/index.ts launchSession) calls this instead of `new
 * WindowTitleAdapter(...)` directly, so when notifications are off no
 * WindowTitleAdapter is ever constructed — start(), the notify methods, and
 * stop() are never called, and zero title/XTWINOPS bytes are ever emitted,
 * on a TTY or otherwise (output byte-identical to pre-feature).
 */
export function createWindowTitleAdapter(
  notifications: true,
  useAscii: boolean,
): WindowTitleAdapter;
export function createWindowTitleAdapter(notifications: false, useAscii: boolean): null;
export function createWindowTitleAdapter(
  notifications: boolean,
  useAscii: boolean,
): WindowTitleAdapter | null;
export function createWindowTitleAdapter(
  notifications: boolean,
  useAscii: boolean,
): WindowTitleAdapter | null {
  return notifications ? new WindowTitleAdapter(useAscii) : null;
}

/**
 * Crash-path exit safety net (ADR-022 gap closure, steps 01-01/01-02). The
 * composition root's single windowTitleAdapter?.stop() after service.run()
 * only fires when run() RESOLVES; an unhandled exception escaping the tick
 * loop, run()'s setup, or start() itself skips it, leaving a stale phase title
 * and an unbalanced XTWINOPS stack. This registers a process 'exit' listener
 * that calls adapter.stop() exactly once, returning a finish() callback to
 * unwire it on the normal exit path. The `proc` seam is injectable (mirrors the
 * TitleStdout convention) so the @tty-sim twins can drive a fake emitter.
 *
 * stopOnce is dedup-guarded so the terminal is restored exactly once no matter
 * how many of {crash 'exit', normal finish()} fire: the first caller wins, the
 * rest are no-ops (no double neutral+restore on the normal path). finish() runs
 * stopOnce (covering the case where run() resolved normally and no crash fired)
 * then unregisters the listener so a subsequent 'exit' stays a no-op.
 *
 * PRECONDITION (call order): callers MUST invoke wireExitSafetyNet BEFORE
 * adapter.start(). Registering the 'exit' listener first is precisely what
 * covers the "start() itself throws" trigger — if start() throws, the net is
 * already armed and the crash path still runs stop(). A caller that wires AFTER
 * start() silently leaves that one trigger uncovered. Calling stop() (neutral
 * title + XTWINOPS 23 restore) even when start() never completed is safe by
 * DDD-12: an unmatched XTWINOPS restore is a no-op on terminals that support it
 * and harmless on those that don't.
 */
export function wireExitSafetyNet(
  adapter: WindowTitleAdapter,
  proc: ExitSignalSource = process,
): () => void {
  let stopped = false;
  const stopOnce = (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    adapter.stop();
  };
  proc.on('exit', stopOnce);
  return () => {
    stopOnce();
    proc.off('exit', stopOnce);
  };
}
