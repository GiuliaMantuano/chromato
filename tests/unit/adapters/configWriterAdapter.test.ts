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

  // LOW-4/LOW-5 (2026-07-06 security review): file permission + TOCTOU hardening
  describe('file permission + TOCTOU hardening (LOW-4/LOW-5)', () => {
    it('creates the chromato/ directory with owner-only permissions (0o700)', () => {
      const writer = new ConfigFileWriterAdapter();
      writer.write({ palette: 'ocean' });
      const dir = path.join(tmpDir, 'chromato');
      const mode = fs.statSync(dir).mode & 0o777;
      expect(mode).toBe(0o700);
    });

    it('writes config.json with owner-only permissions (0o600)', () => {
      const writer = new ConfigFileWriterAdapter();
      writer.write({ palette: 'ocean' });
      const file = path.join(tmpDir, 'chromato', 'config.json');
      const mode = fs.statSync(file).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('retroactively hardens a pre-existing chromato/ directory left at 0o755 by an older version', () => {
      // mkdirSync's `mode` option is a documented no-op when the directory
      // already exists -- this pre-seeds the dir the way an install upgrading
      // from a pre-fix version would find it, and proves the fix chmods it
      // explicitly rather than relying on mkdirSync alone.
      const dir = path.join(tmpDir, 'chromato');
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      const writer = new ConfigFileWriterAdapter();
      writer.write({ palette: 'ocean' });
      const mode = fs.statSync(dir).mode & 0o777;
      expect(mode).toBe(0o700);
    });

    it('does not follow a pre-existing symlink planted at the tmp path (TOCTOU guard)', () => {
      const dir = path.join(tmpDir, 'chromato');
      fs.mkdirSync(dir, { recursive: true });
      const victim = path.join(tmpDir, 'victim.json');
      fs.writeFileSync(victim, 'untouched');
      const tmpPath = path.join(dir, 'config.json.tmp');
      fs.symlinkSync(victim, tmpPath);

      const writer = new ConfigFileWriterAdapter();
      writer.write({ palette: 'berry' });

      expect(fs.readFileSync(victim, 'utf8')).toBe('untouched');
      const file = path.join(dir, 'config.json');
      expect(fs.lstatSync(file).isSymbolicLink()).toBe(false);
      const written = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(written.palette).toBe('berry');
    });
  });
});
