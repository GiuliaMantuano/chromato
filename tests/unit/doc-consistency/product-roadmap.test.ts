import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const FILE = join(process.cwd(), 'docs/feature/pomodoro-timer-cli/deliver/product-roadmap.md');

describe('product-roadmap.md completeness', () => {
  it('Last Updated shows 2026-04-05', () => {
    const c = readFileSync(FILE, 'utf-8');
    expect(c).toContain('Last updated**: 2026-04-05');
  });
  it('Milestone 3 shows 200ms cold start for chromato status', () => {
    const c = readFileSync(FILE, 'utf-8');
    expect(c).toMatch(/200ms cold start/);
    expect(c).not.toMatch(/< 50ms cold start/);
  });
  it('US-03 closure note references 200ms gate', () => {
    const c = readFileSync(FILE, 'utf-8');
    expect(c).toMatch(/200ms gate/);
  });
  it('v1.0 QA Enhancements section exists with help-splash-screen', () => {
    const c = readFileSync(FILE, 'utf-8');
    expect(c).toContain('v1.0 QA Enhancements');
    expect(c).toContain('help-splash-screen');
    expect(c).toContain('US-HSS-01');
    expect(c).toContain('AC-HSS-08');
  });
  it('QA section contains all six bug fix names', () => {
    const c = readFileSync(FILE, 'utf-8');
    expect(c).toContain('fix-pomodoro-counter-overflow');
    expect(c).toContain('fix-overdue-float-seconds');
    expect(c).toContain('fix-banner-minimal-mode');
    expect(c).toContain('fix-tui-terminal-blocking');
    expect(c).toContain('fix-narrow-terminal-strip');
    expect(c).toContain('fix-tui-flicker-regex');
  });
  it('delivery traceability table contains help-splash-screen row', () => {
    const c = readFileSync(FILE, 'utf-8');
    expect(c).toContain('help-splash-screen');
    // Must appear in the traceability table context
    expect(c).toMatch(/help-splash-screen.*QA|QA.*help-splash-screen/s);
  });
});
