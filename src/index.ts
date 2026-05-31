#!/usr/bin/env node
/**
 * chromato -- Focus in full colour. A Pomodoro timer for the terminal.
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
  const [
    { PersistenceAdapter },
    { StatusAdapter },
    { StatusService },
  ] = await Promise.all([
    import('./adapters/persistenceAdapter.js'),
    import('./adapters/statusAdapter.js'),
    import('./application/statusService.js'),
  ] as const);

  const formatIdx = argv.indexOf('--format');
  const formatValue = formatIdx !== -1 ? argv[formatIdx + 1] : 'plain';
  const format: 'tmux' | 'plain' | 'prompt' =
    formatValue === 'tmux' ? 'tmux' : formatValue === 'prompt' ? 'prompt' : 'plain';

  const widthIdx = argv.indexOf('--width');
  const maxWidth = widthIdx !== -1 ? parseInt(argv[widthIdx + 1] ?? '20', 10) : undefined;

  const persistenceAdapter = new PersistenceAdapter();
  const statusAdapter = new StatusAdapter();
  const statusService = new StatusService(persistenceAdapter, statusAdapter);
  const output = statusService.getStatus(format, maxWidth);
  if (output.length > 0) {
    process.stdout.write(output + '\n');
  }
  process.exit(0);
}

// Pre-load start-command modules eagerly in parallel when we know the command
// is `start`. This fires off all dynamic imports before commander finishes
// parsing, shaving the sequential import chain off the first-frame latency
// (AC-05.1: first TUI frame within 100ms).
// For --minimal mode, skip ink/react (they are not needed and add overhead).
const isStartCommand = argv[2] === 'start';
// Minimal/no-color: skip ink/react pre-load when --minimal or --no-color is specified.
const isMinimalStart = isStartCommand && (
  argv.includes('--minimal') ||
  argv.includes('--no-color') ||
  process.env['NO_COLOR'] !== undefined
);

const startModulesP = isStartCommand && !isMinimalStart
  ? Promise.all([
      import('./adapters/tuiAdapter.js'),
      import('./application/sessionService.js'),
      import('./adapters/persistenceAdapter.js'),
      import('./adapters/notificationAdapter.js'),
    ] as const)
  : null;

// Full commander-based CLI for start, help, version, and future commands.
// Loaded lazily: status path above exits before reaching this point.
const [{ Command }, { loadConfig }, { printBanner }, { printHelpSplash }, { detectNonUnicode }, { getPalette }, chalk] = await Promise.all([
  import('commander'),
  import('./configLoader.js'),
  import('./adapters/bannerAdapter.js'),
  import('./adapters/helpAdapter.js'),
  import('./utils/unicodeDetect.js'),
  import('./domain/palette.js'),
  import('chalk'),
] as const);

const program = new Command();

program
  .name('chromato')
  .version(VERSION);

program.option('-C, --no-color', 'Suppress all ANSI color output');

const examplesText = `
Examples:
  chromato start                        Start a 25/5 Pomodoro session
  chromato start --work 50 --break 10   50-minute session with 10-minute break
  chromato start --minimal              Plain-text output (no TUI, tmux-safe)
  chromato start --palette lavender     Start with the lavender color palette
  chromato status --format tmux         Tmux status-right one-liner

Color palettes (--palette):
  Valid names: ocean (default), lavender, berry, forest
  Resolution precedence: --palette flag > CHROMATO_PALETTE env > config.json > default (ocean)
  Config file: \${XDG_CONFIG_HOME:-~/.config}/chromato/config.json  (key: "palette")

Tmux integration:
  set -g status-right "#(chromato status --format tmux)"`;

program.addHelpText('beforeAll', () => {
  const noColor = process.argv.includes('--no-color') || Boolean(process.env['NO_COLOR']);
  const useAscii = detectNonUnicode() || process.argv.includes('--ascii');
  printBanner(getPalette('ocean'), noColor, useAscii);
  printHelpSplash(noColor, useAscii);
  return '';
});

program.addHelpText('beforeAll', () => {
  const noColor = process.argv.includes('--no-color') || Boolean(process.env['NO_COLOR']);
  return noColor ? examplesText : chalk.default.dim(examplesText);
});

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
  .option('--ascii', 'Use ASCII progress bar characters (suppresses auto-detection message)')
  .option('-p, --palette <name>', 'Color palette name (ocean, lavender, berry, forest)')
  .action(async (opts: {
    work: number;
    break: number;
    longBreak: number;
    count: number;
    minimal?: boolean;
    ascii?: boolean;
    palette?: string;
  }) => {
    let configResult;
    try {
      configResult = loadConfig({
        work: opts.work,
        breakDuration: opts.break,
        longBreak: opts.longBreak,
        cycles: opts.count,
        minimal: opts.minimal ?? false,
        noColor: program.opts().color === false,
        ascii: opts.ascii ?? false,
        palette: opts.palette,
      });
    } catch (err) {
      // Unknown palette name or invalid config.json → exit 1 with a clear message.
      // No session is started.
      process.stderr.write(`${(err as Error).message}\n`);
      process.exit(1);
    }
    const { config, autoDetectedAscii, resolvedPalette } = configResult;

    // Use MinimalAdapter when --minimal is set OR when color is suppressed (--no-color / NO_COLOR).
    // Color suppression implies the caller wants plain text output with no ANSI sequences.
    const useMinimalAdapter = opts.minimal || !config.useColor;

    if (useMinimalAdapter) {
      // Minimal / no-color mode: plain-text output, no TUI, no ink/react.
      const [
        { MinimalAdapter },
        { SessionService },
        { PersistenceAdapter },
        { NotificationAdapter },
      ] = await Promise.all([
        import('./adapters/minimalAdapter.js'),
        import('./application/sessionService.js'),
        import('./adapters/persistenceAdapter.js'),
        import('./adapters/notificationAdapter.js'),
      ] as const);

      printBanner(resolvedPalette, program.opts().color === false);
      const renderAdapter = new MinimalAdapter();
      const persistenceAdapter = new PersistenceAdapter();
      const notificationAdapter = new NotificationAdapter();
      const service = new SessionService(renderAdapter, persistenceAdapter, notificationAdapter, persistenceAdapter);

      process.on('SIGTERM', () => { service.interrupt(); });
      await service.run(config);
      process.exit(0);
    }

    // Full TUI mode: await the pre-loaded modules (already resolving in parallel since argv check).
    const [
      { TuiAdapter },
      { SessionService },
      { PersistenceAdapter },
      { NotificationAdapter },
    ] = await (startModulesP ?? Promise.all([
      import('./adapters/tuiAdapter.js'),
      import('./application/sessionService.js'),
      import('./adapters/persistenceAdapter.js'),
      import('./adapters/notificationAdapter.js'),
    ] as const));

    // Print informational message when ASCII mode was auto-detected (not when --ascii explicit).
    if (autoDetectedAscii) {
      process.stdout.write(
        'Note: Unicode not detected — using ASCII progress bar. Pass --ascii to suppress this message.\n'
      );
    }

    const tuiAdapter = new TuiAdapter(resolvedPalette);
    const persistenceAdapter = new PersistenceAdapter();
    const notificationAdapter = new NotificationAdapter();
    const service = new SessionService(tuiAdapter, persistenceAdapter, notificationAdapter, persistenceAdapter);

    process.on('SIGTERM', () => {
      service.interrupt();
    });

    await service.run(config);
    process.exit(0);
  });

// When chromato is invoked with no subcommand, Commander would normally
// treat the missing command as an error (writes to stderr, exits 1).
// A root action intercepts this case and routes it through program.help()
// which uses writeOut (stdout) and exits 0 — matching AC-HSS-08.1.
program.action(() => {
  program.help();
});

program.parse(process.argv);
