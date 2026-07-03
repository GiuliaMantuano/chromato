# ADR-019: RSS Memory NFR Rebaseline — 80 MB → 95 MB (Node 22)

**Status**: Accepted
**Date**: 2026-07-03
**Feature**: node-22-upgrade (backlog #7)

---

## Context

The Node 22 LTS runtime upgrade (see ADR-018) raised chromato's steady-state idle RSS above the 80 MB gate that ADR-008 established for Node 20. This was not unforeseen — ADR-008 explicitly predicted it and pre-authorized the remedy:

> *"The new 80 MB gate has ~5.8% headroom above the highest observed value (75.58 MB). A major dependency upgrade (Node.js 22, Ink 5.x, React 19) could plausibly consume this headroom. At that point, a fresh rebaseline or the lazy-load optimization would be required."* — ADR-008, Consequences → Negative

and, in its Residual Risk section, instructed reviewers of any major runtime upgrade to re-run the RSS benchmark and, if the result approaches 80 MB, include a rebaseline or the lazy-load optimization in that PR's scope.

This ADR is that rebaseline.

---

## Empirical Evidence

| Measurement | Runtime | RSS | CPU | Gate | Result |
|---|---|---|---|---|---|
| ADR-008 peak (PR #37, run 25042121195) | Node 20 | 75.58 MB | 0.47% | 80 MB | (basis for the 80 MB gate) |
| This PR (PR #12, run 28671427937, ubuntu-22.04) | **Node v22.23.1** | **84.97 MB** | 0.30% | 80 MB | **FAIL (RSS)** |

The Node 22 reading is **+9.4 MB (~12%)** above the Node 20 peak. The increase is attributable to Node 22's heavier V8 runtime floor, not to a regression:

- **`src/**` is untouched** in this PR (verified: `git diff --stat -- src/` is empty across the branch) — there is no new code path that could leak memory.
- **CPU is unchanged** and passing (0.30% vs 1% limit).
- The rise is consistent with the documented growth of the V8 baseline across major Node versions.

Measurement method is unchanged (`scripts/benchmark-rss.cjs` reads `/proc/{pid}/status` VmRSS after 30 s steady-state idle). The script is not the problem — the gate value predates the new runtime.

---

## Decision

Revise the RSS NFR from **80 MB → 95 MB** for steady-state idle. CPU gate unchanged (< 1%).

**Reasoning for 95 MB specifically**: The single observed Node 22 measurement is 84.97 MB. Applying ~12% headroom (84.97 × 1.12 ≈ 95.2) yields 95 MB — comfortably absorbing the ~10% run-to-run variance ADR-008 documented on GitHub Actions runners. ADR-008's own history is instructive here: it first tried 75 MB (~3% over peak), which promptly re-failed on variance, before settling on 80 MB. With only **one** Node 22 data point available, the headroom is deliberately generous (~11.8%) to avoid re-flaking on a single measurement rather than shaving the gate as tight as possible.

---

## Alternatives Considered

### Alternative A (Deferred, not rejected): Lazy-load `better-sqlite3` to defer ~12 MB

The native SQLite add-on contributes ~12 MB of RSS (per ADR-008's composition table) and is only needed on the session-history path, not on idle or the `status` path. Deferring it via dynamic `import()` off the composition root would bring steady-state idle RSS back toward/below 80 MB and keep the tighter gate.

**Why not in this PR**: this PR is a runtime upgrade with **zero `src/**` change** by design. Lazy-loading requires composition-root + persistence-adapter changes plus regression tests for the deferred-load path — a distinct, code-touching effort. It remains explicitly preserved as a future optimization (originally ADR-008 Alternative A) and is a valid path if the team later wants to tighten the RSS target.

### Alternative B (Rejected): `continue-on-error` on the benchmark step

Silencing the gate in CI would let it pass without removing the measurement. Rejected for the same reason as ADR-008 Alternative C: it is approval theatre. A gate that never fails gives a future contributor no way to tell "working correctly" from "silenced," providing false assurance. An honest spec update provides true assurance.

---

## Consequences

### Positive
- The `Performance Benchmarks` job and the `All CI Checks` aggregate go green on Node 22. PR #12 becomes mergeable on functional + performance grounds.
- The RSS gate reflects measured reality on the Node 22 stack, with honest headroom for runner variance.
- The lazy-load optimization (Alternative A) remains documented and available for future tightening.

### Negative
- The memory NFR is softer (95 vs 80 MB). For a personal-project CLI on a 16+ GB developer workstation, the user-visible impact is negligible (a Pomodoro timer in a background tmux pane at < 95 MB), but the stated target is looser.

### Residual Risk
- A future major upgrade (Ink 5.x, React 19, Node 24) could consume this headroom again. Per ADR-008's still-standing guidance, re-run the RSS benchmark on any such upgrade and, if the result approaches 95 MB, include a fresh rebaseline **or** the lazy-load optimization (Alternative A) in that PR's scope.
- Only one Node 22 measurement informs this gate. If future runs cluster materially higher than 84.97 MB, revisit.

---

## Files Affected

- `docs/adrs/ADR-019-rss-nfr-rebaseline-node22.md` (this file)
- `scripts/benchmark-rss.cjs` (`RSS_LIMIT_MB` 80 → 95, and the two doc-comment references)
- `CLAUDE.md` (Key Behavioral Contracts memory line: 80 MB → 95 MB, back-link to ADR-019)
- `docs/feature/node-22-upgrade/design/wave-decisions.md` (D4 regression-net contract mention)
- `docs/feature/node-22-upgrade/design/adr-018-node-22-runtime.md` (post-DELIVER note on the contract)

---

## References

- **ADR-008** — prior RSS rebaseline (35 → 80 MB) and explicit pre-authorization of this change
- **ADR-018** — Node 22 LTS runtime decision (the upgrade that triggered this)
- CI run **28671427937** (PR #12, RSS 84.97 MB on Node v22.23.1, ubuntu-22.04)
- Precedent for NFR rebaseline after empirical measurement: ADR-006 (startup 100 ms → 700 ms), ADR-008 (RSS 35 → 80 MB)
