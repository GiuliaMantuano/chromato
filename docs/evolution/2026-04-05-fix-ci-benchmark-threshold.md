# Evolution: fix-ci-benchmark-threshold

**Date**: 2026-04-05
**Feature ID**: fix-ci-benchmark-threshold
**Wave**: DELIVER (bugfix)

---

## Feature Summary

Updated the CI benchmark gate for the `chromato status` command from the stale 50ms threshold to 200ms wall-clock, matching the Node.js cold-start reality already documented in the README and cli-reference.

The threshold in `.github/workflows/ci.yml` (benchmark quality gate, lines 285-286) was comparing median execution time against 50ms. The actual cold-start performance of `chromato status --format tmux` is approximately 100-200ms on a modern machine due to Node.js module load time. The README and cli-reference both document 200ms as the expected wall-clock benchmark. The stale 50ms gate would have failed CI on every release without any regression in the code.

---

## Business Context

The CI pipeline enforces a performance gate on `chromato status --format tmux`, a high-frequency path used by tmux users to update their status bar on every prompt. The intent of the gate is to catch performance regressions, not to fail on documented and stable startup costs.

Leaving the threshold at 50ms would cause CI to fail on every release, blocking all future deliveries of chromato until the discrepancy was noticed and manually corrected. By aligning the CI gate with the value already published in user-facing documentation, the pipeline becomes a reliable regression detector rather than a source of false failures.

---

## Steps Completed

| Step | Name | Outcome |
|------|------|---------|
| 01-01 | Regression test proving stale 50ms threshold exists | PASS — test file `tests/unit/doc-consistency/ci-benchmark-threshold.test.ts` created; test failed against the original file as expected (RED confirmed) |
| 01-02 | Update CI benchmark threshold from 50ms to 200ms | PASS — `.github/workflows/ci.yml` lines 285-286 updated; regression test now passes (GREEN confirmed); committed |

**Total steps**: 2 of 2 completed. All phases executed cleanly with no rework required.

---

## Lessons Learned

Minimal. This was a clean, single-concern fix with a clear before/after state.

One observation worth recording: doc-consistency tests (tests that read config or workflow files and assert specific values) are a lightweight and effective mechanism for preventing documentation drift from diverging with CI configuration. The pattern used here — a test that reads the workflow YAML and asserts the threshold string — caught the inconsistency mechanically and will prevent it recurring. This pattern is worth replicating for other CI quality gate thresholds that have documented equivalents in user-facing docs.
