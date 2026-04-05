# Evolution: fix-cross-wave-doc-consistency

**Date**: 2026-04-05
**Feature ID**: fix-cross-wave-doc-consistency
**Type**: Documentation back-propagation (no source code changes)
**Wave**: DELIVER (documentation-only delivery)

---

## Feature Summary

A cross-wave consistency review of the `pomodoro-timer-cli` and `help-splash-screen` features identified 5 stale documentation references that were never back-propagated after the decisions that superseded them. This feature corrects all 5 inconsistencies across discuss, design, and deliver artifacts, ensuring that future contributors and architects read accurate information.

All changes are markdown-only. No `src/` files were modified. Each fix was gated by a RED-then-GREEN doc-consistency test in `tests/unit/doc-consistency/`.

---

## Steps Completed

All 5 steps in phase 01 completed on 2026-04-05. Each followed the PREPARE → RED → GREEN → COMMIT sequence.

| Step | Name | Result | Committed |
|------|------|--------|-----------|
| 01-01 | Fix AC-03.1 threshold in acceptance-criteria.md | PASS | 2026-04-05T18:07:47Z |
| 01-02 | Document StatusFormatPort in component-boundaries.md | PASS | 2026-04-05T18:07:27Z |
| 01-03 | Fix commander.js version reference in technology-stack.md | PASS | 2026-04-05T18:10:13Z |
| 01-04 | Update product-roadmap.md with help-splash-screen and bug fixes | PASS | 2026-04-05T18:14:58Z |
| 01-05 | Update roadmap-v2.md header and 50ms references | PASS | 2026-04-05T18:15:47Z |

---

## Key Decisions: Why Each Fix Was Needed

### Step 01-01: AC-03.1 performance threshold (acceptance-criteria.md)

The original `chromato status --format tmux` acceptance criterion stated "in under 50ms" — a threshold derived from an assumed compiled binary distribution. The MVP ships via `npm install -g` / `npx`, which requires Node.js cold-start (80–120ms). The revised threshold of 200ms (wall-clock subprocess time) was documented in `upstream-issues.md` Issue 1 but was never applied to `acceptance-criteria.md`. Without this correction, the CI acceptance gate would be permanently red on the npm-distributed MVP.

### Step 01-02: StatusFormatPort missing from component-boundaries.md

`StatusFormatPort` is defined in `src/domain/ports.ts` and is the contract between `StatusService` (application layer) and `StatusAdapter` (adapters layer). It was omitted from the design document, leaving future architects without visibility into the status-path contract. The architectural rationale — that `StatusFormatPort` is deliberately separate from `RenderPort` because the status path is a short-lived process, not a long-running tick loop — was implicit in the code but absent from the design artifact.

### Step 01-03: commander.js version in technology-stack.md

During DELIVER, `commander` was upgraded from `^12.0` to `^14.0.3` in `package.json` with no breaking changes. The upgrade was not back-propagated to `technology-stack.md`, which still referenced `12.x` in both the section heading and the runtime dependency table. Any developer reading the design docs would have installed the wrong version.

### Step 01-04: product-roadmap.md missing QA enhancements and help-splash-screen

`product-roadmap.md` had five stale items after the QA wave: the Last Updated date was 2026-04-03, Milestone 3 still referenced the 50ms threshold for `chromato status`, the US-03 closure note still cited the 50ms gate, the `help-splash-screen` feature (delivered post-gate) was not recorded, and six bug fixes (fix-pomodoro-counter-overflow, fix-overdue-float-seconds, fix-banner-minimal-mode, fix-tui-terminal-blocking, fix-narrow-terminal-strip, fix-tui-flicker-regex) were absent. The roadmap is the primary delivery history artifact; omitting these items would misrepresent the v1.0 scope.

### Step 01-05: roadmap-v2.md stale date and 50ms references

`roadmap-v2.md` carried a `Last reviewed` date of 2026-04-04, did not mention any QA enhancements in its progress summary, and step 01-03's goal and acceptance criteria text still contained "under 50ms". This was the delivery-coordination document used during the `pomodoro-timer-cli` deliver wave; leaving it stale would mislead any team member resuming or auditing that delivery.

---

## Artifacts Produced

### Test files (5, all in tests/unit/doc-consistency/)

| File | What it validates |
|------|-------------------|
| `tests/unit/doc-consistency/ac-threshold.test.ts` | AC-03.1 row in acceptance-criteria.md contains 200ms threshold and post-MVP 50ms note |
| `tests/unit/doc-consistency/port-docs.test.ts` | component-boundaries.md Port Interfaces section contains StatusFormatPort with all 3 method signatures |
| `tests/unit/doc-consistency/tech-stack.test.ts` | technology-stack.md heading and table row reference 14.x, not 12.x |
| `tests/unit/doc-consistency/product-roadmap.test.ts` | product-roadmap.md date, threshold, v1.0 QA section, all 6 bug fix names, and traceability row |
| `tests/unit/doc-consistency/delivery-roadmap.test.ts` | roadmap-v2.md date, help-splash-screen in header, step 01-03 shows 200ms |

### Documentation files updated (5)

| File | Change summary |
|------|---------------|
| `docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md` | AC-03.1 threshold updated from 50ms to 200ms wall-clock with post-MVP compiled binary note |
| `docs/feature/pomodoro-timer-cli/design/component-boundaries.md` | StatusFormatPort block added to Port Interfaces section with method signatures and architectural rationale |
| `docs/feature/pomodoro-timer-cli/design/technology-stack.md` | commander version updated from 12.x to 14.x in heading and dependency table |
| `docs/feature/pomodoro-timer-cli/deliver/product-roadmap.md` | Date updated, 50ms threshold corrected to 200ms, v1.0 QA Enhancements section added, all 6 bug fix names recorded, help-splash-screen traceability row added |
| `docs/feature/pomodoro-timer-cli/deliver/roadmap-v2.md` | Last reviewed date updated, QA enhancements recorded in header, step 01-03 references corrected from 50ms to 200ms |

---

## Lessons Learned

- Design documents (component-boundaries, technology-stack) drift from implementation during DELIVER when version upgrades and new ports are introduced without a back-propagation step. A lightweight "did design docs change?" checklist at the end of each deliver step would prevent this class of inconsistency.
- Performance thresholds in acceptance criteria must reference the distribution model explicitly (compiled binary vs npm-distributed). Threshold values without distribution context become contradictory as the project evolves.
- Doc-consistency tests in `tests/unit/doc-consistency/` are an effective low-cost mechanism for locking documentation invariants. The RED-first discipline applies equally to doc fixes as to code changes.
