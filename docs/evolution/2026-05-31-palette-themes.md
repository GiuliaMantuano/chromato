# Evolution: palette-themes

**Feature ID**: palette-themes
**Delivered**: 2026-05-31 (merged to `main` via PR #50)
**Type**: User-facing theming feature + internal colour-system refactor
**Commits**: foundation-first A→B→C (see git history below)

## Problem

chromato's colours were hardcoded as constants in the adapters (`LOGO_COLORS` in
`bannerAdapter`, `PHASE_COLORS` in `tuiAdapter`), with no single source of truth
and no way for users to choose a different look. The dotfiles / r/unixporn
audience (P2 persona, "Aiko") wanted the timer to match their terminal aesthetic
(catppuccin-style mauve/lavender, berry, forest), and the two surfaces (logo
gradient + phase bar) risked drifting apart because their colours lived in two
places.

## Solution

A single palette registry in the domain layer, injected into the adapters, with
user-facing selection via flag / env / config — shipped in three foundation-first
phases:

- **Phase A** — Introduce `src/domain/palette.ts` (`Palette` struct + `PALETTES`
  registry); unify `bannerAdapter` and `tuiAdapter` onto it (ocean = existing
  colours, a proven no-op refactor), then switch ocean to the refined
  `palette-spec.md` spec + gradient direction flip (light-top → dark-bottom).
- **Phase B** — Add three named palettes: `lavender`, `berry`, `forest`.
- **Phase C** — User selection: `--palette <name>` flag, `CHROMATO_PALETTE` env
  var, and a `"palette"` key in `${XDG_CONFIG_HOME:-~/.config}/chromato/config.json`,
  with precedence `flag > env > config.json > default (ocean)` and a friendly
  "unknown palette" error listing the valid names.

## Architecture decisions (DES-PT-01 … 05)

| Decision | Choice |
|----------|--------|
| Registry placement (DES-PT-01) | Co-locate types + `PALETTES` data in `src/domain/palette.ts` — domain-pure, single import (Option A) |
| Adapter wiring (DES-PT-02) | Constructor injection at the composition root; `printBanner(palette, …)` gains palette as first param; `TimerFrame` receives palette via props (Option A) |
| Resolution + precedence (DES-PT-03) | Extend `configLoader.ts` to own the full `flag > env > config.json > default` chain; adds the first `config.json` read (Option A) |
| Type design (DES-PT-04) | `PaletteName` string-literal union + `Record<PaletteName, Palette>` for compile-time completeness; `resolvePaletteName()` parses raw input; `VALID_PALETTE_NAMES` drives error text (Option A) |
| NO_COLOR placement (DES-PT-05) | NO_COLOR evaluated first in `configLoader`; palette resolution skipped; existing `config.useColor` remains the single colour-suppression signal (Option A) |
| ADR | `docs/adrs/ADR-011-palette-registry.md` |

## Locked product decisions (DISCUSS)

- **D1** — US-06 + US-06b reconciled into one foundation-first story (A→B→C).
- **D2** — Explicit-both palette model: `gradient: hex[6]` + per-phase `{fg,bg}`.
- **D3** — Config format is **JSON** (supersedes the source story's `config.toml`).
- **D4** — v1 = 4 named palettes (ocean/lavender/berry/forest); **custom-hex deferred**.
- **D6** — Default ocean is the **refined** `palette-spec.md` spec (intentional visual
  rebaseline, not a regression); `palette-spec.md` is the colour source of truth.
- **D7** — Persona re-anchored catppuccin → `lavender`; unknown-name error example
  uses `catppuccin-latte`.
- **D5** — Adoption KPI is aspirational; no telemetry instrumented in v1.

## What shipped (key files)

| File | Change |
|------|--------|
| `src/domain/palette.ts` | NEW — `Palette`/`PhaseColorEntry` types, `PALETTES` registry (4 palettes), `getPalette` / `resolvePaletteName` / `VALID_PALETTE_NAMES` |
| `src/adapters/bannerAdapter.ts` | EXTEND — removed `LOGO_COLORS`; `printBanner(palette, …)` |
| `src/adapters/tuiAdapter.tsx` | EXTEND — removed `PHASE_COLORS`; palette threaded via constructor → `TimerFrame` props |
| `src/configLoader.ts` | EXTEND — `palette?` flag, first `config.json` read, precedence chain, `resolvedPalette` |
| `src/index.ts` | EXTEND — `--palette <name>` option; passes resolved palette to adapters |
| tests | `palette.test.ts`, `palette-injection.test.ts`, `configLoader.palette.test.ts`, `milestone-9-palette-themes.feature` + `palette-steps.ts` |

## Lessons learned

- **Foundation-first paid off**: landing the registry as an ocean=current no-op
  before changing colours made the refactor independently verifiable from the
  visual rebaseline.
- **Closed string-literal union** (`PaletteName`) turned "add a 5th palette" into a
  compile-time change and made the unknown-name error list authoritative.
- **`fix-logo-gradient-direction` was folded into the ocean definition** (OI-PT-01)
  rather than landing as a standalone fix, avoiding a confusing half-fixed state.
- **Stacked-branch hazard**: the follow-on banner/tagline refresh was stacked on
  this branch; PR #50 merged palette-themes to `main` before the banner commit,
  briefly stranding it (re-landed via PR #52). Merge the base PR before the one on
  top next time.

## Git history (foundation-first)

```
9b42c5d refactor(palette): unify adapters onto palette registry (ocean=current, no-op)  ← Phase A
74c6d92 feat(palette): adopt refined ocean palette + gradient flip                       ← Phase A
01cc20a feat(palette): add lavender, berry, forest palettes                              ← Phase B
d5ecfd6 feat(palette): --palette flag, env, config.json, precedence, errors, help        ← Phase C
4c8c806 test(palette-themes): DISTILL acceptance + unit tests (RED handoff)
```

## Permanent artifacts (post-finalize)

The temporary workspace `docs/feature/palette-themes/` has been removed; lasting
artifacts were migrated to permanent homes:

- **ADR**: `docs/adrs/ADR-011-palette-registry.md`
- **Architecture**: `docs/architecture/palette-themes/` — `architecture-design.md`,
  `component-boundaries.md`, `data-models.md`, `technology-stack.md`
- **Colour source of truth**: `docs/architecture/palette-themes/palette-spec.md`
  (referenced by the comment in `src/domain/palette.ts` and the `palette.test.ts`
  R4 assertion)
- **UX journeys**: `docs/ux/palette-themes/` — `journey-palette-selection.yaml`,
  `journey-palette-selection-visual.md`
- **Visual preview**: `docs/design/palette-preview.html`

Discarded as process scaffolding (decisions captured in this document): JTBD
analyses, story map, user stories, acceptance criteria, DoR checklist,
outcome-KPIs, shared-artifacts registry, starting decisions, upstream issues,
DISCUSS/DESIGN `wave-decisions.md`, the DISCUSS journey `.feature`, and the DISTILL
`acceptance-design.md`. The executable acceptance tests live permanently under
`tests/acceptance/`.

> Note: this feature was delivered via direct commits rather than the nWave
> `deliver/` execute machinery, so no `deliver/roadmap.json` or
> `execution-log.json` exists; this document was assembled from the DISCUSS/DESIGN
> wave-decisions and git history.
