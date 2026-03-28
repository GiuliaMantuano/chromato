/**
 * esbuild build script for chromato.
 *
 * Bundles src/index.ts into dist/index.js.
 * Target: Node.js 20, CJS output with shebang header for executable CLI.
 *
 * Note: We use CJS format for the bundle because esbuild does not support
 * adding a shebang banner to ESM output cleanly. The package.json keeps
 * "type": "module" for source files; the dist bundle is self-contained.
 */

import { build } from 'esbuild';
import { writeFileSync, readFileSync, chmodSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

mkdirSync(join(__dirname, 'dist'), { recursive: true });

const result = await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  // Use CJS so require() for package.json works and shebang is clean
  format: 'cjs',
  outfile: 'dist/index.js',
  // Externalize native addons that cannot be bundled into JS
  external: ['better-sqlite3'],
  // No banner here -- we prepend shebang manually below
  sourcemap: true,
  logLevel: 'info',
  metafile: false,
});

// Prepend the shebang line to make the output directly executable
const outputPath = join(__dirname, 'dist', 'index.js');

// Write a dist/package.json that marks the dist directory as CommonJS.
// This allows Node.js to load dist/index.js as CJS even though the root
// package.json has "type": "module".
writeFileSync(
  join(__dirname, 'dist', 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n'
);
const content = readFileSync(outputPath, 'utf8');
if (!content.startsWith('#!/usr/bin/env node')) {
  writeFileSync(outputPath, `#!/usr/bin/env node\n${content}`);
}

// Make the output executable
chmodSync(outputPath, '755');
console.log('Build complete: dist/index.js');
