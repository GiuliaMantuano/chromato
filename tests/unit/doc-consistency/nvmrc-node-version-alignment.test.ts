/**
 * Regression guard: .nvmrc's major Node version must match the project's
 * declared floor (package.json engines.node) and the CI runtime (NODE_VERSION
 * in ci.yml).
 *
 * MED-2 (2026-07-06 security review): .nvmrc pinned v24.13.0 while
 * engines.node/CI both floor on Node 22 -- meaning local dev/verify could run
 * on a different Node major than CI enforces, so a Node-22-specific
 * incompatibility might never surface locally. This test guards the MAJOR
 * version only (not exact patch) -- that's the level at which the drift was
 * actually reported and where mismatches matter for ABI/runtime behavior.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..', '..');

function majorVersion(raw: string): number {
  const match = raw.match(/(\d+)/);
  if (!match) {
    throw new Error(`Could not parse a major version out of "${raw}"`);
  }
  return Number(match[1]);
}

describe('.nvmrc Node version alignment with engines.node and CI (MED-2)', () => {
  it('major version matches package.json engines.node floor and ci.yml NODE_VERSION', () => {
    const nvmrc = readFileSync(join(projectRoot, '.nvmrc'), 'utf8').trim();
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    const ci = readFileSync(join(projectRoot, '.github/workflows/ci.yml'), 'utf8');

    const nvmrcMajor = majorVersion(nvmrc);

    const enginesNode: string | undefined = pkg.engines?.node;
    expect(enginesNode).toBeDefined();
    const enginesMajor = majorVersion(enginesNode as string);

    const ciMatch = ci.match(/NODE_VERSION:\s*'(\d+)'/);
    expect(ciMatch).not.toBeNull();
    const ciMajor = Number(ciMatch![1]);

    expect(nvmrcMajor).toBe(enginesMajor);
    expect(nvmrcMajor).toBe(ciMajor);
  });

  it('docs/howto/testing-locally.md quotes the exact version pinned in .nvmrc, not a stale one', () => {
    const nvmrcVersion = readFileSync(join(projectRoot, '.nvmrc'), 'utf8').trim().replace(/^v/, '');
    const guide = readFileSync(join(projectRoot, 'docs/howto/testing-locally.md'), 'utf8');

    // Both call-out lines quote the exact .nvmrc version (prerequisites blurb
    // and the nvm-not-found troubleshooting PATH hint) -- each must match the
    // real .nvmrc value, not a version left behind from a prior bump. The
    // prerequisites blurb deliberately says "floor version", not "exact
    // version CI uses" -- CI's NODE_VERSION floats to the latest 22.x, so
    // claiming .nvmrc pins what CI runs would overclaim precision the same
    // way the original MED-2 wording did.
    expect(guide).toContain(`.nvmrc\` pins the project's floor version, v${nvmrcVersion}`);
    expect(guide).toContain(`/.nvm/versions/node/v${nvmrcVersion}/bin`);
  });
});
