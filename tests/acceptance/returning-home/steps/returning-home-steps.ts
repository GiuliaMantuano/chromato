/**
 * Step definitions for returning-home acceptance scenarios (subprocess harness).
 *
 * Driving port: the chromato CLI, invoked via subprocess (spawnSync). No imports
 * from src/* — the only seams are the real config.json on disk and the process I/O.
 *
 * Coverage scope: the guard truth-table (observed at the bare-`chromato` port),
 * --help isolation, the corrupt-config fallback, `chromato start` unchanged, and
 * recap fidelity (rendered stdout). The keypress-driven menu transitions
 * (home-interaction.feature, tagged @ink-testing @skip) are NOT handled here — a
 * spawned process has no raw-mode TTY stdin; DELIVER implements them via
 * ink-testing-library against the HomeAdapter / HomeChoice seam.
 *
 * State preconditions ("a saved setup …") are seeded by writing config.json
 * DIRECTLY (world.seedConfig) — NOT via any not-yet-implemented adapter — so these
 * scenarios fail at the assertion (MISSING_FUNCTIONALITY), never at setup.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { strict as assert } from 'node:assert';
import type { ReturningHomeWorld } from './world.js';

// Strip SGR colour sequences so label+value content can be matched across the
// colour spans the recap renders them in. The recap emits each row as
// "<label>\x1b[39m \x1b[38;2;r;g;bm<value>\x1b[39m"; the ESC sequences sit
// BETWEEN label and value, so a `label\s+value` regex on RAW stdout never
// matches. The vitest equivalent (tests/unit/adapters/homeAdapter.render.test.ts)
// uses the SAME SGR-strip on rendered frames and passes — the adapter is correct.
// Mirrors that helper's pattern (/\x1b\[[0-9;]*m/g) exactly: SGR-only, so raw
// gradient-SGR assertions (logo/swatch/work colour) keep matching unstripped.
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Palette WORK foreground truecolor SGR fragments (from src/domain/palette.ts).
const WORK_SGR: Record<string, string> = {
  berry: '38;2;244;166;200', // #f4a6c8
  forest: '38;2;163;205;126', // #a3cd7e
  lavender: '38;2;200;169;240', // #c8a9f0
  ocean: '38;2;77;184;232', // #4db8e8
};

// First gradient stop per theme (light end, index 0) — used to assert the logo /
// swatch are rendered in the SAVED theme's gradient (K7 / F1: getPalette().gradient).
const GRADIENT_HEAD_SGR: Record<string, string> = {
  berry: '38;2;255;227;239', // #ffe3ef
  forest: '38;2;219;238;198', // #dbeec6
  lavender: '38;2;236;228;255', // #ece4ff
  ocean: '38;2;216;240;255', // #d8f0ff
};

function run(
  world: ReturningHomeWorld,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
  stdin?: string,
): void {
  const argv = world.chromatoBin.endsWith('.ts')
    ? ['--import', 'tsx', world.chromatoBin, ...args]
    : [world.chromatoBin, ...args];
  const start = Date.now();
  const res = spawnSync('node', argv, {
    // FORCE_COLOR=3 makes chalk emit truecolor SGR on the piped (non-TTY) stdout
    // of this spawned process — the subprocess analogue of a real user's colour
    // TTY. extraEnv may override it (NO_COLOR / --no-color suppress colour).
    env: { FORCE_COLOR: '3', ...world.chromatoEnv, ...extraEnv },
    input: stdin ?? '',
    encoding: 'utf8',
    timeout: 10_000,
  });
  world.elapsedMs = Date.now() - start;
  world.capturedOutput = res.stdout ?? '';
  world.capturedStderr = res.stderr ?? '';
  world.exitCode = res.status;
}

function cmdToArgs(cmd: string): string[] {
  const rest = cmd.replace(/^chromato\s*/, '').trim();
  return rest ? rest.split(/\s+/) : [];
}

// ── Background / Givens ─────────────────────────────────────────────────────

Given('chromato is installed for the home screen', function (this: ReturningHomeWorld) {
  assert.ok(fs.existsSync(this.chromatoBin), `chromato entry point missing: ${this.chromatoBin}`);
});

Given('no saved setup exists', function (this: ReturningHomeWorld) {
  if (fs.existsSync(this.configFilePath)) fs.rmSync(this.configFilePath);
});

Given(
  'a saved setup with theme {string}, work {int}, break {int}, cycles {int}, long break {int}, notifications {word}',
  function (
    this: ReturningHomeWorld,
    theme: string,
    work: number,
    brk: number,
    cycles: number,
    longBreak: number,
    notifications: string,
  ) {
    this.seedConfig({
      palette: theme,
      work,
      break: brk,
      longBreak,
      cycles,
      notifications: notifications.toLowerCase() === 'on',
    });
  },
);

