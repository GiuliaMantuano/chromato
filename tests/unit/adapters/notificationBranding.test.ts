/**
 * Unit tests: NotificationAdapter branded delivery — notification-branding
 * US-NB-01 / US-NB-03 / US-NB-04 / US-NB-05.
 *
 * Architecture: NotificationAdapter is the driven-external port for OS desktop
 * notifications. Per the ATDD Infrastructure Policy + Architecture of Reference,
 * it is FAKED via the injected CommandRunner seam (FakeCommandRunner) — tests
 * assert the COMMAND + ARGS captured (the notification payload: command, title,
 * body, icon arg), NEVER the OS-rendered card (SC-01, D3). This is an in-process
 * vitest harness; a subprocess could not observe the payload.
 *
 * Delivery is PLATFORM-GATED under ADR-016 Option C (NOT an availability probe —
 * AC-NB-01.1/01.2 RETIRED, see design/upstream-changes.md (e)):
 *   - Linux  (process.platform === 'linux', DISPLAY set) → notify-send -i <icon>
 *   - macOS  (process.platform === 'darwin')             → osascript, NO icon arg
 *   - headless / NODE_ENV=test / unsupported             → bell, no spawn
 *
 * The adapter takes resolved copy numbers via constructor (decision 7). The exact
 * constructor signature is the crafter's choice; these tests pass numbers first,
 * runner second (the contract these specs commit to).
 *
 * RED classification (against current adapter + RED scaffolds):
 *   - copy assertions: MISSING_FUNCTIONALITY (current adapter uses phaseLabel, not D3)
 *   - constructor(numbers, runner): MISSING_FUNCTIONALITY (current ctor is (runner?))
 *   - notify-send -i <icon>: MISSING_FUNCTIONALITY (current Linux branch has no -i)
 *   - notifySessionComplete: MISSING_FUNCTIONALITY (RED scaffold throws)
 *
 * Specs run RED against the scaffold (Mandate-7 RED-against-scaffold preferred over
 * it.skip for vitest); DELIVER implements to GREEN.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotificationAdapter,
  type CommandRunner,
} from '../../../src/adapters/notificationAdapter.js';
import type { NotificationCopyNumbers } from '../../../src/domain/notificationCopy.js';

interface CommandCall {
  command: string;
  args: string[];
}

class FakeCommandRunner implements CommandRunner {
  readonly calls: CommandCall[] = [];
  nextExitCode = 0;
  shouldThrow = false;

  async run(command: string, args: string[]): Promise<{ exitCode: number }> {
    this.calls.push({ command, args });
    if (this.shouldThrow) {
      throw new Error('spawn error: ENOENT');
    }
    return { exitCode: this.nextExitCode };
  }
}

// Resolved copy numbers — the PRECONDITION (input state), never the expected output.
const NUMBERS: NotificationCopyNumbers = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cycleCount: 4,
};

// The adapter is constructed with (numbers, runner). DELIVER owns the precise
// signature; if the crafter chooses a different order, these helper calls are the
// single place to adjust. `as never` mirrors the existing seam-test style while the
// constructor signature is being introduced.
function makeAdapter(runner: CommandRunner): NotificationAdapter {
  return new NotificationAdapter(NUMBERS as never, runner as never);
}

function captureStderr(): { hasBell: () => boolean; restore: () => void } {
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  return {
    hasBell: () => spy.mock.calls.some((args) => String(args[0]).includes('\x07')),
    restore: () => spy.mockRestore(),
  };
}

const settle = () => new Promise((r) => setTimeout(r, 10));

// ---------------------------------------------------------------------------
// Linux delivery: notify-send with branded copy + -i <icon> (AC-NB-01.3, AC-NB-03.1a)
// ---------------------------------------------------------------------------

describe('NotificationAdapter — Linux notify-send branded delivery (US-NB-01 / US-NB-03)', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    process.env['DISPLAY'] = ':0';
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    delete process.env['DISPLAY'];
    vi.restoreAllMocks();
  });

  // AC-NB-03.1a — Linux: notify-send invoked with -i <timer-ring icon path>
  it('attaches the timer-ring icon via -i on the notify-send path', async () => {
    const runner = new FakeCommandRunner();
    makeAdapter(runner).notifyPhaseChange('WORK', 'BREAK');
    await settle();

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('notify-send');
    const args = runner.calls[0]!.args;
    const iconFlagIndex = args.indexOf('-i');
    expect(iconFlagIndex).toBeGreaterThanOrEqual(0);
    expect(args[iconFlagIndex + 1]).toMatch(/icon-timer-ring\.png$/);
  });

  // AC-NB-02.1 (Linux path) — branded warm copy in the notify-send title/body args
  it('passes branded warm copy as notify-send title + body args (WORK to short BREAK)', async () => {
    const runner = new FakeCommandRunner();
    makeAdapter(runner).notifyPhaseChange('WORK', 'BREAK');
    await settle();

    const args = runner.calls[0]!.args;
    // title + body are present as args[] (the exact positions are the crafter's
    // detail; assert presence as separate, unescaped args — notify-send uses
    // execFile args[], so NO shell escaping is applied here, per C-NB-3 / HIGH-3).
    expect(args).toContain('Pomodoro complete 🍅');
    expect(args).toContain('Nice focus. Take 5.');
  });

  // AC-NB-03.2 — one static icon across moments (Scenario-Outline shape over the icon path)
  it.each([
    ['WORK', 'BREAK'],
    ['BREAK', 'WORK'],
    ['WORK', 'LONG_BREAK'],
    // LONG_BREAK→WORK is a real PomodoroPhase transition: the "Break → Work" moment
    // is break-agnostic (any break ending → back to work uses the same icon/copy).
    ['LONG_BREAK', 'WORK'],
  ] as const)('uses the same single icon asset for the %s to %s moment', async (from, to) => {
    const runner = new FakeCommandRunner();
    makeAdapter(runner).notifyPhaseChange(from, to);
    await settle();

    const args = runner.calls[0]!.args;
    const icon = args[args.indexOf('-i') + 1];
    expect(icon).toMatch(/icon-timer-ring\.png$/);
  });
});

// ---------------------------------------------------------------------------
// macOS delivery: osascript with branded copy, NO icon arg (AC-NB-03.1b, AC-NB-03.3)
// ---------------------------------------------------------------------------

describe('NotificationAdapter — macOS osascript branded copy, no icon (US-NB-01 / US-NB-03)', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  // AC-NB-03.1b — macOS: osascript with branded copy, NO custom-icon argument
  it('invokes osascript with branded copy and sets no icon argument', async () => {
    const runner = new FakeCommandRunner();
    makeAdapter(runner).notifyPhaseChange('WORK', 'BREAK');
    await settle();

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('osascript');
    const joined = runner.calls[0]!.args.join(' ');
    expect(joined).toContain('display notification');
    expect(joined).toContain('Pomodoro complete'); // branded title present
    expect(joined).toContain('Nice focus. Take 5.'); // branded body present
    // osascript cannot set a custom app icon — no icon flag/path on this path
    expect(joined).not.toContain('-i');
    expect(joined).not.toMatch(/icon-timer-ring\.png/);
  });

  // AC-NB-02.4 (macOS path) — OVERDUE warm copy
  it('invokes osascript with the warm OVERDUE copy', async () => {
    const runner = new FakeCommandRunner();
    makeAdapter(runner).notifyOverdue();
    await settle();

    const joined = runner.calls[0]!.args.join(' ');
    expect(joined).toContain('Break ran over');
    expect(joined).toContain('Ready to focus again?');
  });

  // AC-NB-02.6 — OVERDUE may fire twice (activation + 60s milestone); the second
  // fire uses the SAME branded copy and does not crash. (SessionService B9/B10
  // cover that it fires twice; this asserts both fires carry identical branded copy.)
  it('uses the same branded copy and does not crash when overdue fires twice', async () => {
    const runner = new FakeCommandRunner();
    const adapter = makeAdapter(runner);

    expect(() => {
      adapter.notifyOverdue();
      adapter.notifyOverdue();
    }).not.toThrow();
    await settle();

    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[0]!.args.join(' ')).toBe(runner.calls[1]!.args.join(' '));
    expect(runner.calls[0]!.args.join(' ')).toContain('Break ran over');
  });
});

// ---------------------------------------------------------------------------
// Headless / test environment: bell, no spawn (AC-NB-01.4)
// ---------------------------------------------------------------------------

describe('NotificationAdapter — headless/test bell (US-NB-01)', () => {
  let origNodeEnv: string | undefined;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    vi.restoreAllMocks();
  });

  it('emits a bell and spawns no command in a test environment', async () => {
    const runner = new FakeCommandRunner();
    const { hasBell, restore } = captureStderr();
    makeAdapter(runner).notifyPhaseChange('WORK', 'BREAK');
    await settle();

    expect(hasBell()).toBe(true);
    expect(runner.calls).toHaveLength(0);
    restore();
  });
});

// ---------------------------------------------------------------------------
// Never-crash fallback: error/non-zero/ENOENT → bell, no throw (SC-05, AC-NB-01.5, NFR-01)
// ---------------------------------------------------------------------------

describe('NotificationAdapter — never-crash error degradation (SC-05 / NFR-01)', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  it('falls back to a bell when the delivery command exits non-zero', async () => {
    const runner = new FakeCommandRunner();
    runner.nextExitCode = 1;
    const { hasBell, restore } = captureStderr();

    makeAdapter(runner).notifyPhaseChange('WORK', 'BREAK');
    await settle();

    expect(hasBell()).toBe(true);
    restore();
  });

  it('falls back to a bell and never throws when the spawn errors (ENOENT)', async () => {
    const runner = new FakeCommandRunner();
    runner.shouldThrow = true;
    const { hasBell, restore } = captureStderr();

    // The call is fire-and-forget (.catch → bell); it must not throw synchronously
    // and no unhandled rejection escapes.
    expect(() => makeAdapter(runner).notifyPhaseChange('WORK', 'BREAK')).not.toThrow();
    await settle();

    expect(hasBell()).toBe(true);
    restore();
  });
});

// ---------------------------------------------------------------------------
// Injection safety: osascript path escapes quotes; notify-send args[] is NOT escaped
// (C-NB-3 / review H3)
// ---------------------------------------------------------------------------

describe('NotificationAdapter — AppleScript injection safety (C-NB-3 / H3)', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    vi.restoreAllMocks();
    vi.unmock('../../../src/domain/notificationCopy.js');
    vi.resetModules();
  });

  // NON-VACUOUS escaping enforcement (C-NB-3 / HIGH-3). We FORCE a double-quote
  // into the resolved copy by overriding the copy module, drive the macOS osascript
  // path, and assert that every " in dynamic content is backslash-escaped before it
  // reaches the `display notification "…"` literal — i.e. escapeForAppleScript runs
  // on the osascript path. With the override returning a title/body that CONTAIN ",
  // the escaped form (\") MUST appear in the serialised args, and the raw content
  // quote must NOT appear unescaped. This is the dynamic-injection surface: runtime
  // copy must never break out of the AppleScript string literal.
  //
  // This asserts escaping on the osascript path ONLY. The notify-send path uses
  // execFile args[] (no shell), so it must NOT escape — there is no escaping
  // assertion on that path (S11 asserts notify-send args are UNescaped).
  it('escapes every double-quote in resolved copy on the osascript path', async () => {
    // Force a quote-bearing copy through resolveCopy (the injected numbers→copy seam).
    // Documented-safe sequence: resetModules() FIRST (clear the module cache), then
    // doMock() (register the override), then dynamic import() (resolves against the
    // mock). D3 hardening — same teeth, more robust ordering.
    vi.resetModules();
    vi.doMock('../../../src/domain/notificationCopy.js', async (importOriginal) => {
      const actual = await importOriginal<
        typeof import('../../../src/domain/notificationCopy.js')
      >();
      return {
        ...actual,
        resolveCopy: () => ({ title: 'Test "x"', body: 'a "b" c' }),
      };
    });
    const { NotificationAdapter: AdapterWithMockedCopy } = await import(
      '../../../src/adapters/notificationAdapter.js'
    );

    const runner = new FakeCommandRunner();
    new AdapterWithMockedCopy(NUMBERS as never, runner as never).notifyPhaseChange('WORK', 'BREAK');
    await settle();

    // Capture guard (mirrors S11/S13): once the 2-arg ctor (numbers, runner) is
    // honored and resolveCopy is wired, the osascript command is captured. Against
    // the current scaffold this is length 0 (ctor not yet 2-arg) → MISSING_FUNCTIONALITY,
    // the same right-reason RED as the other capturing specs (never a TypeError).
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('osascript');
    const joined = runner.calls[0]!.args.join(' ');

    // Teeth: the escaped form of every content quote is present …
    expect(joined).toContain('Test \\"x\\"'); // title quotes escaped
    expect(joined).toContain('a \\"b\\" c'); // body quotes escaped
    // … and no bare content quote survives unescaped. The only unescaped " allowed
    // are the literal's own delimiters. A well-formed two-literal command —
    // `display notification "<body>" with title "<title>"` — has exactly FOUR bare
    // delimiter quotes: an opening + closing quote around each of the two string
    // literals. Strip every escaped quote (\"), then the bare quotes that remain
    // must be exactly those four delimiters and nothing more (no content quote
    // leaked out unescaped). Counting only the two OPENING delimiters would be
    // arithmetically unsatisfiable (the two closing delimiters always remain), so
    // we account for opener + closer per literal.
    const withoutEscaped = joined.replace(/\\"/g, ''); // remove escaped quotes
    const openingDelimiters = (joined.match(/(?:display notification |with title )"/g) ?? [])
      .length;
    const expectedDelimiterQuotes = openingDelimiters * 2; // each literal: one open + one close
    const remainingBareQuotes = (withoutEscaped.match(/"/g) ?? []).length;
    expect(openingDelimiters).toBe(2); // two string literals on the osascript path
    expect(remainingBareQuotes).toBe(expectedDelimiterQuotes); // exactly the 4 delimiters, no leaked content quote

    // Structural guard (kept): the osascript expression is well-formed.
    expect(joined).toContain('display notification "');
  });
});

// ---------------------------------------------------------------------------
// Session-complete payload through the adapter (US-NB-04 — AC-NB-04.1/04.2)
// ---------------------------------------------------------------------------

describe('NotificationAdapter — session-complete delivery (US-NB-04)', () => {
  let origNodeEnv: string | undefined;
  let origPlatform: string;

  beforeEach(() => {
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    vi.restoreAllMocks();
  });

  // AC-NB-04.1 — session-complete fires with the focused-minutes copy
  it('invokes osascript with "Session complete" / "100 min focused. Well done."', async () => {
    const runner = new FakeCommandRunner();
    makeAdapter(runner).notifySessionComplete(100);
    await settle();

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]!.command).toBe('osascript');
    const joined = runner.calls[0]!.args.join(' ');
    expect(joined).toContain('Session complete');
    expect(joined).toContain('100 min focused. Well done.');
  });

  // AC-NB-04.2 — focused minutes are dynamic
  it('reflects a 50-minute session in the body', async () => {
    const runner = new FakeCommandRunner();
    makeAdapter(runner).notifySessionComplete(50);
    await settle();

    expect(runner.calls[0]!.args.join(' ')).toContain('50 min focused. Well done.');
  });
});
