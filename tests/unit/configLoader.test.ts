/**
 * Unit tests: loadConfig Unicode detection and ASCII fallback logic.
 *
 * Test Budget:
 *   4 distinct behaviors x 2 = 8 max unit tests
 *
 *   B1: LANG without UTF-8 → useAscii=true, autoDetectedAscii=true
 *   B2: TERM=dumb → useAscii=true, autoDetectedAscii=true
 *   B3: --ascii flag → useAscii=true, autoDetectedAscii=false
 *   B4: LANG with UTF-8 and no --ascii → useAscii=false, autoDetectedAscii=false
 *
 * Port boundary: loadConfig is the driving port for configuration resolution.
 * Tests exercise the function directly as a pure configuration function.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadConfig } from '../../src/configLoader.js';

// Hermetic isolation: point XDG_CONFIG_HOME at a fresh EMPTY temp dir before
// every test. loadConfig resolves palette from ~/.config/chromato/config.json,
// so a real on-disk config could otherwise make loadConfig throw (invalid JSON
// / unknown palette) and break these Unicode-detection assertions spuriously.
let isolatedConfigHome = '';

beforeEach(() => {
  isolatedConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-xdg-'));
  process.env['XDG_CONFIG_HOME'] = isolatedConfigHome;
});

// Restore env after each test to prevent cross-test contamination.
afterEach(() => {
  delete process.env['LANG'];
  delete process.env['LC_ALL'];
  delete process.env['TERM'];
  delete process.env['NO_COLOR'];
  delete process.env['XDG_CONFIG_HOME'];
  if (isolatedConfigHome) {
    fs.rmSync(isolatedConfigHome, { recursive: true, force: true });
    isolatedConfigHome = '';
  }
});

describe('loadConfig Unicode detection (configLoader)', () => {
  // B1: LANG without UTF-8 → auto-detected ASCII
  it('B1a: LANG=en_US (no UTF-8) sets useAscii=true and autoDetectedAscii=true', () => {
    process.env['LANG'] = 'en_US';
    delete process.env['LC_ALL'];
    delete process.env['TERM'];

    const result = loadConfig({});

    expect(result.config.useAscii).toBe(true);
    expect(result.autoDetectedAscii).toBe(true);
  });

  it('B1b: LANG=C (no UTF-8) sets useAscii=true and autoDetectedAscii=true', () => {
    process.env['LANG'] = 'C';
    delete process.env['LC_ALL'];
    delete process.env['TERM'];

    const result = loadConfig({});

    expect(result.config.useAscii).toBe(true);
    expect(result.autoDetectedAscii).toBe(true);
  });

  // B2: TERM=dumb → auto-detected ASCII
  it('B2: TERM=dumb sets useAscii=true and autoDetectedAscii=true', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    process.env['TERM'] = 'dumb';
    delete process.env['LC_ALL'];

    const result = loadConfig({});

    expect(result.config.useAscii).toBe(true);
    expect(result.autoDetectedAscii).toBe(true);
  });

  // B3: --ascii flag → explicit ASCII, no auto-detection message
  it('B3: --ascii flag sets useAscii=true and autoDetectedAscii=false', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    delete process.env['LC_ALL'];
    delete process.env['TERM'];

    const result = loadConfig({ ascii: true });

    expect(result.config.useAscii).toBe(true);
    expect(result.autoDetectedAscii).toBe(false);
  });

  // B4: UTF-8 environment with no --ascii → Unicode mode
  it('B4: LANG with UTF-8 and no --ascii flag sets useAscii=false', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    delete process.env['LC_ALL'];
    delete process.env['TERM'];

    const result = loadConfig({});

    expect(result.config.useAscii).toBe(false);
    expect(result.autoDetectedAscii).toBe(false);
  });
});
