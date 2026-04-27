# ADR-006: Startup-Budget Alignment for `chromato start` (Node.js MVP vs Compiled-Binary Post-MVP)

**Status**: Accepted
**Date**: 2026-04-27
**Feature**: pomodoro-timer-cli (start path)

---

## Context

While verifying the Cucumber acceptance pipeline on CI (PR #34), the scenario "First TUI frame appears within 100 milliseconds of starting a session" failed on every GitHub-Actions runner with empirical measurements of 166-297ms. Local runs on developer hardware passed (median 84ms). The 8-hour RCA that followed (`docs/troubleshooting/2026-04-27-ci-state-and-followups.md` postscript) surfaced two compounding issues; this ADR addresses the second one.

Audit of the project's documentation revealed an existing inconsistency that pre-dated PR #34:

| Document | Stated startup target |
|---|---|
| `docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md` (AC-05.1, AC-NF1) | **<700ms wall-clock** (Node.js + Ink startup); **<100ms post-MVP compiled binary** |
| `CLAUDE.md` Key Behavioral Contracts | <100ms |
| `docs/feature/pomodoro-timer-cli/design/architecture-design.md` (Performance attributes; Section 6.2) | <100ms |
| `docs/feature/pomodoro-timer-cli/design/wave-decisions.md` (justified targets table; CI checklist) | 100ms |
| `tests/acceptance/pomodoro-timer-cli/milestone-4-session-lifecycle.feature:32` | 100ms (test assertion) |
| `docs/feature/pomodoro-timer-cli/distill/walking-skeleton.md` | 100 milliseconds |
| `docs/feature/pomodoro-timer-cli/devops/ci-cd-pipeline.md:168` | <100ms |
| `docs/feature/pomodoro-timer-cli/devops/environments.yaml:256` | <100ms |

The acceptance-criteria document — the source of truth for ACs in this project — had been correctly qualified ("post-MVP compiled binary target: <100ms"), but the qualifier was never propagated to the seven downstream artifacts. The 100ms figure they cite is the post-MVP target, not the MVP budget. None of the downstream documents acknowledge this distinction.

The RSS NFR was previously revised on 2026-03-28 (20MB → 35MB) for the same reason: an aspirational figure outlived its empirical basis once the Node.js stack was actually measured. The startup figure is the same shape of issue, caught at a different waveform of the same investigation.

## Decision

Align all downstream artifacts with the source-of-truth AC:

- **MVP target (Node.js + Ink + better-sqlite3 + node-notifier)**: **<700ms** wall-clock from process spawn to first stdout byte of TUI frame content. With the test harness's existing 50ms tolerance, the assertion budget is 750ms.
- **Post-MVP target (compiled single-file binary, e.g. Node SEA per the post-MVP backlog)**: **<100ms**. Unchanged.

The post-MVP backlog already lists "Node.js SEA single-file binary (MVP uses npm install -g / npx)" (CLAUDE.md, "Excluded from MVP"). Once that ships, the <100ms target becomes empirically achievable because the binary path eliminates Node.js cold-start, ESM resolution, tsx transformation, and most of the better-sqlite3 native-module load cost.

## Empirical evidence

Measurements gathered during the RCA on 2026-04-27:

**Local first-byte time** (developer MacBook, M-series, warm filesystem cache, 10 cold-start runs of `node dist/index.js start`):

| Sample | first-byte (ms) |
|---|---|
| 1-10 | 117, 83, 83, 84, 83, 91, 83, 84, 84, 85 |
| Median | 84 |
| p95 | 117 |

**Local import-graph cost in isolation** (just the four start-path ESM imports): 39-42ms (5 runs, very stable).

**Local raw Node.js startup baseline** (empty `node -e "..."`): 30-40ms.

**GitHub Actions CI measurements** (workflow run 25006471759, four data points):

| Runner | first-byte (ms) |
|---|---|
| ubuntu-22.04 (run 1) | 297 |
| ubuntu-22.04 (run 2) | 266 |
| macos-14 (run 1) | 199 |
| macos-14 (run 2) | 166 |

The CI-vs-local ratio is ~2-3.5x, consistent with shared-runner CPU contention and cold filesystem cache. The 700ms MVP budget covers all observed CI numbers with >400ms headroom.

## Alternatives Considered

### Option 1 (Chosen): Align downstream artifacts with the documented AC (700ms MVP, <100ms post-MVP)

- **Pros**: Restores internal consistency. The 700ms figure is the value the AC-author already weighed against `clig.dev`'s CLI responsiveness heuristic. No new value is invented. The 100ms aspiration remains intact, attached to its already-planned post-MVP binary.
- **Cons**: Requires editing seven downstream artifacts. The user-facing MVP claim is now "sub-second startup" rather than "sub-100ms startup" — measurably less impressive but also accurate.

### Option 2 (Rejected): Pick a new value (e.g. 250ms) covering observed CI numbers with margin

- The original RCA proposed this. On audit it was rejected because (a) 250ms does not appear in any existing artifact, so adopting it would introduce a third value to track alongside the existing 700ms and 100ms; (b) it is no more empirically justified than 700ms; (c) it does not respect the AC-author's stated rationale (clig.dev heuristic) which already produced 700ms.

### Option 3 (Rejected): Optimise the start path to chase the original 100ms

- The empirical evidence shows even the local first-byte time (84ms median, 117ms p95) is already at the boundary on developer hardware. CI runners are 2-3.5x slower for reasons outside chromato's control (shared CPU, cold cache). Realistic optimisations:
  - Lazy-load `better-sqlite3` and `node-notifier` off the start path. Only the persistence adapter strictly needs sqlite; deferring its import would save an estimated 30-50ms on cold start.
  - Pre-build to a single-file binary (Node SEA). Already planned post-MVP; would actually achieve <100ms.
- Both optimisations are strictly more valuable than chasing the budget — but they are out of scope for fixing the stale documentation. They remain valid follow-up work; this ADR does not preclude them.

### Option 4 (Rejected): Mark the failing scenario `@skip` and leave the 100ms references in place

- The scenario was passing on developer hardware while failing on CI; skipping it would silence the actual signal we just paid eight hours of investigation to surface. Same anti-pattern as suppressing a CI timeout: it hides the problem, doesn't fix it.

## Consequences

### Positive

- All artifacts now agree on the same number for the same lifecycle phase.
- The <100ms claim survives, attached to its actually-achievable vehicle (the post-MVP binary).
- The acceptance pipeline produces a green result for the first-frame scenario on CI without code changes.
- A documented precedent exists for future "stale aspiration vs measured reality" mismatches (matching the RSS revision pattern).

### Negative

- The user-perceived MVP startup claim is now "<700ms" rather than "<100ms". For a Pomodoro timer this is below the threshold of frustration for the launch-and-go use case (chromato is invoked once at the start of a focus block, not interactively used many times per minute), but it is a real product-claim downgrade.
- ADR-001 ("Deliver a visually rich animated TUI with sub-100ms startup") and ADR-002 ("the 100ms startup budget accommodates [Ink's React reconciler]") still reference 100ms in their original Decision/Rationale sections. Per ADR convention these historical sections are not edited; instead, both ADRs receive a one-line "Superseded in part by ADR-006" footnote pointing here.

### Neutral / explicitly out of scope

- **Help-splash NFR remains <100ms.** The help path imports only `commander`, `chalk`, banner, help, and unicode utilities — no Ink, no React, no sqlite, no node-notifier. The 100ms target is plausibly achievable on this much smaller import graph and is not contradicted by any measurement gathered here. AC-HSS-07.1 and ADR-005 are unchanged. (`docs/feature/help-splash-screen/**` is entirely out of this ADR's scope.)
- **No production source code changes.** The fix is documentation-only, plus the `.feature` test assertion.
- **Lazy-loading `better-sqlite3` / `node-notifier`** off the start path is recommended as a follow-up work item (separate ticket, separate ADR if it changes the architecture diagram). It would tighten the MVP budget further but is not required to pass the revised 700ms target.

## Files affected

- `tests/acceptance/pomodoro-timer-cli/milestone-4-session-lifecycle.feature` (the AC-05.1 scenario at line 27-33; assertion 100 -> 700)
- `CLAUDE.md` (Key Behavioral Contracts entry for AC-NF1)
- `docs/feature/pomodoro-timer-cli/design/architecture-design.md` (Performance attribute summary; Section 6.2)
- `docs/feature/pomodoro-timer-cli/design/wave-decisions.md` (justified-targets table; CI checklist)
- `docs/feature/pomodoro-timer-cli/devops/environments.yaml` (AC-NF1 traceability comment)
- `docs/feature/pomodoro-timer-cli/devops/ci-cd-pipeline.md` (benchmark target table)
- `docs/feature/pomodoro-timer-cli/distill/walking-skeleton.md` (walking-skeleton scenario)
- This ADR (new)

## References

- `docs/troubleshooting/2026-04-27-ci-state-and-followups.md` (RCA narrative)
- `docs/adrs/ADR-001-language-choice.md` (original 100ms aspiration; partially superseded by this ADR)
- `docs/adrs/ADR-002-tui-library.md` (original 100ms budget reference; partially superseded by this ADR)
- `docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md` lines 84, 117 (the source-of-truth AC, already correctly qualified)
- RSS NFR revision precedent: `CLAUDE.md` "(revised from 20MB; Node.js 20 baseline)" and `docs/feature/pomodoro-timer-cli/design/wave-decisions.md` line ~34
- Workflow run with the empirical CI measurements: GitHub Actions run 25006471759 on PR #34
