# Evolution Archive — bug-fix workspaces (consolidated)

**Date**: 2026-06-05 | **Type**: consolidated archive of 9 small bug-fix features
**Model**: nWave legacy multi-file (no SSOT)

This single file replaces nine tiny `docs/feature/fix-*/` workspaces (each 1–3 files,
mostly a `roadmap.json` + `execution-log.json`). All nine shipped to `main`; their full
DES records remain recoverable from the git history. They are consolidated here rather
than given nine near-empty evolution files of their own.

## The fixes

| Feature | What it fixed | Key commit(s) |
|---------|---------------|---------------|
| `fix-cold-start-tolerance` | Re-baselined the start-up budget: first-frame tolerance `AC-NF1` from a stale 100ms to **700ms wall-clock** (cold Node.js start); aligned the acceptance docs. | `3e9946c`, `0fe414c` |
| `fix-help-examples-position` | `chromato --help` ordering: moved the **examples block before** Commander's usage output. | `6faffd6` |
| `fix-macos-notification-silent` | macOS desktop notifications were silently failing to appear — restored delivery. | PR #48 (`6b99cc5`) |
| `fix-notification-copy-units` | Restored time units in notification copy so it reads naturally at any duration (fixed ambiguous "Take 1." → "Take a proper {n}-minute break."). Via `/nw-bugfix`. | PR #65 (`91a10b6`) |
| `fix-overdue-float-seconds` | Floor seconds in `formatOverdueCountdown` to stop fractional-second display in the OVERDUE counter. | `30daf2f`, `33d5004` |
| `fix-pomodoro-counter-overflow` | Fixed `currentPomodoro` overflow after a full cycle (session count / streak). | `6246bb5` |
| `fix-q-quit-any-screen` | Made `Q` quit the first-run setup wizard from **any** screen (was Welcome-only). Regression-test-first TDD via `/nw-bugfix`. | (in PR #60 line) |
| `fix-testing-locally-docs` | Replaced hardcoded personal paths and updated four stale claims in `TESTING-LOCALLY.md`. | `3627e41`, `62a205f` |
| `fix-tui-terminal-blocking` | Regression tests R1–R5 + fix for TUI terminal-blocking bugs. | `9656994` |

## Notes

- Each fix carries its own regression test in `tests/` (kept — they guard the bug, the
  workspace docs did not).
- The full per-fix wave records (roadmap.json, execution-log.json, RCA/acceptance-design)
  lived under `docs/feature/fix-*/` and are preserved in the git history (workspaces
  archived + removed in this change).
