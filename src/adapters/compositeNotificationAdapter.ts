/**
 * CompositeNotificationAdapter: fans one notification moment out to N
 * NotificationPort children, in construction order; the empty composite IS
 * the null object for mode "off" (DDD-2, subsumes NullNotificationAdapter
 * from slice-03 on).
 *
 * No mode flags in here — WHICH children ride in the bundle is decided by the
 * composition root (src/index.ts launchSession, the single wiring point).
 *
 * CRITICAL: must NOT import ink/react (rides the minimal path, Rule 3
 * family — DDD-9 dep-cruiser entries added at DELIVER) and must NOT import
 * other adapters (Rule 4 — it composes INSTANCES, imports domain only).
 */

import type { NotificationPort } from '../domain/ports.js';
import type { PomodoroPhase } from '../domain/phase.js';

export class CompositeNotificationAdapter implements NotificationPort {
  constructor(public readonly children: readonly NotificationPort[]) {}

  notifyPhaseChange(from: PomodoroPhase, to: PomodoroPhase): void {
    for (const child of this.children) {
      child.notifyPhaseChange(from, to);
    }
  }

  notifyOverdue(): void {
    for (const child of this.children) {
      child.notifyOverdue();
    }
  }

  notifySessionComplete(focusedMinutes: number): void {
    for (const child of this.children) {
      child.notifySessionComplete(focusedMinutes);
    }
  }
}
