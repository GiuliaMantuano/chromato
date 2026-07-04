/**
 * Unit tests: timing precedence in loadConfig (src/configLoader.ts)
 *
 * Feature      : first-run-setup-wizard / step 03-01 (DD-4 read consolidation)
 * Driving port : loadConfig() — the config resolution driving port
 * Traceability : US-03 (saved timing honoured), DD-4 (parse-once readConfigFile),
 *                DD-7 / D-OPEN-4 (preserve EXISTING precedence ordering exactly)
 *
 * The new behaviour: config.json timing keys (MINUTES) fold into the precedence
 * chain BETWEEN the flag and the default, multiplied by 60 to domain seconds.
 *
 * The REGRESSION guard (D-OPEN-4): the EXISTING ordering must NOT change —
 *   - work/break keep the env-first quirk: CHROMATO_WORK_SECONDS > flag > config > default.
 *   - work/break/longBreak/cycles: an explicit flag still beats config.json.
 *   - only work/break have env overrides — longBreak/cycles do NOT (no invented env vars).
 *
 * Test budget: 3 distinct behaviours x 2 = 6 max.
 *   B1: config.json timing (minutes) is honoured when no flag/env (×60 → seconds).
 *   B2: an explicit flag still beats config.json (flag > config precedence).
 *   B3: CHROMATO_WORK_SECONDS still beats config.json (env-first quirk preserved).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from '../../src/configLoader.js';
import { DEFAULT_CONFIG } from '../../src/domain/config.js';

let isolatedConfigHome = '';

beforeEach(() => {
  isolatedConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-xdg-timing-'));
  process.env['XDG_CONFIG_HOME'] = isolatedConfigHome;
  process.env['LANG'] = 'en_US.UTF-8';
});

afterEach(() => {
  delete process.env['CHROMATO_WORK_SECONDS'];
  delete process.env['CHROMATO_BREAK_SECONDS'];
  delete process.env['CHROMATO_LONG_BREAK_SECONDS'];
  delete process.env['CHROMATO_CYCLES_SECONDS'];
  delete process.env['CHROMATO_PALETTE'];
  delete process.env['NO_COLOR'];
  delete process.env['XDG_CONFIG_HOME'];
  if (isolatedConfigHome) {
    fs.rmSync(isolatedConfigHome, { recursive: true, force: true });
    isolatedConfigHome = '';
  }
});

/** Write config.json under the isolated XDG_CONFIG_HOME and run fn. */
function withConfigJson(content: string, fn: () => void): void {
  const chromatoDir = path.join(isolatedConfigHome, 'chromato');
  fs.mkdirSync(chromatoDir, { recursive: true });
  fs.writeFileSync(path.join(chromatoDir, 'config.json'), content, 'utf8');
  fn();
}

describe('loadConfig timing precedence (configLoader — step 03-01)', () => {
  // B1: config.json timing (minutes) is honoured when no flag/env, ×60 → seconds.
  it('B1: config.json timing keys (minutes) fold into the chain ×60 when no flag/env', () => {
    withConfigJson('{"palette":"ocean","work":50,"break":10,"longBreak":20,"cycles":6}', () => {
      const { config } = loadConfig({});
      expect(config.workDurationSeconds).toBe(50 * 60);
      expect(config.breakDurationSeconds).toBe(10 * 60);
      expect(config.longBreakDurationSeconds).toBe(20 * 60);
      expect(config.cycleCount).toBe(6);
    });
  });

  // B2 (REGRESSION): an explicit flag still beats config.json for EVERY timing key.
  it('B2: an explicit flag overrides config.json (flag > config) for all timing keys', () => {
    withConfigJson('{"palette":"ocean","work":50,"break":10,"longBreak":20,"cycles":6}', () => {
      const { config } = loadConfig({ work: 10, breakDuration: 3, longBreak: 5, cycles: 2 });
      expect(config.workDurationSeconds).toBe(10 * 60);
      expect(config.breakDurationSeconds).toBe(3 * 60);
      expect(config.longBreakDurationSeconds).toBe(5 * 60);
      expect(config.cycleCount).toBe(2);
    });
  });

  // B3 (REGRESSION, D-OPEN-4): the env-first quirk survives — CHROMATO_WORK_SECONDS
  // beats config.json AND an explicit work flag; only work/break have env vars.
  it('B3: CHROMATO_WORK_SECONDS still beats both config.json and the flag (env-first quirk)', () => {
    process.env['CHROMATO_WORK_SECONDS'] = '7';
    process.env['CHROMATO_BREAK_SECONDS'] = '4';
    withConfigJson('{"palette":"ocean","work":50,"break":10,"longBreak":20,"cycles":6}', () => {
      const { config } = loadConfig({ work: 33, breakDuration: 22 });
      // env wins over flag AND config (env-first quirk, raw seconds — no ×60).
      expect(config.workDurationSeconds).toBe(7);
      expect(config.breakDurationSeconds).toBe(4);
      // longBreak/cycles have NO env var — config.json still applies (×60 / count).
      expect(config.longBreakDurationSeconds).toBe(20 * 60);
      expect(config.cycleCount).toBe(6);
    });
  });

  // B4 (REGRESSION, D-OPEN-4): longBreak/cycles have NO env override. Inventing
  // CHROMATO_LONG_BREAK_SECONDS / CHROMATO_CYCLES_SECONDS must be IGNORED — config wins.
  // Pins the "no invented env vars" invariant so a future env addition can't slip in.
  it('B4: longBreak/cycles ignore any (non-existent) env var — config.json still applies', () => {
    process.env['CHROMATO_LONG_BREAK_SECONDS'] = '999';
    process.env['CHROMATO_CYCLES_SECONDS'] = '99';
    withConfigJson('{"palette":"ocean","work":50,"break":10,"longBreak":20,"cycles":6}', () => {
      const { config } = loadConfig({});
      expect(config.longBreakDurationSeconds).toBe(20 * 60);
      expect(config.cycleCount).toBe(6);
    });
  });

  // Sanity: absent config.json → defaults (proves config read is additive, not breaking).
  it('B1-baseline: absent config.json → domain defaults (no regression to default path)', () => {
    const { config } = loadConfig({});
    expect(config.workDurationSeconds).toBe(DEFAULT_CONFIG.workDurationSeconds);
    expect(config.breakDurationSeconds).toBe(DEFAULT_CONFIG.breakDurationSeconds);
    expect(config.longBreakDurationSeconds).toBe(DEFAULT_CONFIG.longBreakDurationSeconds);
    expect(config.cycleCount).toBe(DEFAULT_CONFIG.cycleCount);
  });
});
