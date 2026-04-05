# Evolution: help-splash-screen

**Feature ID**: help-splash-screen
**Delivered**: 2026-04-05
**Type**: User-facing UX feature
**Commits**: 4 (one per step)

## Problem

Running `chromato` with no args showed plain Commander boilerplate with no visual identity.
The ASCII art banner was absent from the default help output.

## Solution

When `chromato` (no args) or `chromato --help` is invoked, the ASCII art banner +
tagline + styled examples now appear before Commander's help text.

## Architecture decisions

| Decision | Choice |
|----------|--------|
| Commander hook | `addHelpText('beforeAll')` — idiomatic, fires for all help invocations |
| Tagline dedup | Export `TAGLINE` from `bannerAdapter.ts`, remove from `program.description()` |
| Unicode detection | Shared `src/utils/unicodeDetect.ts` — consistent with progress bar fallback |
| `--no-color` scope | Promoted to program level — works globally across all subcommands |

## Files created/modified

| File | Change |
|------|--------|
| `src/utils/unicodeDetect.ts` | NEW — shared Unicode detection extracted from configLoader |
| `src/adapters/helpAdapter.ts` | NEW — `printHelpSplash(noColor, useAscii)` |
| `src/adapters/bannerAdapter.ts` | Export `TAGLINE` |
| `src/configLoader.ts` | Import `detectNonUnicode` from utils |
| `src/index.ts` | `addHelpText` hook, program-level `--no-color`, examples to after-hook |
| `.dependency-cruiser.cjs` | No-ink/react rules for helpAdapter and bannerAdapter |
| `tests/unit/utils/unicodeDetect.test.ts` | NEW |
| `tests/unit/adapters/helpAdapter.test.ts` | NEW |
| `tests/unit/index-help.test.ts` | NEW |
