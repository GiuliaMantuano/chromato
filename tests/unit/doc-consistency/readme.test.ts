import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readmePath = join(process.cwd(), 'README.md');
const readmeContent = readFileSync(readmePath, 'utf-8');

describe('README status latency claim matches current specification', () => {
  it('does not contain stale < 50ms latency claim', () => {
    expect(readmeContent).not.toContain('< 50ms');
    expect(readmeContent).not.toContain('<50ms');
  });

  it('contains accurate wall-clock latency figure', () => {
    expect(readmeContent).toContain('200ms wall-clock');
  });

  it('contains accurate in-process latency figure', () => {
    expect(readmeContent).toContain('5ms in-process');
  });
});
