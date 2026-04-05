/**
 * Cucumber-JS configuration for help-splash-screen acceptance tests.
 *
 * Feature ID : help-splash-screen
 * Framework  : @cucumber/cucumber (TypeScript with tsx)
 * Runner     : cucumber-js
 *
 * Usage:
 *   pnpm cucumber-js --config tests/acceptance/help-splash-screen/cucumber.config.ts
 *
 * Tags:
 *   @skip              -- scenario not yet implemented; excluded from run
 *   @walking_skeleton  -- walking skeleton scenarios (run first)
 *   @US-HSS-01         -- story traceability tag
 *   @AC-HSS-*          -- acceptance criterion traceability tags
 */

export default {
  // Feature file paths
  paths: ['tests/acceptance/help-splash-screen/**/*.feature'],

  // Step definitions and world — use `import` with tsx for ESM-compatible TS loading
  import: ['tests/acceptance/help-splash-screen/steps/**/*.ts'],
  requireModule: ['tsx'],

  // Format output
  format: [
    'progress-bar',
    'json:reports/cucumber-help-splash-report.json',
    'html:reports/cucumber-help-splash-report.html',
  ],

  // Exclude @skip scenarios by default.
  tags: 'not @skip',

  // Timeout per step (milliseconds).
  // Process spawning and Node.js cold-start can take several seconds.
  timeout: 30_000,

  // Retry flaky scenarios once in CI.
  retry: process.env.CI ? 1 : 0,

  // Stop after first failure in local development; run all in CI.
  failFast: !process.env.CI,

  // World parameters
  worldParameters: {
    chromatoLogLevel: process.env.CHROMATO_LOG_LEVEL || 'silent',
  },
};
