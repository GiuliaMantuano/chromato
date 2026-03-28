/**
 * Cucumber-JS configuration for chromato acceptance tests.
 *
 * Feature ID : pomodoro-timer-cli
 * Framework  : @cucumber/cucumber (TypeScript)
 * Runner     : cucumber-js
 *
 * Usage:
 *   pnpm cucumber-js --config tests/acceptance/pomodoro-timer-cli/cucumber.config.ts
 *
 * CI usage (from environments.yaml acceptance stage):
 *   pnpm cucumber-js
 *
 * Tags:
 *   @skip    -- scenario not yet implemented; excluded from run
 *   @walking_skeleton -- walking skeleton scenarios (run first)
 *   @property -- property-shaped criteria (signals DELIVER wave to use property-based testing)
 *   @US-01 through @US-05 -- story traceability tags
 *   @infrastructure -- CI benchmark and infrastructure smoke tests
 */

export default {
  // Feature file paths
  paths: ['tests/acceptance/pomodoro-timer-cli/**/*.feature'],

  // Step definitions and world
  require: ['tests/acceptance/pomodoro-timer-cli/steps/**/*.ts'],
  requireModule: ['ts-node/register'],

  // Format output
  format: [
    'progress-bar',
    'json:reports/cucumber-report.json',
    'html:reports/cucumber-report.html',
  ],

  // Exclude @skip scenarios by default.
  // To run a specific tagged scenario: --tags '@walking_skeleton and not @skip'
  tags: 'not @skip',

  // Timeout per step (milliseconds).
  // TUI tests may wait up to 10 seconds for a phase transition.
  timeout: 30_000,

  // Retry flaky scenarios once in CI.
  retry: process.env.CI ? 1 : 0,

  // Stop after first failure in local development; run all in CI.
  failFast: !process.env.CI,

  // World parameters (available in step definitions via this.parameters).
  worldParameters: {
    chromatoLogLevel: process.env.CHROMATO_LOG_LEVEL || 'silent',
  },
};
