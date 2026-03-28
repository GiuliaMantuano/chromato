/**
 * Unit test: CLI --version output
 *
 * Behavior: chromato --version prints a semantic version string and exits 0.
 *
 * Test Budget: 1 distinct behavior x 2 = 2 max unit tests.
 * (1) outputs semver string to stdout
 * (2) exits with code 0
 *
 * Tests invoke through the CLI driving port (dist/index.js) via child_process.
 * No imports from src/domain/, src/application/, or src/adapters/.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const entryPoint = join(projectRoot, 'dist', 'index.js');

describe('chromato CLI driving port', () => {
  it('outputs a semantic version string when --version is passed', () => {
    const result = spawnSync('node', [entryPoint, '--version'], {
      encoding: 'utf8',
    });

    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('exits with code 0 when --version is passed', () => {
    const result = spawnSync('node', [entryPoint, '--version'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
  });
});
