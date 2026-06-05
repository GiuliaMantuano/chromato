# ADR-015: Shared Presentational TUI Module (`src/adapters/tui/`) + Rule-4 Carve-Out

**Status**: Proposed
**Date**: 2026-06-02
**Feature**: returning-home
**Deciders**: Morgan (solution-architect), maintainer (confirmed Decision A → A1, Propose mode 2026-06-02)
**Relates to**: ADR-004 (ports-and-adapters), ADR-002 (Ink TUI), ADR-011 (palette registry placement). Dynamic-import discipline is governed by **ADR-012** — referenced, not restated here.

---

## Context

The home screen (`src/adapters/homeAdapter.tsx`) must render the CHROMATO logo in the
saved theme gradient, a 6-stop swatch, and a footer keybar — visually consistent with
the first-run wizard. Those presentational helpers already exist, but **private** to
`src/adapters/setupWizardAdapter.tsx`:

- `LogoBlock` (`:185`) — palette-agnostic FC rendering `LOGO` from `domain/brand.ts`.
- `Footer` / `keyHint` / `KeyHint` (`:282`, `:150`, `:275`) — footer keybar.
- `swatch(name)` (`:155`) — 6-stop gradient strip, sourced from `getPalette(name).gradient`.
- `PALETTE_META` (`:107`) — presentation label/description map (`{ label, description }`).
- `colorize(hex, content)` (`:140`) — chalk truecolor helper the above depend on.

Dependency-cruiser **Rule 4** (`adapters-no-cross-import`, `.dependency-cruiser.cjs:113`)
forbids any adapter from importing any other adapter. So `homeAdapter` cannot simply
`import { LogoBlock } from './setupWizardAdapter.js'`. The constraint is correct in
spirit (it prevents behavioural adapter coupling) but the helpers above are **pure
presentation** with no behaviour — they are shared UI primitives, not adapter logic.

DISCUSS D3 mandated reuse over duplication for exactly these helpers (US-RH-01 Technical
Notes; SC-04). We need a placement that satisfies both D3 and Rule 4's intent.

---

## Decision

**Extract the palette-agnostic presentational helpers into a new shared module
`src/adapters/tui/`** that both `setupWizardAdapter` and `homeAdapter` import.

Exports: `LogoBlock`, `Footer`, `keyHint`, the `KeyHint` interface, `swatch`,
`PALETTE_META` (label/description map), and `colorize`.

**Add a dependency-cruiser carve-out** so Rule 4 permits adapters to import
`src/adapters/tui/**`, while `tui/**` itself imports no other adapter. Concretely the
`adapters-no-cross-import` rule gains a `pathNot: '^src/adapters/tui/'` on its `to`
target (the `tui/` module is an allowed import target), and a companion rule keeps
`tui/**` from importing back out into sibling adapters:

```js
// Rule 4 (amended): adapters must not import each other — EXCEPT the shared tui/ module.
{
  name: 'adapters-no-cross-import',
  severity: 'error',
  from: { path: '^src/adapters/', pathNot: '^src/adapters/tui/' },
  to:   { path: '^src/adapters/', pathNot: '^src/adapters/tui/' },
},
// Rule 4b: the shared tui/ module must not import sibling (non-tui) adapters.
{
  name: 'tui-no-sibling-adapters',
  severity: 'error',
  from: { path: '^src/adapters/tui/' },
  to:   { path: '^src/adapters/', pathNot: '^src/adapters/tui/' },
},
```

Rule 4's `from` excludes `tui/`; tui-as-source is governed by `tui-no-sibling-adapters` — the two rules are complementary, not redundant.

`tui/**` may import `ink`, `react`, `chalk`, `src/domain/**` (brand, palette) — the
same dependencies the wizard helpers already use; it is on the Ink side of the
dynamic-import boundary (loaded only when an Ink adapter is loaded), so it does not
threaten the cold `--help` path (ADR-012).

