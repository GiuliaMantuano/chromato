import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const WALKING_SKELETON = join(
  process.cwd(),
  'tests/acceptance/pomodoro-timer-cli/walking-skeleton.feature',
);
const ACCEPTANCE_CRITERIA = join(
  process.cwd(),
  'docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md',
);
const PRODUCT_ROADMAP = join(
  process.cwd(),
  'docs/feature/pomodoro-timer-cli/deliver/product-roadmap.md',
);

describe('cold-start tolerance -- stale 100ms first-frame criterion', () => {
  describe('walking-skeleton.feature', () => {
    it('does NOT contain the stale "within 100 milliseconds" first-frame step', () => {
      const content = readFileSync(WALKING_SKELETON, 'utf-8');
      expect(content).not.toContain('within 100 milliseconds');
    });

    it('DOES contain the corrected "within 700 milliseconds" first-frame step', () => {
      const content = readFileSync(WALKING_SKELETON, 'utf-8');
      expect(content).toContain('within 700 milliseconds');
    });
  });

  describe('acceptance-criteria.md', () => {
    it('does NOT contain the stale "<100ms from process start" for AC-NF1', () => {
      const content = readFileSync(ACCEPTANCE_CRITERIA, 'utf-8');
      expect(content).not.toContain('<100ms from process start');
    });

    it('DOES contain the corrected "700ms wall-clock" threshold for AC-NF1', () => {
      const content = readFileSync(ACCEPTANCE_CRITERIA, 'utf-8');
      expect(content).toContain('700ms wall-clock');
    });
  });

  describe('product-roadmap.md', () => {
    it('does NOT contain the stale "First TUI frame guaranteed <100ms" milestone', () => {
      const content = readFileSync(PRODUCT_ROADMAP, 'utf-8');
      expect(content).not.toContain('First TUI frame guaranteed <100ms');
    });
  });
});
