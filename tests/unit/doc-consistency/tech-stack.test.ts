import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const TECH_FILE = join(process.cwd(), 'docs/feature/pomodoro-timer-cli/design/technology-stack.md');

describe('technology-stack.md commander version', () => {
  it('commander section heading references 14.x', () => {
    const content = readFileSync(TECH_FILE, 'utf-8');
    expect(content).toContain('CLI Framework: commander.js 14.x');
  });

  it('commander section heading does not reference 12.x', () => {
    const content = readFileSync(TECH_FILE, 'utf-8');
    expect(content).not.toContain('CLI Framework: commander.js 12.x');
  });

  it('commander dependency table row shows ^14.0', () => {
    const content = readFileSync(TECH_FILE, 'utf-8');
    expect(content).toMatch(/commander\s*\|\s*\^14\.0/);
  });
});