Given('a corrupt saved config exists', function (this: ReturningHomeWorld) {
  this.seedCorruptConfig();
});

// The composition root passes `process.stdout.isTTY || chalk.level > 0` as the
// guard's isTTY (colour-interactive surrogate). In this spawned harness stdout is
// a pipe (non-TTY, isTTY arm false), so FORCE_COLOR=3 exercises the chalk.level>0
// ARM of that OR — the colour-interactive surrogate that makes the guard render.
// The literal process.stdout.isTTY arm is NOT exercised here (no real TTY in a
// subprocess); it is covered by the shouldShowHome unit tests (homeGuard.test.ts).
// This step therefore proves the colour-interactive guard arm + the full feature
// flow end-to-end, NOT the stdout.isTTY input itself.
Given('the terminal is interactive with colour support', function (this: ReturningHomeWorld) {
  this.chromatoEnv = { ...this.chromatoEnv, FORCE_COLOR: '3' };
  delete this.chromatoEnv.NO_COLOR;
});

Given('the terminal is running inside tmux', function (this: ReturningHomeWorld) {
  this.chromatoEnv = { ...this.chromatoEnv, TMUX: '/tmp/tmux-1000/default,1234,0' };
});

Given('the terminal is not running inside tmux', function (this: ReturningHomeWorld) {
  delete this.chromatoEnv.TMUX;
});

// ── Whens ───────────────────────────────────────────────────────────────────

// Non-interactive context → extra env / argv. spawnSync stdin is always non-TTY,
// so "piped standard input" models a real `chromato | cat`: stdout is a pipe and
// chalk gets no colour. The harness default FORCE_COLOR=3 is the colour-TTY
// surrogate for POSITIVE scenarios; the piped-input NEGATIVE context must NOT
// inherit it, else chalk.level > 0 makes the guard's colour-TTY surrogate true
// and the home renders when it must not (mirrors the wizard harness, which keeps
// FORCE_COLOR off its non-interactive contexts). FORCE_COLOR=0 forces chalk.level
// to 0 → surrogate false → home hidden. The other rows suppress independently of
// colour (NO_COLOR via env, CI via the CI guard, --no-color via argv).
const CONTEXT_ENV: Record<string, NodeJS.ProcessEnv> = {
  'piped standard input': { FORCE_COLOR: '0' },
  'NO_COLOR set': { NO_COLOR: '1' },
  'CI set': { CI: 'true' },
  'the --no-color flag': {},
};
const CONTEXT_ARGS: Record<string, string[]> = {
  'the --no-color flag': ['--no-color'],
};

When(
  'the returning user runs {string} with no subcommand',
  function (this: ReturningHomeWorld, _cmd: string) {
    run(this, []);
  },
);

When(
  'the returning user runs {string} with {string}',
  function (this: ReturningHomeWorld, cmd: string, context: string) {
    const env = CONTEXT_ENV[context];
    assert.ok(env !== undefined, `unknown context "${context}"`);
    run(this, [...cmdToArgs(cmd), ...(CONTEXT_ARGS[context] ?? [])], env);
  },
);

When('the returning user runs {string}', function (this: ReturningHomeWorld, cmd: string) {
  run(this, cmdToArgs(cmd));
});

When(
  'the returning user runs {string} with a {int}-minute work duration',
  function (this: ReturningHomeWorld, _cmd: string, minutes: number) {
    run(this, ['start', '--work', String(minutes)]);
  },
);

// ── Thens ─────────────────────────────────────────────────────────────────────

// The welcome-back recap is the home screen's signature line (AC-RH-02.2 copy,
// adopted verbatim from the prototype).
Then('the welcome-back recap is shown', function (this: ReturningHomeWorld) {
  assert.ok(
    this.capturedOutput.includes("Welcome back. Here's your setup:"),
    `expected the welcome-back recap; got:\n${this.capturedOutput}`,
  );
});

Then('the welcome-back recap is not shown', function (this: ReturningHomeWorld) {
  assert.equal(
    this.capturedOutput.includes("Welcome back. Here's your setup:"),
    false,
    `the home screen rendered in a context where it must not:\n${this.capturedOutput}`,
  );
});

// The plain Commander listing is the fallback the guard-false / corrupt-config
// paths fall through to (the existing help splash content).
Then('the plain command listing is shown instead', function (this: ReturningHomeWorld) {
  assert.ok(
    /Usage:|Commands:|chromato start/.test(this.capturedOutput),
    `expected the plain command listing; got:\n${this.capturedOutput}`,
  );
});

