import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CI_FILE = join(process.cwd(), '.github/workflows/ci.yml');

describe('CI benchmark gate threshold consistency', () => {
  it('CI benchmark gate uses 200ms threshold', () => {
    const content = readFileSync(CI_FILE, 'utf-8');

    const statusBenchmarkSection = content.split('bench_status')[1];
    expect(statusBenchmarkSection).toBeDefined();

    expect(statusBenchmarkSection).toContain('> 200');
    expect(statusBenchmarkSection).toContain('200ms gate');
  });
});
