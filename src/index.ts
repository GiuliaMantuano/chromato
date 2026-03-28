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
import { loadConfig } from './configLoader.js';
import { SessionService } from './application/sessionService.js';
import { TuiAdapter } from './adapters/tuiAdapter.js'; // .tsx resolved by esbuild

// Version injected at build time by esbuild define — no runtime file I/O needed.
declare const __CHROMATO_VERSION__: string;

const program = new Command();

program
  .name('chromato')
  .description('The Pomodoro timer your terminal deserves')
  .version(__CHROMATO_VERSION__);

program
  .command('start')
  .description('Start a Pomodoro session')
  .option('-w, --work <minutes>', 'Work duration in minutes', '25')
  .option('-b, --break <minutes>', 'Break duration in minutes', '5')
  .option('-l, --long-break <minutes>', 'Long break duration in minutes', '15')
  .option('-c, --cycles <count>', 'Number of Pomodoros per cycle', '4')
  .option('--minimal', 'Use plain text output (no TUI)')
  .option('--no-color', 'Suppress all ANSI color output')
  .action(async (opts: {
    work: string;
    break: string;
    longBreak: string;
    cycles: string;
    minimal?: boolean;
    color?: boolean;
  }) => {
    const config = loadConfig({
      work: parseInt(opts.work, 10),
      breakDuration: parseInt(opts.break, 10),
      longBreak: parseInt(opts.longBreak, 10),
      cycles: parseInt(opts.cycles, 10),
      minimal: opts.minimal,
      noColor: opts.color === false,
    });

    const tuiAdapter = new TuiAdapter();
    const service = new SessionService(tuiAdapter, null, null, null);

    process.on('SIGTERM', () => {
      process.exit(0);
    });

    await service.run(config);
  });

program.parse(process.argv);
