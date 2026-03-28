/**
 * Root cucumber config (ESM) for pnpm cucumber-js with no explicit --config.
 * Uses --import tsx for ESM-compatible TypeScript step loading.
 *
 * Note: requireModule/require cannot load ESM TypeScript when package.json has
 * "type": "module". Use the `import` directive with tsx instead.
 */

export default {
  paths: ['tests/acceptance/pomodoro-timer-cli/**/*.feature'],
  // Use `import` (not `require`) with tsx for ESM-compatible TS loading
  import: ['tests/acceptance/pomodoro-timer-cli/steps/**/*.ts'],
  requireModule: ['tsx'],
  format: [
    'progress-bar',
    'json:reports/cucumber-report.json',
    'html:reports/cucumber-report.html',
  ],
  tags: 'not @skip',
  timeout: 30_000,
  retry: process.env.CI ? 1 : 0,
  failFast: !process.env.CI,
  worldParameters: {
    chromatoLogLevel: process.env.CHROMATO_LOG_LEVEL || 'silent',
  },
};
