/**
 * Step definitions for first-run-setup-wizard acceptance scenarios.
 *
 * Driving port: the chromato CLI, invoked via subprocess (spawnSync). No imports
 * from src/* — the only seam is the real config.json on disk and the process I/O.
 *
 * State preconditions ("the wizard has saved X") are seeded by writing config.json
 * DIRECTLY (world.seedConfig) — NOT via the not-yet-implemented ConfigFileWriterAdapter —
 * so these scenarios fail at the assertion (MISSING_FUNCTIONALITY), never at setup.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { strict as assert } from 'node:assert';
import type { SetupWizardWorld } from './world.js';

// Palette WORK foreground truecolor SGR fragments (from src/domain/palette.ts).
const WORK_SGR: Record<string, string> = {
  berry: '38;2;244;166;200', // #f4a6c8
  forest: '38;2;163;205;126', // #a3cd7e
  lavender: '38;2;200;169;240', // #c8a9f0
  ocean: '38;2;77;184;232', // #4db8e8
};

function run(
  world: SetupWizardWorld,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
  stdin?: string,
): void {
  const isTs = world.chromatoBin.endsWith('.ts');
  const cmd = isTs ? 'node' : 'node';
  const argv = isTs
    ? ['--import', 'tsx', world.chromatoBin, ...args]
    : [world.chromatoBin, ...args];
  const start = Date.now();
  const res = spawnSync(cmd, argv, {
    // FORCE_COLOR=3 makes chalk emit truecolor SGR even on the piped (non-TTY)
    // stdout of this spawned process. This is the subprocess analogue of the real
    // user's TTY (where chalk.level defaults to 3 automatically) — legitimate, since
    // a real developer on a real terminal gets colour for free. extraEnv may override
    // it (e.g. NO_COLOR contexts intentionally suppress colour).
    env: { FORCE_COLOR: '3', ...world.chromatoEnv, ...extraEnv },
    input: stdin ?? '', // piped, non-TTY stdin by default
    encoding: 'utf8',
    timeout: 10_000,
  });
  world.elapsedMs = Date.now() - start;
  world.capturedOutput = res.stdout ?? '';
  world.capturedStderr = res.stderr ?? '';
  world.exitCode = res.status;
}

// ── Background / Givens ─────────────────────────────────────────────────────

Given('chromato is installed for the setup wizard', function (this: SetupWizardWorld) {
  assert.ok(fs.existsSync(this.chromatoBin), `chromato entry point missing: ${this.chromatoBin}`);
});

Given('no chromato config file exists yet', function (this: SetupWizardWorld) {
  if (fs.existsSync(this.configFilePath)) fs.rmSync(this.configFilePath);
});

Given('a chromato config file already exists', function (this: SetupWizardWorld) {
  this.seedConfig({ palette: 'ocean' });
});

Given(
  'the setup wizard has saved the theme {string} to the config file',
  function (this: SetupWizardWorld, theme: string) {
    this.seedConfig({ palette: theme });
  },
);

Given(
  'the setup wizard has saved a {int}-minute work duration to the config file',
  function (this: SetupWizardWorld, minutes: number) {
    this.seedConfig({
      palette: 'ocean',
      work: minutes,
      break: 5,
      longBreak: 15,
      cycles: 4,
      notifications: true,
    });
  },
);

Given(
  'the setup wizard has saved a full configuration to the config file',
  function (this: SetupWizardWorld) {
    this.seedConfig({
      palette: 'lavender',
      work: 50,
      break: 10,
      longBreak: 20,
      cycles: 6,
      notifications: true,
    });
  },
);

Given('a corrupted config file exists', function (this: SetupWizardWorld) {
  fs.mkdirSync(path.dirname(this.configFilePath), { recursive: true });
  fs.writeFileSync(this.configFilePath, '{ this is not valid json', 'utf8');
});

Given(
  'the config file names an unknown theme {string}',
  function (this: SetupWizardWorld, theme: string) {
    this.seedConfig({ palette: theme });
  },
);

// ── Whens ───────────────────────────────────────────────────────────────────

When(
  'the developer runs setup-wizard {string} with a {int}-minute work duration',
  function (this: SetupWizardWorld, _cmd: string, minutes: number) {
    run(this, ['start', '--work', String(minutes)]);
  },
);

When(
  'the developer runs {string} with no duration flags',
  function (this: SetupWizardWorld, _cmd: string) {
    run(this, ['start']);
  },
);

When('the developer runs {string} with no flags', function (this: SetupWizardWorld, _cmd: string) {
  run(this, ['start']);
});

// Non-interactive context → extra env. spawnSync stdin is always non-TTY, so
// "piped standard input" needs no extra env; NO_COLOR / CI set their var.
const CONTEXT_ENV: Record<string, NodeJS.ProcessEnv> = {
  'piped standard input': {},
  'NO_COLOR set': { NO_COLOR: '1' },
  'CI set': { CI: 'true' },
};

function cmdToArgs(cmd: string): string[] {
  const rest = cmd.replace(/^chromato\s*/, '').trim();
  return rest ? rest.split(/\s+/) : [];
}

