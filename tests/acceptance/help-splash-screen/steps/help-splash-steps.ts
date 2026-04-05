/**
 * Step definitions for help-splash-screen acceptance tests.
 *
 * Invokes chromato exclusively through the CLI driving port (CM-A compliance).
 * No imports from src/. All assertions operate on observable stdout/stderr
 * output and process exit codes.
 *
 * CRITICAL environment notes:
 * - NODE_ENV='production' is set in world.ts so printBanner() runs (the
 *   function returns early when NODE_ENV==='test').
 * - FORCE_COLOR='2' is set by default in world.ts so Chalk emits ANSI even
 *   when stdout is piped. Steps that test NO_COLOR / plain-text output must
 *   override chromatoEnv before invoking chromato.
 */

import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import type { ChromatoHelpWorld } from './world.js';
import { runChromato, countAnsiSequences, stripAnsi, runChromatoUntilFirstFrame } from './helpers.js';
import * as assert from 'assert';
import * as fs from 'fs';

// Allow up to 15 s per step — process spawning + Node.js cold-start can be slow on CI.
setDefaultTimeout(15_000);

const TAGLINE = 'The Pomodoro timer your terminal deserves';

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

After(async function (this: ChromatoHelpWorld) {
  if (this.process && !this.process.killed) {
    this.process.kill('SIGTERM');
  }
  if (this.tempDir && fs.existsSync(this.tempDir)) {
    fs.rmSync(this.tempDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Given steps
// ---------------------------------------------------------------------------

Given('chromato is built and available', function (this: ChromatoHelpWorld) {
  // Verified in world constructor: chromatoBin is set to dist/index.js or src/index.ts.
  assert.ok(this.chromatoBin, 'chromato entry point must be resolved in world constructor');
});

Given("Kai's terminal has color support enabled", function (this: ChromatoHelpWorld) {
  // Ensure FORCE_COLOR is set and NO_COLOR is absent so Chalk emits ANSI sequences.
  this.chromatoEnv = {
    ...this.chromatoEnv,
    FORCE_COLOR: '2',
  };
  delete this.chromatoEnv['NO_COLOR'];
});

Given('the NO_COLOR environment variable is not set', function (this: ChromatoHelpWorld) {
  delete this.chromatoEnv['NO_COLOR'];
});

Given('the NO_COLOR environment variable is set to {string}', function (
  this: ChromatoHelpWorld,
  value: string
) {
  // Remove FORCE_COLOR so it does not override NO_COLOR (Chalk respects NO_COLOR
  // only when FORCE_COLOR is absent).
  delete this.chromatoEnv['FORCE_COLOR'];
  this.chromatoEnv = {
    ...this.chromatoEnv,
    NO_COLOR: value,
  };
  delete this.chromatoEnv['FORCE_COLOR'];
});

Given('chromato output is captured through a pipe', function (this: ChromatoHelpWorld) {
  // When we spawn chromato with stdio: 'pipe', stdout.isTTY is undefined/false.
  // Chalk detects a non-TTY and disables colors automatically.
  // We explicitly remove FORCE_COLOR so Chalk behaves as in real piped usage.
  delete this.chromatoEnv['FORCE_COLOR'];
  delete this.chromatoEnv['NO_COLOR'];
});

Given('the terminal is set to dumb mode with an ASCII-only locale', function (
  this: ChromatoHelpWorld
) {
  // detectNonUnicode() returns true when TERM=dumb, causing useAscii=true in index.ts.
  this.chromatoEnv = {
    ...this.chromatoEnv,
    TERM: 'dumb',
    LANG: 'C',
    LC_ALL: 'C',
  };
});

// ---------------------------------------------------------------------------
// When steps
// ---------------------------------------------------------------------------

When('Kai runs chromato with no subcommand', async function (this: ChromatoHelpWorld) {
  const result = await runChromato(this, [], 10_000);
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

When('Kai runs chromato with the --help flag', async function (this: ChromatoHelpWorld) {
  const result = await runChromato(this, ['--help'], 10_000);
  this.secondOutput = result.stdout;
  this.secondExitCode = result.exitCode;
});

When('Kai runs chromato with the --no-color flag', async function (this: ChromatoHelpWorld) {
  // --no-color is a Commander global flag; remove FORCE_COLOR so Chalk
  // respects the flag rather than being overridden by FORCE_COLOR.
  delete this.chromatoEnv['FORCE_COLOR'];
  delete this.chromatoEnv['NO_COLOR'];
  const result = await runChromato(this, ['--no-color'], 10_000);
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

// ---------------------------------------------------------------------------
// Then steps
// ---------------------------------------------------------------------------

Then('the ASCII art logo appears at the top of the output', function (
  this: ChromatoHelpWorld
) {
  // The logo contains block-drawing chars unique to the CHROMATO ASCII art.
  // After stripping ANSI, the plain text still contains these characters.
  const plain = stripAnsi(this.capturedOutput);
  assert.ok(
    plain.includes('██████╗') || plain.includes('CHROMATO') || plain.includes('██╗'),
    `Expected ASCII art logo in output but not found.\nOutput:\n${plain}`
  );
});

Then('the output contains ANSI color sequences on the logo lines', function (
  this: ChromatoHelpWorld
) {
  const ansiCount = countAnsiSequences(this.capturedOutput);
  assert.ok(
    ansiCount > 0,
    `Expected ANSI color sequences in output but found none.\nOutput:\n${this.capturedOutput}`
  );
});

Then('the tagline {string} appears in the output', function (
  this: ChromatoHelpWorld,
  tagline: string
) {
  const plain = stripAnsi(this.capturedOutput);
  assert.ok(
    plain.includes(tagline),
    `Expected tagline "${tagline}" in output but not found.\nPlain text:\n${plain}`
  );
});

Then('the Commander help text appears below the banner', function (
  this: ChromatoHelpWorld
) {
  // Commander outputs "Usage:" as the first word of its generated help block.
  const plain = stripAnsi(this.capturedOutput);
  assert.ok(
    plain.includes('Usage:') || plain.includes('chromato'),
    `Expected Commander help text (Usage: / chromato) in output.\nPlain text:\n${plain}`
  );
});

Then('the process exits with code 0', function (this: ChromatoHelpWorld) {
  assert.strictEqual(
    this.exitCode,
    0,
    `Expected exit code 0 but got ${this.exitCode}`
  );
});

Then('the first output byte arrives within {int} milliseconds', async function (
  this: ChromatoHelpWorld,
  limitMs: number
) {
  // Run a fresh timing measurement to get an accurate cold-start value.
  // (The previous When step already ran the process; we measure a second spawn
  // dedicated to timing so the assertion is clean.)
  const { measureTimeToFirstByte } = await import('./helpers.js');
  const elapsed = await measureTimeToFirstByte(this, [], 10_000);
  assert.ok(
    elapsed < limitMs,
    `Expected first output byte within ${limitMs}ms but measured ${elapsed}ms`
  );
});

Then('both outputs are identical', function (this: ChromatoHelpWorld) {
  // capturedOutput = result of "chromato" (set in second When step)
  // secondOutput   = result of "chromato --help" (set in first When step)
  assert.strictEqual(
    this.capturedOutput,
    this.secondOutput,
    `Expected "chromato" and "chromato --help" to produce identical output.\n` +
    `"chromato" output:\n${this.capturedOutput}\n` +
    `"chromato --help" output:\n${this.secondOutput}`
  );
});

Then('the tagline {string} appears exactly once in the output', function (
  this: ChromatoHelpWorld,
  tagline: string
) {
  const plain = stripAnsi(this.capturedOutput);
  const count = plain.split(tagline).length - 1;
  assert.strictEqual(
    count,
    1,
    `Expected tagline "${tagline}" exactly once but found ${count} times.\nPlain text:\n${plain}`
  );
});

Then('the process exits within {int} milliseconds of first output', function (
  this: ChromatoHelpWorld,
  limitMs: number
) {
  // elapsedMs is set by the runChromatoUntilFirstFrame helper in the
  // "chromato is invoked with no subcommand" When step.
  assert.ok(
    this.elapsedMs < limitMs,
    `Expected first output within ${limitMs}ms but measured ${this.elapsedMs}ms`
  );
});

Then('no ANSI escape sequences appear in the output', function (
  this: ChromatoHelpWorld
) {
  const ansiCount = countAnsiSequences(this.capturedOutput);
  assert.strictEqual(
    ansiCount,
    0,
    `Expected no ANSI sequences but found ${ansiCount}.\nOutput:\n${this.capturedOutput}`
  );
});

Then('the ASCII art logo is present as plain text', function (
  this: ChromatoHelpWorld
) {
  const plain = stripAnsi(this.capturedOutput);
  assert.ok(
    plain.includes('██████╗') || plain.includes('██╗') || plain.includes('CHROMATO'),
    `Expected ASCII art logo in plain-text output.\nPlain text:\n${plain}`
  );
});

Then('the tagline {string} is present as plain text', function (
  this: ChromatoHelpWorld,
  tagline: string
) {
  const plain = stripAnsi(this.capturedOutput);
  assert.ok(
    plain.includes(tagline),
    `Expected tagline "${tagline}" in plain-text output.\nPlain text:\n${plain}`
  );
});

Then('the Commander help text is present as plain text', function (
  this: ChromatoHelpWorld
) {
  const plain = stripAnsi(this.capturedOutput);
  assert.ok(
    plain.includes('Usage:') || plain.includes('chromato'),
    `Expected Commander help text in plain-text output.\nPlain text:\n${plain}`
  );
});

Then('the output does not contain the Unicode divider character {string}', function (
  this: ChromatoHelpWorld,
  dividerChar: string
) {
  assert.ok(
    !this.capturedOutput.includes(dividerChar),
    `Expected output NOT to contain Unicode divider "${dividerChar}" but it was found.\nOutput:\n${this.capturedOutput}`
  );
});

Then('the tagline {string} is still present', function (
  this: ChromatoHelpWorld,
  tagline: string
) {
  const plain = stripAnsi(this.capturedOutput);
  assert.ok(
    plain.includes(tagline),
    `Expected tagline "${tagline}" to still be present.\nPlain text:\n${plain}`
  );
});

Then('the ASCII art logo is still present', function (this: ChromatoHelpWorld) {
  const plain = stripAnsi(this.capturedOutput);
  assert.ok(
    plain.includes('██████╗') || plain.includes('██╗') || plain.includes('CHROMATO'),
    `Expected ASCII art logo to be present.\nPlain text:\n${plain}`
  );
});

Then('the process produces no output on stderr', function (this: ChromatoHelpWorld) {
  const stripped = this.capturedStderr.trim();
  assert.strictEqual(
    stripped,
    '',
    `Expected empty stderr but got:\n${this.capturedStderr}`
  );
});

Then('the tagline is rendered with bold ANSI styling', function (this: ChromatoHelpWorld) {
  // chalk.bold emits SGR code 1 (\x1b[1m). Verify bold code is present in the
  // output — this is the observable proxy for AC-HSS-02.2 (bold white tagline).
  const hasBold = /\x1b\[1m/.test(this.capturedOutput);
  assert.ok(
    hasBold,
    `Expected bold ANSI styling (\x1b[1m) for tagline but not found.\nOutput:\n${this.capturedOutput}`
  );
  // Also verify the tagline text itself is in the output.
  const plain = stripAnsi(this.capturedOutput);
  assert.ok(
    plain.includes(TAGLINE),
    `Expected tagline "${TAGLINE}" in output.\nPlain text:\n${plain}`
  );
});

Then('the dividers are rendered with dim ANSI styling', function (this: ChromatoHelpWorld) {
  // chalk.dim emits SGR code 2 (\x1b[2m). Verify dim code is present in the
  // output — this is the observable proxy for AC-HSS-02.3 (dim dividers).
  const hasDim = /\x1b\[2m/.test(this.capturedOutput);
  assert.ok(
    hasDim,
    `Expected dim ANSI styling (\x1b[2m) for dividers but not found.\nOutput:\n${this.capturedOutput}`
  );
});
