import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const changelogPath = join(process.cwd(), 'CHANGELOG.md');

describe('CHANGELOG.md exists with v1.0.0 entry covering all delivered features', () => {
  it('CHANGELOG.md exists at the repository root', () => {
    expect(existsSync(changelogPath)).toBe(true);
  });

  it('contains the v1.0.0 release header', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('## [1.0.0]');
  });

  it('contains an Added subsection under the 1.0.0 entry', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('### Added');
  });

  it('lists Animated progress bar feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('Animated progress bar');
  });

  it('lists Color-coded phases feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('Color-coded phases');
  });

  it('lists Desktop notifications feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('Desktop notifications');
  });

  it('lists Second overdue notification feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('Second overdue notification');
  });

  it('lists tmux status-right integration feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('tmux status-right integration');
  });

  it('lists Shell prompt integration feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('Shell prompt integration');
  });

  it('lists Minimal mode feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('Minimal mode');
  });

  it('lists NO_COLOR support', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('NO_COLOR');
  });

  it('lists Narrow terminal compact mode feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('Narrow terminal compact mode');
  });

  it('lists 1-second progress bar update cadence feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('1-second progress bar update cadence');
  });

  it('lists Help splash screen feature', () => {
    const content = readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('Help splash screen');
  });
});
