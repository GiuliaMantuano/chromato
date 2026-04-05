import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FILE = join(process.cwd(), 'docs/feature/pomodoro-timer-cli/deliver/roadmap-v2.md');

describe('roadmap-v2.md date is 2026-04-05, help-splash-screen appears in header, step 01-03 shows 200ms threshold', () => {
  it('Last reviewed shows 2026-04-05', () => {
    const c = readFileSync(FILE, 'utf-8');
    expect(c).toContain('Last reviewed**: 2026-04-05');
  });
  it('header progress section contains help-splash-screen', () => {
    const c = readFileSync(FILE, 'utf-8');
    expect(c).toContain('help-splash-screen');
  });
  it('header contains all six bug fix names', () => {
    const c = readFileSync(FILE, 'utf-8');
    expect(c).toContain('fix-pomodoro-counter-overflow');
    expect(c).toContain('fix-overdue-float-seconds');
    expect(c).toContain('fix-banner-minimal-mode');
    expect(c).toContain('fix-tui-terminal-blocking');
    expect(c).toContain('fix-narrow-terminal-strip');
    expect(c).toContain('fix-tui-flicker-regex');
  });
  it('step 01-03 uses 200ms threshold not 50ms', () => {
    const c = readFileSync(FILE, 'utf-8');
    // Find the step 01-03 section and check for 200ms
    const step01_03Index = c.indexOf('`01-03`');
    const step01_03Section = c.slice(step01_03Index, step01_03Index + 800);
    expect(step01_03Section).toContain('200ms');
    expect(step01_03Section).not.toMatch(/under 50ms/);
  });
});
