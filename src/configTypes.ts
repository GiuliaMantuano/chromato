/**
 * Shared config-schema types for the persisted config.json and the setup wizard.
 *
 * Pure types only — no I/O, no external imports. Importable by any layer
 * (domain, application, adapters, configLoader, firstRun) without violating
 * dependency-cruiser rules. See ADR-013 (docs/adrs/ADR-013-config-write-port-and-schema.md).
 */

import type { PaletteName } from './domain/palette.js';
import type { NotificationMode } from './domain/notificationMode.js';

/**
 * The on-disk schema of $XDG_CONFIG_HOME/chromato/config.json.
 * Timing keys are in MINUTES (the runtime multiplies by 60 → seconds).
 * All keys optional on read (absent → default); the wizard writes the full set.
 */
export interface PersistedConfig {
  palette?: PaletteName;
  work?: number; // minutes (1–90)
  break?: number; // minutes (1–30)
  longBreak?: number; // minutes (5–60, step 5)
  cycles?: number; // count (1–8)
  /** Read tolerance for legacy configs ([D6]): old boolean OR the new mode enum. */
  notifications?: boolean | NotificationMode;
}

/**
 * The wizard's emitted result on completion — maps 1:1 to PersistedConfig with
 * all keys present. Timing in minutes / count.
 */
export interface WizardResult {
  palette: PaletteName;
  work: number;
  break: number;
  longBreak: number;
  cycles: number;
  /** The wizard always WRITES the enum, never the legacy boolean (DDD-1). */
  notifications: NotificationMode;
}
