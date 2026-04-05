# Evolution: fix-tui-flicker-regex

**Date**: 2026-04-05
**Feature ID**: fix-tui-flicker-regex
**Type**: Bug fix
**Wave**: DELIVER (bug-fix path via /nw-bugfix → /nw-deliver)

## Summary

Fixed a false-positive in the acceptance-test flicker detection step that caused
the `no full-screen flicker` scenario to fail even though `TuiAdapter` was
architecturally correct (using `rerender()` for all tick updates).

## Root Cause

The acceptance step at `tests/acceptance/pomodoro-timer-cli/steps/visual-progress-steps.ts`
used the regex `/process\.stdout\.write\s*\((?![^)]*unmount)/` to detect whether
`TuiAdapter` wrote directly to stdout for frame updates (which would cause flicker).

The negative lookahead `(?![^)]*unmount)` was intended to exempt the two
alternate-screen writes in `TuiAdapter`, but those writes used raw ANSI escape
string literals (`'\x1b[?1049h\x1b[2J\x1b[H'` and `'\x1b[?1049l'`) that do not
contain the word `unmount`. The lookahead therefore never matched, so the regex
reported a false positive: both writes were flagged as "direct stdout writes for
bar updates" when they are legitimate alternate-screen management calls.

## Fix

**Two coordinated changes:**

1. **`src/adapters/tuiAdapter.tsx`** — Extracted the two raw ANSI escape strings
   into named module-scope constants:
   ```typescript
   const ALTERNATE_SCREEN_ENTER = '\x1b[?1049h\x1b[2J\x1b[H';
   const ALTERNATE_SCREEN_EXIT  = '\x1b[?1049l';
   ```
   Both `process.stdout.write` call sites updated to reference these constants.

2. **`tests/acceptance/pomodoro-timer-cli/steps/visual-progress-steps.ts`** —
   Updated the lookahead from `(?![^)]*unmount)` to `(?![^)]*ALTERNATE_SCREEN)`.
   The new lookahead correctly exempts both write sites because their argument
   tokens now contain the identifier `ALTERNATE_SCREEN`.

## Steps Completed

| Step   | Name                                                             | Status |
|--------|------------------------------------------------------------------|--------|
| 01-01  | Write failing regression test proving broken regex false positive | DONE   |
| 01-02  | Extract named constants in tuiAdapter.tsx and update regex       | DONE   |

## Key Decisions

- **Named constants over inline exemption list**: Naming the constants
  `ALTERNATE_SCREEN_ENTER` / `ALTERNATE_SCREEN_EXIT` makes the intent
  self-documenting and gives the lookahead a stable, searchable identifier to
  match on. Any future alternate-screen write that follows the same naming
  convention is automatically exempt; a genuinely bad raw-string write remains
  flagged.

- **No production behaviour change**: The ANSI sequences written to stdout are
  identical before and after the fix. Only the identifiers in the source text
  changed.

## Commits

- `c904ae6` — test(fix-tui-flicker-regex): regression test for broken regex false positive — step 01-01
- `6069309` — fix(fix-tui-flicker-regex): named ALTERNATE_SCREEN constants + updated lookahead — step 01-02

## Lessons Learned

- Regex heuristics that match on human-readable identifiers (like `unmount`) are
  fragile when the actual argument is a raw escape string. Prefer matching on
  identifier names by using named constants at the call site.
- The `failFast: true` setting in the local cucumber config masked this failure
  throughout development because an earlier scenario (`fix-narrow-terminal-strip`)
  was stopping the run first. Fixing the narrow-terminal bug unmasked the flicker
  false positive.

## Related

- `docs/evolution/2026-04-05-fix-narrow-terminal-strip.md` — the preceding fix that
  unmasked this failure
