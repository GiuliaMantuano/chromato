import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const docPath = join(process.cwd(), 'TESTING-LOCALLY.md');
const docContent = readFileSync(docPath, 'utf-8');

describe('TESTING-LOCALLY.md stale content regression tests', () => {
  it('does not contain stale --help description referencing only start and status', () => {
    expect(docContent).not.toContain('list of commands (`start`, `status`)');
  });

  it('does not contain stale countdown format showing 6:00 minutes', () => {
    expect(docContent).not.toContain('6:00 →');
  });

  it('does not contain stale vitest bin wrapper invocation', () => {
    expect(docContent).not.toContain('node_modules/.bin/vitest run');
  });

  it('contains correct vitest ESM entry point', () => {
    expect(docContent).toContain('vitest.mjs');
  });

  it('contains direct node cucumber.js fallback invocation', () => {
    expect(docContent).toContain('cucumber.js');
  });
});
