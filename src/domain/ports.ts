/**
 * Port interfaces: driven port boundaries for the hexagonal core.
 * These interfaces are owned by the domain. Adapters implement them.
 *
 * No external imports.
 */

import type { SessionSnapshot } from './types.js';
import type { PomodoroPhase } from './phase.js';

export interface RenderPort {
  render(snapshot: SessionSnapshot): void;
  stop(): void;
}

export interface StatePort {
  writeState(snapshot: SessionSnapshot): void;
  writeIdle(): void;
  readState(): SessionSnapshot | null;
  readCompletedToday(): number;
}

export interface NotificationPort {
  notifyPhaseChange(from: PomodoroPhase, to: PomodoroPhase): void;
  notifyOverdue(): void;
}

export interface HistoryPort {
  recordSession(completedPomodoros: number): void;
  readTodayCount(): number;
  readStreak(): number;
}

export interface StatusFormatPort {
  formatTmux(snapshot: SessionSnapshot | null, maxWidth?: number): string;
  formatPlain(snapshot: SessionSnapshot | null): string;
  formatPrompt(snapshot: SessionSnapshot | null): string;
}
