/**
 * Setup and teardown step definitions for chromato acceptance tests.
 *
 * Domain concept: environment setup -- "chromato is installed", "no previous state exists"
 *
 * CM-A compliance: no imports from src/ production modules.
 * All interaction with chromato is through the CLI driving port.
 */

import { Given, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import type { ChromatoWorld } from './world';

// Override the default 5000ms step timeout so TUI phase-transition scenarios
// (which spawn real processes and wait for phase changes) don't time out.
setDefaultTimeout(30_000);
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

Before(function (this: ChromatoWorld) {
  // World constructor already creates the temp directory and sets paths.
  // Ensure the XDG data directory exists so the state file path is valid.
  fs.mkdirSync(path.join(this.tempDir, 'chromato'), { recursive: true });
  fs.mkdirSync(path.join(this.tempDir, 'config', 'chromato'), { recursive: true });
});

After(function (this: ChromatoWorld) {
  // Kill any lingering chromato process so it does not leak between scenarios.
  if (this.process && !this.process.killed) {
    try {
      this.process.kill('SIGTERM');
    } catch {
      // Process may have already exited — ignore.
    }
  }

  // Clean up the temporary directory.
  try {
    fs.rmSync(this.tempDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
});

// ---------------------------------------------------------------------------
// Given: environment preconditions
// ---------------------------------------------------------------------------

Given('chromato is installed and available on the PATH', function (this: ChromatoWorld) {
  // Verified by WorldImpl constructor: throws if neither dist/ nor src/ entry exists.
  // This step is a documentation-grade precondition that confirms the world is ready.
});

Given('no previous session state exists', function (this: ChromatoWorld) {
  // The temp dir is fresh per scenario (created in Before hook).
  // Explicitly remove any state.json that may have been written in a multi-step setup.
  const stateFile = path.join(this.tempDir, 'chromato', 'state.json');
  if (fs.existsSync(stateFile)) {
    fs.rmSync(stateFile);
  }
});

Given('no configuration file exists', function (this: ChromatoWorld) {
  const configFile = path.join(this.tempDir, 'config', 'chromato', 'config.json');
  if (fs.existsSync(configFile)) {
    fs.rmSync(configFile);
  }
});

Given('the NO_COLOR environment variable is set to {string}', function (
  this: ChromatoWorld,
  value: string
) {
  this.chromatoEnv = { ...this.chromatoEnv, NO_COLOR: value };
});

Given('the NO_COLOR environment variable is set to any non-empty value', function (
  this: ChromatoWorld
) {
  this.chromatoEnv = { ...this.chromatoEnv, NO_COLOR: '1' };
});

Given("Priya's terminal is set to TERM=xterm without Unicode support", function (
  this: ChromatoWorld
) {
  this.chromatoEnv = {
    ...this.chromatoEnv,
    TERM: 'xterm',
    LANG: 'C',
    LC_ALL: 'C',
  };
});

Given('the TERM environment variable is set to {string}', function (
  this: ChromatoWorld,
  term: string
) {
  this.chromatoEnv = { ...this.chromatoEnv, TERM: term };
});

Given(
  'the terminal environment reports COLORTERM={string} and TERM={string}',
  function (this: ChromatoWorld, colorterm: string, term: string) {
    this.chromatoEnv = { ...this.chromatoEnv, COLORTERM: colorterm, TERM: term };
  }
);

Given('the terminal environment reports TERM=dumb and LC_ALL=C', function (
  this: ChromatoWorld
) {
  this.chromatoEnv = {
    ...this.chromatoEnv,
    TERM: 'dumb',
    LC_ALL: 'C',
    LANG: 'C',
  };
});

Given('the terminal supports 256 colors (TERM=xterm-256color)', function (
  this: ChromatoWorld
) {
  this.chromatoEnv = { ...this.chromatoEnv, TERM: 'xterm-256color' };
});

Given(
  'the terminal supports Unicode block characters (LANG includes UTF-8)',
  function (this: ChromatoWorld) {
    this.chromatoEnv = {
      ...this.chromatoEnv,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
    };
  }
);

Given('the terminal environment reports TERM=dumb with no color support', function (
  this: ChromatoWorld
) {
  this.chromatoEnv = {
    ...this.chromatoEnv,
    TERM: 'dumb',
    LC_ALL: 'C',
    LANG: 'C',
  };
});

Given('Aiko has a terminal window set to {int} columns', function (
  this: ChromatoWorld,
  columns: number
) {
  this.chromatoEnv = { ...this.chromatoEnv, COLUMNS: String(columns) };
});

Given('a terminal window with {int} columns', function (
  this: ChromatoWorld,
  columns: number
) {
  this.chromatoEnv = { ...this.chromatoEnv, COLUMNS: String(columns) };
});
