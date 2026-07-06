/**
 * SessionService: application service (use case orchestrator).
 *
 * Drives the Session aggregate root in a tick loop.
 * Calls render, state, notification, and history ports after each tick.
 *
 * tickOnce(config, deltaSeconds) is exposed for testability (Option A).
 * run(config) drives the production tick loop using setTimeout.
 *
 * No imports from adapters. No ink/react imports.
 */

import { Session } from '../domain/session.js';
import type { SessionConfig } from '../domain/config.js';
import type {
  RenderPort,
  StatePort,
  NotificationPort,
  HistoryPort,
  SessionControlPort,
  SessionReadPort,
} from '../domain/ports.js';
import type { SessionSnapshot } from '../domain/types.js';

const TICK_INTERVAL_MS = 1000;
const OVERDUE_SECOND_NOTIFICATION_SECONDS = 60;

/**
 * KPI observability (step 04-04): the driven HistoryPort gains an additive,
 * OPTIONAL method for recording completed OVERDUE episodes. Declared as a
 * local extension (not added to HistoryPort in ports.ts) so the many
 * InMemory HistoryPort test doubles across the suite are structurally
 * unaffected -- an optional member's absence is always assignment-compatible.
 * Only PersistenceAdapter implements it concretely.
 */
type HistoryPortWithOverdueEpisodes = HistoryPort & {
  recordOverdueEpisode?(durationSeconds: number): void;
};

export class SessionService implements SessionControlPort, SessionReadPort {
  private readonly renderPort: RenderPort;
  private readonly statePort: StatePort | null;
  private readonly notificationPort: NotificationPort | null;
  private readonly historyPort: HistoryPortWithOverdueEpisodes | null;
  private session: Session | null = null;
  private config: SessionConfig | null = null;
  private overdueSecondNotified = false;
  private lastSnapshot: SessionSnapshot | null = null;
  private completedThisSession = 0;

  constructor(
    renderPort: RenderPort,
    statePort: StatePort | null,
    notificationPort: NotificationPort | null,
    historyPort: HistoryPortWithOverdueEpisodes | null,
  ) {
    this.renderPort = renderPort;
    this.statePort = statePort;
    this.notificationPort = notificationPort;
    this.historyPort = historyPort;
  }

  /**
   * Advance the session by deltaSeconds and process all side-effects.
   * Creates a new Session on the first call with the given config.
   * Exposed for testing (Option A: tickOnce for tests).
   */
  tickOnce(config: SessionConfig, deltaSeconds: number): void {
    this.config = config;
    if (this.session === null) {
      let completedToday = 0;
      let streak = 0;
      try {
        completedToday = this.statePort?.readCompletedToday() ?? 0;
      } catch {
        completedToday = 0;
      }
      try {
        streak = this.historyPort?.readStreak() ?? 0;
      } catch {
        streak = 0;
      }
      this.session = new Session(config, completedToday, streak);
      this.completedThisSession = 0;
    }

    if (this.session.isInterrupted()) {
      this.recordOverdueEpisodeOnExit();
      this.renderPort.stop();
      this.statePort?.writeIdle();
      return;
    }

    this.session.tick(deltaSeconds);

    const snapshot = this.session.getSnapshot();
    this.lastSnapshot = snapshot;
    this.renderPort.render(snapshot);
    this.statePort?.writeState(snapshot);

    this.processEvents(config);
    this.processOverdueMilestones(snapshot);
  }

  /**
   * Signal the current session to stop.
   * The next tickOnce() call will finalize the shutdown.
   */
  interrupt(): void {
    this.session?.interrupt();
  }

  /**
   * SessionControlPort.skip(): leave the current rest phase into a fresh WORK
   * session, observable synchronously on the keypress frame (immediate render +
   * state write + processEvents flush). No-op when there is no active session.
   *
   * The domain Session.skipToWork() no-ops during WORK/IDLE, so an in-WORK skip
   * produces no PHASE_CHANGED event and leaves the snapshot unchanged.
   */
  skip(): void {
    if (this.session === null) {
      return;
    }
    this.session.skipToWork();
    this.recordEndedOverdueEpisode(this.session.takeEndedOverdueDurationSeconds());
    const snapshot = this.session.getSnapshot();
    this.lastSnapshot = snapshot;
    this.renderPort.render(snapshot);
    this.statePort?.writeState(snapshot);
    this.processEvents(this.config ?? snapshot.config);
  }

  /**
   * SessionControlPort.quit(): request a clean stop (parity with Ctrl+C) by
   * setting interrupt on the active session; the next tick tears down (stop +
   * writeIdle). No-op when there is no active session.
   */
  quit(): void {
    if (this.session === null) {
      return;
    }
    this.session.interrupt();
  }

  /**
   * SessionReadPort.getSnapshot(): the live session snapshot (DN-3 read surface),
   * or null when no session is bound yet. Adapters/tests read the active session
   * through this port instead of reaching the private `session` field.
   */
  getSnapshot(): SessionSnapshot | null {
    return this.session?.getSnapshot() ?? null;
  }

