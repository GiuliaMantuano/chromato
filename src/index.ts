#!/usr/bin/env node
/**
 * chromato -- The Pomodoro timer your terminal deserves.
 *
 * CLI entry point and composition root.
 * This is the only file that imports from all layers.
 *
 * Driving port: commander.js program (CLI)
 *
 * PERFORMANCE NOTE:
 * TuiAdapter (Ink/React) is dynamically imported only for the `start` command.
 * The `status` command path must complete in <50ms -- Ink/React cold start
 * adds 15-20ms. Dynamic import ensures status never pays that cost.
 */

import { Command } from 'commander';
import { loadConfig } from './configLoader.js';
import { StatusService } from './application/statusService.js';
import { PersistenceAdapter } from './adapters/persistenceAdapter.js';
import { StatusAdapter } from './adapters/statusAdapter.js';

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
      work: parseFloat(opts.work),
      breakDuration: parseFloat(opts.break),
      longBreak: parseFloat(opts.longBreak),
      cycles: parseInt(opts.cycles, 10),
      minimal: opts.minimal ?? false,
      noColor: opts.color === false,
    });

    // Lazy import: TuiAdapter loads Ink/React only when `start` is invoked.
    const { TuiAdapter } = await import('./adapters/tuiAdapter.js');
    const { SessionService } = await import('./application/sessionService.js');

    const tuiAdapter = new TuiAdapter();
    const persistenceAdapter = new PersistenceAdapter();
    const service = new SessionService(tuiAdapter, persistenceAdapter, null, persistenceAdapter);

    process.on('SIGTERM', () => {
      service.interrupt();
    });

    await service.run(config);
    process.exit(0);
  });

program
  .command('status')
  .description('Show current session status')
  .option('--format <format>', 'Output format: tmux or plain', 'plain')
  .action((opts: { format: string }) => {
    const format = opts.format === 'tmux' ? 'tmux' : 'plain';
    const persistenceAdapter = new PersistenceAdapter();
    const statusAdapter = new StatusAdapter();
    const statusService = new StatusService(persistenceAdapter, statusAdapter);
    const output = statusService.getStatus(format);
    if (output.length > 0) {
      process.stdout.write(output + '\n');
    }
    process.exit(0);
  });

program.parse(process.argv);
