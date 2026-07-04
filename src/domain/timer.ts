/**
 * TimerSnapshot: value object representing the current timer state.
 * Derived from total and elapsed seconds.
 *
 * No external imports.
 */

export interface TimerSnapshot {
  readonly totalSeconds: number;
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly progressFraction: number;
  readonly isOverdue: boolean;
  readonly overdueElapsedSeconds: number;
}

export function deriveTimerSnapshot(
  totalSeconds: number,
  elapsedSeconds: number,
  overdueElapsedSeconds: number,
): TimerSnapshot {
  const isOverdue = elapsedSeconds >= totalSeconds;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progressFraction = totalSeconds > 0 ? Math.min(1, elapsedSeconds / totalSeconds) : 0;

  return {
    totalSeconds,
    elapsedSeconds,
    remainingSeconds,
    progressFraction,
    isOverdue,
    overdueElapsedSeconds,
  };
}
