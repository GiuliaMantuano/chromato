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
}

export function loadConfig(flags: StartFlags): SessionConfig {
  const noColor = flags.noColor === true || process.env['NO_COLOR'] !== undefined;

  const config: SessionConfig = {
    workDurationSeconds: flags.work != null ? flags.work * 60 : DEFAULT_CONFIG.workDurationSeconds,
    breakDurationSeconds: flags.breakDuration != null
      ? flags.breakDuration * 60
      : DEFAULT_CONFIG.breakDurationSeconds,
    longBreakDurationSeconds: flags.longBreak != null
      ? flags.longBreak * 60
      : DEFAULT_CONFIG.longBreakDurationSeconds,
    cycleCount: flags.cycles ?? DEFAULT_CONFIG.cycleCount,
    useAscii: flags.minimal === true,
    useColor: !noColor,
  };
  validateConfig(config);
  return config;
}
