/**
 * esbuild build script for chromato.
 *
 * Bundles src/index.ts into dist/index.js.
 * Target: Node.js 20, ESM output with shebang header for executable CLI.
 *
 * Uses ESM format (not CJS) because Ink 4.x uses top-level await and ESM.
 * dist/package.json marks the dist directory as ESM ("type": "module").
 *
 * Code splitting is enabled so that dynamic import('./adapters/tuiAdapter.js')
 * in src/index.ts produces a separate chunk. This keeps ink/react off the
 * module graph for `chromato status` (AC-03.1 / AC-NF1: status <50ms cold start).
 */

import { build } from 'esbuild';
import { writeFileSync, readFileSync, chmodSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read version from package.json to inject at build time
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

mkdirSync(join(__dirname, 'dist'), { recursive: true });

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  // Use outdir + splitting so dynamic import() produces a real separate chunk.
  // This keeps ink/react off the import graph for `chromato status`.
  outdir: 'dist',
  splitting: true,
  // Inject version at build time so no runtime package.json read is needed
  define: {
    '__CHROMATO_VERSION__': JSON.stringify(pkg.version),
  },
  // Externalize all runtime deps — they live in node_modules for npm installs.
  // This avoids CJS/ESM interop issues when bundling mixed-format packages.
  external: [
    'better-sqlite3',
    'commander',
    'chalk',
    'ink',
    'react',
    'node-notifier',
    'react-devtools-core',
  ],
  sourcemap: true,
  logLevel: 'info',
  metafile: false,
  // JSX support for Ink/React TUI components
  jsx: 'automatic',
  jsxImportSource: 'react',
  plugins: [],
});

// Write a dist/package.json that marks the dist directory as ESM.
writeFileSync(
  join(__dirname, 'dist', 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n'
);

// Prepend the shebang line to make the output directly executable
const outputPath = join(__dirname, 'dist', 'index.js');
const content = readFileSync(outputPath, 'utf8');
if (!content.startsWith('#!/usr/bin/env node')) {
  writeFileSync(outputPath, `#!/usr/bin/env node\n${content}`);
}

// Make the output executable
chmodSync(outputPath, '755');
console.log('Build complete: dist/index.js');
