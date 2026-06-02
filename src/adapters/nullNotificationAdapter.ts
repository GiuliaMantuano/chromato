/**
 * NullNotificationAdapter: no-op NotificationPort (null-object pattern).
 *
 * Selected at the composition root (src/index.ts) in place of the real
 * NotificationAdapter when the user has turned notifications OFF in the setup
 * wizard (notifications=false). Every method is a deliberate no-op: no desktop
 * notification command is spawned and no terminal bell is emitted.
 *
 * Why a Null object rather than a flag on the real adapter (ADR-014 / DD-1):
 * "notifications" is a ConfigResult / composition-root concern, NOT a domain
 * SessionConfig field. The SessionService and the real NotificationAdapter stay
 * UNTOUCHED — the suppression is purely an injection choice at the wiring root.
 *
 * MUST NOT import other adapters (dependency-cruiser adapters-no-cross-import).
 */

import type { NotificationPort } from '../domain/ports.js';
import type { PomodoroPhase } from '../domain/phase.js';

export class NullNotificationAdapter implements NotificationPort {
  notifyPhaseChange(_from: PomodoroPhase, _to: PomodoroPhase): void {
    // no-op: notifications are turned off
  }

  notifyOverdue(): void {
    // no-op: notifications are turned off
  }

  // NEW (US-NB-04 / D-NB-6 / AC-NB-04.3): keep the port total. Off-switch
  // suppresses the session-complete notification too — a deliberate no-op.
  notifySessionComplete(_focusedMinutes: number): void {
    // no-op: notifications are turned off
  }
}
