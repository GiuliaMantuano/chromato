import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WALKING_SKELETON = join(
  process.cwd(),
  'tests/acceptance/pomodoro-timer-cli/walking-skeleton.feature',
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
});
