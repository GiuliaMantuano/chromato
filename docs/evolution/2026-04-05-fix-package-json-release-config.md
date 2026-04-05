# Evolution: fix-package-json-release-config

**Date**: 2026-04-05
**Feature ID**: fix-package-json-release-config
**Type**: Pre-release packaging fix
**Scope**: `package.json` metadata corrections for npm publish readiness

---

## Feature Summary

Corrected three categories of stale metadata in `package.json` ahead of the v1.0.0 npm publish:

1. **Version bump**: `0.1.0` -> `1.0.0`
2. **GitHub URL corrections**: replaced placeholder organisation `chromato/chromato` with the correct `GiuliaMantuano/chromato` in `repository.url`, `homepage`, and `bugs.url`
3. **Files array**: added `CHANGELOG.md` to the published file set (`['dist/', 'README.md', 'LICENSE', 'CHANGELOG.md']`)

A regression test file (`tests/unit/doc-consistency/package-json.test.ts`) was introduced first to confirm the bugs were present (all four assertions failing), then the fixes were applied to make all assertions pass. No other fields in `package.json` were modified.

---

## Business Context

These fixes are required before publishing chromato to npm as v1.0.0. Incorrect GitHub URLs in a published package prevent users from filing issues, navigating to the homepage, or resolving the source repository. An absent `CHANGELOG.md` in the files array means consumers cannot read release notes after install. Publishing with the wrong version signals a pre-release state to the npm registry. Fixing these before publish avoids having to yank and re-publish the initial release.

---

## Steps Completed

| Step | Name | Outcome |
|------|------|---------|
| 01-01 | Write regression tests that prove the current package.json bugs exist | PASS |
| 01-02 | Apply the three targeted changes to package.json so all regression tests pass | PASS |

### Execution detail (from execution-log.json)

**Step 01-01**
- PREPARE: PASS
- RED_ACCEPTANCE: PASS — four assertions failing as expected against stale package.json
- RED_UNIT: SKIPPED (not applicable — the test file itself is the deliverable for this step)
- GREEN: SKIPPED (checkpoint pending — package.json fix happens in step 01-02)
- COMMIT: SKIPPED (checkpoint pending — commit deferred to after fix)

**Step 01-02**
- RED_ACCEPTANCE: PASS — assertions confirmed failing before applying fix
- RED_UNIT: SKIPPED (not applicable — doc-consistency tests are the full test suite for this change)
- GREEN: PASS — all four assertions passing after applying fixes to package.json
- COMMIT: PASS
- PREPARE: PASS

---

## Lessons Learned

Execution was clean with no rework required. Two observations worth retaining:

- **Doc-consistency test pattern is effective**: the test-first approach for configuration correctness (write assertions that fail, then fix) provided clear verification without ambiguity about whether the fix was applied correctly.
- **Deferred commit is valid for multi-step atomic fixes**: when step 01-01 produces only a test file and step 01-02 produces the fix, committing both together after step 01-02 is correct. The execution log captured this with explicit CHECKPOINT_PENDING annotations rather than silently skipping.
