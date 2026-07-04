/**
 * Integration tests for ConfigFileWriterAdapter (real filesystem, tmp dir). RED stage.
 * Traceability: US-05, AC-05.2, K5, ADR-013 DD-5/DD-6.
 *
 * @real-io @adapter-integration — the write port's only @real-io coverage (Mandate 6).
 * RED now (ConfigFileWriterAdapter.write throws the scaffold error).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ConfigFileWriterAdapter } from '../../../src/adapters/configWriterAdapter.js';

let tmpDir: string;
let prevXdg: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-cfgw-'));
  prevXdg = process.env['XDG_CONFIG_HOME'];
  process.env['XDG_CONFIG_HOME'] = tmpDir;
});

afterEach(() => {
  if (prevXdg === undefined) delete process.env['XDG_CONFIG_HOME'];
  else process.env['XDG_CONFIG_HOME'] = prevXdg;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ConfigFileWriterAdapter', () => {
  it('writes all six keys to config.json as valid JSON (minutes for timing)', () => {
    const writer = new ConfigFileWriterAdapter();
    writer.write({
      palette: 'lavender',
      work: 50,
      break: 10,
      longBreak: 20,
      cycles: 6,
      notifications: true,
    });

    const file = path.join(tmpDir, 'chromato', 'config.json');
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(parsed).toMatchObject({
      palette: 'lavender',
      work: 50,
      break: 10,
      longBreak: 20,
      cycles: 6,
      notifications: true,
    });
  });

  it('creates the chromato/ directory if absent', () => {
    const writer = new ConfigFileWriterAdapter();
    writer.write({ palette: 'ocean' });
    expect(fs.existsSync(path.join(tmpDir, 'chromato', 'config.json'))).toBe(true);
  });

  it('leaves config.json valid even when overwriting an existing file (atomic)', () => {
    const writer = new ConfigFileWriterAdapter();
    writer.write({ palette: 'ocean' });
    writer.write({ palette: 'berry', work: 30 });
    const file = path.join(tmpDir, 'chromato', 'config.json');
    expect(() => JSON.parse(fs.readFileSync(file, 'utf8'))).not.toThrow();
  });
});
