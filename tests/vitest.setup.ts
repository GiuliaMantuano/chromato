// Vitest global setup.
//
// vitest 4 (vite 8 / the new module runner) provides a worker `console` that
// lacks the `Console` constructor. Ink's patchConsole() (via patch-console)
// does `new console.Console(...)` when render() mounts, so any test that mounts
// an Ink component throws "console.Console is not a constructor" under vitest 4.
// Restore the real Node constructor so Ink can patch the console as it does in
// production. (Test-environment shim only — no production behaviour is affected.)
import { Console } from 'node:console';

const c = globalThis.console as unknown as { Console?: unknown };
if (typeof c.Console !== 'function') {
  c.Console = Console;
}

// Ink detects CI (via `is-ci`) and switches to a log-friendly static render mode
// that skips the normal throttled incremental re-render path — this breaks any
// test that asserts on incrementally re-rendered frames (e.g. banner pulse
// cadence, mid-session copy changes) whenever the real environment has CI=true,
// which every CI provider sets by default. Ink reads `process.env['CI']` once
// at module-import time and honours the literal string 'false' as an explicit
// override (ink/build/ink.js: `isCi = process.env['CI'] === 'false' ? false :
// originalIsCi`) — set it here, before any test file imports 'ink', so tests
// exercise the same interactive rendering path real terminal users get.
// (Test-environment shim only — no production behaviour is affected; production
// never sets CI='false' itself.)
process.env['CI'] = 'false';
