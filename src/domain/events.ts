/**
 * Domain events emitted by the Session aggregate root.
 * Discriminated union via the 'type' discriminant.
 *
 * No external imports.
 */

import type { PomodoroPhase } from './phase.js';

export interface PhaseChangedEvent {
  readonly type: 'PHASE_CHANGED';
  readonly from: PomodoroPhase;
  readonly to: PomodoroPhase;
}

export interface SessionCompletedEvent {
  readonly type: 'SESSION_COMPLETED';
  readonly completedPomodoros: number;
}

export interface OverdueActivatedEvent {
  readonly type: 'OVERDUE_ACTIVATED';
  readonly overdueElapsedSeconds: number;
}

export type TimerEvent = PhaseChangedEvent | SessionCompletedEvent | OverdueActivatedEvent;
