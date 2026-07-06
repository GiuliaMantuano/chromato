/**
 * Session aggregate root.
 *
 * Orchestrates the Pomodoro state machine, timer, and event queue.
 * tick(deltaSeconds) advances the timer; drainEvents() returns queued events.
 *
 * Events emitted:
 *   PHASE_CHANGED        -- on every phase transition
 *   SESSION_COMPLETED    -- when a work period completes (completedPomodoros incremented)
 *   OVERDUE_ACTIVATED    -- when a break/long-break timer expires and phase becomes OVERDUE
 *
 * No external imports.
 */

import { PhaseStateMachine } from './phase.js';
import { deriveTimerSnapshot } from './timer.js';
import type { TimerEvent } from './events.js';
import type { SessionConfig } from './config.js';
import type { SessionSnapshot } from './types.js';

export class Session {
  private readonly stateMachine: PhaseStateMachine;
  private readonly config: SessionConfig;
  private elapsedSeconds: number = 0;
  private overdueElapsedSeconds: number = 0;
  private events: TimerEvent[] = [];
  private interrupted: boolean = false;
  private completedToday: number = 0;
  private streak: number = 0;
  private lastEndedOverdueDurationSeconds: number | null = null;

  constructor(config: SessionConfig, initialCompletedToday: number = 0, initialStreak: number = 0) {
    this.config = config;
    this.stateMachine = new PhaseStateMachine(initialCompletedToday);
    this.completedToday = initialCompletedToday;
    this.streak = initialStreak;
  }

  tick(deltaSeconds: number): void {
    if (this.interrupted) {
      return;
    }

    const phase = this.stateMachine.currentPhase();

    if (phase === 'IDLE') {
      this.elapsedSeconds = 0;
      this.overdueElapsedSeconds = 0;
      this.stateMachine.startWork();
      return;
    }

    if (phase === 'OVERDUE') {
      this.overdueElapsedSeconds += deltaSeconds;
      return;
    }

    const durationSeconds = this.phaseDuration();
    const previousElapsed = this.elapsedSeconds;
    this.elapsedSeconds += deltaSeconds;

    if (previousElapsed < durationSeconds && this.elapsedSeconds >= durationSeconds) {
      this.transitionPhase();
    }
  }

  getSnapshot(): SessionSnapshot {
    const phase = this.interrupted ? 'IDLE' : this.stateMachine.currentPhase();

    // During BREAK/LONG_BREAK/OVERDUE, completedCount() was already incremented
    // when WORK ended — so currentPomodoro is the one just finished, normalized to cycle position.
    // During WORK/IDLE, completedCount() reflects completed sessions, so +1 is the active one.
    // Modulo normalization keeps currentPomodoro in [1, cycleCount] across multiple cycles.
    const cycleCount = this.config.cycleCount;
    const completedCount = this.stateMachine.completedCount();
    const currentPomodoro =
      phase === 'BREAK' || phase === 'LONG_BREAK' || phase === 'OVERDUE'
        ? ((completedCount - 1) % cycleCount) + 1
        : (completedCount % cycleCount) + 1;

    if (phase === 'OVERDUE') {
      // In OVERDUE state, the timer is fully elapsed (progressFraction = 1.0).
      // Use a sentinel totalSeconds of 1 with elapsedSeconds = 1 to represent full.
      return {
        phase,
        timer: deriveTimerSnapshot(1, 1, this.overdueElapsedSeconds),
        currentPomodoro,
        completedToday: this.completedToday,
        streak: this.streak,
        config: this.config,
      };
    }

    const durationSeconds = this.phaseDurationForPhase(phase);

    return {
      phase,
      timer: deriveTimerSnapshot(durationSeconds, this.elapsedSeconds, this.overdueElapsedSeconds),
      currentPomodoro,
      completedToday: this.completedToday,
      streak: this.streak,
      config: this.config,
    };
  }

  drainEvents(): TimerEvent[] {
    const drained = this.events.slice();
    this.events = [];
    return drained;
  }

  /**
   * Skip the current rest phase (BREAK / LONG_BREAK / OVERDUE) into a fresh WORK
   * session: set the phase to WORK, reset elapsed to 0, clear the private overdue
   * counter, leave completedToday untouched (a skipped break is not a completed
   * pomodoro), and enqueue exactly one PHASE_CHANGED. No-op while interrupted or
   * during WORK / IDLE. Order matters (ADR-017 / DESIGN §5).
   */
  skipToWork(): void {
    if (this.interrupted) {
      return;
    }

    const from = this.stateMachine.currentPhase();
    if (from !== 'BREAK' && from !== 'LONG_BREAK' && from !== 'OVERDUE') {
      return;
    }

    if (from === 'OVERDUE') {
      // Capture the episode's final duration BEFORE the count-up is cleared
      // below (KPI 1/2 data source, step 04-04) -- see takeEndedOverdueDurationSeconds().
      this.lastEndedOverdueDurationSeconds = this.overdueElapsedSeconds;
    }

    this.stateMachine.completeBreak(); // phase FIRST: current -> WORK
    this.elapsedSeconds = 0;
    this.overdueElapsedSeconds = 0; // HARD #2: clear the overdue count-up
    // completedToday left UNTOUCHED.
    this.events.push({ type: 'PHASE_CHANGED', from, to: 'WORK' });
  }

  /**
   * Read-once surface (KPI 1/2 data source, step 04-04): returns the duration
   * of the OVERDUE episode that just ended via skipToWork(), or null if none
   * ended since the last call. SessionService calls this immediately after
   * skipToWork() to persist the episode via HistoryPort.
   */
  takeEndedOverdueDurationSeconds(): number | null {
    const value = this.lastEndedOverdueDurationSeconds;
    this.lastEndedOverdueDurationSeconds = null;
    return value;
  }

  interrupt(): void {
    this.interrupted = true;
    this.stateMachine.reset();
  }

  isInterrupted(): boolean {
    return this.interrupted;
  }

  private transitionPhase(): void {
    const from = this.stateMachine.currentPhase();

    if (from === 'WORK') {
      this.completedToday += 1;
      this.stateMachine.completeWork(this.config.cycleCount);
      const to = this.stateMachine.currentPhase();
      this.elapsedSeconds = 0;
      this.events.push({ type: 'PHASE_CHANGED', from, to });
      this.events.push({ type: 'SESSION_COMPLETED', completedPomodoros: this.completedToday });
    } else if (from === 'BREAK' || from === 'LONG_BREAK') {
      this.stateMachine.activateOverdue();
      const to = this.stateMachine.currentPhase();
      // Do NOT reset elapsedSeconds for OVERDUE: deriveTimerSnapshot uses it to compute progressFraction=1.0
      this.events.push({ type: 'PHASE_CHANGED', from, to });
      this.events.push({ type: 'OVERDUE_ACTIVATED', overdueElapsedSeconds: 0 });
    }
  }

  private phaseDuration(): number {
    return this.phaseDurationForPhase(this.stateMachine.currentPhase());
  }

  private phaseDurationForPhase(phase: ReturnType<PhaseStateMachine['currentPhase']>): number {
    if (phase === 'WORK') {
      return this.config.workDurationSeconds;
    }
    if (phase === 'BREAK') {
      return this.config.breakDurationSeconds;
    }
    if (phase === 'LONG_BREAK') {
      return this.config.longBreakDurationSeconds;
    }
    return this.config.workDurationSeconds;
  }
}