**Bounded refactor of the shipped wizard (DELIVER task)**: move the five export groups
out of `setupWizardAdapter.tsx` into `src/adapters/tui/`, and update the wizard's
imports to `./tui/…`. Mechanical move, no behaviour change. The wizard's regression
suite (cucumber feature + vitest) MUST stay green; this is the acceptance gate on the
refactor. Wizard-internal, non-shared chrome (Breadcrumbs, ThemePreview, TimingTimeline,
the preview-only constants) stays in `setupWizardAdapter.tsx`.

> **DELIVER precondition (ThemePreview consumes `LogoBlock`)**: `ThemePreview` in
> `setupWizardAdapter.tsx` calls `<LogoBlock>` (`:~212`). Before starting the refactor,
> verify ThemePreview's `LogoBlock` import resolves to `./tui/` post-move, and confirm
> ink-testing-library coverage of ThemePreview exists.

---

## Alternatives Considered

### A2 — Duplicate the helpers into `homeAdapter` (rejected)

Copy `LogoBlock`/`Footer`/`swatch`/`PALETTE_META`/`colorize` into the new adapter.

**Rejected**: directly violates DISCUSS D3 ("no palette data, wizard logic … duplicated")
and SC-04. Two copies of `PALETTE_META` and the logo-rendering loop drift the moment a
label or gradient-alignment detail changes — the exact failure mode the swatch/logo
"same source" acceptance criteria (K7, US-RH-01) are designed to catch. Lowest
short-term effort, highest long-term maintainability cost. No.

### A3 — Move the helpers into `src/domain/` (rejected)

Put the presentational helpers in the domain layer (where `brand.ts` and `palette.ts`
already live) so adapters import "down" into domain, fully sidestepping Rule 4.

**Rejected**: these helpers import `ink`, `react`, and `chalk`. `src/domain/**` is
forbidden from importing `ink`/`react` by Rules 1 (`domain-no-ink`, `domain-no-react`,
`.dependency-cruiser.cjs:18,24`) — and rightly so: the domain is the dependency-free
core (ADR-004, CLAUDE.md). `brand.ts` is domain-pure *because* it holds only `LOGO`
strings and applies no colour ("colour is applied by adapters", `brand.ts:7`).
React components are presentation/infrastructure by definition; placing them in the
domain would corrupt the layer's defining invariant. No.

### A1 — Shared `src/adapters/tui/` module with a scoped Rule-4 carve-out (CHOSEN)

Keeps the helpers on the adapter (Ink) side where they belong, eliminates duplication,
and narrows the Rule-4 exception to a single, clearly-named shared-UI directory with a
companion rule preventing the shared module from reaching back into sibling adapters.
The carve-out is enforceable and self-documenting: `tui/` is *the* shared-presentation
location, and any future adapter coupling outside it still trips Rule 4.

---

## Consequences

**Positive**: single source of truth for logo/swatch/footer/label rendering (D3, SC-04,
K7 structurally supported); home and wizard cannot visually drift; Rule 4's behavioural-
coupling intent is preserved via the scoped carve-out + the `tui-no-sibling-adapters`
companion rule; helpers stay off the domain layer (Rule 1 intact); no new dependency.

**Negative**: a bounded refactor of the shipped wizard adapter (move + re-import) carries
a small regression risk on a feature already in production — mitigated by the
green-regression-suite gate. The `.dependency-cruiser.cjs` Rule 4 grows from one rule to
two and gains `pathNot` clauses (slightly more config surface to reason about).

**Neutral**: `src/adapters/tui/` is a new directory; wizard-internal chrome stays put,
so the wizard file shrinks modestly rather than emptying out.

---

## Compliance

- DISCUSS D3 (reuse over duplication), SC-04 (palette/helpers shared, not copied),
  US-RH-01 / K7 (logo + swatch from one source).
- ADR-004 (ports-and-adapters): layering preserved; helpers stay adapter-side.
- ADR-012: the dynamic-import discipline that keeps Ink off the cold `--help` path is
  **unchanged** — `tui/**` only loads when an Ink adapter loads. See ADR-012; not restated.
- dependency-cruiser: Rule 4 amended + new `tui-no-sibling-adapters` rule; the
  `homeGuard-no-external` purity rule (D-RH-1) is a separate constraint, not part of this ADR.
