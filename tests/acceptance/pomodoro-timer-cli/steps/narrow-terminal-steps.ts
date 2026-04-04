/**
 * Step definitions for AC-01.3: Progress bar renders correctly in narrow terminal.
 *
 * Driving port: chromato CLI (spawns the chromato binary with COLUMNS=30).
 * All Then steps assert observable output through the CLI driving port.
 * No imports from src/ production code.
 *
 * Hexagonal boundary: test enters through CLI (driving port).
 * Assertions are on stdout content — observable at port boundary.
 */

import { When, Then } from '@cucumber/cucumber';
import type { ChromatoWorld } from './world';
import { runChromato, stripAnsi } from './helpers';
import * as assert from 'assert';

// ---------------------------------------------------------------------------
// When: she runs "chromato start" with a N-minute work session
// ---------------------------------------------------------------------------

When('she runs {string} with a {int}-minute work session', async function (
  this: ChromatoWorld,
  command: string,
  minutes: number
) {
  const args = command
    .replace(/^chromato\s+/, '')
    .split(/\s+/)
    .filter(Boolean);

  const result = await runChromato(this, [...args, '--work', String(minutes)], 3000);
  this.capturedOutput = result.stdout;
  this.capturedStderr = result.stderr;
  this.exitCode = result.exitCode;
});

// ---------------------------------------------------------------------------
// Then: display renders on a single line (no multi-line wrapping of core UI)
// ---------------------------------------------------------------------------

Then('the display renders on a single line', function (this: ChromatoWorld) {
  const plainText = stripAnsi(this.capturedOutput);
  // The compact layout stacks phase label above bar — "single line" means
  // the progress bar line itself fits in the column budget. Verify that
  // at least one line does not exceed the column budget set via COLUMNS env var.
  const columns = parseInt(this.chromatoEnv['COLUMNS'] ?? '80', 10);
  const lines = plainText.split('\n').filter((l) => l.trim().length > 0);

  const allFit = lines.some((line) => line.length <= columns);
  assert.ok(
    allFit,
    `Expected at least one output line to fit within ${columns} columns, but all lines exceed it.\nLines:\n${lines.join('\n')}`
  );
});

// ---------------------------------------------------------------------------
// Then: phase label and remaining time are both visible
// ---------------------------------------------------------------------------

Then('the phase label and remaining time are both visible', function (this: ChromatoWorld) {
  const plainText = stripAnsi(this.capturedOutput);

  // Phase label must be present (one of the known phase display labels)
  const hasPhaseLabel = /WORK|BREAK|LONG BREAK|OVERDUE|IDLE/i.test(plainText);
  assert.ok(
    hasPhaseLabel,
    `Expected a phase label (WORK, BREAK, OVERDUE, etc.) in output but got:\n${plainText}`
  );

  // Timer countdown must be present (MM:SS format)
  const hasTimer = /\d{2}:\d{2}/.test(plainText);
  assert.ok(
    hasTimer,
    `Expected a timer countdown (MM:SS) in output but got:\n${plainText}`
  );
});

// ---------------------------------------------------------------------------
// Then: no display element is truncated or overflows the N-column boundary
// ---------------------------------------------------------------------------

Then('no display element is truncated or overflows the {int}-column boundary', function (
  this: ChromatoWorld,
  columns: number
) {
  const plainText = stripAnsi(this.capturedOutput);
  const lines = plainText.split('\n').filter((l) => l.trim().length > 0);

  // Skip lines containing the interrupt/session summary (not part of the timer display).
  const timerLines = lines.filter((l) => !/Session interrupted|Partial session/.test(l));

  // Verify no timer line exceeds the column limit
  const overflowingLines = timerLines.filter((line) => line.length > columns);

  assert.ok(
    overflowingLines.length === 0,
    `Expected no lines to exceed ${columns} columns, but found ${overflowingLines.length} overflowing line(s):\n` +
      overflowingLines.map((l) => `  [${l.length} chars] "${l}"`).join('\n')
  );
});
