import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CI_FILE = join(process.cwd(), '.github/workflows/ci.yml');
const ADR_FILE = join(process.cwd(), 'docs/adrs/ADR-021-ci-vulnerability-scanning.md');

describe('ADR-021 trivy-action pinning consistency', () => {
  it('ADR-021 describes the actual mobile-tag pinning convention, not a stale SHA claim', () => {
    const ci = readFileSync(CI_FILE, 'utf-8');
    const adr = readFileSync(ADR_FILE, 'utf-8');

    const match = ci.match(/aquasecurity\/trivy-action@(\S+)/);
    expect(match).not.toBeNull();
    const actualRef = match![1];

    // The actual ref must stay a mobile version tag, matching the convention
    // every other action in this workflow already uses (none are SHA-pinned).
    expect(actualRef).toMatch(/^v\d+\.\d+\.\d+$/);

    // ADR-021 must describe the SAME tag, and must never re-claim SHA-pinning
    // (which was never implemented and would misrepresent the actual mechanism).
    expect(adr).toContain(actualRef);
    expect(adr.toLowerCase()).not.toContain('pinned to a full sha');
  });
});
