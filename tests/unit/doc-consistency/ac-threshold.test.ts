import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const AC_FILE = join(process.cwd(), 'docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md');

describe('AC-03.1 threshold consistency', () => {
  it('AC-03.1 row contains 200ms wall-clock threshold as primary statement', () => {
    const content = readFileSync(AC_FILE, 'utf-8');
    const ac031Line = content.split('\n').find(l => l.includes('AC-03.1'));
    expect(ac031Line).toBeDefined();
    expect(ac031Line).toContain('200ms (wall-clock subprocess time including Node.js startup)');
  });

  it('AC-03.1 row contains post-MVP compiled binary note for <50ms', () => {
    const content = readFileSync(AC_FILE, 'utf-8');
    const ac031Line = content.split('\n').find(l => l.includes('AC-03.1'));
    expect(ac031Line).toContain('The <50ms constraint applies to post-MVP compiled binary distributions');
  });

  it('AC-03.1 row does not use "in under 50ms" as a standalone performance target', () => {
    const content = readFileSync(AC_FILE, 'utf-8');
    const ac031Line = content.split('\n').find(l => l.includes('AC-03.1'));
    // The phrase "in under 50ms" must not appear as the main threshold in AC-03.1
    // It may appear inside the post-MVP note, but not as a standalone "exits in under 50ms"
    expect(ac031Line).not.toMatch(/exits? in under 50ms/);
    expect(ac031Line).not.toMatch(/under 50ms\s*\|/);
  });
});
