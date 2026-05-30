/**
 * Unit tests: package.json npm publish metadata
 *
 * Step 07-03: Validate declared dependency isolation
 *
 * These tests verify that package.json contains all fields required for a
 * valid npm publish. They act as a fast, local gate that catches missing
 * metadata before hitting the npm registry.
 *
 * Behaviors validated:
 *   B1: Required publish fields present (name, version, description, license, author)
 *   B2: `files` array declared and contains at minimum dist/ and README.md
 *   B3: `bin` field points to dist/index.js (the esbuild entry point)
 *   B4: `homepage` and `bugs.url` are set (improves npm page quality)
 *   B5: Runtime dependencies are in `dependencies`, not `devDependencies`
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

// ---------------------------------------------------------------------------
// B1: Required publish fields
// ---------------------------------------------------------------------------

describe('package.json -- required publish fields (B1)', () => {
  it('has a non-empty name field', () => {
    expect(typeof pkg.name).toBe('string');
    expect(pkg.name.length).toBeGreaterThan(0);
  });

  it('has a semver version field', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('has a non-empty description field', () => {
    expect(typeof pkg.description).toBe('string');
    expect(pkg.description.length).toBeGreaterThan(0);
  });

  it('has a license field', () => {
    expect(typeof pkg.license).toBe('string');
    expect(pkg.license.length).toBeGreaterThan(0);
  });

  it('has an author field', () => {
    expect(pkg.author).toBeDefined();
    const authorStr = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name ?? '';
    expect(authorStr.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// B2: `files` array controls tarball contents
// ---------------------------------------------------------------------------

describe('package.json -- files array for npm tarball (B2)', () => {
  it('has a files array', () => {
    expect(Array.isArray(pkg.files)).toBe(true);
    expect(pkg.files.length).toBeGreaterThan(0);
  });

  it('includes dist/ in the files array', () => {
    expect(pkg.files).toContain('dist/');
  });

  it('includes README.md in the files array', () => {
    expect(pkg.files).toContain('README.md');
  });
});

// ---------------------------------------------------------------------------
// B3: `bin` field points to dist/index.js
// ---------------------------------------------------------------------------

describe('package.json -- bin entry point (B3)', () => {
  it('has a bin field with the chromato key', () => {
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin.chromato).toBeDefined();
  });

  it('bin.chromato points to dist/index.js', () => {
    expect(pkg.bin.chromato).toBe('dist/index.js');
  });
});

// ---------------------------------------------------------------------------
// B4: homepage and bugs are configured
// ---------------------------------------------------------------------------

describe('package.json -- npm page quality fields (B4)', () => {
  it('has a homepage field', () => {
    expect(typeof pkg.homepage).toBe('string');
    expect(pkg.homepage.length).toBeGreaterThan(0);
  });

  it('has a bugs.url field', () => {
    expect(pkg.bugs).toBeDefined();
    expect(typeof pkg.bugs.url).toBe('string');
    expect(pkg.bugs.url.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// B5: Runtime dependencies are in `dependencies` (not devDependencies)
// ---------------------------------------------------------------------------

describe('package.json -- runtime dependency placement (B5)', () => {
  // node-notifier removed per ADR-010 (native osascript / notify-send instead)
  const REQUIRED_RUNTIME_DEPS = ['chalk', 'commander', 'ink', 'react', 'better-sqlite3'];

  for (const dep of REQUIRED_RUNTIME_DEPS) {
    it(`"${dep}" is listed in dependencies (not devDependencies)`, () => {
      expect(pkg.dependencies[dep]).toBeDefined();
      expect(pkg.devDependencies?.[dep]).toBeUndefined();
    });
  }
});