Then('the full command listing is shown', function (this: ReturningHomeWorld) {
  assert.ok(
    /Usage:|Commands:|chromato start/.test(this.capturedOutput),
    `expected the full command listing; got:\n${this.capturedOutput}`,
  );
});

Then('the recap shows the theme name {string}', function (this: ReturningHomeWorld, label: string) {
  assert.ok(
    stripAnsi(this.capturedOutput).includes(label),
    `expected theme label "${label}" in recap`,
  );
});

Then('the recap shows the timing {string}', function (this: ReturningHomeWorld, timing: string) {
  assert.ok(
    stripAnsi(this.capturedOutput).includes(timing),
    `expected timing "${timing}" in recap`,
  );
});

Then(
  'the recap shows the long break {string}',
  function (this: ReturningHomeWorld, longBreak: string) {
    // The recap row renders "long break 15m" (prototype: `long break ${t.long}m`).
    const re = new RegExp(`long break\\s+${longBreak.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    assert.ok(
      re.test(stripAnsi(this.capturedOutput)),
      `expected long break "${longBreak}" in recap`,
    );
  },
);

Then('the recap shows notifications {string}', function (this: ReturningHomeWorld, value: string) {
  // Match "Notifications  Banner + bell" / "Notifications  Off" — the recap row
  // label + value. The label and value render in separate colour spans, so strip
  // SGR first. Mode labels (DDD-10) can contain regex-special characters (e.g.
  // "Banner + bell"), so the value must be escaped before building the RegExp —
  // same escaping pattern as the long-break step above.
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`Notifications\\s+${escaped}\\b`);
  assert.ok(re.test(stripAnsi(this.capturedOutput)), `expected notifications "${value}" in recap`);
});

Then('the footer note shows the resolved config file path', function (this: ReturningHomeWorld) {
  // The footer renders "Settings live in <abs path>/config.json"; at COLUMNS=80
  // the long temp path wraps across a newline, so `.*` must span line breaks (s flag).
  assert.ok(
    /Settings live in .*config\.json/s.test(stripAnsi(this.capturedOutput)),
    `expected the footer config-path note; got:\n${this.capturedOutput}`,
  );
});

Then(
  'the logo is rendered in the {word} gradient',
  function (this: ReturningHomeWorld, theme: string) {
    const head = GRADIENT_HEAD_SGR[theme];
    assert.ok(head, `unknown theme ${theme}`);
    assert.ok(
      this.capturedOutput.includes(head),
      `expected ${theme} gradient head SGR ${head} in logo`,
    );
  },
);

Then(
  'the swatch colours match the {word} gradient',
  function (this: ReturningHomeWorld, theme: string) {
    const head = GRADIENT_HEAD_SGR[theme];
    assert.ok(head, `unknown theme ${theme}`);
    assert.ok(this.capturedOutput.includes(head), `expected ${theme} swatch gradient SGR ${head}`);
  },
);

Then(
  'the started session is rendered in the {word} work colour',
  function (this: ReturningHomeWorld, theme: string) {
    const sgr = WORK_SGR[theme];
    assert.ok(sgr, `unknown theme ${theme}`);
    assert.ok(this.capturedOutput.includes(sgr), `expected ${theme} WORK SGR ${sgr} in output`);
  },
);

Then('a tmux row is shown in the recap', function (this: ReturningHomeWorld) {
  assert.ok(/tmux/i.test(stripAnsi(this.capturedOutput)), `expected a tmux row in the recap`);
});

Then('no tmux row is shown in the recap', function (this: ReturningHomeWorld) {
  assert.equal(
    /tmux/i.test(stripAnsi(this.capturedOutput)),
    false,
    `unexpected tmux row in the recap`,
  );
});

Then(
  'no {string} error appears on the home path',
  function (this: ReturningHomeWorld, errText: string) {
    assert.equal(
      (this.capturedOutput + this.capturedStderr).includes(errText),
      false,
      `unexpected "${errText}" error`,
    );
  },
);

Then(
  'the help output completes within {int} milliseconds on the home path',
  function (this: ReturningHomeWorld, ms: number) {
    assert.ok(this.elapsedMs < ms, `help took ${this.elapsedMs}ms (budget ${ms}ms)`);
  },
);

Then('the home process exits with code {int}', function (this: ReturningHomeWorld, code: number) {
  assert.equal(this.exitCode, code, `stderr: ${this.capturedStderr}`);
});
