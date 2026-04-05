import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../../..');

describe('Howto and CLI reference docs contain no stale 50ms latency claims', () => {
  const installAndConfigurePath = resolve(root, 'docs/howto/install-and-configure.md');
  const cliReferencePath = resolve(root, 'docs/reference/cli-reference.md');

  it('docs/howto/install-and-configure.md exists', () => {
    expect(existsSync(installAndConfigurePath)).toBe(true);
  });

  it('docs/howto/install-and-configure.md does not contain stale 50ms claim', () => {
    const content = readFileSync(installAndConfigurePath, 'utf-8');
    expect(content).not.toMatch(/50ms/);
  });

  it('docs/reference/cli-reference.md exists', () => {
    expect(existsSync(cliReferencePath)).toBe(true);
  });

  it('docs/reference/cli-reference.md does not contain stale 50ms claim', () => {
    const content = readFileSync(cliReferencePath, 'utf-8');
    expect(content).not.toMatch(/50ms/);
  });
});
