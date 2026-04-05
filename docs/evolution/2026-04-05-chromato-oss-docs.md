# Evolution: chromato-oss-docs

**Date**: 2026-04-05
**Feature ID**: chromato-oss-docs
**Phase**: 1 of 1 — GitHub Open Source Documentation
**Steps**: 9 of 9 — all COMMIT/PASS
**Delivery window**: 18:32 – 18:59 UTC

---

## What was delivered and why

chromato reached functional completion as a CLI Pomodoro timer. Before publishing to GitHub as an open source project, it lacked the community-health and repository-hygiene files that contributors, security reporters, and automated tooling expect. This delivery created that layer.

The work fell into three categories:

**Accuracy fix** — Two documentation files contained a stale latency claim (`<50ms`) for `chromato status` inherited from an early design target. The accepted specification is `<200ms wall-clock` (cold Node.js start) and `<5ms in-process`. README.md and `docs/reference/cli-reference.md` were updated to match.

**Community health files** — Standard open source root files were missing entirely: `CONTRIBUTING.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`. Each was created with content specific to the chromato project rather than generic templates.

**GitHub workflow integration** — `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, and `.github/PULL_REQUEST_TEMPLATE.md` were created to guide contributors toward actionable reports and well-structured PRs.

A minor `.gitignore` gap was also closed: `.env` and `.DS_Store` were absent from the ignore list.

---

## Key decisions made

**CONTRIBUTING.md is project-specific, not generic.** Rather than a boilerplate contributor guide, the document was written to reflect the actual stack (Node.js 20 LTS, pnpm, TypeScript strict mode), the actual test commands (`pnpm install`, `pnpm build`, `pnpm test`, `pnpm coverage`), and the three-layer test structure (`tests/unit/`, `tests/integration/`, `tests/acceptance/`). Conventional Commits format is required because the project's CHANGELOG depends on it.

**CHANGELOG format is Keep a Changelog.** The 1.0.0 entry enumerates all 14 delivered features explicitly rather than linking to commits. This is more useful for users evaluating an upgrade than a raw commit list.

**SECURITY.md prohibits public issue disclosure.** The reporting section directs reporters to a private channel and explicitly states not to open a public GitHub issue for security vulnerabilities. This is the standard responsible-disclosure pattern.

**Latency claim corrected at the specification boundary.** The `<50ms` figure was a design-phase aspiration. The shipped implementation is constrained by Node.js cold-start overhead; the correct observable guarantee is `<200ms wall-clock`. The `<5ms in-process` figure reflects the time spent inside the status command itself. Both figures are documented together so the distinction is clear to readers.

**Testing theater removed in the final commit.** An adversarial review of the doc-consistency tests identified assertions that could never fail (e.g., testing that a string is a subset of itself, or asserting the presence of content that had just been hard-coded into the test). Those assertions were removed. The remaining 85 tests verify real invariants on the actual repository files.

---

## Test coverage added

14 test files were created in `tests/unit/doc-consistency/`, totalling 85 tests. Each file corresponds to one or more repository files and verifies structural and content invariants:

| Test file | What it verifies |
|-----------|-----------------|
| `readme.test.ts` | No `<50ms` or `50ms` in README; `200ms wall-clock` and `5ms in-process` present |
| `contributing.test.ts` | CONTRIBUTING.md exists; sections for setup, PR process, Conventional Commits, code style; test directory references |
| `changelog.test.ts` | CHANGELOG.md exists; `## [1.0.0]` header; `Added` subsection; all 14 v1.0.0 features listed |
| `community-health.test.ts` | CODE_OF_CONDUCT.md contains Contributor Covenant 2.1; SECURITY.md has Supported Versions and Reporting sections; no instruction to open public issue |
| `issue-templates.test.ts` | Bug report has `name:` containing `bug`, required fields (Describe, Reproduce, Expected, Environment); feature request has `name:` containing `feature`, Problem and Solution sections |
| `pr-template.test.ts` | PR template has checklist items (`- [ ]`) covering tests, commit message, documentation, lint; has description prompt |
| `reference-docs.test.ts` | `docs/reference/cli-reference.md` contains no `50ms`; latency claim uses `200ms wall-clock` or `5ms in-process` |
| `license.test.ts` | LICENSE exists; contains `MIT License`; copyright line with `Giulia Mantuano`; standard permission grant text |
| `gitignore.test.ts` | `.gitignore` contains `node_modules`, `dist`, `coverage`, `.env`, `.DS_Store`; does not exclude `src/` or `tests/` |

Unit tests for this delivery are documentation-consistency checks with no application code under test. RED_UNIT was recorded as NOT_APPLICABLE for all 9 steps; RED_ACCEPTANCE and GREEN phases were executed for each step.

---

## Commits

| Hash | Message |
|------|---------|
| `bd92db2` | `docs(readme): update status latency from 50ms to 200ms wall-clock` |
| `bee9a56` | `docs: add CONTRIBUTING.md for open source contributors` |
| `5d913ae` | `docs: add CHANGELOG.md with v1.0.0 release entry` |
| `c216c0c` | `docs: add CODE_OF_CONDUCT.md and SECURITY.md` |
| `9542922` | `docs: add GitHub issue templates for bugs and feature requests` |
| `c260a50` | `docs: add GitHub pull request template` |
| `a913702` | `docs(cli-reference): update status latency from 50ms to 200ms wall-clock` |
| `7a1b38f` | `test(doc-consistency): add LICENSE verification test` |
| `20cde85` | `chore: add .env and .DS_Store to .gitignore` |
| `73784d4` | `test(doc-consistency): remove testing theater from doc verification tests` |

---

## Delivery artifacts

Source files created or updated:

- `README.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/reference/cli-reference.md`
- `.gitignore`

Test files created:

- `tests/unit/doc-consistency/` (14 files, 85 tests)

Delivery tracking preserved at:

- `docs/feature/chromato-oss-docs/deliver/roadmap.json`
- `docs/feature/chromato-oss-docs/deliver/execution-log.json`
