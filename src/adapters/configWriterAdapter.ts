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
  write(config: PersistedConfig): void {
    const configFile = resolveConfigFilePath();
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    const tmpFile = `${configFile}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tmpFile, configFile);
  }
}
