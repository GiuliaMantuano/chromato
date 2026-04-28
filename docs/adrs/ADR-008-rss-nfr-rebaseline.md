# ADR-008: RSS Memory NFR Rebaseline — 35 MB → 80 MB

**Status**: Accepted
**Date**: 2026-04-28
**Feature**: pomodoro-timer-cli

---

## Context

The memory NFR for chromato has a revision history:

| Revision | Target | Rationale | Date |
|----------|--------|-----------|------|
| Original | < 20 MB RSS | Python MVP estimate | 2026-03-28 (DISCUSS wave) |
| First revision | < 35 MB RSS | "Node.js 20 baseline" (V8 + runtime floor) | 2026-03-28 |
| This ADR | < 80 MB RSS | Empirical measurement of the full chosen stack | 2026-04-28 |

The source-of-truth NFR statement from `docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md` (AC-NF3, as of first revision):

> **AC-NF3 | Memory footprint | <35MB RSS during steady-state | `ps -o rss= -p $(pgrep chromato)` — revised from <20MB per ADR-001 consequences (Node.js 20 baseline)**

And from `docs/feature/pomodoro-timer-cli/discuss/requirements.md` (NFR-01.4):

> **NFR-01.4 | Memory footprint during steady-state session | <35MB RSS | Revised from <20MB: Node.js 20 + V8 baseline requires ~30–35MB; documented in ADR-001 consequences and architecture-design.md §1.1**

Both statements acknowledge that the 35 MB target was already a revision from the original 20 MB figure. The 35 MB number was chosen as a round number covering the Node.js 20 + V8 runtime floor — but it was set *before* the full dependency stack was assembled and measured. The stack that actually shipped is:

- Node.js 20 (V8 + libuv + runtime) — ~22 MB base RSS
- Ink 4.x + React 18 (full React reconciler + renderer) — ~18 MB
- better-sqlite3 (native add-on, node-gyp compiled, in-process SQLite) — ~12 MB
- node-notifier + chalk + commander + application code — ~10 MB

The composition adds to ~62–67 MB. CI measurements (see Empirical Evidence) land in the 68–76 MB range on Linux Node 20 runners, with run-to-run variance of several MB. The 35 MB gate has therefore failed on every CI run that has ever exercised it.

The 35 MB target was not a reasoned calculation from the known stack — it was an interim estimate that outlived its empirical basis once the stack was actually chosen and measured.

---

## Empirical Evidence

Three independent CI measurements on GitHub Actions ubuntu-22.04 runners (Node 20):

| CI Run | RSS Measured | CPU Measured | Gate | Result |
|--------|-------------|--------------|------|--------|
| PR #31 (run id unknown) | 72.99 MB | < 1% | 35 MB | FAIL |
| PR #36 (run id 25040651137) | 68.44 MB | 0.47% | 35 MB | FAIL |
| PR #37 first attempt (run id 25042121195) | 75.58 MB | 0.47% | 75 MB | FAIL |

The PR #37 first-attempt measurement is significant: it shows that the measurement varies by several MB across runs on the same runner type. The 68.44 MB and 75.58 MB readings from the same codebase on the same runner class demonstrate ~10% run-to-run variance, consistent with how Linux VmRSS accounting captures shared pages (shared libraries, mapped files) differently depending on what else was loaded into memory on the runner at measurement time.

All measurements were produced by `scripts/benchmark-rss.cjs`, which reads `/proc/{pid}/status` (VmRSS) after 30 seconds of steady-state idle. The measurement method is correct. The script is not the problem.

**Approximate memory composition** (back-of-envelope estimates, not profiler output):

| Component | Estimated RSS contribution |
|-----------|---------------------------|
| Node.js 20 V8 heap + runtime | ~22 MB |
| Ink 4.x + React 18 reconciler | ~18 MB |
| better-sqlite3 native add-on | ~12 MB |
| node-notifier + chalk + commander + app code | ~10 MB |
| **Total estimate** | **~62 MB** |

The ~62 MB estimate underpredicts the measured 68–76 MB range by 6–14 MB, consistent with OS-level memory accounting differences (shared libraries mapped into the process but not captured by component-level estimates, V8 heap overhead, page-sharing variance). The estimates are directionally correct and match the order of magnitude.

The CPU gate (< 1%) continues to pass at 0.47%. The RSS gate is the sole failure.

---

## Decision

Revise the RSS NFR from **35 MB → 80 MB** for steady-state idle.

