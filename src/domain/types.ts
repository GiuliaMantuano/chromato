/**
 * Shared domain types.
 * No external imports.
 */

import type { PomodoroPhase } from './phase.js';
import type { TimerSnapshot } from './timer.js';
import type { SessionConfig } from './config.js';

export interface SessionSnapshot {
  readonly phase: PomodoroPhase;
  readonly timer: TimerSnapshot;
  readonly currentPomodoro: number;
  readonly completedToday: number;
  readonly streak: number;
  readonly config: SessionConfig;
}
