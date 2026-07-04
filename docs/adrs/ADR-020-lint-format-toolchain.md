# ADR-020: Lint + Format Toolchain — Revisit ADR-009 (Biome selected)

**Status**: Accepted — Biome selected by Giulia on 2026-07-03; implemented in the `tooling-hardening` DELIVER (PR 2) using `@biomejs/biome@2.5.2`. Canonical record; the DESIGN-wave process copy remains at `docs/feature/tooling-hardening/design/adr-020-lint-format-toolchain.md`.
**Date**: 2026-07-03
**Feature**: tooling-hardening (backlog #3)
**Updates/Supersedes**: ADR-009 (De-scope Local Quality Tooling) — see Context

> Canonical ADR (accepted decisions only). Originated as a DESIGN-wave draft in the feature folder and copied here on acceptance, mirroring the ADR-018 lifecycle.

---

## Context

Backlog #3 ("Tooling — alto valore, basso sforzo") asks to add a linter/formatter, add a
`typecheck` script, type-check the tests, and fix stale `CONTRIBUTING.md` script references.
This ADR covers the **linter/formatter** decision; the typecheck/tsconfig and CONTRIBUTING
sub-items are single-path and recorded in `docs/feature/tooling-hardening/design/wave-decisions.md`.

**Relationship to ADR-009.** ADR-009 (Accepted 2026-05-30) deliberately **deferred** ESLint +
Prettier (OI-DV-05) and husky/lint-staged/commitlint (OI-DV-04) past v1.0, with a stated
priority order (Prettier-first → ESLint → hooks) and a stated **trigger to revisit**: "the
first time the project takes sustained outside PRs."

Honesty requirement: **that trigger has not fired** — chromato is still solo-maintained with
~zero external-PR traffic. This ADR revisits the toolchain **proactively** as a deliberate
low-effort/high-value hardening pass, not because the ADR-009 trigger fired. ADR-009's central
finding still holds and is respected here: the linter's **marginal correctness value is low**
(strict TypeScript + dependency-cruiser already own type-correctness and architecture
boundaries); its real value is **style consistency + contributor experience**.

Two facts change the cost/benefit ADR-009 weighed:
1. A single tool (**Biome**) now collapses ADR-009's two-tool "Prettier-first, ESLint-later"
   plan into one dependency + one config + one CI step — directly lowering the maintenance
   surface whose absence made deferral attractive.
2. The codebase carries **2 orphaned `eslint-disable` comments** (`statusAdapter.ts:33`
   `no-control-regex`; `persistenceAdapter.ts:50` `@typescript-eslint/no-explicit-any`) that
   do nothing today; a linter makes these deliberate suppressions actually enforced.

The governing quality attribute (ISO 25010) is **maintainability** (analyzability,
modifiability) plus OSS **contributor experience**, under hard constraints: solo maintainer,
GitHub Actions budget (2,000 min/month), and the project's minimalist ethos.

---

## Decision

**Recommend adopting Biome** (single tool: formatter + linter) as chromato's lint/format
toolchain, with the formatter enabled and a curated recommended lint set. The linter
**complements, does not duplicate** dependency-cruiser (architecture boundaries) and strict TS
(type correctness) — no import-boundary lint rules, and lint rules that overlap `tsc` (e.g.
unused-vars) are left to `tsc` as the single source of truth.

This decision is presented for Giulia's approval in **PROPOSE** mode; the runner-up
(ESLint+Prettier) is fully specified below and is an acceptable alternative if she prefers it.

**Consequence for the existing suppressions:** under Biome the 2 `eslint-disable` comments must
be **converted** to `biome-ignore` syntax (they are not reactivated as-is — a 2-line change).
Under the ESLint alternative they reactivate unchanged.

Adoption is sized honestly as **not zero-effort** (see Consequences) and lands in a **dedicated
PR** (see wave-decisions D8), separate from the near-zero-risk typecheck/CONTRIBUTING PR.

---

## Alternatives Considered

### Alternative A — ESLint 9 (flat config) + typescript-eslint + Prettier (runner-up, not rejected)
Two tools: ESLint lints, Prettier formats, `eslint-config-prettier` disables ESLint's
formatting rules, `eslint-plugin-react-hooks` covers the 4 `.tsx` Ink components.
- **For:** reactivates the 2 `eslint-disable` comments **as-is** (matches existing codebase
  vocabulary); canonical type-aware TS rules; largest ecosystem, familiar to outside
  contributors.
- **Against (this project):** ~5–6 devDeps + 2 configs + flat-config learning curve; slower;
  a full type-aware ruleset over an untouched tree surfaces a **larger** first-pass findings
  batch; two CI steps. Higher maintenance surface for type-aware depth that strict TS largely
  already covers here.
- **Verdict:** kept as first-class alternative — **choose this if** deep type-aware lint is
  wanted or a wave of ESLint-native outside PRs is expected.

### Alternative B — Prettier-only, no linter (the ADR-009 floor, deferred-not-rejected)
Formatter only; exactly ADR-009's pre-blessed high-value slice.
- **For:** cheapest, near-zero risk, no findings triage.
- **Against:** does not satisfy backlog #3's explicit "add a linter" intent; leaves the 2
  `eslint-disable` comments permanently orphaned.
- **Verdict:** minimal fallback only, if the linter findings-triage appetite is zero now.

### Alternative C — Keep ADR-009 deferral, do nothing (rejected)
- **Against:** backlog #3 is a deliberate decision to close the tooling gap proactively;
  leaving it deferred perpetuates the orphaned suppressions and the stale CONTRIBUTING/tooling
  story. Reversing the deferral is exactly what this ADR does, explicitly.

---

## Consequences

### Positive
- Automated formatting consistency (ADR-009's high-value slice) delivered in one fast tool.
- The 2 deliberate suppressions become actually enforced.
- Minimal maintenance + CI surface (1 dep, 1 config, 1 step) — fits solo-maintainer constraints.
- Complements existing gates; no duplication of dependency-cruiser or strict TS.

### Negative
- **Not zero-effort:** a one-time whole-tree `format --write` (large mechanical diff) + an
  open-ended first-pass lint findings triage + converting 2 ignore comments to `biome-ignore`.
- Biome's type-aware lint is shallower than typescript-eslint (acceptable: strict TS owns type
  correctness).
- Diverges from ADR-009's literal "Prettier-then-ESLint" sequence (justified: Biome unifies
  both; ADR-009's intent — cheap high-value formatting first — is preserved).

### Residual Risk
- First-pass findings size is unknown until the tool runs once; contained to its dedicated PR,
  structured as separate commits (config → format-write → findings → docs).
- If Biome's rule maturity or ergonomics disappoint in practice, ESLint+Prettier (Alternative
  A) remains a documented, ready fallback.

---

## Files Affected (on approval; implemented in DELIVER, not by this ADR)
- `biome.json` (new) — or ESLint/Prettier configs if Alternative A chosen
- `package.json` — add `format`, `lint`, `check` scripts + devDependency; wire `lint` into `quality:gates`
- `src/adapters/statusAdapter.ts`, `src/adapters/persistenceAdapter.ts` — convert 2 ignore comments (Biome)
- `CONTRIBUTING.md` — add format/lint commands, rewrite line 96
- whole `src/`, `tests/`, root `.mjs/.cjs` — one-time format-write
- `docs/adrs/ADR-009-quality-tooling-descope.md` — add back-link noting ADR-020 revisits it

## References
- `docs/adrs/ADR-009-quality-tooling-descope.md` (the deferral this ADR revisits)
- `docs/feature/tooling-hardening/design/architecture-design.md` (full trade-off analysis)
- Decision-change discipline precedent: ADR-007, ADR-008, ADR-009