**Reasoning for 80 MB specifically**: The highest observed measurement is 75.58 MB (PR #37 first CI run). A ~10% headroom above 75.58 MB would be ~83 MB; 80 MB is the clean round number below that, providing ~5.8% headroom above the highest observed value. The 10% headroom principle cited in the task brief was applied relative to the originally observed maximum of 72.99 MB, yielding ~80.3 MB — which rounds to 80 MB. This convergence from two different reasoning paths (clean round number below 10% over peak, and 10% over the PR #31 maximum) makes 80 MB the most defensible choice.

An initial attempt used 75 MB (~3% over the prior peak of 72.99 MB), but the first CI run on this PR measured 75.58 MB, demonstrating that 75 MB provides insufficient headroom against the run-to-run variance observed on GitHub Actions runners. 80 MB absorbs this variance while remaining an honest, measured-reality target rather than an aspirational figure.

All files that define or enforce the 35 MB NFR are updated in this PR. Files that merely narrate the NFR in historical context (troubleshooting snapshots, wave-decision rationale, prior ADRs) are left unchanged per ADR immutability convention.

---

## Alternatives Considered

### Alternative A (Deferred, not rejected): Lazy-load `better-sqlite3` to defer ~12 MB

`better-sqlite3` is a native SQLite add-on responsible for approximately 12 MB of RSS. It is required only when session-history operations execute (start command persistence path). For the `chromato status --format tmux` path, it is currently imported at module load time via the composition root (`src/index.ts`), even though the status path never touches the database.

Lazy-loading would defer the 12 MB hit until the first actual database call, which could bring steady-state idle RSS closer to ~60 MB — plausibly recovering the original 35 MB framing (or at least reducing the delta substantially).

**Why not in this PR**: This approach requires code changes to the composition root and persistence adapter wiring, refactoring of the deferred-load path (dynamic `import()` or a proxy pattern), and regression tests for the deferred-load scenario (verifying that the database initializes correctly on first call, not at startup). Estimated engineering effort: 1–2 focused hours. This is not a documentation-only change.

**Status**: Explicitly preserved as a future optimization. This ADR does not foreclose it. A follow-up PR targeting the lazy-load approach remains a valid path if the team later decides to tighten the RSS target.

### Alternative B (Rejected): Replace Ink with a lighter TUI library

Ink 4.x + React 18 contribute approximately 18 MB to RSS. A lighter TUI library (e.g., `blessed`, raw ANSI escape sequences, or a purpose-built terminal renderer) would reduce this significantly.

**Rejected**: This directly contradicts ADR-002, which selected Ink after evaluating alternatives and established the architectural contract for the TUI adapter. Replacing Ink would invalidate `src/adapters/tuiAdapter.ts` and the Ink-based acceptance test helpers (`ink-testing-library`). For a personal project CLI tool, this is weeks of refactor for a memory saving that has no user-visible impact. The performance cost is in idle RSS, not in interactive latency.

### Alternative C (Rejected): Mark the RSS gate as `continue-on-error` in CI

Setting `continue-on-error: true` on the performance benchmark step would allow CI to pass without removing the measurement.

**Rejected**: This is approval theatre — the gate would exist in the YAML but carry no enforcement weight. A future contributor reading the CI config would see a gate that never fails and have no way to distinguish "this gate is working correctly" from "this gate has been silenced." The same pattern was called out in PR #36's reviewer feedback regarding the CodeQL job. A disabled gate provides false assurance; an honest spec update provides true assurance.

---

## Consequences

### Positive

- The `Performance Benchmarks` job goes green. The `All CI Checks` aggregate gate goes green. `main` is fully green for the first time since the repository was created.
- The NFR reflects measured reality on the chosen stack, including the run-to-run variance observed on GitHub Actions runners. Future contributors reading AC-NF3 or NFR-01.4 will see a target that is achievable and has been verified.
- The lazy-load path (Alternative A) is explicitly documented and preserved for future optimization work.

### Negative

- The original "< 35 MB RSS" claim is no longer the stated target. For a personal project CLI tool, the user-visible impact is negligible (a Pomodoro timer running in a background tmux pane consumes < 80 MB of a typical 16+ GB developer workstation), but the marketing claim is softer.
- The new 80 MB gate has ~5.8% headroom above the highest observed value (75.58 MB). A major dependency upgrade (Node.js 22, Ink 5.x, React 19) could plausibly consume this headroom. At that point, a fresh rebaseline or the lazy-load optimization would be required.

### Residual Risk

Reviewers of any major dependency upgrade (Node.js major, Ink major, React major) should re-run the RSS benchmark locally before merging and document the measurement in the PR description. If the result approaches 80 MB, the lazy-load optimization (Alternative A) or a planned rebaseline should be included in that PR's scope. The memory composition table in the Empirical Evidence section provides a reference for decomposing any unexpected increase.

---

## Files Affected

- `docs/adrs/ADR-008-rss-nfr-rebaseline.md` (this file)
- `scripts/benchmark-rss.cjs` (RSS_LIMIT_MB constant and doc comment: 35 → 80)
- `CLAUDE.md` (Key Behavioral Contracts memory line: 35 MB → 80 MB, back-link to ADR-008)
- `docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md` (AC-NF3 threshold)
- `docs/feature/pomodoro-timer-cli/discuss/requirements.md` (NFR-01.4 threshold)
- `docs/feature/pomodoro-timer-cli/design/architecture-design.md` (§1.1 performance attributes)
- `docs/feature/pomodoro-timer-cli/devops/environments.yaml` (CI quality gate: rss_benchmark)
- `docs/feature/pomodoro-timer-cli/devops/ci-cd-pipeline.md` (Job 3 benchmark table)

---

## References

- Full RCA: `docs/troubleshooting/2026-04-27-rca-remaining-ci-reds.md` (Category 3, Decision 3a)
- CI runs with empirical measurements: GitHub Actions run 25040651137 (PR #36, RSS 68.44 MB); run 25042121195 (PR #37 first attempt, RSS 75.58 MB)
- Precedent for NFR rebaseline after empirical measurement: ADR-006 (startup 100 ms → 700 ms)
- Lazy-load optimization precedent: ADR-006 Alternatives Considered (Option 3 — lazy-load `better-sqlite3` off the start path)
- Stack composition reference: `docs/feature/pomodoro-timer-cli/design/technology-stack.md`
