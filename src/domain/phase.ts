/**
 * Phase state machine for the Pomodoro timer.
 *
 * Domain concept: PomodoroPhase discriminated union and legal transitions.
 * No external imports.
 */

export type PomodoroPhase = 'IDLE' | 'WORK' | 'BREAK' | 'LONG_BREAK' | 'OVERDUE';

export class PhaseStateMachine {
  private current: PomodoroPhase = 'IDLE';
  private completedPomodoros: number;

  constructor(initialCompleted: number = 0) {
    this.completedPomodoros = initialCompleted;
  }

  currentPhase(): PomodoroPhase {
    return this.current;
  }

  completedCount(): number {
    return this.completedPomodoros;
  }

  startWork(): void {
    this.current = 'WORK';
  }

  completeWork(cycleCount: number): void {
    this.completedPomodoros += 1;
    if (this.completedPomodoros % cycleCount === 0) {
      this.current = 'LONG_BREAK';
    } else {
      this.current = 'BREAK';
    }
  }

  completeBreak(): void {
    this.current = 'WORK';
  }

  activateOverdue(): void {
    this.current = 'OVERDUE';
  }

  reset(): void {
    this.current = 'IDLE';
  }
}
