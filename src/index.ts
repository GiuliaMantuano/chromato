#!/usr/bin/env node
/**
 * chromato -- The Pomodoro timer your terminal deserves.
 *
 * CLI entry point and composition root.
 * This is the only file that imports from all layers.
 *
 * Driving port: commander.js program (CLI)
 */

import { Command } from 'commander';

// Read version from package.json. Using require() here because esbuild
// bundles this to CJS and inlines the package.json content.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('chromato')
  .description('The Pomodoro timer your terminal deserves')
  .version(version);

program.parse(process.argv);
