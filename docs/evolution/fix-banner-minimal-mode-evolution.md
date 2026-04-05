# Evolution: fix-banner-minimal-mode

**Feature ID**: fix-banner-minimal-mode
**Delivered**: 2026-04-05
**Type**: Bug fix
**Commits**: 2 (regression test + fix)

## Problem

`chromato start --minimal` produced no banner output. `printBanner()` in
`src/adapters/bannerAdapter.ts` had zero call sites in `src/index.ts`.

## Root Cause

The minimal path in `src/index.ts` was authored without a `printBanner()` call.
A subsequent commit removed the only existing call site (from the TUI path, correctly —
TUI uses alternate screen which is banner-incompatible) without auditing whether the
minimal path needed its own independent call. Compounded by a misleading JSDoc comment
("before the TUI renders") that implied the banner was TUI-only.

## Fix

1. `src/index.ts`: added `bannerAdapter.js` to the parallel import array in the minimal
   path; added `printBanner(opts.color === false)` call before `service.run(config)`.
2. `src/adapters/bannerAdapter.ts`: corrected JSDoc to state banner is minimal-only (not TUI).
3. `tests/regression/bannerAdapter.regression.test.ts`: regression test that asserts banner
   tagline appears before timer output in the minimal mode startup sequence.

## Architectural note

`bannerAdapter` is imported only in `src/index.ts` (composition root). It is NOT imported
in `minimalAdapter.ts` — that would violate arch rule 4 (adapters must not import each other).

## Files modified

- `src/index.ts`
- `src/adapters/bannerAdapter.ts`
- `tests/regression/bannerAdapter.regression.test.ts`
- `vitest.config.ts` (added regression test glob pattern)
