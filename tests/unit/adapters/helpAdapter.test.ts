import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test Budget: 4 behaviors x 2 = 8 max unit tests. Using 4.
// Behaviors:
//   1. noColor=false → output contains chalk.dim ANSI codes around '─' divider
//   2. noColor=true → output is plain '─' divider, no ANSI codes
//   3. useAscii=true → uses '-' instead of '─'
//   4. NODE_ENV=test → no output written

describe('printHelpSplash', () => {
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
    // Set to production so the NODE_ENV=test guard does not suppress output
    process.env['NODE_ENV'] = 'production';
    delete process.env['NO_COLOR'];
    // Force chalk to emit ANSI codes in non-TTY test environment
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

  it('writes chalk.dim ANSI codes around the unicode divider when noColor=false', async () => {
    const { printHelpSplash } = await import('../../../src/adapters/helpAdapter.js');
    printHelpSplash(false, false);
    const output = writtenChunks.join('');
    // chalk.dim produces ESC[2m ... ESC[22m sequences
    expect(output).toMatch(/\x1b\[/);
    expect(output).toContain('─');
  });

  it('writes plain unicode divider with no ANSI codes when noColor=true', async () => {
    const { printHelpSplash } = await import('../../../src/adapters/helpAdapter.js');
    printHelpSplash(true, false);
    const output = writtenChunks.join('');
    expect(output).not.toMatch(/\x1b\[/);
    expect(output).toContain('─');
  });

  it('uses hyphen character when useAscii=true', async () => {
    const { printHelpSplash } = await import('../../../src/adapters/helpAdapter.js');
    printHelpSplash(true, true);
    const output = writtenChunks.join('');
    expect(output).toContain('-');
    expect(output).not.toContain('─');
  });

  it('writes nothing to stdout when NODE_ENV=test', async () => {
    process.env['NODE_ENV'] = 'test';
    const { printHelpSplash } = await import('../../../src/adapters/helpAdapter.js');
    printHelpSplash(false, false);
    expect(writtenChunks).toHaveLength(0);
  });
});
