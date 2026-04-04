/**
 * configLoader: resolves SessionConfig from CLI flags, env vars, config file, and defaults.
 *
 * Resolution order: flags > env > config file > defaults
 */

import type { SessionConfig } from './domain/config.js';
import { DEFAULT_CONFIG, validateConfig } from './domain/config.js';

export interface StartFlags {
  work?: number;
  breakDuration?: number;
  longBreak?: number;
  cycles?: number;
  minimal?: boolean;
  noColor?: boolean;
  /** Explicit ASCII mode. When true, suppresses the auto-detection informational message. */
  ascii?: boolean;
}

export interface ConfigResult {
  config: SessionConfig;
  /**
   * True when ASCII mode was activated by auto-detection (LANG/TERM check),
   * not by an explicit --ascii flag. Used to print the informational message.
   */
  autoDetectedAscii: boolean;
}

/**
 * Parses a positive numeric environment variable override.
 * Returns undefined if the variable is not set or invalid.
 * Used by acceptance tests to inject short durations without fractional CLI flags.
 */
function parseEnvSeconds(name: string): number | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const value = parseFloat(raw);
  if (isNaN(value) || value <= 0) return undefined;
  return value;
}

/**
 * Detects whether the current environment supports Unicode block characters.
 * Returns true when ASCII fallback should be activated automatically.
 *
 * Detection rules (in order):
 * 1. TERM=dumb → no Unicode support
 * 2. LANG or LC_ALL does not contain 'UTF-8' → no Unicode support
 * 3. Otherwise → Unicode supported
 */
function detectNonUnicode(): boolean {
  if (process.env['TERM'] === 'dumb') {
    return true;
  }
  const lang = process.env['LC_ALL'] ?? process.env['LANG'] ?? '';
  if (lang === '' || !lang.includes('UTF-8')) {
    return true;
  }
  return false;
}

export function loadConfig(flags: StartFlags): ConfigResult {
  const noColor = flags.noColor === true || process.env['NO_COLOR'] !== undefined;

  const explicitAscii = flags.ascii === true;
  const autoDetected = !explicitAscii && detectNonUnicode();
  const useAscii = explicitAscii || autoDetected;

  const config: SessionConfig = {
    workDurationSeconds:
      parseEnvSeconds('CHROMATO_WORK_SECONDS') ??
      (flags.work != null ? flags.work * 60 : DEFAULT_CONFIG.workDurationSeconds),
    breakDurationSeconds:
      parseEnvSeconds('CHROMATO_BREAK_SECONDS') ??
      (flags.breakDuration != null ? flags.breakDuration * 60 : DEFAULT_CONFIG.breakDurationSeconds),
    longBreakDurationSeconds: flags.longBreak != null
      ? flags.longBreak * 60
      : DEFAULT_CONFIG.longBreakDurationSeconds,
    cycleCount: flags.cycles ?? DEFAULT_CONFIG.cycleCount,
    useAscii,
    useColor: !noColor,
  };
  validateConfig(config);
  return { config, autoDetectedAscii: autoDetected };
}
