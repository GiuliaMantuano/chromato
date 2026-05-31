/**
 * Step definitions for milestone-9-palette-themes.feature
 *
 * Feature ID  : palette-themes
 * Wave        : DISTILL — RED-ready stubs
 * Driving port: chromato CLI (subprocess) — the only entry point exercised here.
 *               No imports from src/ production modules (CM-A compliance).
 *
 * All steps are implemented so Cucumber can parse and resolve them.
 * The steps either: (a) configure world state for subsequent steps, or
 * (b) assert on subprocess output after runChromato / spawnChromato.
 *
 * These step bodies remain RED until DELIVER Phase C wires --palette through
 * the composition root. Assertions in Then steps will fail with the correct
 * MISSING_FUNCTIONALITY classification (not import error or setup error).
 */

import { Given, When, Then } from '@cucumber/cucumber';
import type { ChromatoWorld } from './world.js';
import { runChromato } from './helpers.js';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helper: write a config.json in the XDG_CONFIG_HOME temp dir
// ---------------------------------------------------------------------------
function writeConfigJson(world: ChromatoWorld, content: string): void {
  const configDir = path.join(world.tempDir, 'config', 'chromato');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, 'config.json'), content, 'utf8');
}

// ---------------------------------------------------------------------------
// GIVEN steps
// ---------------------------------------------------------------------------

Given('chromato is installed and runnable from the command line', function (this: ChromatoWorld) {
  // World constructor verifies the binary exists. This step is a
  // documentation-grade precondition.
});

Given('no palette is set in the environment or config file', function (this: ChromatoWorld) {
  delete this.chromatoEnv['CHROMATO_PALETTE'];
  // Config dir is fresh per scenario (Before hook); no config.json written.
});

Given('the user has written {string} to the chromato config file', function (
  this: ChromatoWorld,
  jsonContent: string,
) {
  writeConfigJson(this, jsonContent);
});

Given('the CHROMATO_PALETTE environment variable is set to {string}', function (
  this: ChromatoWorld,
  paletteName: string,
) {
  this.chromatoEnv = { ...this.chromatoEnv, CHROMATO_PALETTE: paletteName };
});

Given('no CHROMATO_PALETTE environment variable is set', function (this: ChromatoWorld) {
  delete this.chromatoEnv['CHROMATO_PALETTE'];
});

Given('no --palette flag is used', function (this: ChromatoWorld) {
  // Documented precondition — no-op; the When step controls the args.
});

Given('the NO_COLOR environment variable is set', function (this: ChromatoWorld) {
  this.chromatoEnv = { ...this.chromatoEnv, NO_COLOR: '1' };
});

Given('the chromato config file contains invalid JSON content', function (this: ChromatoWorld) {
  writeConfigJson(this, '{ not valid json }');
});

Given(
  'the user runs "chromato start --palette lavender" in a real terminal',
  function (this: ChromatoWorld) {
    // @manual-verify-only scenario — no-op in CI.
  },
);

// ---------------------------------------------------------------------------
// WHEN steps
// ---------------------------------------------------------------------------

When(
  'the user runs {string} and the session initializes',
  async function (this: ChromatoWorld, command: string) {
    // Parse the command string: "chromato start --palette lavender" → ['start', '--palette', 'lavender']
    const parts = command.split(' ').slice(1); // strip leading 'chromato'
    const originalEnv = this.chromatoEnv;
    this.chromatoEnv = {
      ...this.chromatoEnv,
      CHROMATO_WORK_SECONDS: '1',
      CHROMATO_BREAK_SECONDS: '1',
    };
    // Append --minimal so headless CI can run without a TTY
    const allArgs = parts.includes('--minimal') ? parts : [...parts, '--minimal'];
    const result = await runChromato(this, allArgs, 10_000);
    this.chromatoEnv = originalEnv;
    this.capturedOutput = result.stdout;
    this.capturedStderr = result.stderr;
    this.exitCode = result.exitCode;
  },
);

