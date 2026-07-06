/**
 * ConfigFileWriterAdapter — driven adapter implementing ConfigWritePort (ADR-013 DD-5).
 *
 * Serialises PersistedConfig to JSON and writes it atomically (tmp + rename) to
 * $XDG_CONFIG_HOME/chromato/config.json. Reuses the atomic-write technique from
 * persistenceAdapter (different file/lifecycle — see Reuse Analysis). config.json
 * stores timing in MINUTES; the writer serialises whatever PersistedConfig it is
 * given (no unit conversion here).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PersistedConfig } from '../configTypes.js';
import type { ConfigWritePort } from '../domain/ports.js';
import { ensureOwnerOnlyDir, OWNER_ONLY_FILE_MODE } from '../utils/fileMode.js';

// Re-export so existing importers (setupWizardAdapter.test.ts) keep working.
export type { ConfigWritePort } from '../domain/ports.js';

/**
 * Resolves the chromato config file path:
 * ${XDG_CONFIG_HOME:-~/.config}/chromato/config.json
 * Mirrors configLoader.resolveConfigFilePath (replicated locally — out of scope to import).
 */
function resolveConfigFilePath(): string {
  const base = process.env['XDG_CONFIG_HOME'] ?? path.join(os.homedir(), '.config');
  return path.join(base, 'chromato', 'config.json');
}

export class ConfigFileWriterAdapter implements ConfigWritePort {
  /**
   * Hardened per LOW-4/LOW-5 (2026-07-06 security review): any stale tmp
   * (leftover from a crashed prior write, or a symlink pre-planted at the tmp
   * path) is unlinked first -- unlinkSync removes a symlink itself rather than
   * following it -- then the tmp file is created with O_EXCL (`flag: 'wx'`),
   * so a write can never silently follow a pre-existing file/symlink at that
   * path (CWE-59). This closes the static "symlink already sitting at the tmp
   * path" case (tested below); the O_EXCL flag also fails safe (throws EEXIST
   * rather than following) if a symlink is replanted in the narrow window
   * between the unlink and the create, but that live race isn't independently
   * exercised by a single-threaded test. ensureOwnerOnlyDir/OWNER_ONLY_FILE_MODE
   * keep the directory/file owner-only (CWE-276), including retroactively for
   * a directory an older, pre-fix version already created.
   */
  write(config: PersistedConfig): void {
    const configFile = resolveConfigFilePath();
    ensureOwnerOnlyDir(path.dirname(configFile));
    const tmpFile = `${configFile}.tmp`;
    try {
      fs.unlinkSync(tmpFile);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
    fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2), {
      mode: OWNER_ONLY_FILE_MODE,
      flag: 'wx',
    });
    fs.renameSync(tmpFile, configFile);
  }
}
