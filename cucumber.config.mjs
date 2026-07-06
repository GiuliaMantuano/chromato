/**
 * Root cucumber config (ESM) for pnpm cucumber-js with no explicit --config.
 * Uses --import tsx for ESM-compatible TypeScript step loading.
 *
 * Note: requireModule/require cannot load ESM TypeScript when package.json has
 * "type": "module". Use the `import` directive with tsx instead.
 */

export default {
  paths: [
    'tests/acceptance/pomodoro-timer-cli/**/*.feature',
    'tests/acceptance/first-run-setup-wizard/**/*.feature',
    'tests/acceptance/returning-home/**/*.feature',
    'tests/acceptance/in-terminal-notifications/**/*.feature',
  ],
  // Register tsx's ESM hook FIRST, then load step files. Order matters:
  // the register file must precede any *.ts entries. requireModule was the
  // legacy CJS recipe and is incompatible with this project's ESM-native config;
  // keeping both produced a leaked esbuild service that hung CI.
  import: [
    './cucumber.tsx-register.mjs',
    'tests/acceptance/pomodoro-timer-cli/steps/**/*.ts',
    'tests/acceptance/first-run-setup-wizard/steps/**/*.ts',
    'tests/acceptance/returning-home/steps/**/*.ts',
    'tests/acceptance/in-terminal-notifications/steps/**/*.ts',
  ],
  format: [
    'progress-bar',
    'json:reports/cucumber-report.json',
    'html:reports/cucumber-report.html',
  ],
  tags: 'not @skip',
  timeout: 30_000,
  retry: process.env.CI ? 1 : 0,
  failFast: !process.env.CI,
  // Force exit after the run. Default false lets the event loop drain naturally,
  // which hangs CI forever if any transitive dep leaks a handle. Trade-off:
  // could mask a future leak in step code; periodically run locally without
  // this key to detect new leaks early.
  forceExit: true,
  worldParameters: {
    chromatoLogLevel: process.env.CHROMATO_LOG_LEVEL || 'silent',
  },
};
