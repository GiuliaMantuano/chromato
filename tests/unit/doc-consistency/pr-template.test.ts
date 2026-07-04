import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const prTemplatePath = join(ROOT, '.github', 'PULL_REQUEST_TEMPLATE.md');

function readPrTemplate(): string {
  return readFileSync(prTemplatePath, 'utf-8');
}

describe('PULL_REQUEST_TEMPLATE.md', () => {
  it('contains at least one checklist item', () => {
    const content = readPrTemplate();
    expect(content).toMatch(/- \[ \]/);
  });

  it('contains a checklist item referencing tests', () => {
    const content = readPrTemplate();
    const lines = content.split('\n');
    const testLine = lines.find(
      (line) => line.includes('- [ ]') && line.toLowerCase().includes('test'),
    );
    expect(testLine).toBeDefined();
  });

  it('contains a checklist item referencing Conventional Commits', () => {
    const content = readPrTemplate();
    const lines = content.split('\n');
    const commitLine = lines.find(
      (line) =>
        line.includes('- [ ]') &&
        (line.toLowerCase().includes('conventional') || line.toLowerCase().includes('commit')),
    );
    expect(commitLine).toBeDefined();
  });

  it('contains a checklist item referencing documentation', () => {
    const content = readPrTemplate();
    const lines = content.split('\n');
    const docLine = lines.find(
      (line) => line.includes('- [ ]') && line.toLowerCase().includes('doc'),
    );
    expect(docLine).toBeDefined();
  });

  it('contains a section prompting the author to describe the change', () => {
    const content = readPrTemplate();
    expect(content).toMatch(/describe|what|why/i);
  });
});
