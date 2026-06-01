/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // Rule 1: domain must not import from adapters, application, or heavy external libs
    {
      name: 'domain-no-adapters',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'domain-no-application',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/application/' },
    },
    {
      name: 'domain-no-ink',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { dependencyTypes: ['npm'], path: '^ink$' },
    },
    {
      name: 'domain-no-react',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { dependencyTypes: ['npm'], path: '^react$' },
    },
    {
      name: 'domain-no-commander',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { dependencyTypes: ['npm'], path: '^commander$' },
    },
    {
      name: 'domain-no-better-sqlite3',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { dependencyTypes: ['npm'], path: '^better-sqlite3$' },
    },

    // Rule 2: application must not import from adapters, ink, or react
    {
      name: 'application-no-adapters',
      severity: 'error',
      from: { path: '^src/application/' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'application-no-ink',
      severity: 'error',
      from: { path: '^src/application/' },
      to: { dependencyTypes: ['npm'], path: '^ink$' },
    },
    {
      name: 'application-no-react',
      severity: 'error',
      from: { path: '^src/application/' },
      to: { dependencyTypes: ['npm'], path: '^react$' },
    },

    // Rule 3: statusAdapter and minimalAdapter must not import ink or react
    {
      name: 'status-adapter-no-ink',
      severity: 'error',
      from: { path: '^src/adapters/statusAdapter\\.' },
      to: { dependencyTypes: ['npm'], path: '^ink$' },
    },
    {
      name: 'status-adapter-no-react',
      severity: 'error',
      from: { path: '^src/adapters/statusAdapter\\.' },
      to: { dependencyTypes: ['npm'], path: '^react$' },
    },
    {
      name: 'minimal-adapter-no-ink',
      severity: 'error',
      from: { path: '^src/adapters/minimalAdapter\\.' },
      to: { dependencyTypes: ['npm'], path: '^ink$' },
    },
    {
      name: 'minimal-adapter-no-react',
      severity: 'error',
      from: { path: '^src/adapters/minimalAdapter\\.' },
      to: { dependencyTypes: ['npm'], path: '^react$' },
    },

    {
      name: 'help-adapter-no-ink',
      severity: 'error',
      from: { path: '^src/adapters/helpAdapter\\.' },
      to: { dependencyTypes: ['npm'], path: '^ink$' },
    },
    {
      name: 'help-adapter-no-react',
      severity: 'error',
      from: { path: '^src/adapters/helpAdapter\\.' },
      to: { dependencyTypes: ['npm'], path: '^react$' },
    },
    {
      name: 'banner-adapter-no-ink',
      severity: 'error',
      from: { path: '^src/adapters/bannerAdapter\\.' },
      to: { dependencyTypes: ['npm'], path: '^ink$' },
    },
    {
      name: 'banner-adapter-no-react',
      severity: 'error',
      from: { path: '^src/adapters/bannerAdapter\\.' },
      to: { dependencyTypes: ['npm'], path: '^react$' },
    },

    // Rule 4: adapters must not import each other
    {
      name: 'adapters-no-cross-import',
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: { path: '^src/adapters/' },
    },

    // Rule 5: firstRun guard must stay pure — no ink, react, or adapter imports
    // (ADR-012 DD-2). The guard runs on the help + non-interactive paths, so it
    // must never pull in the heavy TUI stack.
    {
      name: 'firstRun-no-external',
      severity: 'error',
      from: { path: '^src/firstRun\\.' },
      to: {
        path: ['^src/adapters/', '^ink$', '^react$'],
        dependencyTypes: ['npm', 'local'],
      },
    },
  ],

  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
