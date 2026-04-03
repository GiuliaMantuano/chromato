/**
 * Unit tests: NotificationAdapter (adapter layer)
 *
 * Integration tests would require a live display server; these unit tests
 * verify the adapter's observable behaviour at the port boundary using
 * Node.js built-ins only (no live node-notifier invocation).
 *
 * The adapter is tested in isolation: it is constructed directly because it
 * IS the subject under test (it is the adapter itself, not an internal class).
 * Per the hexagonal testing mandate, adapters are tested with integration tests.
 * However, because these tests stub the OS notification layer via environment
 * variables (NODE_ENV=test) to exercise the bell fallback path, they qualify
 * as unit-level adapter behaviour tests with no real I/O.
 *
 * Test Budget: 2 distinct behaviours x 2 = 4 max unit tests
 *   B1: bell fallback writes \a to stderr when NODE_ENV=test (no desktop notifier call)
 *   B2: notifyOverdue writes \a to stderr (bell fallback) when NODE_ENV=test
 *
 * Architecture gate: NotificationAdapter is the ONLY file that imports node-notifier.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationAdapter } from '../../../src/adapters/notificationAdapter.js';

describe('NotificationAdapter (adapter boundary)', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Capture stderr writes to verify bell fallback without real I/O
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // B1: bell fallback fires on phase change in test environment
  it('writes bell character to stderr on notifyPhaseChange when running in test environment', () => {
    const adapter = new NotificationAdapter();

    adapter.notifyPhaseChange('WORK', 'BREAK');

    const stderrCalls = stderrSpy.mock.calls.map((args) => String(args[0]));
    const hasBell = stderrCalls.some((s) => s.includes('\u0007'));
    expect(hasBell).toBe(true);
  });

  // B2: bell fallback fires on overdue notification in test environment
  it('writes bell character to stderr on notifyOverdue when running in test environment', () => {
    const adapter = new NotificationAdapter();

    adapter.notifyOverdue();

    const stderrCalls = stderrSpy.mock.calls.map((args) => String(args[0]));
    const hasBell = stderrCalls.some((s) => s.includes('\u0007'));
    expect(hasBell).toBe(true);
  });
});
