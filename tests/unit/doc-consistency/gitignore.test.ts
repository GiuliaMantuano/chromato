import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const GITIGNORE_PATH = resolve(__dirname, '../../../.gitignore');

describe('.gitignore consistency', () => {
  it('exists at repository root', () => {
    expect(existsSync(GITIGNORE_PATH)).toBe(true);
  });

  it('contains node_modules entry', () => {
    const content = readFileSync(GITIGNORE_PATH, 'utf-8');
    expect(content).toMatch(/^node_modules/m);
  });

  it('contains dist entry', () => {
    const content = readFileSync(GITIGNORE_PATH, 'utf-8');
    expect(content).toMatch(/^dist/m);
  });

  it('contains coverage entry', () => {
    const content = readFileSync(GITIGNORE_PATH, 'utf-8');
    expect(content).toMatch(/^coverage/m);
  });

  it('contains .env entry for sensitive environment files', () => {
    const content = readFileSync(GITIGNORE_PATH, 'utf-8');
    expect(content).toMatch(/^\.env$/m);
  });

  it('contains .DS_Store entry for macOS metadata', () => {
    const content = readFileSync(GITIGNORE_PATH, 'utf-8');
    expect(content).toMatch(/^\.DS_Store$/m);
  });

  it('does NOT exclude src/ directory', () => {
    const content = readFileSync(GITIGNORE_PATH, 'utf-8');
    expect(content).not.toMatch(/^src\//m);
  });

  it('does NOT exclude tests/ directory', () => {
    const content = readFileSync(GITIGNORE_PATH, 'utf-8');
    expect(content).not.toMatch(/^tests\//m);
  });
});
