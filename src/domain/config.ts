/**
 * SessionConfig: configuration value object for a Pomodoro session.
 * No external imports.
 */

export interface SessionConfig {
  readonly workDurationSeconds: number;
  readonly breakDurationSeconds: number;
  readonly longBreakDurationSeconds: number;
  readonly cycleCount: number;
  readonly useAscii: boolean;
  readonly useColor: boolean;
}

export function validateConfig(config: SessionConfig): void {
  if (config.workDurationSeconds <= 0) {
    throw new Error('workDurationSeconds must be positive');
  }
  if (config.breakDurationSeconds <= 0) {
    throw new Error('breakDurationSeconds must be positive');
  }
  if (config.longBreakDurationSeconds <= 0) {
    throw new Error('longBreakDurationSeconds must be positive');
  }
  if (config.cycleCount <= 0) {
    throw new Error('cycleCount must be positive');
  }
}

export const DEFAULT_CONFIG: SessionConfig = {
  workDurationSeconds: 25 * 60,
  breakDurationSeconds: 5 * 60,
  longBreakDurationSeconds: 15 * 60,
  cycleCount: 4,
  useAscii: false,
  useColor: true,
};
