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
    ] as const)
  : null;

// Full commander-based CLI for start, help, version, and future commands.
// Loaded lazily: status path above exits before reaching this point.
const [{ Command }, { loadConfig, configFileExists, configFilePath }, { shouldRunWizard }, { shouldShowHome, normalizeGuardEnv }, { printBanner }, { printHelpSplash }, { detectNonUnicode }, { getPalette }, chalk] = await Promise.all([
  import('commander'),
  import('./configLoader.js'),
  import('./firstRun.js'),
  import('./homeGuard.js'),
  import('./adapters/bannerAdapter.js'),
  import('./adapters/helpAdapter.js'),
  import('./utils/unicodeDetect.js'),
  import('./domain/palette.js'),
  import('chalk'),
] as const);

/**
 * Selects the NotificationPort for a session (ADR-014 / DD-1). The wizard's
 * notifications=false is a composition-root injection, not a domain field: when
 * off, the no-op NullNotificationAdapter is wired so a work→break transition fires
 * no desktop notification and no bell; otherwise the real NotificationAdapter is
 * used. Either way a NotificationPort is returned and SessionService is untouched.
 * Shared by every session launch path (start action, wizard launch, home Start).
 */
async function buildNotificationPort(
  notifications: boolean,
): Promise<import('./domain/ports.js').NotificationPort> {
  if (!notifications) {
    const { NullNotificationAdapter } = await import('./adapters/nullNotificationAdapter.js');
    return new NullNotificationAdapter();
  }
  const { NotificationAdapter } = await import('./adapters/notificationAdapter.js');
  return new NotificationAdapter();
}

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
  }, command: import('commander').Command) => {
    // Only forward a timing flag when the user EXPLICITLY supplied it on the CLI
    // (source 'cli'), not when commander filled in its declared default (source
    // 'default'). This is what lets config.json timing (DD-4) win over the
    // built-in default while an explicit --work still wins over config.json.
    const fromCli = (name: string): boolean => command.getOptionValueSource(name) === 'cli';
    let configResult;
    try {
      configResult = loadConfig({
        ...(fromCli('work') ? { work: opts.work } : {}),
        ...(fromCli('break') ? { breakDuration: opts.break } : {}),
        ...(fromCli('longBreak') ? { longBreak: opts.longBreak } : {}),
        ...(fromCli('count') ? { cycles: opts.count } : {}),
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
    const { config, autoDetectedAscii, resolvedPalette, notifications } = configResult;

    // Use MinimalAdapter when --minimal is set OR when color is suppressed (--no-color / NO_COLOR).
    // Color suppression implies the caller wants plain text output with no ANSI sequences.
    const useMinimalAdapter = opts.minimal || !config.useColor;

    if (useMinimalAdapter) {
      // Minimal / no-color mode: plain-text output, no TUI, no ink/react.
      const [
        { MinimalAdapter },
        { SessionService },
        { PersistenceAdapter },
      ] = await Promise.all([
        import('./adapters/minimalAdapter.js'),
        import('./application/sessionService.js'),
        import('./adapters/persistenceAdapter.js'),
      ] as const);

      printBanner(resolvedPalette, program.opts().color === false);
      const renderAdapter = new MinimalAdapter();
      const persistenceAdapter = new PersistenceAdapter();
      const notificationAdapter = await buildNotificationPort(notifications);
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
    ] = await (startModulesP ?? Promise.all([
      import('./adapters/tuiAdapter.js'),
      import('./application/sessionService.js'),
      import('./adapters/persistenceAdapter.js'),
    ] as const));

    // Print informational message when ASCII mode was auto-detected (not when --ascii explicit).
    if (autoDetectedAscii) {
      process.stdout.write(
        'Note: Unicode not detected — using ASCII progress bar. Pass --ascii to suppress this message.\n'
      );
    }

    const tuiAdapter = new TuiAdapter(resolvedPalette);
    const persistenceAdapter = new PersistenceAdapter();
    const notificationAdapter = await buildNotificationPort(notifications);
    const service = new SessionService(tuiAdapter, persistenceAdapter, notificationAdapter, persistenceAdapter);

    process.on('SIGTERM', () => {
      service.interrupt();
    });

    await service.run(config);
    process.exit(0);
  });

/**
 * Launch handoff (step 04-01): start a real `chromato start` session from the
 * WizardResult the user just confirmed on the Summary screen. The wizard has
 * already persisted the six-key config atomically (ConfigFileWriterAdapter), so
 * we read it back through loadConfig — the single resolution path — to honour the
 * chosen theme + timing exactly as a flagless `chromato start` would. DD-8 graceful
 * degrade: if the write failed the wizard still resolved the in-memory result, so
 * we fall back to those values (no flags) and the session starts regardless.
 */
async function launchSessionFromWizard(
  result: import('./configTypes.js').WizardResult,
): Promise<void> {
  const { loadConfig } = await import('./configLoader.js');
  const configResult = loadConfig({
    work: result.work,
    breakDuration: result.break,
    longBreak: result.longBreak,
    cycles: result.cycles,
    palette: result.palette,
  });
  await launchSessionFromConfigResult(configResult);
}

/**
 * Start a real TUI session from an already-loaded ConfigResult. The home screen's
 * "Start" choice reuses this with the config it ALREADY loaded for the recap — no
 * second loadConfig call (AC-RH-04.2 / K8). launchSessionFromWizard funnels here too
 * so the wizard and home start paths share one launch implementation (SC-06).
 */
async function launchSessionFromConfigResult(
  configResult: import('./configLoader.js').ConfigResult,
): Promise<void> {
  const { config, resolvedPalette, notifications } = configResult;

  const [{ TuiAdapter }, { SessionService }, { PersistenceAdapter }] = await Promise.all([
    import('./adapters/tuiAdapter.js'),
    import('./application/sessionService.js'),
    import('./adapters/persistenceAdapter.js'),
  ] as const);

  const tuiAdapter = new TuiAdapter(resolvedPalette);
  const persistenceAdapter = new PersistenceAdapter();
  const notificationAdapter = await buildNotificationPort(notifications);
  const service = new SessionService(tuiAdapter, persistenceAdapter, notificationAdapter, persistenceAdapter);

  process.on('SIGTERM', () => { service.interrupt(); });
  await service.run(config);
}

/**
 * Run the setup wizard and (on Summary confirm) launch a session in the chosen
 * theme. Shared by the `setup` command and the home screen's "Reconfigure" choice
 * (SC-05, AC-RH-05.3) so there is one wizard launch path, not two. `initial`
 * pre-seeds the wizard with the saved settings on a Reconfigure re-run (R2 / OQ-1).
 */
async function runSetupWizard(
  initial?: import('./configTypes.js').WizardResult,
): Promise<void> {
  // Non-TTY refusal (US-06 AC-06.4, ADR-012): the wizard needs raw-mode stdin.
  // Refuse with guidance BEFORE the dynamic import() below, so ink/react stay
  // off the refusal path and Ink's setRawMode is never reached on a non-TTY.
  if (!process.stdin.isTTY) {
    process.stderr.write(
      'chromato setup needs an interactive terminal (a TTY). Run it directly in your terminal.\n'
    );
    process.exit(1);
  }

  // Dynamic import keeps ink/react off the --help and non-interactive paths
  // (ADR-012, AC-HSS-07): the wizard adapter is loaded only when `setup` runs.
  const [{ SetupWizardAdapter }, { ConfigFileWriterAdapter }] = await Promise.all([
    import('./adapters/setupWizardAdapter.js'),
    import('./adapters/configWriterAdapter.js'),
  ] as const);

  const adapter = new SetupWizardAdapter(new ConfigFileWriterAdapter());
  const tmuxDetected = process.env['TMUX'] !== undefined;
  const result = await adapter.run({ tmuxDetected, ...(initial ? { initial } : {}) });
  // Launch handoff (04-01): on Summary confirm, hand off to a real session in the
  // chosen theme; Q/Ctrl+C resolves null → no session, clean exit.
  if (result) {
    await launchSessionFromWizard(result);
  }
}

/**
 * Build the wizard pre-seed (R2 / OQ-1) from the config ALREADY loaded for the home
 * recap, so Reconfigure reopens the wizard showing the user's current settings. The
 * palette NAME comes straight off the single-read ConfigResult.paletteName (DD-4) —
 * no second config.json read; timings convert domain seconds → wizard minutes. This
 * is the pre-seed only — not a second loadConfig of the session config (K8 honoured).
 */
function reconfigureSeed(
  configResult: import('./configLoader.js').ConfigResult,
): import('./configTypes.js').WizardResult {
  const { config, paletteName, notifications } = configResult;
  const toMinutes = (seconds: number): number => Math.round(seconds / 60);
  return {
    palette: paletteName,
    work: toMinutes(config.workDurationSeconds),
    break: toMinutes(config.breakDurationSeconds),
    longBreak: toMinutes(config.longBreakDurationSeconds),
    cycles: config.cycleCount,
    notifications,
  };
}

program
  .command('setup')
  .description('Run the first-run setup wizard (choose a colour theme)')
  .action(async () => {
    await runSetupWizard();
    process.exit(0);
  });

// When chromato is invoked with no subcommand, the first-run guard decides
// between auto-launching the setup wizard and falling back to help.
//
// The guard (pure shouldRunWizard + configFileExists) is evaluated BEFORE the
// wizard's dynamic import() so ink/react stay off the help and non-interactive
// paths (ADR-012, AC-HSS-07). Only the bare `chromato` invocation auto-launches
// (DD-3); the `start` action and other subcommands are untouched.
program.action(async () => {
  const configExists = configFileExists();

  // Returning-home guard (D-RH-1/D-RH-8): a returning user (config present) in an
  // interactive colour terminal is greeted by the branded home screen. The guard's
  // isTTY input is "interactive colour stdout": a real terminal sets stdout.isTTY
  // AND chalk detects colour; piped/redirected output (chalk.level 0) falls through
  // to help. This is ADDITIVE — evaluated BEFORE the wizard/help fallback below;
  // --help/start/status/setup never reach here (Commander routes those first).
  // Normalise the env the guard sees (normalizeGuardEnv): a literal CI="false"/"0"/""
  // is the conventional "NOT in CI" signal (and our test harness sets CI="false" to
  // keep Ink off its CI-buffered path), so those map to not-in-CI. The isTTY input is
  // the colour-interactive surrogate `stdout.isTTY || chalk.level > 0` (see HomeGuardInput).
  const showHome = shouldShowHome({
    isTTY: Boolean(process.stdout.isTTY) || chalk.default.level > 0,
    env: normalizeGuardEnv(process.env),
    argv: process.argv,
    configExists,
  });

  if (showHome) {
    // D-RH-8 step 2: the existence-only guard passed, but the file may be corrupt.
    // Wrap loadConfig() ONLY in try/catch — a parse throw degrades gracefully to
    // plain Commander help (exit 0), with NO Ink mount (AC-RH-07.4 / C2).
    let configResult: import('./configLoader.js').ConfigResult;
    try {
      configResult = loadConfig({ noColor: program.opts().color === false });
    } catch {
      // outputHelp writes the listing to stdout WITHOUT calling process.exit
      // internally (unlike program.help(), which exits with process.exitCode ?? 0).
      // Exit 0 explicitly (AC-RH-07.4 / C2): a corrupt config degrades to plain help.
      program.outputHelp();
      process.exit(0);
    }

    // D-RH-8 step 3: guard true AND config loaded → dynamic-import the home adapter
    // (Ink stays off every other path, ADR-012 / K5), render, and delegate on the
    // resolved HomeChoice. The composition root owns delegation (D-RH-5).
    const { HomeAdapter } = await import('./adapters/homeAdapter.js');
    const tmuxDetected = process.env['TMUX'] !== undefined;
    const choice = await new HomeAdapter().run({
      config: configResult,
      tmuxDetected,
      configPath: configFilePath(),
    });

    if (choice.kind === 'start') {
      // Start reuses the config ALREADY loaded for the recap — no second loadConfig
      // (AC-RH-04.2 / K8) — funnelling through the shared launch path (SC-06).
      await launchSessionFromConfigResult(configResult);
      process.exit(0);
    }
    if (choice.kind === 'reconfigure') {
      // Reconfigure reopens the setup wizard pre-seeded with the saved settings
      // (R2 / OQ-1), reusing the shared wizard launch path (SC-05, AC-RH-05.3).
      await runSetupWizard(reconfigureSeed(configResult));
      process.exit(0);
    }
    process.exit(0); // quit — the home wrote nothing (AC-RH-06.1)
  }

  const launchWizard = shouldRunWizard({
    isTTY: Boolean(process.stdin.isTTY),
    env: process.env,
    configExists,
  });

  if (launchWizard) {
    // First-run wizard (04-01): a brand-new user (no config) flows straight into
    // their first session in the chosen theme when they confirm the Summary.
    await runSetupWizard();
    process.exit(0);
  }

  // Non-interactive / config-present / help fallback: Commander would normally
  // treat the missing command as an error (stderr, exit 1). program.help() uses
  // writeOut (stdout) and exits 0 — matching AC-HSS-08.1.
  program.help();
});

program.parse(process.argv);
