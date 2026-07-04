/**
 * configLoader: resolves SessionConfig from CLI flags, env vars, config file, and defaults.
 *
 * Resolution order: flags > env > config file > defaults
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SessionConfig } from './domain/config.js';
import { DEFAULT_CONFIG, validateConfig } from './domain/config.js';
import type { PersistedConfig } from './configTypes.js';
import {
  getPalette,
  resolvePaletteName,
  DEFAULT_PALETTE_NAME,
  VALID_PALETTE_NAMES,
  type Palette,
  type PaletteName,
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
  /**
   * Resolved palette NAME (DD-4 single-read): the typed name behind
   * resolvedPalette, computed during the single config parse. Surfaced so the
   * composition root (reconfigureSeed) and adapters (paletteNameOf reverse
   * lookup) need NOT re-read config.json or reverse-map the Palette object.
   * In NO_COLOR mode this is the default ocean name (matching resolvedPalette).
   */
  paletteName: PaletteName;
  /**
   * Whether desktop notifications are enabled (config.json "notifications",
   * default true). NOT a domain SessionConfig field (ADR-014 / DD-1): it is a
   * composition-root concern surfaced here so index.ts can select the real
   * NotificationAdapter (true) or the NullNotificationAdapter (false).
   */
  notifications: boolean;
}

/**
 * Error thrown when a requested palette name is not a known palette.
 * The message enumerates VALID_PALETTE_NAMES so the CLI can surface them.
 */
export class UnknownPaletteError extends Error {
  constructor(rawName: string) {
    super(`Unknown palette "${rawName}". Valid palettes: ${VALID_PALETTE_NAMES.join(', ')}.`);
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
 * Whether a chromato config.json already exists on disk.
 * Reuses resolveConfigFilePath so the composition root (firstRun guard) does
 * not re-implement XDG path resolution.
 */
export function configFileExists(): boolean {
  return fs.existsSync(resolveConfigFilePath());
}

/**
 * The resolved chromato config file path (for display — e.g. the home screen
 * footer note, AC-RH-02.5 / OQ-2). Mirrors the configFileExists() accessor
 * precedent so the composition root does not re-implement XDG path resolution.
 */
export function configFilePath(): string {
  return resolveConfigFilePath();
}

/**
 * Reads and parses chromato's config.json ONCE (DD-4), returning the persisted
 * settings as a Partial<PersistedConfig>. Both palette resolution and the timing
 * precedence chain consume this single parse.
 * - File absent → {} (silent fallthrough to flags/env/defaults).
 * - File present but invalid JSON → throws (CLI surfaces as exit 1).
 *
 * Values are returned as-read (palette as a string, timing in MINUTES); callers
 * apply their own validation and the ×60 minutes→seconds conversion.
 */
export function readConfigFile(): Partial<PersistedConfig> {
  const configFile = resolveConfigFilePath();
  if (!fs.existsSync(configFile)) {
    return {};
  }
  const raw = fs.readFileSync(configFile, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse chromato config file as JSON: ${configFile}`);
  }
  if (parsed && typeof parsed === 'object') {
    return parsed as Partial<PersistedConfig>;
  }
  return {};
}

/**
 * Resolves the palette NAME through the precedence chain:
 *   --palette flag → CHROMATO_PALETTE env → config.json "palette" → default ocean.
 * Throws UnknownPaletteError if the selected name is not a known palette.
 * Returns the typed name; loadConfig derives both the Palette object and the
 * ConfigResult.paletteName from this single resolution (DD-4 single-read).
 */
function resolvePaletteNameFor(
  flags: StartFlags,
  fileConfig: Partial<PersistedConfig>,
): PaletteName {
  const filePalette = typeof fileConfig.palette === 'string' ? fileConfig.palette : undefined;
  const rawName =
    flags.palette ?? process.env['CHROMATO_PALETTE'] ?? filePalette ?? DEFAULT_PALETTE_NAME;

  const name = resolvePaletteName(rawName);
  if (name === null) {
    throw new UnknownPaletteError(rawName);
  }
  return name;
}

/**
 * Picks a positive numeric minutes value from the parsed config.json, if present,
 * and converts it to domain seconds (×60). Returns undefined when absent/invalid
 * so the caller falls through to the default. Guards the config layer against
 * a hand-edited non-numeric value silently zeroing a duration.
 */
function configMinutesToSeconds(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value * 60;
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
  if (Number.isNaN(value) || value <= 0) return undefined;
  return value;
}

export function loadConfig(flags: StartFlags): ConfigResult {
  const noColor = flags.noColor === true || process.env['NO_COLOR'] !== undefined;

  const explicitAscii = flags.ascii === true;
  const autoDetected = !explicitAscii && detectNonUnicode();
  const useAscii = explicitAscii || autoDetected;

  // Parse config.json ONCE (DD-4) — shared by palette + timing resolution.
  const fileConfig = readConfigFile();

  // Precedence (D-OPEN-4 — DO NOT REORDER): config.json is inserted BETWEEN the
  // flag and the default. For work/break the env-first quirk is preserved:
  //   env (raw seconds) > flag (×60) > config.json (×60) > default.
  // longBreak/cycles have NO env var: flag > config.json > default.
  const config: SessionConfig = {
    workDurationSeconds:
      parseEnvSeconds('CHROMATO_WORK_SECONDS') ??
      (flags.work != null
        ? flags.work * 60
        : (configMinutesToSeconds(fileConfig.work) ?? DEFAULT_CONFIG.workDurationSeconds)),
    breakDurationSeconds:
      parseEnvSeconds('CHROMATO_BREAK_SECONDS') ??
      (flags.breakDuration != null
        ? flags.breakDuration * 60
        : (configMinutesToSeconds(fileConfig.break) ?? DEFAULT_CONFIG.breakDurationSeconds)),
    longBreakDurationSeconds:
      flags.longBreak != null
        ? flags.longBreak * 60
        : (configMinutesToSeconds(fileConfig.longBreak) ?? DEFAULT_CONFIG.longBreakDurationSeconds),
    cycleCount:
      flags.cycles ??
      (typeof fileConfig.cycles === 'number' && fileConfig.cycles > 0
        ? fileConfig.cycles
        : DEFAULT_CONFIG.cycleCount),
    useAscii,
    useColor: !noColor,
  };
  validateConfig(config);

  // NO_COLOR short-circuit (AC-PT-09): when color is suppressed, skip palette
  // resolution entirely and return the default ocean palette. Adapters ignore
  // it because config.useColor is false. This is evaluated BEFORE any flag/env/
  // config palette resolution, so an invalid CHROMATO_PALETTE under NO_COLOR
  // never throws.
  const paletteName = noColor ? DEFAULT_PALETTE_NAME : resolvePaletteNameFor(flags, fileConfig);
  const resolvedPalette = getPalette(paletteName);

  // Notifications (ADR-014 / DD-1): composition-root concern, not a SessionConfig
  // field. Default true; only an explicit `false` in config.json turns it off.
  const notifications = fileConfig.notifications !== false;

  return { config, autoDetectedAscii: autoDetected, resolvedPalette, paletteName, notifications };
}