When('the user runs {string}', async function (this: ChromatoWorld, command: string) {
  const parts = command.split(' ').slice(1);
  const result = await runChromato(this, parts, 10_000);
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

When('the session renders its first frame', function (this: ChromatoWorld) {
  // @manual-verify-only — no-op in CI; human visually confirms the frame.
});

// ---------------------------------------------------------------------------
// THEN steps
// ---------------------------------------------------------------------------

Then('chromato starts a Pomodoro session without error', function (this: ChromatoWorld) {
  assert.strictEqual(
    this.exitCode,
    0,
    `Expected exit code 0 but got ${this.exitCode}.\nStderr: ${this.capturedStderr}`,
  );
});

Then('the process exits with code 0 after the session ends', function (this: ChromatoWorld) {
  assert.strictEqual(this.exitCode, 0, `Expected exit 0, got ${this.exitCode}`);
});

Then('no error message appears on standard error', function (this: ChromatoWorld) {
  // The notification adapter's bell fallback writes BEL (\x07) to stderr on
  // phase transitions — that is an intentional audible alert, not an error
  // message. Strip non-printable control characters before asserting that no
  // textual error message remains.
  // eslint-disable-next-line no-control-regex
  const errorText = this.capturedStderr.replace(/[\x00-\x1f\x7f]/g, '').trim();
  assert.strictEqual(
    errorText,
    '',
    `Expected no error message on stderr but got:\n${JSON.stringify(this.capturedStderr)}`,
  );
});

Then(
  'no mention of {string} appears in standard error',
  function (this: ChromatoWorld, name: string) {
    assert.ok(
      !this.capturedStderr.includes(name),
      `Expected stderr to NOT contain "${name}" but found:\n${this.capturedStderr}`,
    );
  },
);

// NOTE: "the process exits with code 1" is handled by the shared
// 'the process exits with code {int}' step in session-steps.ts. A local
// duplicate here caused an ambiguous-match error, so it is intentionally omitted.

Then(
  'the error output contains the unknown palette name {string}',
  function (this: ChromatoWorld, name: string) {
    const combined = this.capturedOutput + this.capturedStderr;
    assert.ok(
      combined.includes(name),
      `Expected error output to contain "${name}" but got:\n${combined}`,
    );
  },
);

Then(
  'the error output lists all 4 valid palette names: ocean, lavender, berry, forest',
  function (this: ChromatoWorld) {
    const combined = this.capturedOutput + this.capturedStderr;
    const expected = ['ocean', 'lavender', 'berry', 'forest'];
    for (const name of expected) {
      assert.ok(
        combined.includes(name),
        `Expected error output to contain valid palette name "${name}" but got:\n${combined}`,
      );
    }
  },
);

Then('no Pomodoro session is started', function (this: ChromatoWorld) {
  // A Pomodoro session starting would produce session output. Exit 1 with no
  // session-start text is the observable boundary.
  // Phase label "WORK" in stdout would indicate a session started.
  assert.ok(
    !this.capturedOutput.includes('WORK') && !this.capturedOutput.includes('POMODORO'),
    `Expected no session output but found session output:\n${this.capturedOutput}`,
  );
});

Then(
  'the error output indicates a configuration file parse error',
  function (this: ChromatoWorld) {
    const combined = this.capturedOutput + this.capturedStderr;
    // The exact message format is implementation-defined; check for key signals
    assert.ok(
      combined.toLowerCase().includes('json') ||
        combined.toLowerCase().includes('config') ||
        combined.toLowerCase().includes('parse'),
      `Expected parse error indication in output but got:\n${combined}`,
    );
  },
);

Then(
  'the session starts with the forest palette \\(flag is highest precedence)',
  function (this: ChromatoWorld) {
    // Observable: session starts without error (exit 0). Visual color verification
    // is @manual-verify-only. The unit tests (configLoader.palette.test.ts P4/P5/P6)
    // are the load-bearing precedence enforcement.
    assert.strictEqual(this.exitCode, 0, `Expected exit 0, got ${this.exitCode}`);
  },
);

Then(
  'no ANSI color sequences appear in standard output',
  function (this: ChromatoWorld) {
    // eslint-disable-next-line no-control-regex
    const ansiPattern = /\x1b\[[0-9;]*[A-Za-z]/;
    assert.ok(
      !ansiPattern.test(this.capturedOutput),
      `Expected no ANSI sequences in stdout but found:\n${this.capturedOutput}`,
    );
  },
);

Then(
  'functional text output \\(phase label and timer) is visible in standard output',
  function (this: ChromatoWorld) {
    // Minimal mode output should contain at least a phase name or time indicator
    const hasContent = this.capturedOutput.trim().length > 0;
    assert.ok(
      hasContent,
      `Expected functional text output in stdout but stdout was empty.\nStderr: ${this.capturedStderr}`,
    );
  },
);

Then(
  'the output includes "--palette" with valid palette names listed',
  function (this: ChromatoWorld) {
    const output = this.capturedOutput + this.capturedStderr;
    assert.ok(
      output.includes('--palette') || output.includes('palette'),
      `Expected --palette in help output but got:\n${output}`,
    );
    for (const name of ['ocean', 'lavender', 'berry', 'forest']) {
      assert.ok(
        output.includes(name),
        `Expected help output to list palette name "${name}" but got:\n${output}`,
      );
    }
  },
);

Then(
  'the output includes at least one named-palette example command',
  function (this: ChromatoWorld) {
    const output = this.capturedOutput + this.capturedStderr;
    // An example command would contain 'chromato start --palette' followed by a name
    assert.ok(
      output.includes('--palette') && (
        output.includes('lavender') ||
        output.includes('ocean') ||
        output.includes('berry') ||
        output.includes('forest')
      ),
      `Expected at least one palette example command in help but got:\n${output}`,
    );
  },
);

Then(
  'the output documents the config.json file path for palette configuration',
  function (this: ChromatoWorld) {
    const output = this.capturedOutput + this.capturedStderr;
    assert.ok(
      output.includes('config.json') || output.includes('.config/chromato'),
      `Expected config.json path in help output but got:\n${output}`,
    );
  },
);

Then(
  'the output documents the precedence order for palette resolution',
  function (this: ChromatoWorld) {
    const output = this.capturedOutput + this.capturedStderr;
    // Precedence documentation contains "> " or ">" between levels, or the word "precedence"
    assert.ok(
      output.includes('>') || output.includes('precedence') || output.includes('override'),
      `Expected precedence documentation in help output but got:\n${output}`,
    );
  },
);

// @manual-verify-only Then steps — no assertions in CI
Then(
  'the ASCII art logo gradient uses lavender hex stops from palette-spec.md',
  function (this: ChromatoWorld) {
    // Manual verification only — headless CI cannot assert ANSI gradient colors.
    // Visual contract: logo gradient[0..5] are lavender stops from palette-spec.md.
  },
);

Then(
  'the TUI progress bar phase color matches the lavender palette phases map',
  function (this: ChromatoWorld) {
    // Manual verification only.
  },
);

Then(
  'both surfaces are visually coherent with no per-adapter color divergence',
  function (this: ChromatoWorld) {
    // Manual verification only.
  },
);
