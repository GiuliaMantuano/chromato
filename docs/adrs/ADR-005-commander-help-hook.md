# ADR-005: Commander 12 Hook for Styled Help Output

**Status**: Accepted
**Date**: 2026-04-05
**Feature**: help-splash-screen

---

## Context

The help-splash-screen feature requires the ASCII art banner and styled preamble to appear before Commander's rendered help text whenever `chromato` is invoked with no arguments or `--help`. Commander 12 provides multiple mechanisms for injecting content around its help output.

Quality attributes at stake:
- **Maintainability**: the hook must not require knowledge of Commander internals or be brittle against Commander patch releases
- **Performance**: the help path must complete in < 100ms (NFR-01); no ink/react import is permitted
- **Correctness**: the hook must fire for both no-args and `--help` invocations, and must not break `--version` or `help [command]` behavior

---

## Decision

Use `program.addHelpText('beforeAll', callback)` at the program (root) level.

The callback resolves `noColor` from `process.argv` and `process.env.NO_COLOR` (Commander's option parsing is not complete at callback execution time), then calls `printBanner(noColor)` and `printHelpSplash(noColor, useAscii)` in sequence.

---

## Alternatives Considered

### Option 1 (Chosen): `addHelpText('beforeAll', fn)`

**Pros**:
- Documented Commander 12 public API
- Fires before help text for the program AND any subcommand (`beforeAll` semantics)
- Does not intercept `--version` output
- Synchronous callback; no async complications
- Trivially testable: callback is an ordinary function

**Cons**:
- Fires before `start --help` too (banner appears before subcommand help). Acceptable for MVP; only one subcommand exists. Post-MVP: can use `'before'` scoped to program only.
- `program.opts()` is not fully settled inside the callback; `noColor` must be resolved from `process.argv` directly

### Option 2: `configureOutput({ writeOut })`

Intercept all Commander stdout writes to prepend the banner.

**Rejected**: intercepts version output, error messages, and all subcommand help indiscriminately. Requires the callback to detect which output it is intercepting. Fragile against Commander internal rendering changes. Increases accidental complexity with no benefit over `addHelpText`.

### Option 3: Override `.outputHelp()`

Override the program's `outputHelp()` method to call `printBanner` before delegating to the original implementation.

**Rejected**: `.outputHelp()` is not triggered on the no-args path in Commander 12 when no default command and no explicit `.action()` is registered at the program level. This would require adding a program-level `.action()` solely to trigger the override — hidden coupling that contradicts the intent of having Commander handle the no-args case natively.

---

## Consequences

**Positive**:
- Single, idiomatic Commander 12 API call in `src/index.ts`
- Banner displays correctly for both `chromato` (no-args) and `chromato --help`
- No impact on `chromato --version` output
- Testable: `printHelpSplash` can be tested by direct import; `addHelpText` callback can be tested via Commander's `helpInformation()` + stdout capture

**Negative**:
- Banner appears before `chromato start --help` (subcommand help). This is a cosmetic trade-off acceptable for a single-subcommand CLI. If subcommands multiply post-MVP, scope the hook to `'before'` (program-only) rather than `'beforeAll'`.
- `noColor` resolution inside the callback reads `process.argv` rather than `program.opts()`. This is the same pattern used by the existing `status` fast-path and is consistent with how `bannerAdapter.ts` reads `process.env.NO_COLOR` directly.
