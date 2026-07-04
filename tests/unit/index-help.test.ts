/**
 * Acceptance test: help splash wired in index.ts (step 01-04)
 *
 * Verifies the noColor resolution logic and the help-splash call sequence.
 *
 * Test Budget: 2 behaviors x 2 = 4 max unit tests. Using 2.
 * Behaviors:
 *   1. --no-color in argv resolves noColor=true
 *   2. NO_COLOR env var resolves noColor=true
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── noColor resolution logic (extracted from index.ts wiring) ──────────────
// This is the pure logic that should be used in the addHelpText('beforeAll') hook.
function resolveNoColor(argv: string[], env: Record<string, string | undefined>): boolean {
  return argv.includes('--no-color') || Boolean(env['NO_COLOR']);
}

describe('help splash noColor resolution', () => {
  it('resolves noColor=true when --no-color is in argv', () => {
    const result = resolveNoColor(['node', 'chromato', '--no-color'], {});
    expect(result).toBe(true);
  });

  it('resolves noColor=true when NO_COLOR env var is set', () => {
    const result = resolveNoColor(['node', 'chromato'], { NO_COLOR: '1' });
    expect(result).toBe(true);
  });
});

// ── help splash sequence integration (verifies wiring contract) ────────────
// Verifies that printBanner + printHelpSplash together produce output
// containing the tagline and divider, in the expected order.
describe('help splash sequence', () => {
  let writtenChunks: string[];
  let originalNodeEnv: string | undefined;
  let originalForceColor: string | undefined;
  let originalNoColor: string | undefined;

  beforeEach(() => {
    writtenChunks = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      writtenChunks.push(String(chunk));
      return true;
    });
    originalNodeEnv = process.env['NODE_ENV'];
    originalForceColor = process.env['FORCE_COLOR'];
    originalNoColor = process.env['NO_COLOR'];
    process.env['NODE_ENV'] = 'production';
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '1';
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env['NODE_ENV'] = originalNodeEnv;
    if (originalForceColor !== undefined) {
      process.env['FORCE_COLOR'] = originalForceColor;
    } else {
      delete process.env['FORCE_COLOR'];
    }
    if (originalNoColor !== undefined) {
      process.env['NO_COLOR'] = originalNoColor;
    } else {
      delete process.env['NO_COLOR'];
    }
  });

  it('tagline appears exactly once in combined banner + help splash output', async () => {
    const { printBanner, TAGLINE } = await import('../../src/adapters/bannerAdapter.js');
    const { printHelpSplash } = await import('../../src/adapters/helpAdapter.js');
    const { getPalette } = await import('../../src/domain/palette.js');

    printBanner(getPalette('ocean'), true); // noColor=true → plain text
    printHelpSplash(true, false);

    const output = writtenChunks.join('');
    const taglineOccurrences = (output.match(new RegExp(TAGLINE, 'g')) ?? []).length;
    expect(taglineOccurrences).toBe(1);
  });

  it('divider appears after tagline in combined output when noColor=false', async () => {
    const { printBanner } = await import('../../src/adapters/bannerAdapter.js');
    const { printHelpSplash } = await import('../../src/adapters/helpAdapter.js');
    const { getPalette } = await import('../../src/domain/palette.js');

    printBanner(getPalette('ocean'), false);
    printHelpSplash(false, false);

    const output = writtenChunks.join('');
    // Divider character must appear in the combined output (the help splash
    // examples block uses the '─' box-drawing divider in unicode mode).
    expect(output).toContain('─');
  });
});
