/**
 * Unit tests: palette resolution in loadConfig (src/configLoader.ts)
 *
 * Feature      : palette-themes / Phase C
 * Wave         : DISTILL — RED-ready
 * Driving port : loadConfig() — the config resolution driving port
 * Traceability : AC-PT-04 (--palette flag), AC-PT-05 (CHROMATO_PALETTE env),
 *                AC-PT-06 (config.json key), AC-PT-07 (precedence chain),
 *                AC-PT-08 (unknown name → exit 1 + valid names),
 *                AC-PT-09 (NO_COLOR short-circuits palette resolution)
 *
 * Test budget (Phase C — configLoader palette extension):
 *   P1 : --palette flag sets resolvedPalette to the named palette
 *   P2 : CHROMATO_PALETTE env sets resolvedPalette when no flag is set
 *   P3 : config.json "palette" key sets resolvedPalette when no flag/env
 *   P4 : flag beats env var (flag > env precedence)
 *   P5 : flag beats config.json (flag > config precedence)
 *   P6 : env var beats config.json (env > config precedence)
 *   P7 : default 'ocean' when no flag, env, or config key
 *   P8 : unknown palette name via flag throws with VALID_PALETTE_NAMES enumerated
 *   P9 : unknown palette name via env throws with VALID_PALETTE_NAMES enumerated
 *   P10: unknown palette name via config.json throws with VALID_PALETTE_NAMES enumerated
 *   P11: config.json invalid JSON throws (exit 1 path, not silent fallthrough)
 *   P12: config.json absent → falls through to default (no error)
 *   P13: NO_COLOR env set → resolvedPalette is default ocean; useColor=false
 *   P14: --no-color flag → resolvedPalette is default ocean; useColor=false
 *   P15: NO_COLOR set + CHROMATO_PALETTE set → palette NOT resolved, useColor=false
 *
 * Error/edge ratio: 8 of 15 = 53% — target met (>= 40%)
 *
 * All tests are .skip — DELIVER enables one at a time.
 * First test (P1) is enabled — RED anchor for Phase C configLoader.
 *
 * NOTE: These tests require configLoader.ts to be extended with palette resolution
 * per DES-PT-03 / component-boundaries.md. They will remain RED until DELIVER
 * implements the extension. The scaffold (src/domain/palette.ts) ensures imports
 * resolve without breaking; assertions fail because loadConfig does not yet
 * return resolvedPalette.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadConfig } from '../../src/configLoader.js';

// Restore env after each test to prevent cross-test contamination.
afterEach(() => {
  delete process.env['NO_COLOR'];
  delete process.env['CHROMATO_PALETTE'];
  delete process.env['XDG_CONFIG_HOME'];
  // Restore UTF-8 env for Unicode detection
  process.env['LANG'] = 'en_US.UTF-8';
});

// ---------------------------------------------------------------------------
// Helper: write a temporary config.json and point XDG_CONFIG_HOME at it.
// ---------------------------------------------------------------------------
function withConfigJson(content: string, fn: () => void): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-test-'));
  const chromatoDir = path.join(tmpDir, 'chromato');
  fs.mkdirSync(chromatoDir, { recursive: true });
  fs.writeFileSync(path.join(chromatoDir, 'config.json'), content, 'utf8');
  process.env['XDG_CONFIG_HOME'] = tmpDir;
  try {
    fn();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env['XDG_CONFIG_HOME'];
  }
}

// ---------------------------------------------------------------------------
// Phase C — palette resolution
// ---------------------------------------------------------------------------

describe('loadConfig palette resolution (configLoader — Phase C)', () => {

  // P1 — enabled: RED anchor for Phase C.
  // Fails because loadConfig does not yet return resolvedPalette.
  it('P1: --palette lavender flag sets resolvedPalette to the lavender palette', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    // @ts-expect-error — palette field does not exist yet on StartFlags; added by DELIVER
    const result = loadConfig({ palette: 'lavender' });
    // resolvedPalette does not exist on the current ConfigResult shape — RED
    expect((result as unknown as Record<string, unknown>)['resolvedPalette']).toBeDefined();
    expect(
      ((result as unknown as Record<string, unknown>)['resolvedPalette'] as Record<string, unknown>)
    ).toHaveProperty('gradient');
  });

  it.skip('P2: CHROMATO_PALETTE=berry env sets resolvedPalette to berry when no --palette flag', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    process.env['CHROMATO_PALETTE'] = 'berry';
    // @ts-expect-error — palette extension pending
    const result = loadConfig({});
    const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'];
    expect(resolved).toBeDefined();
    // Berry gradient first stop per palette-spec.md
    const gradient = (resolved as Record<string, unknown>)['gradient'] as string[];
    expect(gradient[0]).toBe('#ffe3ef');
  });

  it.skip('P3: config.json "palette": "forest" sets resolvedPalette to forest when no flag/env', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    withConfigJson('{"palette":"forest"}', () => {
      // @ts-expect-error — palette extension pending
      const result = loadConfig({});
      const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'];
      expect(resolved).toBeDefined();
      const gradient = (resolved as Record<string, unknown>)['gradient'] as string[];
      expect(gradient[0]).toBe('#dbeec6');
    });
  });

  it.skip('P4: --palette flag beats CHROMATO_PALETTE env var (flag > env precedence)', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    process.env['CHROMATO_PALETTE'] = 'berry';
    // @ts-expect-error — palette extension pending
    const result = loadConfig({ palette: 'lavender' });
    const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'];
    const gradient = (resolved as Record<string, unknown>)['gradient'] as string[];
    // Lavender gradient first stop per palette-spec.md
    expect(gradient[0]).toBe('#ece4ff');
  });

  it.skip('P5: --palette flag beats config.json key (flag > config precedence)', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    withConfigJson('{"palette":"berry"}', () => {
      // @ts-expect-error — palette extension pending
      const result = loadConfig({ palette: 'forest' });
      const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'];
      const gradient = (resolved as Record<string, unknown>)['gradient'] as string[];
      // Forest gradient first stop per palette-spec.md
      expect(gradient[0]).toBe('#dbeec6');
    });
  });

  it.skip('P6: CHROMATO_PALETTE env beats config.json key (env > config precedence)', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    process.env['CHROMATO_PALETTE'] = 'ocean';
    withConfigJson('{"palette":"lavender"}', () => {
      // @ts-expect-error — palette extension pending
      const result = loadConfig({});
      const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'];
      const gradient = (resolved as Record<string, unknown>)['gradient'] as string[];
      // Ocean gradient first stop per palette-spec.md
      expect(gradient[0]).toBe('#d8f0ff');
    });
  });

  it.skip('P7: default ocean palette when no flag, env, or config.json key is set', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    delete process.env['CHROMATO_PALETTE'];
    // @ts-expect-error — palette extension pending
    const result = loadConfig({});
    const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'];
    const gradient = (resolved as Record<string, unknown>)['gradient'] as string[];
    // Ocean gradient first stop per palette-spec.md
    expect(gradient[0]).toBe('#d8f0ff');
  });

  // ---------------------------------------------------------------------------
  // Error paths (AC-PT-08)
  // ---------------------------------------------------------------------------

  it.skip('P8: unknown palette name via --palette flag throws and enumerates valid names', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    expect(() => {
      // @ts-expect-error — palette extension pending
      loadConfig({ palette: 'catppuccin-latte' });
    }).toThrow();
    try {
      // @ts-expect-error — palette extension pending
      loadConfig({ palette: 'catppuccin-latte' });
    } catch (err) {
      const msg = String((err as Error).message);
      expect(msg).toContain('catppuccin-latte');
      expect(msg).toContain('ocean');
      expect(msg).toContain('lavender');
      expect(msg).toContain('berry');
      expect(msg).toContain('forest');
    }
  });

  it.skip('P9: unknown palette name via CHROMATO_PALETTE env throws and enumerates valid names', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    process.env['CHROMATO_PALETTE'] = 'dracula';
    expect(() => {
      // @ts-expect-error — palette extension pending
      loadConfig({});
    }).toThrow();
    try {
      // @ts-expect-error — palette extension pending
      loadConfig({});
    } catch (err) {
      const msg = String((err as Error).message);
      expect(msg).toContain('dracula');
      expect(msg).toContain('ocean');
    }
  });

  it.skip('P10: unknown palette name in config.json throws and enumerates valid names', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    withConfigJson('{"palette":"nord"}', () => {
      expect(() => {
        // @ts-expect-error — palette extension pending
        loadConfig({});
      }).toThrow();
      try {
        // @ts-expect-error — palette extension pending
        loadConfig({});
      } catch (err) {
        const msg = String((err as Error).message);
        expect(msg).toContain('nord');
        expect(msg).toContain('ocean');
      }
    });
  });

  it.skip('P11: config.json present but invalid JSON throws (exit 1 path, not silent)', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    withConfigJson('{ not valid json }', () => {
      expect(() => {
        // @ts-expect-error — palette extension pending
        loadConfig({});
      }).toThrow();
    });
  });

  it.skip('P12: config.json absent — falls through to default ocean (no error)', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    // XDG_CONFIG_HOME points to a tmp dir with no chromato/config.json
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-noconfig-'));
    process.env['XDG_CONFIG_HOME'] = tmpDir;
    try {
      // @ts-expect-error — palette extension pending
      expect(() => loadConfig({})).not.toThrow();
      // @ts-expect-error — palette extension pending
      const result = loadConfig({});
      const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'];
      const gradient = (resolved as Record<string, unknown>)['gradient'] as string[];
      expect(gradient[0]).toBe('#d8f0ff');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      delete process.env['XDG_CONFIG_HOME'];
    }
  });

  // ---------------------------------------------------------------------------
  // NO_COLOR short-circuit (AC-PT-09)
  // ---------------------------------------------------------------------------

  it.skip('P13: NO_COLOR env set — resolvedPalette is default ocean; useColor is false', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    process.env['NO_COLOR'] = '1';
    // @ts-expect-error — palette extension pending
    const result = loadConfig({});
    expect(result.config.useColor).toBe(false);
    // resolvedPalette is set to ocean default (adapters ignore it; useColor=false is the signal)
    const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'];
    expect(resolved).toBeDefined();
  });

  it.skip('P14: --no-color flag — resolvedPalette is default ocean; useColor is false', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    // @ts-expect-error — palette extension pending
    const result = loadConfig({ noColor: true });
    expect(result.config.useColor).toBe(false);
    const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'];
    expect(resolved).toBeDefined();
  });

  it.skip('P15: NO_COLOR set + CHROMATO_PALETTE set — palette NOT resolved, useColor=false', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    process.env['NO_COLOR'] = '1';
    process.env['CHROMATO_PALETTE'] = 'lavender';
    // NO_COLOR takes precedence — palette resolution is skipped entirely
    // @ts-expect-error — palette extension pending
    const result = loadConfig({});
    expect(result.config.useColor).toBe(false);
    // resolvedPalette still defined (set to ocean default); lavender NOT applied
    const resolved = (result as unknown as Record<string, unknown>)['resolvedPalette'] as Record<string, unknown>;
    if (resolved) {
      const gradient = resolved['gradient'] as string[];
      // Should be ocean (default), not lavender
      if (gradient) {
        expect(gradient[0]).not.toBe('#ece4ff'); // Not lavender's first stop
      }
    }
  });

});