// Quoted context captures the FULL phrase (BL-001 fix): {word} cannot match
// multi-word / punctuated contexts, so the context is a quoted {string}.
When(
  'the developer runs {string} with {string}',
  function (this: SetupWizardWorld, cmd: string, context: string) {
    const env = CONTEXT_ENV[context];
    assert.ok(env !== undefined, `unknown non-interactive context "${context}"`);
    run(this, cmdToArgs(cmd), env);
  },
);

When('the developer runs setup-wizard {string}', function (this: SetupWizardWorld, cmd: string) {
  run(this, cmdToArgs(cmd));
});

// ── Thens ─────────────────────────────────────────────────────────────────────

Then(
  'the rendered output uses the {word} work colour',
  function (this: SetupWizardWorld, theme: string) {
    const sgr = WORK_SGR[theme];
    assert.ok(sgr, `unknown theme ${theme}`);
    assert.ok(this.capturedOutput.includes(sgr), `expected ${theme} WORK SGR ${sgr} in output`);
  },
);

Then('the process starts the session without error', function (this: SetupWizardWorld) {
  assert.equal(
    this.capturedStderr.includes('Error'),
    false,
    `unexpected error: ${this.capturedStderr}`,
  );
});

Then('the setup wizard does not launch', function (this: SetupWizardWorld) {
  // The wizard's welcome marker must be absent (it would only appear on a TTY).
  assert.equal(
    this.capturedOutput.includes("Let's tune chromato"),
    false,
    'wizard launched in a non-interactive context',
  );
});

Then('no {string} error appears', function (this: SetupWizardWorld, errText: string) {
  assert.equal(this.capturedStderr.includes(errText), false, `unexpected error: ${errText}`);
});

Then(
  'the setup-wizard process exits with code {int}',
  function (this: SetupWizardWorld, code: number) {
    assert.equal(this.exitCode, code, `stderr: ${this.capturedStderr}`);
  },
);

Then('the process exits with a non-zero code', function (this: SetupWizardWorld) {
  assert.notEqual(this.exitCode, 0);
});

Then('the help text is shown', function (this: SetupWizardWorld) {
  assert.ok(/Examples:|Usage:|chromato start/.test(this.capturedOutput), 'help text not shown');
});

Then(
  'the help output completes in under {int} milliseconds',
  function (this: SetupWizardWorld, ms: number) {
    assert.ok(this.elapsedMs < ms, `help took ${this.elapsedMs}ms (budget ${ms}ms)`);
  },
);

Then(
  'a message explains that setup needs an interactive terminal',
  function (this: SetupWizardWorld) {
    assert.ok(
      /interactive terminal|requires a TTY|needs a terminal/i.test(
        this.capturedOutput + this.capturedStderr,
      ),
    );
  },
);

Then('the work timer counts down from {string}', function (this: SetupWizardWorld, clock: string) {
  assert.ok(this.capturedOutput.includes(clock), `expected timer ${clock} in output`);
});

Then('chromato reports an error mentioning the config file', function (this: SetupWizardWorld) {
  const out = this.capturedOutput + this.capturedStderr;
  assert.ok(/config/i.test(out), `expected an error mentioning the config file, got: ${out}`);
});

Then(
  'chromato reports an error listing the valid palette names',
  function (this: SetupWizardWorld) {
    const out = this.capturedOutput + this.capturedStderr;
    assert.ok(
      /ocean/.test(out) && /lavender/.test(out),
      `expected valid palette names in error, got: ${out}`,
    );
  },
);

Then(
  'the config file contains valid JSON with the keys palette, work, break, longBreak, cycles, notifications',
  function (this: SetupWizardWorld) {
    const raw = fs.readFileSync(this.configFilePath, 'utf8');
    const parsed = JSON.parse(raw); // throws if invalid
    for (const k of ['palette', 'work', 'break', 'longBreak', 'cycles', 'notifications']) {
      assert.ok(k in parsed, `missing key ${k}`);
    }
  },
);
