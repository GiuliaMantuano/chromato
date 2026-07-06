/**
 * Owner-only filesystem permission helpers (LOW-4, 2026-07-06 security review,
 * CWE-276). Shared by persistenceAdapter.ts and configWriterAdapter.ts, both of
 * which write user-local state/config under $XDG_DATA_HOME/$XDG_CONFIG_HOME.
 */

import * as fs from 'node:fs';

export const OWNER_ONLY_DIR_MODE = 0o700;
export const OWNER_ONLY_FILE_MODE = 0o600;

/**
 * Ensures `dir` exists and is owner-only (0o700). `fs.mkdirSync`'s `mode`
 * option is a documented no-op when the directory already exists, so an
 * unconditional `chmodSync` is required to retroactively harden a directory
 * an older, pre-fix version of chromato already created (typically 0o755).
 */
export function ensureOwnerOnlyDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: OWNER_ONLY_DIR_MODE });
  fs.chmodSync(dir, OWNER_ONLY_DIR_MODE);
}
