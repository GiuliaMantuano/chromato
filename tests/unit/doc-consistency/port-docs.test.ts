import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const BOUNDARIES_FILE = join(process.cwd(), 'docs/feature/pomodoro-timer-cli/design/component-boundaries.md');

describe('component-boundaries.md port documentation', () => {
  it('Port Interfaces section contains StatusFormatPort', () => {
    const content = readFileSync(BOUNDARIES_FILE, 'utf-8');
    expect(content).toContain('StatusFormatPort');
  });

  it('StatusFormatPort documents all three method signatures', () => {
    const content = readFileSync(BOUNDARIES_FILE, 'utf-8');
    expect(content).toContain('formatTmux');
    expect(content).toContain('formatPlain');
    expect(content).toContain('formatPrompt');
  });

  it('StatusFormatPort documents implementation and consumption', () => {
    const content = readFileSync(BOUNDARIES_FILE, 'utf-8');
    expect(content).toContain('StatusAdapter');
    expect(content).toContain('StatusService');
  });

  it('StatusFormatPort includes architectural rationale note', () => {
    const content = readFileSync(BOUNDARIES_FILE, 'utf-8');
    // Must explain why StatusFormatPort is separate from RenderPort
    expect(content).toMatch(/short-lived|short lived/i);
  });
});
