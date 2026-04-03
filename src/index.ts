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
 *
 * FAST-PATH NOTE:
 * `chromato status` uses a pre-commander fast-path: argv is checked before
 * loading commander (which adds 5-7ms). This guarantees the status path
 * stays well under AC-03.1's 50ms budget even under Vitest worker overhead.
 * commander is loaded lazily (dynamic import) so the status path does not
 * pay its cold-start cost.
 */

// Version injected at build time by esbuild define.
// Falls back to 'dev' when running via tsx in dev mode.
declare const __CHROMATO_VERSION__: string | undefined;
const VERSION: string = (() => {
  try { return __CHROMATO_VERSION__ ?? 'dev'; } catch { return 'dev'; }
})();

const argv = process.argv;

// Fast-path for `chromato status`.
// Handles the status subcommand without loading commander, which adds 5-7ms
// of cold-start cost incompatible with the <50ms AC-03.1 budget.
if (argv[2] === 'status') {
  const { PersistenceAdapter } = await import('./adapters/persistenceAdapter.js');
  const { StatusAdapter } = await import('./adapters/statusAdapter.js');
  const { StatusService } = await import('./application/statusService.js');

  const formatIdx = argv.indexOf('--format');
  const formatValue = formatIdx !== -1 ? argv[formatIdx + 1] : 'plain';
  const format: 'tmux' | 'plain' = formatValue === 'tmux' ? 'tmux' : 'plain';

  const persistenceAdapter = new PersistenceAdapter();
  const statusAdapter = new StatusAdapter();
  const statusService = new StatusService(persistenceAdapter, statusAdapter);
  const output = statusService.getStatus(format);
  if (output.length > 0) {
    process.stdout.write(output + '\n');
  }
  process.exit(0);
}

// Pre-load start-command modules eagerly in parallel when we know the command
// is `start`. This fires off all dynamic imports before commander finishes
// parsing, shaving the sequential import chain off the first-frame latency
// (AC-05.1: first TUI frame within 100ms).
const isStartCommand = argv[2] === 'start';
const startModulesP = isStartCommand
  ? Promise.all([
      import('./adapters/bannerAdapter.js'),
      import('./adapters/tuiAdapter.js'),
      import('./application/sessionService.js'),
      import('./adapters/persistenceAdapter.js'),
    ] as const)
  : null;

// Full commander-based CLI for start, help, version, and future commands.
// Loaded lazily: status path above exits before reaching this point.
const [{ Command }, { loadConfig }] = await Promise.all([
  import('commander'),
  import('./configLoader.js'),
]);

const program = new Command();

program
  .name('chromato')
  .description(`The Pomodoro timer your terminal deserves

Examples:
  chromato start                        Start a 25/5 Pomodoro session
  chromato start --work 50 --break 10   50-minute session with 10-minute break
  chromato start --minimal              Plain-text output (no TUI, tmux-safe)
  chromato status --format tmux         Tmux status-right one-liner

Tmux integration:
  set -g status-right "#(chromato status --format tmux)"`)
  .version(VERSION);

/**
 * Parses a CLI option value as a positive integer.
 * Calls program.error() (exits with code 2) on invalid input.
 */
function parsePositiveInt(flagName: string) {
  return (value: string): number => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || String(parsed) !== value.trim() || parsed <= 0) {
      program.error(
        `error: option '--${flagName}' must be a positive integer, got: ${value}`,
        { exitCode: 2 }
      );
    }
    return parsed;
  };
}

program
  .command('start')
  .description('Start a Pomodoro session')
  .option('-w, --work <minutes>', 'Work duration in minutes', parsePositiveInt('work'), 25)
  .option('-b, --break <minutes>', 'Break duration in minutes', parsePositiveInt('break'), 5)
  .option('-l, --long-break <minutes>', 'Long break duration in minutes', parsePositiveInt('long-break'), 15)
  .option('-c, --count <count>', 'Number of Pomodoros per cycle', parsePositiveInt('count'), 4)
  .option('--minimal', 'Use plain text output (no TUI)')
  .option('--no-color', 'Suppress all ANSI color output')
  .action(async (opts: {
    work: number;
    break: number;
    longBreak: number;
    count: number;
    minimal?: boolean;
    color?: boolean;
  }) => {
    const config = loadConfig({
      work: opts.work,
      breakDuration: opts.break,
      longBreak: opts.longBreak,
      cycles: opts.count,
      minimal: opts.minimal ?? false,
      noColor: opts.color === false,
    });

    // Await the pre-loaded modules (already resolving in parallel since argv check).
    const [
      { printBanner },
      { TuiAdapter },
      { SessionService },
      { PersistenceAdapter },
    ] = await (startModulesP ?? Promise.all([
      import('./adapters/bannerAdapter.js'),
      import('./adapters/tuiAdapter.js'),
      import('./application/sessionService.js'),
      import('./adapters/persistenceAdapter.js'),
    ] as const));

    // Print ASCII art banner before TUI renders (stdout, stays above Ink output).
    printBanner(opts.color === false);

    const tuiAdapter = new TuiAdapter();
    const persistenceAdapter = new PersistenceAdapter();
    const service = new SessionService(tuiAdapter, persistenceAdapter, null, persistenceAdapter);

    process.on('SIGTERM', () => {
      service.interrupt();
    });

    await service.run(config);
    process.exit(0);
  });

program.parse(process.argv);