  async run(config: SessionConfig): Promise<void> {
    this.config = config;
    let completedToday = 0;
    let streak = 0;
    try {
      completedToday = this.statePort?.readCompletedToday() ?? 0;
    } catch {
      completedToday = 0;
    }
    try {
      streak = this.historyPort?.readStreak() ?? 0;
    } catch {
      streak = 0;
    }
    this.session = new Session(config, completedToday, streak);
    this.completedThisSession = 0;
    const session = this.session;

    process.on('SIGINT', () => {
      session.interrupt();
    });

    // Render first frame immediately (IDLE -> WORK transition on first tick)
    session.tick(0);
    const firstSnapshot = session.getSnapshot();
    this.renderPort.render(firstSnapshot);
    this.statePort?.writeState(firstSnapshot);
    this.processEvents(config);

    return new Promise<void>((resolve) => {
      let lastTime = process.hrtime.bigint();

      const tick = () => {
        if (session.isInterrupted()) {
          this.printInterruptSummary();
          this.recordOverdueEpisodeOnExit();
          this.renderPort.stop();
          this.statePort?.writeIdle();
          resolve();
          return;
        }

        const now = process.hrtime.bigint();
        const deltaNs = now - lastTime;
        const deltaSeconds = Number(deltaNs) / 1e9;
        lastTime = now;

        session.tick(deltaSeconds);

        const snapshot = session.getSnapshot();
        this.lastSnapshot = snapshot;
        this.renderPort.render(snapshot);
        this.statePort?.writeState(snapshot);

        this.processEvents(config);
        this.processOverdueMilestones(snapshot);

        setTimeout(tick, TICK_INTERVAL_MS);
      };

      setTimeout(tick, TICK_INTERVAL_MS);
    });
  }

  private printInterruptSummary(): void {
    const snap = this.lastSnapshot;
    if (snap === null) return;
    const elapsed = snap.timer.elapsedSeconds;
    const pct = Math.round(snap.timer.progressFraction * 100);
    const min = Math.floor(elapsed / 60);
    const sec = Math.floor(elapsed % 60);
    const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    process.stdout.write(
      `Session interrupted at ${timeStr} (${pct}% complete). Partial session not counted.\n`,
    );
  }

  /**
   * KPI observability (step 04-04): records an OVERDUE episode ended by
   * skipToWork() (skip() hook point), swallowing a sqlite-unavailable error
   * the same way SESSION_COMPLETED recording does.
   */
  private recordEndedOverdueEpisode(durationSeconds: number | null): void {
    if (durationSeconds === null) {
      return;
    }
    try {
      this.historyPort?.recordOverdueEpisode?.(durationSeconds);
    } catch {
      /* sqlite unavailable */
    }
  }

  /**
   * KPI observability (step 04-04): if the session exits (quit/Ctrl+C/SIGTERM)
   * while still OVERDUE, the in-flight episode would otherwise be lost --
   * this is the single place that already handles every exit path (both
   * tickOnce() and run()'s tick loop reach here via isInterrupted()), parity
   * with WindowTitleAdapter's stop() lifecycle covering every exit path.
   * Read-once: nulls lastSnapshot so a repeated isInterrupted() pass does not
   * double-record.
   */
  private recordOverdueEpisodeOnExit(): void {
    const snapshot = this.lastSnapshot;
    this.lastSnapshot = null;
    if (snapshot === null || snapshot.phase !== 'OVERDUE') {
      return;
    }
    this.recordEndedOverdueEpisode(snapshot.timer.overdueElapsedSeconds);
  }

  private processOverdueMilestones(snapshot: SessionSnapshot): void {
    if (snapshot.phase !== 'OVERDUE' || !this.notificationPort) return;
    if (
      !this.overdueSecondNotified &&
      snapshot.timer.overdueElapsedSeconds >= OVERDUE_SECOND_NOTIFICATION_SECONDS
    ) {
      this.overdueSecondNotified = true;
      this.notificationPort.notifyOverdue();
    }
  }

  private processEvents(config: SessionConfig): void {
    if (this.session === null) {
      return;
    }

    const events = this.session.drainEvents();
    for (const event of events) {
      if (event.type === 'PHASE_CHANGED') {
        this.overdueSecondNotified = false;
        if (this.notificationPort) {
          this.notificationPort.notifyPhaseChange(event.from, event.to);
        }
      }
      if (event.type === 'OVERDUE_ACTIVATED' && this.notificationPort) {
        this.notificationPort.notifyOverdue();
      }
      if (event.type === 'SESSION_COMPLETED') {
        // History receives the DAILY total (event.completedPomodoros). It stays
        // first inside its own try/catch (sqlite may be unavailable).
        if (this.historyPort) {
          try {
            this.historyPort.recordSession(event.completedPomodoros);
          } catch {
            /* sqlite unavailable */
          }
        }
        // Notification reports SESSION-SCOPED focus (CRIT-2 fix): a fresh
        // per-session counter, reset at each new Session(...), so a 2nd same-day
        // session does NOT over-count. notify is fire-and-forget at the adapter.
        this.completedThisSession += 1;
        if (this.notificationPort) {
          const focusedMinutes = this.completedThisSession * (config.workDurationSeconds / 60);
          this.notificationPort.notifySessionComplete(focusedMinutes);
        }
      }
    }
  }
}
