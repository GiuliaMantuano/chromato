# Evolution: fix-narrow-terminal-strip

**Date**: 2026-04-05
**Feature ID**: fix-narrow-terminal-strip
**Type**: Bug fix (test helper, no production code changes)
**Author**: nw-platform-architect (finalize)

---

## Summary

Fixed a false positive in acceptance test AC-01.3 ("Progress bar renders correctly in a narrow 30-column terminal"). The test was incorrectly reporting overflow failures due to three compounding defects in the test output-processing pipeline. Production TUI output was correct throughout; all defects were confined to test helper code.

---

## Business Context

The narrow-terminal acceptance test (AC-01.3) is a behavioral gate for the chromato compact layout at 30 columns — a critical user-facing feature for terminal-native developers working in split panes and tmux layouts. A false positive in this gate blocks delivery by signaling a production defect that does not exist, adding unnecessary investigation overhead to the delivery cycle.

---

## Root Causes (3, independent, all in test helpers)

All three root causes are documented in full at `docs/analysis/rca-narrow-terminal-overflow-false-positive.md`.

### Root Cause A — stripAnsi regex incomplete for DEC private mode sequences
`helpers.ts` exported a `stripAnsi` function using `/\x1b\[[0-9;]*[A-Za-z]/g`. This regex covers SGR (color/style) and basic CSI sequences but does not match DEC private mode sequences such as `ESC[?1049h` (enter alternate screen) and `ESC[?1049l` (exit alternate screen), which use `?` as a parameter prefix byte in the 0x3F range. These sequences survived stripping and contributed literal characters to measured line lengths.

### Root Cause B — split('\n') does not reconstruct Ink screen lines
`narrow-terminal-steps.ts` split the captured output on `'\n'` only. Ink renders frames using cursor-movement sequences (`ESC[H`, `ESC[2J`) rather than plain newlines for all line boundaries. Where two visual lines were separated by cursor-movement bytes rather than `'\n'`, they merged into a single measured string after stripping, inflating column counts.

### Root Cause C — Multi-frame buffer accumulated duplicate lines
`runChromato` captures stdout for 3 seconds at 1 Hz render cadence, producing approximately 3 full render frames concatenated in one buffer. Splitting without deduplication caused identical lines from different frames to repeat, multiplying false overflow reports (5 total: 3 of the 37-char variant, 2 of the 53-char variant).

---

## Fix

### Files modified

| File | Change |
|------|--------|
| `tests/unit/acceptance-helpers/strip-escapes.test.ts` | New — regression tests proving the three root causes and verifying the fix |
| `tests/acceptance/pomodoro-timer-cli/steps/helpers.ts` | Added `stripAllEscapes()` export using full ECMA-48 CSI pattern `/\x1b\[[\x20-\x3F]*[\x40-\x7E]/g` |
| `tests/acceptance/pomodoro-timer-cli/steps/narrow-terminal-steps.ts` | Updated overflow assertion to use `stripAllEscapes`, `split(/\r\n|\r|\n/)`, and `[...new Set(lines)]` deduplication |

No files under `src/` were modified. No production behavior changed.

### Design choice: Option 2 (reusable helper)

The RCA proposed two fix options. Option 2 (extract `stripAllEscapes` to `helpers.ts`) was selected over Option 1 (inline regex in the step) because it documents the distinction between `stripAnsi` (content-presence assertions) and `stripAllEscapes` (column-width layout assertions), preventing the same class of defect in future step definitions.

---

## Steps Completed

| Step | Phase | Description | Result |
|------|-------|-------------|--------|
| 01-01 | RED_UNIT | Write failing unit test for `stripAllEscapes` and dedup logic | PASS |
| 01-01 | RED_ACCEPTANCE | Skipped — fix targets test helpers, no CLI driving-port acceptance test for internal test utility functions | SKIPPED (NOT_APPLICABLE) |
| 02-01 | RED_ACCEPTANCE | Verify acceptance scenario AC-01.3 fails before fix | PASS |
| 02-01 | RED_UNIT | Verify unit tests fail before fix | PASS |
| 02-01 | GREEN | Apply fix — add `stripAllEscapes`, update `narrow-terminal-steps.ts` | PASS |
| 02-01 | COMMIT | Commit fix | PASS |

### Commits

- `cd5f1d4` — `test(fix-narrow-terminal-strip): regression test for stripAnsi DEC sequence gap`
- `ef61a25` — `fix(narrow-terminal-strip): add stripAllEscapes covering DEC private modes`

---

## Mutation Testing

Skipped. No mutation testing tooling is installed in the project. Modified files are test helpers (not production source under `src/`); mutation testing of test helpers is out of scope per project Mutation Testing Strategy (per-feature, scoped to modified production files only).

---

## Review

**Reviewer**: adversarial review, haiku model
**Result**: APPROVED

---

## Lessons Learned

1. **Distinguish strip functions by use case**: `stripAnsi` (SGR only) is sufficient for content-presence assertions (does "WORK" appear in output?). Column-width layout assertions require a broader strip covering all CSI sequences per ECMA-48. These are now separated into two named exports in `helpers.ts`.

2. **Multi-frame buffers require deduplication for layout assertions**: Capturing N seconds of TUI output is appropriate for content verification. Layout measurement requires either single-frame extraction or explicit deduplication. Adding `[...new Set(lines)]` before layout assertions is a cheap and correct guard.

3. **Split on all TUI line endings**: TUI applications emit `\r\n` and `\r` as well as `\n`. Using `split(/\r\n|\r|\n/)` is the correct default for any step that measures line structure in captured terminal output.

4. **Inline root cause documentation in test helpers**: The `stripAllEscapes` export in `helpers.ts` includes a JSDoc comment explaining why it exists and when to use it over `stripAnsi`. This prevents the distinction from being lost when the RCA document is eventually discarded.

---

## References

- RCA document: `docs/analysis/rca-narrow-terminal-overflow-false-positive.md`
- Acceptance criteria: `docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md` (AC-01.3)
- Roadmap: `docs/feature/fix-narrow-terminal-strip/deliver/roadmap.json`
- Execution log: `docs/feature/fix-narrow-terminal-strip/deliver/execution-log.json`
