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
import type { RenderPort, StatePort, NotificationPort, HistoryPort } from '../domain/ports.js';
import type { SessionSnapshot } from '../domain/types.js';

const TICK_INTERVAL_MS = 1000;
const OVERDUE_SECOND_NOTIFICATION_SECONDS = 60;

export class SessionService {
  private readonly renderPort: RenderPort;
  private readonly statePort: StatePort | null;
  private readonly notificationPort: NotificationPort | null;
  private readonly historyPort: HistoryPort | null;
  private session: Session | null = null;
  private overdueSecondNotified = false;

  constructor(
    renderPort: RenderPort,
    statePort: StatePort | null,
    notificationPort: NotificationPort | null,
    historyPort: HistoryPort | null
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
    if (this.session === null) {
      const completedToday = this.statePort?.readCompletedToday() ?? 0;
      const streak = this.historyPort?.readStreak() ?? 0;
      this.session = new Session(config, completedToday, streak);
    }

    if (this.session.isInterrupted()) {
      this.renderPort.stop();
      this.statePort?.writeIdle();
      return;
    }

    this.session.tick(deltaSeconds);

    const snapshot = this.session.getSnapshot();
    this.renderPort.render(snapshot);
    this.statePort?.writeState(snapshot);

    this.processEvents();
    this.processOverdueMilestones(snapshot);
  }

  /**
   * Signal the current session to stop.
   * The next tickOnce() call will finalize the shutdown.
   */
  interrupt(): void {
    this.session?.interrupt();
  }

  async run(config: SessionConfig): Promise<void> {
    const completedToday = this.statePort?.readCompletedToday() ?? 0;
    const streak = this.historyPort?.readStreak() ?? 0;
    this.session = new Session(config, completedToday, streak);
    const session = this.session;

    process.on('SIGINT', () => {
      session.interrupt();
    });

    // Render first frame immediately (IDLE -> WORK transition on first tick)
    session.tick(0);
    const firstSnapshot = session.getSnapshot();
    this.renderPort.render(firstSnapshot);
    this.statePort?.writeState(firstSnapshot);
    this.processEvents();

    return new Promise<void>((resolve) => {
      let lastTime = process.hrtime.bigint();

      const tick = () => {
        if (session.isInterrupted()) {
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
        this.renderPort.render(snapshot);
        this.statePort?.writeState(snapshot);

        this.processEvents();
        this.processOverdueMilestones(snapshot);

        setTimeout(tick, TICK_INTERVAL_MS);
      };

      setTimeout(tick, TICK_INTERVAL_MS);
    });
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

  private processEvents(): void {
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
      if (event.type === 'SESSION_COMPLETED' && this.historyPort) {
        this.historyPort.recordSession(event.completedPomodoros);
      }
    }
  }
}
