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
