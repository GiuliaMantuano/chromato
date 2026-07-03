# ADR-018: Node 22 LTS runtime + held-dependency adoption

## Status
Accepted — originated in the DESIGN wave (feature `node-22-upgrade`), approved by Giulia and merged to `main` on 2026-07-03 (PR #12, squash `b52e746`). Post-merge, the steady-state RSS gate was rebaselined 80 → 95 MB for the Node 22 V8 floor (see ADR-019); this ADR's runtime decision otherwise stands as shipped. The DESIGN-wave process copy remains at `docs/feature/node-22-upgrade/design/adr-018-node-22-runtime.md`.

## Context
Node 20 LTS is at/past end-of-life as of mid-2026. chromato's runtime, `engines.node` (`">=20.0.0"`), CI `NODE_VERSION` (`'20'`), and esbuild build target (`'node20'`) all pin to Node 20. Three dependency majors were deliberately held pending this runtime move (backlog #7, PR #3, Dependabot ignore-major rules in PR #7):

- **commander 15** — ESM-only, declares `engines.node ">=22.12.0"`; held only to avoid an `EBADENGINE` warning on Node 20 (PR #3 passed CI on Node 20).
- **@cucumber/cucumber 13** — requires Node ≥22; cannot install-and-run on Node 20 (PR #68 reverted, #57 closed).
- **@types/node** — floated ahead to 25.x, ahead of the intended runtime floor.

The runtime bump is the prerequisite that unblocks all three. Constraint: a free private repo with a **2,000 Actions min/month** budget (macOS runners bill at 10×), so CI job-count is a first-class design input.

chromato is a hexagonal TypeScript CLI/TUI; no `src/**` change is required. The behavioural contracts in `CLAUDE.md` (status <50ms, NO_COLOR suppression AC-P3, exit-0 no-zombies AC-P6, first-frame <700ms, <1% CPU / <80MB RSS) must remain green on the new stack. (Post-DELIVER note: Node 22's V8 floor pushed steady-state RSS to 84.97 MB in CI, so the RSS gate was rebaselined 80→95 MB per ADR-019, exactly the scenario ADR-008 foresaw.)

## Decision
1. **Adopt Node 22 LTS as a clean cut** (no transitional dual-Node matrix). Set `engines.node ">=22.12.0"` (the max of Node-22-LTS, commander-15's `>=22.12.0`, cucumber-13's `>=22`), `NODE_VERSION: '22'` in **both** `ci.yml` **and** `release.yml`, and `build.mjs` target `'node22'`. `tsconfig.json` (`ES2022`/`NodeNext`) is unchanged.
2. **Adopt commander 15, @cucumber/cucumber 13, and re-pin @types/node to `^22`** in the same pass.
3. **Remove the two Dependabot `ignore-major` rules** (commander, cucumber) in the same PR that adopts the majors.
4. **Ship as a single branch-PR**, internally ordered runtime → deps → dependabot → `quality:gates` + full CI.

## Alternatives considered
- **Transitional CI matrix Node 20 + 22 (rejected).** Doubles the expensive cross-OS acceptance + benchmark minutes (incl. the 10×-billed macOS leg twice). Decisively, it is self-defeating: cucumber 13 requires Node ≥22, so the Node 20 acceptance leg *cannot run the acceptance suite at all* — it would burn budget to exercise only commit-stage unit tests. Incompatible with adopting cucumber 13.
- **Split into multiple PRs — Node first, then each dep (rejected).** Coupling forbids "deps first" (cucumber 13 fails on Node 20). "Node first" is possible but spends the full pipeline twice against the Actions budget for no correctness gain; the combined diff is small and mechanical enough to review in one PR.
- **Looser `engines.node ">=22"` (rejected in favour of `>=22.12.0`).** `>=22` would leave the pre-LTS 22.0–22.11 band eligible, where commander 15 still emits `EBADENGINE`. `>=22.12.0` matches commander's declared floor exactly and is warning-free; it rejects only versions no LTS user should run.
- **Defer commander 15 / keep on 14 (rejected).** commander 14 is supported to ~May 2027, so deferral is *safe* but pointless once on Node 22: v15 removes the `EBADENGINE` warning that was the sole reason for the hold, and the AC-P3 regression risk is bounded and fully covered by existing acceptance scenarios.

## Consequences
**Positive**
- Supported, non-EOL runtime; `EBADENGINE` warnings eliminated across the adopted stack.
- Dependency debt cleared in one pass; Dependabot majors flow normally again.
- No added Actions cost vs today (matrix unchanged).
- No `src/**` or architecture-boundary change → `check:arch` confirms no coupling regression.

**Negative / accepted trade-offs**
- Drops Node 20 support (intended — it is EOL). Narrowing `engines.node` from `>=20.0.0` to `>=22.12.0` is a **breaking public-contract change** (the README advertises Node 20). chromato is still `[Unreleased]` at `1.0.0` with nothing published to npm, so it is not a blocker now — but **whenever the release is cut it MUST ship as a MAJOR version bump**, even though no runtime behaviour changed.
- `release.yml` carries its own `NODE_VERSION` (line 9), consumed directly by the `sbom` and `publish-npm` jobs (not inherited from `ci.yml`). It MUST be bumped to `'22'` in the same change set, or the published npm artifact would still be built on Node 20 despite CI validating on 22 — the exact drift this ADR eliminates. `release.yml` is tag-triggered, so this adds no per-PR Actions cost.
- commander 15 carries a bounded AC-P3 regression risk on the three `program.opts().color === false` reads (index.ts:226/254/454); mitigated by the defensive strict `=== false` comparison, two commander-independent no-color paths (`argv`, `NO_COLOR`), and existing `--no-color`/`NO_COLOR` acceptance scenarios across minimal/tmux/help/palette modes.
- cucumber 13 touches test infrastructure only (suite spawns built `dist/` via the CLI port); the one migration touch-point is confirming the `progress-bar`/`json`/`html` formatter IDs still resolve under v13's formatter rework. No `BeforeAll`/`AfterAll` and no `parallel` config are used, so those v13 changes are N/A.
- CI benchmark gates (200ms) are looser than the documented AC targets; a sub-200ms Node 22 perf regression would pass CI — a watch-item (tightening belongs to backlog #5), not a blocker.

## Enforcement / verification (Earned Trust)
The bump is *probed*, not assumed: Node 22 + the full adopted stack is exercised by the existing CI on the new runtime — Commit Stage (`tsc --noEmit`, build, 369 vitest + 70% coverage, `pnpm audit`, `check:arch`), Acceptance (2-OS cucumber against built `dist/`), and Benchmarks (cold-start, status latency, RSS/CPU). Green across all three on Node 22 is the empirical demonstration that every contract still holds in the real environment.
