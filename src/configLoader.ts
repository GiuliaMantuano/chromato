/**
 * configLoader: resolves SessionConfig from CLI flags, env vars, config file, and defaults.
 *
 * Resolution order: flags > env > config file > defaults
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { SessionConfig } from './domain/config.js';
import { DEFAULT_CONFIG, validateConfig } from './domain/config.js';
import {
  getPalette,
  resolvePaletteName,
  DEFAULT_PALETTE_NAME,
  VALID_PALETTE_NAMES,
  type Palette,
} from './domain/palette.js';
import { detectNonUnicode } from './utils/unicodeDetect.js';

export interface StartFlags {
  work?: number;
  breakDuration?: number;
  longBreak?: number;
  cycles?: number;
  minimal?: boolean;
  noColor?: boolean;
  /** Explicit ASCII mode. When true, suppresses the auto-detection informational message. */
  ascii?: boolean;
  /** Raw string from the --palette flag; undefined if not set. */
  palette?: string | undefined;
}

export interface ConfigResult {
  config: SessionConfig;
  /**
   * True when ASCII mode was activated by auto-detection (LANG/TERM check),
   * not by an explicit --ascii flag. Used to print the informational message.
   */
  autoDetectedAscii: boolean;
  /**
   * Resolved palette. Always present. In NO_COLOR mode this is the default
   * ocean palette — adapters ignore it because config.useColor is false.
   */
  resolvedPalette: Palette;
}

/**
 * Error thrown when a requested palette name is not a known palette.
 * The message enumerates VALID_PALETTE_NAMES so the CLI can surface them.
 */
export class UnknownPaletteError extends Error {
  constructor(rawName: string) {
    super(
      `Unknown palette "${rawName}". Valid palettes: ${VALID_PALETTE_NAMES.join(', ')}.`,
    );
    this.name = 'UnknownPaletteError';
  }
}

/**
 * Resolves the chromato config file path:
 * ${XDG_CONFIG_HOME:-~/.config}/chromato/config.json
 * Mirrors PersistenceAdapter's XDG resolution (XDG_DATA_HOME analog).
 */
function resolveConfigFilePath(): string {
  const base = process.env['XDG_CONFIG_HOME'] ?? path.join(os.homedir(), '.config');
  return path.join(base, 'chromato', 'config.json');
}

/**
 * Reads the "palette" string from config.json, if present.
 * - File absent or "palette" key absent → undefined (silent fallthrough).
 * - File present but invalid JSON → throws (CLI surfaces as exit 1).
 */
function readConfigFilePalette(): string | undefined {
  const configFile = resolveConfigFilePath();
  if (!fs.existsSync(configFile)) {
    return undefined;
  }
  const raw = fs.readFileSync(configFile, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Failed to parse chromato config file as JSON: ${configFile}`,
    );
  }
  if (parsed && typeof parsed === 'object' && 'palette' in parsed) {
    const value = (parsed as Record<string, unknown>)['palette'];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

/**
 * Resolves the palette through the precedence chain:
 *   --palette flag → CHROMATO_PALETTE env → config.json "palette" → default ocean.
 * Throws UnknownPaletteError if the selected name is not a known palette.
 */
function resolvePalette(flags: StartFlags): Palette {
  const rawName =
    flags.palette ??
    process.env['CHROMATO_PALETTE'] ??
    readConfigFilePalette() ??
    DEFAULT_PALETTE_NAME;

  const name = resolvePaletteName(rawName);
  if (name === null) {
    throw new UnknownPaletteError(rawName);
  }
  return getPalette(name);
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

  // NO_COLOR short-circuit (AC-PT-09): when color is suppressed, skip palette
  // resolution entirely and return the default ocean palette. Adapters ignore
  // it because config.useColor is false. This is evaluated BEFORE any flag/env/
  // config palette resolution, so an invalid CHROMATO_PALETTE under NO_COLOR
  // never throws.
  const resolvedPalette = noColor
    ? getPalette(DEFAULT_PALETTE_NAME)
    : resolvePalette(flags);

  return { config, autoDetectedAscii: autoDetected, resolvedPalette };
}
