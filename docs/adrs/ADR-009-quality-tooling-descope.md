# ADR-009: De-scope Local Quality Tooling (OI-DV-04 / OI-DV-05) — Blocking → Deferred

**Status**: Accepted
**Date**: 2026-05-30
**Feature**: pomodoro-timer-cli

---

## Context

Two local-quality-tooling open items were forwarded into implementation, both originally marked **Blocking** in the project planning record:

| Item | Description | Priority (as written) |
|------|-------------|----------------------|
| OI-DV-04 | Configure husky + commitlint + lint-staged in package.json | Blocking (local quality gates) |
| OI-DV-05 | Configure ESLint + Prettier for TypeScript | Blocking |

The originally-designed Commit Stage likewise listed `lint, format` as pipeline steps.

**Neither was ever executed.** PR #20 *removed* the `Lint` and `Format check` CI steps because ESLint and Prettier were never installed. These steps had been historically planned but never executed during implementation.

Meanwhile, the project passed its own exit gates: the planning "Quality Gates Status" was **all PASS** — but it gated on *design completeness* ("CI/CD pipeline designed", "Local quality gates mirror CI commit stage"), not on the tools being installed. And v1.0 passed both independent reviews (architecture and implementation, both APPROVED) with zero findings related to missing lint/format tooling.

The result is a **decision-record drift**: the original planning record still says these items are "Blocking," while the lived reality is that the feature shipped and was review-approved without them. Left unresolved, every future review will keep re-surfacing OI-DV-04/05 as unfinished blocking work.

This ADR resolves the contradiction by changing the SSOT, not by silently ignoring it.

---

## Decision

Reclassify **OI-DV-04** and **OI-DV-05** from **Blocking → Deferred (post-v1.0)**.

**Rationale.** The "Blocking" classification predates the implementation and was never validated against what the project actually needs. chromato already enforces the high-value gates in CI today:

| Existing gate | What it catches | Where |
|---------------|-----------------|-------|
| TypeScript `strict` mode | Type errors, null-safety, implicit any | `tsconfig.json`; `tsc --noEmit` in commit stage |
| dependency-cruiser | Architecture-boundary violations (the real risk for a hexagonal codebase) | `.dependency-cruiser.cjs`; `check:arch` in commit stage |
| Coverage gate (≥ 70%) | Untested code | commit stage |
| gitleaks | Committed secrets | commit stage |
| `pnpm audit` | Vulnerable dependencies | commit stage |

What ESLint/Prettier/hooks add *on top* of this is primarily **formatting consistency and contributor-experience tooling** — its value scales with the volume of external contributions, which for a solo-developer pre-v1.0 OSS project is currently ~zero. They do not catch a class of correctness defect that the existing gates miss (strict TS already covers most of the lint surface; Prettier catches nothing, it only normalizes style).

For v1.0, local quality tooling is therefore **not needed**. It is deferred, not abandoned.

**Trigger to revisit (in priority order when revisited):**
1. **Prettier** — first, as the cheap high-value step (formatting consistency; ~30 min; near-zero risk).
2. **ESLint** — when style/lint debates begin consuming PR review time, or strict-TS gaps appear in practice.
3. **husky + lint-staged + commitlint** — when sustained external contributions make local pre-commit enforcement worth the setup.

A concrete trigger: the first time the project takes sustained outside PRs (e.g. several merged contributor PRs in a release cycle), reopen OI-DV-05 (Prettier-first) as a dedicated item.

---

## Alternatives Considered

### Alternative A (Rejected): Honor the "Blocking" label — install ESLint + Prettier + husky before v1.0

Install the full toolchain now, triage whatever lint findings surface across the existing `src/` tree, wire husky/lint-staged/commitlint, and re-add the CI lint/format steps removed in PR #20.

**Rejected**: this is config plus an open-ended findings-triage pass for a consistency gain that has **no current consumers** (no external contributors yet). It delays a v1.0 that two independent reviews already approved, to satisfy a checklist item whose correctness value is already covered by strict TS + dependency-cruiser. The cost/benefit only turns positive once contributor volume exists.

### Alternative B (Deferred, not rejected): Prettier-only minimal install

Install Prettier alone (no ESLint, no hooks) — a `format` script + a Prettier CI check. This is genuinely cheap and the highest-value slice of the toolchain (kills style debates in PRs).

**Status**: explicitly preserved as the *first step* when OI-DV-05 is revisited. Not done in this ADR because v1.0 has zero external PR traffic to benefit from it, and the goal here is to close v1.0 scope honestly rather than add even small new surface. This ADR does not foreclose it.

### Alternative C (Rejected): Leave the SSOT saying "Blocking" and just skip the work

Do nothing — leave OI-DV-04/05 marked Blocking and informally treat them as ignorable.

**Rejected**: this is the decision-record-drift status quo. It leaves the planning record contradicting reality, so every future review re-flags the items as unfinished blocking work, and the project carries a permanent phantom "not done" signal. The discipline — established by ADR-007 (falsified DV-05) and ADR-008 (rebaselined the RSS NFR) — is to **change the decision record explicitly** when reality diverges from a prior decision, never to contradict it silently.

---

## Consequences

### Positive

- v1.0 scope is closed honestly: no phantom "Blocking" work blocks the release.
- The planning record stops contradicting the as-shipped reality; future reviews will not re-surface OI-DV-04/05 as unfinished.
- The cheapest high-value step (Prettier-only, Alternative B) is documented and preserved as the first move when the toolchain is revisited.

### Negative

- No automated formatting/style consistency until the items are revisited. Style is enforced manually (by the solo maintainer) in the interim.
- `CONTRIBUTING.md` must not promise tooling that does not exist. (The stale `pnpm format` reference was already removed in PR #32; verify no equivalent claim is reintroduced.)

### Residual Risk

The first wave of external contributor PRs may surface formatting inconsistency or style churn. That is the explicit trigger to reopen OI-DV-05 (Prettier-first). A reviewer onboarding outside contributions should treat recurring style friction as the signal to act, not wait for a scheduled task.

---

## Files Affected

- `docs/adrs/ADR-009-quality-tooling-descope.md` (this file)
- Project planning record (OI-DV-04 and OI-DV-05 priority: Blocking → Deferred, with back-link to this ADR)

---

## References

- Decision-change precedent: `docs/adrs/ADR-007-tmux-version-matrix-falsification.md` (falsified an earlier decision), `docs/adrs/ADR-008-rss-nfr-rebaseline.md` (rebaselined an NFR after evidence)
- v1.0 approvals without the tooling: the architecture and implementation reviews, both APPROVED
- Tooling removal: PR #20 (`4b86e3c`)
