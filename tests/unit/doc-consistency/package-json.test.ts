/**
 * Regression guards: package.json release configuration
 *
 * Step 01-01: Verify correct release values are present
 *
 * These tests assert the correct values for the public release fields in
 * package.json. They must FAIL against the stale pre-fix values and PASS
 * after the fix is applied in step 01-02.
 *
 * Behaviors validated:
 *   B1: version is the GA release version "1.0.0"
 *   B2: repository.url points to the correct GitHub owner (GiuliaMantuano)
 *   B3: homepage points to the correct GitHub owner (GiuliaMantuano)
 *   B4: bugs.url points to the correct GitHub owner (GiuliaMantuano)
 *   B5: files array includes CHANGELOG.md for npm tarball completeness
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..', '..');
const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

// ---------------------------------------------------------------------------
// B1: version is the GA release version
// ---------------------------------------------------------------------------

describe('package.json -- GA release version (B1)', () => {
  it('version is 1.0.0', () => {
    expect(pkg.version).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------
// B2: repository.url points to GiuliaMantuano/chromato
// ---------------------------------------------------------------------------

describe('package.json -- repository URL points to correct owner (B2)', () => {
  it('repository.url contains GiuliaMantuano', () => {
    expect(pkg.repository?.url).toContain('GiuliaMantuano');
  });
});

// ---------------------------------------------------------------------------
// B3: homepage points to GiuliaMantuano/chromato
// ---------------------------------------------------------------------------

describe('package.json -- homepage points to correct owner (B3)', () => {
  it('homepage contains GiuliaMantuano', () => {
    expect(pkg.homepage).toContain('GiuliaMantuano');
  });
});

// ---------------------------------------------------------------------------
// B4: bugs.url points to GiuliaMantuano/chromato/issues
// ---------------------------------------------------------------------------

describe('package.json -- bugs URL points to correct owner (B4)', () => {
  it('bugs.url contains GiuliaMantuano', () => {
    expect(pkg.bugs?.url).toContain('GiuliaMantuano');
  });
});

// ---------------------------------------------------------------------------
// B5: files array includes CHANGELOG.md
// ---------------------------------------------------------------------------

describe('package.json -- files array includes CHANGELOG.md (B5)', () => {
  it('files array includes CHANGELOG.md', () => {
    expect(pkg.files).toContain('CHANGELOG.md');
  });
});
