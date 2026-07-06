/**
 * Unit tests: notification mode resolution in loadConfig (src/configLoader.ts)
 *
 * Feature      : in-terminal-notifications slice-03 (step 04-01)
 * Driving port : loadConfig() — the config resolution driving port
 * Traceability : AC-03.1 (default), AC-03.2 ([D6] legacy boolean), AC-03.4 ([D10]
 *                invalid-value single warning), DDD-1/DDD-2
 *
 * ConfigResult.notifications changes from a plain boolean to the resolved
 * NotificationMode ([D6]/[D10]). The single-parse point (DD-4 precedent,
 * mirroring palette/timing) now also resolves the mode via parseNotificationMode.
 *
 * Test budget: 4 behaviors (absent-default / legacy-boolean-mapping /
 * valid-mode-passthrough / invalid-single-stderr-warning) x 2 = 8 max; 7 written.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from '../../src/configLoader.js';
import { DEFAULT_NOTIFICATION_MODE } from '../../src/domain/notificationMode.js';

let isolatedConfigHome = '';

beforeEach(() => {
  isolatedConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-xdg-notif-'));
  process.env['XDG_CONFIG_HOME'] = isolatedConfigHome;
  process.env['LANG'] = 'en_US.UTF-8';
});

afterEach(() => {
  delete process.env['XDG_CONFIG_HOME'];
  delete process.env['NO_COLOR'];
  if (isolatedConfigHome) {
    fs.rmSync(isolatedConfigHome, { recursive: true, force: true });
    isolatedConfigHome = '';
  }
});

function withConfigJson(content: string, fn: () => void): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-notif-test-'));
  const chromatoDir = path.join(tmpDir, 'chromato');
  fs.mkdirSync(chromatoDir, { recursive: true });
  fs.writeFileSync(path.join(chromatoDir, 'config.json'), content, 'utf8');
  process.env['XDG_CONFIG_HOME'] = tmpDir;
  try {
    fn();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('loadConfig notification-mode resolution (configLoader — slice-03)', () => {
  it('absent notifications key resolves to the default mode ("banner+bell", AC-03.1)', () => {
    const result = loadConfig({});
    expect(result.notifications).toBe(DEFAULT_NOTIFICATION_MODE);
  });

  it.each([
    ['true', 'banner+bell'],
    ['false', 'off'],
  ] as const)('legacy boolean %s in config.json maps to "%s" ([D6])', (rawJsonValue, expectedMode) => {
    withConfigJson(`{"notifications":${rawJsonValue}}`, () => {
      const result = loadConfig({});
      expect(result.notifications).toBe(expectedMode);
    });
  });

  it.each([
    'banner+bell',
    'banner',
    'bell',
    'off',
  ] as const)('valid mode string "%s" in config.json passes through unchanged', (mode) => {
    withConfigJson(`{"notifications":"${mode}"}`, () => {
      const result = loadConfig({});
      expect(result.notifications).toBe(mode);
    });
  });

  it('an unknown notifications value falls back to the default mode ([D10])', () => {
    withConfigJson('{"notifications":"loud"}', () => {
      const result = loadConfig({});
      expect(result.notifications).toBe(DEFAULT_NOTIFICATION_MODE);
    });
  });

  it('an unknown notifications value writes EXACTLY ONE stderr warning naming valid modes ([D10])', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    withConfigJson('{"notifications":"loud"}', () => {
      loadConfig({});
    });
    const warnings = writeSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes('loud'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('banner+bell');
    expect(warnings[0]).toContain('banner');
    expect(warnings[0]).toContain('bell');
    expect(warnings[0]).toContain('off');
    writeSpy.mockRestore();
  });

  it('a valid notifications value writes NO stderr warning', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    withConfigJson('{"notifications":"bell"}', () => {
      loadConfig({});
    });
    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});
