/**
 * First-run launch guard (PURE module, ADR-012 DD-2).
 *
 * No I/O, no ink/react/adapter imports. Takes isTTY/env/configExists as
 * arguments so the composition root supplies the side-effecting reads.
 *
 * The `firstRun-no-external` dependency-cruiser rule forbids this module from
 * importing ink, react, or anything under src/adapters/.
 */

import type { WizardResult } from './configTypes.js';
import { DEFAULT_NOTIFICATION_MODE } from './domain/notificationMode.js';

export interface FirstRunGuardInput {
  /** process.stdin.isTTY */
  readonly isTTY: boolean;
  /** environment snapshot (reads NO_COLOR, CI) */
  readonly env: NodeJS.ProcessEnv;
  /** whether config.json already exists */
  readonly configExists: boolean;
}

/**
 * Returns true iff the setup wizard should auto-launch:
 * configExists === false AND isTTY AND !NO_COLOR AND !CI.
 */
export function shouldRunWizard(input: FirstRunGuardInput): boolean {
  return (
    input.configExists === false &&
    input.isTTY &&
    input.env['NO_COLOR'] === undefined &&
    input.env['CI'] === undefined
  );
}

/** The skip-to-defaults WizardResult (ocean / 25·5×4 / notifications on). */
export function firstRunDefaults(): WizardResult {
  return {
    palette: 'ocean',
    work: 25,
    break: 5,
    longBreak: 15,
    cycles: 4,
    notifications: DEFAULT_NOTIFICATION_MODE,
  };
}
