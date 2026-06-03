/**
 * Port interfaces: driven port boundaries for the hexagonal core.
 * These interfaces are owned by the domain. Adapters implement them.
 *
 * No external imports.
 */

import type { SessionSnapshot } from './types.js';
import type { PomodoroPhase } from './phase.js';
import type { PersistedConfig } from '../configTypes.js';

export interface ConfigWritePort {
  write(config: PersistedConfig): void;
}

export interface RenderPort {
  render(snapshot: SessionSnapshot): void;
  stop(): void;
}

/**
 * Driving (primary) control port for in-session keypress controls (ADR-017).
 *
 * The running TUI calls this to request a phase skip or a clean quit. Implemented
 * by SessionService and late-injected into TuiAdapter at the composition root.
 */
export interface SessionControlPort {
  /** Leave the current rest phase and start a fresh WORK session. No-op during WORK/IDLE. */
  skip(): void;
  /** Stop the session cleanly (parity with Ctrl+C). */
  quit(): void;
}

/**
 * Public read surface for the live session (DN-3). A sibling to SessionControlPort
 * so adapters/tests read the active session through a port instead of reaching the
 * private `session` field. Returns null when no session is bound yet.
 *
 * SessionService implements this alongside SessionControlPort (wired at the
 * application layer in a later slice step); the TUI receives it as a read port.
 */
export interface SessionReadPort {
  /** Snapshot of the live session, or null when none is bound. */
  getSnapshot(): SessionSnapshot | null;
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
  // NEW (US-NB-04 / D-NB-6): fired on SESSION_COMPLETED with session-scoped
  // focused minutes. Implemented in NotificationAdapter (branded copy + icon
  // where platform allows) and NullNotificationAdapter (no-op).
  notifySessionComplete(focusedMinutes: number): void;
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
