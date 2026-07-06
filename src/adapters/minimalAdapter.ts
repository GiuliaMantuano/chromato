/**
 * MinimalAdapter: plain-text stdout renderer for --minimal flag.
 *
 * Implements RenderPort (each render() writes one line to stdout) AND
 * NotificationPort (in-terminal-notifications slice-05, DDD-5): a persistent
 * "title — body" line per moment when the mode-driven composite includes
 * this adapter (banner/banner+bell — see src/index.ts buildNotificationPort;
 * bell-only/off never construct/route through it, so no mode gating lives
 * here, mirroring TuiAdapter's approach).
 *
 * This adapter is the ONLY owner of the \r/\n live-timer line protocol, which
 * is exactly why it — and not a separate line-writer — prints the persistent
 * notification line: interleaving safely requires owning both protocols.
 *
 * Emits no ANSI escape sequences (AC-05.4, AC-P3).
 * Uses ASCII progress bar: '=' for filled, '-' for empty.
 *
 * CRITICAL: Must NOT import ink or react.
 * Must NOT emit any ANSI escape sequences.
 */

import type { NotificationPort, RenderPort } from '../domain/ports.js';
import type { SessionSnapshot } from '../domain/types.js';
import type { PomodoroPhase } from '../domain/phase.js';
import {
  resolveCopy,
  stripNonAscii,
  type NotificationCopyNumbers,
  type NotificationMoment,
} from '../domain/notificationCopy.js';

const BAR_WIDTH = 20;

/** The minimal stdout surface this adapter needs: TTY detection + byte writes. */
export interface MinimalStdout {
  readonly isTTY?: boolean | undefined;
  write(chunk: string): boolean;
}

function formatMinSec(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.floor(Math.max(0, totalSeconds) % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderAsciiBar(fraction: number): string {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return `[${'='.repeat(filled)}${'-'.repeat(empty)}]`;
}

export class MinimalAdapter implements RenderPort, NotificationPort {
  private wroteOutput = false;
  private copyNumbers: NotificationCopyNumbers | null = null;
  // Colour/ASCII mode of the CURRENT session (in-terminal-notifications
  // step 06-02): captured from the config every render() call, since the
  // NotificationPort methods below have no config of their own — render()
  // always fires before the same tick's notify* calls (SessionService),
  // so this is populated before the first notification of a session.
  private useColor = true;
  private useAscii = false;
  // Consumed ONLY by notifyOverdue() (Upstream Issue 3, step 06-05): every
  // BREAK/LONG_BREAK -> OVERDUE timeout fires notifyPhaseChange(to='OVERDUE')
  // together with notifyOverdue() in the same drain (session.ts), and once
  // notificationCopy.ts's copy bug is fixed both calls resolve to the SAME
  // "Break ran over" text -- printing it twice is pure noise. NOT consumed by
  // notifySessionComplete(): that pairing's double-line behavior ([D-DISTILL-1])
  // is a deliberate, unchanged product decision (two DIFFERENT useful lines).
  private phaseChangedThisDrain = false;

  constructor(private readonly stdout: MinimalStdout = process.stdout) {}

  render(snapshot: SessionSnapshot): void {
    const { phase, timer, currentPomodoro, config } = snapshot;
    this.useColor = config.useColor;
    this.useAscii = config.useAscii;

    if (phase === 'IDLE') {
      return;
    }

    const time = formatMinSec(timer.remainingSeconds);
    const bar = renderAsciiBar(timer.progressFraction);
    const pct = Math.round(timer.progressFraction * 100);
    const badge = `POMODORO ${currentPomodoro} of ${config.cycleCount}`;
    const line = `${phase} ${time} ${bar} ${pct}% ${badge}`;

    if (this.stdout.isTTY) {
      // Overwrite the current line in place; pad to clear any residual characters
      // from a previous longer line (e.g. LONG_BREAK → WORK).
      this.stdout.write(`\r${line.padEnd(60)}`);
    } else {
      this.stdout.write(`${line}\n`);
    }
    this.wroteOutput = true;
  }

  stop(): void {
    // On TTY, move to a fresh line so the shell prompt appears below the last output.
    if (this.stdout.isTTY && this.wroteOutput) {
      this.stdout.write('\n');
    }
  }

  /**
   * Inject the resolved copy numbers (mirrors TuiAdapter.attachNotificationCopy
   * — seconds ÷ 60 → minutes, derived once at the composition root from the
   * SAME ConfigResult.config the session uses). Required before the
   * NotificationPort methods below can print a persistent line.
   */
  attachNotificationCopy(numbers: NotificationCopyNumbers): void {
    this.copyNumbers = numbers;
  }

  /** NotificationPort: phase change → persistent "title — body" line (DDD-5). */
  notifyPhaseChange(from: PomodoroPhase, to: PomodoroPhase): void {
    this.phaseChangedThisDrain = true;
    this.printNotificationLine({ kind: 'PHASE_CHANGE', from, to });
  }

  /**
   * NotificationPort: break ran over → persistent overdue line. Suppressed
   * when a same-drain PHASE_CHANGE just fired (step 06-05, Upstream Issue 3):
   * the phase-change line already printed the correct "Break ran over" text
   * for this moment. Consumes the flag either way, so a later, standalone
   * call (the 60-second overdue follow-up reminder) still prints.
   */
  notifyOverdue(): void {
    if (this.phaseChangedThisDrain) {
      this.phaseChangedThisDrain = false;
      return;
    }
    this.printNotificationLine({ kind: 'OVERDUE' });
  }

  /**
   * NotificationPort: session complete → persistent summary line. Unlike the
   * TUI's single-slot banner ([D-DISTILL-1] phase-change-wins arbitration),
   * the minimal renderer is append-only — both the phase-change line and the
   * session-summary line print and stack (DISTILL pin, AC-01.6).
   */
  notifySessionComplete(focusedMinutes: number): void {
    this.printNotificationLine({ kind: 'SESSION_COMPLETE', focusedMinutes });
  }

  /**
   * Print one persistent "title — body" line (DDD-5, SC-6 resolveCopy — no
   * restated strings). This adapter is the ONLY owner of the \r/\n
   * live-timer protocol, so it alone can interleave a notification line
   * safely: on a TTY, first terminate the in-place \r timer line with a
   * newline (no corruption), then print the notification line; the next
   * render() call resumes the timer on the fresh row below. On non-TTY the
   * line is simply newline-terminated — zero ANSI, zero BEL ([D8], AC-05.2).
   *
   * NO_COLOR ASCII emphasis (">>> … <<<") and the ASCII copy degradation
   * (stripNonAscii, DDD-8) both apply here (AC-05.3 / AC-05.4, step 06-02):
   * ASCII mode degrades the assembled line FIRST (so the em dash separator
   * normalizes to a plain hyphen alongside any emoji in the copy — one
   * stripping rule, no second implementation), then colour suppression wraps
   * the result in ">>> … <<<" markers so the emphasis survives losing colour.
   */
  private printNotificationLine(moment: NotificationMoment): void {
    if (this.copyNumbers === null) {
      return;
    }
    const { title, body } = resolveCopy(moment, this.copyNumbers);
    let line = `${title} — ${body}`;
    if (this.useAscii) {
      line = stripNonAscii(line);
    }
    if (!this.useColor) {
      line = `>>> ${line} <<<`;
    }

    if (this.stdout.isTTY && this.wroteOutput) {
      this.stdout.write('\n');
    }
    this.stdout.write(`${line}\n`);
    this.wroteOutput = true;
  }
}
