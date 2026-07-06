/**
 * CompositeNotificationAdapter fan-out twins — in-terminal-notifications slice-02.
 *
 * Feature ID : in-terminal-notifications
 * Wave       : DELIVER (step 02-04) | Date: 2026-07-05
 * Traceability: DDD-2 (composite fan-out, empty composite = null object)
 *
 * TEST PARADIGM (TS adaptation of the PBT mandate): the fan-out contract is a
 * property — for ANY child list and ANY notification moment, EVERY child
 * receives that moment EXACTLY once, in construction order, with the exact
 * arguments. fast-check is not a project dependency, so the input space is
 * enumerated as a full cross-product test table (child-list sizes 0..3 × the
 * complete 3-method moment universe) — total coverage, zero new dependencies.
 * Size 0 doubles as the null-object contract (well-behaved, no throw, no calls).
 *
 * Test budget: 3 behaviors (in-order fan-out / args fidelity / empty null
 * object) x 2 = 6 max; 1 parametrized property test (12 cases) + 1 named
 * null-object example = within budget.
 *
 * Port boundary (Mandate 1): CompositeNotificationAdapter IS the driven
 * adapter under test; the RecordingPort fakes sit at the NotificationPort
 * boundary exactly where real children (TuiAdapter banner, bell) sit.
 */

import { describe, expect, it } from 'vitest';
import { CompositeNotificationAdapter } from '../../../src/adapters/compositeNotificationAdapter.js';
import type { NotificationPort } from '../../../src/domain/ports.js';
import type { PomodoroPhase } from '../../../src/domain/phase.js';

interface RecordedCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

/** A fake child port: records its own calls AND stamps a shared ordering log. */
class RecordingPort implements NotificationPort {
  readonly calls: RecordedCall[] = [];
  constructor(
    private readonly id: number,
    private readonly orderLog: string[],
  ) {}
  notifyPhaseChange(from: PomodoroPhase, to: PomodoroPhase): void {
    if (!from || !to) {
      throw new Error('phase args must be non-empty (real children rely on them)');
    }
    this.record('notifyPhaseChange', [from, to]);
  }
  notifyOverdue(): void {
    this.record('notifyOverdue', []);
  }
  notifySessionComplete(focusedMinutes: number): void {
    if (!Number.isFinite(focusedMinutes)) {
      throw new Error('focusedMinutes must be a finite number');
    }
    this.record('notifySessionComplete', [focusedMinutes]);
  }
  private record(method: string, args: readonly unknown[]): void {
    this.calls.push({ method, args });
    this.orderLog.push(`child${this.id}:${method}`);
  }
}

/** The FULL NotificationPort moment universe with the exact expected forwarding. */
const MOMENTS: ReadonlyArray<{
  name: string;
  fire: (port: NotificationPort) => void;
  expected: RecordedCall;
}> = [
  {
    name: 'notifyPhaseChange(WORK -> BREAK)',
    fire: (port) => port.notifyPhaseChange('WORK', 'BREAK'),
    expected: { method: 'notifyPhaseChange', args: ['WORK', 'BREAK'] },
  },
  {
    name: 'notifyOverdue()',
    fire: (port) => port.notifyOverdue(),
    expected: { method: 'notifyOverdue', args: [] },
  },
  {
    name: 'notifySessionComplete(42)',
    fire: (port) => port.notifySessionComplete(42),
    expected: { method: 'notifySessionComplete', args: [42] },
  },
];

/** Child-list sizes 0..3 — size 0 is the null object, sizes 1..3 the fan-out. */
const SIZES = [0, 1, 2, 3] as const;

const TABLE = SIZES.flatMap((size) => MOMENTS.map((moment) => ({ size, ...moment })));

describe('CompositeNotificationAdapter — fan-out property (DDD-2)', () => {
  it.each(
    TABLE,
  )('with $size children, $name reaches every child exactly once, in order, with exact args', ({
    size,
    fire,
    expected,
  }) => {
    const orderLog: string[] = [];
    const children = Array.from({ length: size }, (_, id) => new RecordingPort(id, orderLog));
    const composite = new CompositeNotificationAdapter(children);

    fire(composite);

    // Every child received the moment EXACTLY once with the EXACT args…
    for (const child of children) {
      expect(child.calls).toEqual([expected]);
    }
    // …in construction order, one entry per child, nothing extra.
    expect(orderLog).toEqual(
      Array.from({ length: size }, (_, id) => `child${id}:${expected.method}`),
    );
  });

  // Named example (Mandate 11) for the null-object half of DDD-2: the EMPTY
  // composite absorbs a whole session of moments without throwing — it IS the
  // "off" wiring that subsumes NullNotificationAdapter from slice-03 on.
  it('the empty composite is a well-behaved null object across a whole session of moments', () => {
    const composite = new CompositeNotificationAdapter([]);
    expect(() => {
      composite.notifyPhaseChange('WORK', 'BREAK');
      composite.notifyOverdue();
      composite.notifyPhaseChange('OVERDUE', 'WORK');
      composite.notifySessionComplete(50);
    }).not.toThrow();
  });
});
