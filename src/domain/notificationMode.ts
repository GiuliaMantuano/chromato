/**
 * notificationMode: mode enum, legacy mapping, display labels, and signal
 * predicates — the single source for mode semantics (DDD-1).
 *
 * Domain-pure: no external imports (dependency-cruiser Rule 1).
 */

/** The four user-facing notification modes (owner decision Q1). */
export type NotificationMode = 'banner' | 'banner+bell' | 'bell' | 'off';

/** Absent key / invalid value fall back here ([D10], AC-03.1). */
export const DEFAULT_NOTIFICATION_MODE: NotificationMode = 'banner+bell';

/** The full mode universe — single source for exhaustive iteration/validation. */
export const VALID_NOTIFICATION_MODES: readonly NotificationMode[] = [
  'banner+bell',
  'banner',
  'bell',
  'off',
];

export interface ParsedNotificationMode {
  readonly mode: NotificationMode;
  /** Set to the raw string when an unknown value fell back to the default. */
  readonly invalid?: string;
}

function isValidMode(value: string): value is NotificationMode {
  return (VALID_NOTIFICATION_MODES as readonly string[]).includes(value);
}

/**
 * Resolve a raw config value: legacy `true` → "banner+bell", `false` → "off"
 * ([D6]); unknown string → default + `invalid` marker ([D10]); absent/any
 * other shape → default. Total over any input — never throws.
 */
export function parseNotificationMode(raw: unknown): ParsedNotificationMode {
  if (raw === undefined || raw === null) {
    return { mode: DEFAULT_NOTIFICATION_MODE };
  }
  if (raw === true) {
    return { mode: 'banner+bell' };
  }
  if (raw === false) {
    return { mode: 'off' };
  }
  if (typeof raw === 'string' && isValidMode(raw)) {
    return { mode: raw };
  }
  return { mode: DEFAULT_NOTIFICATION_MODE, invalid: String(raw) };
}

/** Display label for a mode ("banner+bell" → "Banner + bell", …) — single
 * source for wizard rows, wizard summary, and home recap (DDD-10). */
export const MODE_LABELS: Record<NotificationMode, string> = {
  'banner+bell': 'Banner + bell',
  banner: 'Banner',
  bell: 'Bell',
  off: 'Off',
};

/** Convenience accessor over MODE_LABELS (kept for call-site readability). */
export function modeLabel(mode: NotificationMode): string {
  return MODE_LABELS[mode];
}

/** True when the mode draws the visual banner / minimal line. */
export function modeIncludesBanner(mode: NotificationMode): boolean {
  return mode === 'banner+bell' || mode === 'banner';
}

/** True when the mode rings the bell. */
export function modeIncludesBell(mode: NotificationMode): boolean {
  return mode === 'banner+bell' || mode === 'bell';
}

/** True for "off" — everything off: banner, bell, AND window title (OQ-D). */
export function modeIsOff(mode: NotificationMode): boolean {
  return mode === 'off';
}
