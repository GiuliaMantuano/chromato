# Evolution Archive — returning-home

**Shipped**: 2026-06-02 | **Branch**: `feature/returning-home` | **Model**: nWave legacy multi-file (no SSOT)
**Waves**: DISCUSS → DESIGN → DISTILL → DELIVER (DISCOVER/SPIKE/DEVOPS n/a — brownfield, no new infra)

## What shipped

When a config already exists and `chromato` is run bare in an interactive colour TTY, it now shows a
branded "welcome back" home screen — saved-setup recap (theme + swatch, timing, notifications, optional
tmux row) and a Start / Reconfigure / Quit menu — instead of the Commander help dump. Start launches a
focus session from the saved config; Reconfigure re-opens the setup wizard pre-seeded with current values;
Quit exits cleanly. Every non-interactive path (pipe, NO_COLOR, --no-color, CI, no-config), `chromato --help`,
and `chromato start` are unchanged and Ink-free.

## Architecture (as built)

- `src/homeGuard.ts` — pure `shouldShowHome()` guard (configExists ∧ isTTY ∧ !NO_COLOR ∧ !--no-color ∧ !CI) +
  `normalizeGuardEnv()`; zero side-effecting imports, enforced by the `homeGuard-no-external` cruiser rule.
  Mirrors the wizard's `shouldRunWizard` (ADR-012 launch-guard pattern).
- `src/adapters/tui/components.tsx` — NEW shared Ink module (LogoBlock, Footer, keyHint, swatch, PALETTE_META,
  colorize) extracted from the wizard adapter per **ADR-015**, so home and wizard share helpers without an
  adapter→adapter import. Guarded by a Rule-4 carve-out + `tui-no-sibling-adapters`.
- `src/adapters/homeAdapter.tsx` — `HomeAdapter` resolving a `HomeChoice` discriminated union
  ('start'|'reconfigure'|'quit'); renders recap (gradient from `getPalette().gradient`, label from `PALETTE_META`
  — the F1 correction) + keypress menu navigation. Imports no sibling adapter.
- `src/index.ts` — bare-action guard branch (additive, before the help fallback); D-RH-8 try/catch around
  `loadConfig()` only (corrupt config → `outputHelp()` → exit 0); dynamic Ink import (ADR-012 cold-path
  discipline, `--help` <100ms); HomeChoice delegation reusing the existing launch + setup paths.
- `src/configLoader.ts` — `configFilePath()` accessor + `paletteName` on `ConfigResult` (single parse, DD-4).

## Decisions that shaped it

- **ADR-015 (the consequential one)**: DISCUSS said "reuse the wizard's helpers," but dependency-cruiser Rule 4
  forbids adapter→adapter imports. Resolution: extract a shared `tui/` module — which meant a bounded refactor
  of already-shipped wizard code (PR #60), gated on wizard regression staying green. It did.
- **F1 correction**: DISCUSS ACs cited `PALETTE_META` for colour data, but that map holds labels only; gradient
  lives in `getPalette().gradient`. Caught in DESIGN review, corrected throughout DISTILL/DELIVER.
- **NFR-03 (200ms render)**: kept dogfood-only, not CI-gated (Ink first-frame timing is flaky); K3 (`--help`
  <100ms, non-Ink path) is the only hard CI latency gate.
- **Two-harness test split**: subprocess cucumber for guard/help/recap (CI-wired); ink-testing-library vitest for
  raw-mode keypress interaction (not cucumber-runnable). The `@ink-testing` cucumber scenarios remain `@skip`
  living documentation.

## Delivery facts

- 6 TDD steps, DES-monitored (legacy 5-phase), all with complete integrity traces.
- Tests: 329 vitest (51 files) + 103/103 cucumber (623 steps, incl. wizard + pomodoro regression) green.
- Quality: L1-L6 refactor pass; adversarial review (NEEDS_REVISION → fixed: paletteName single-read, dropped
  implementation-mirroring spy asserts, documented the FORCE_COLOR/isTTY surrogate, outputHelp exit-safety).
- Reviews across waves: DESIGN (Atlas, APPROVED post-revision), DISTILL (Sentinel, APPROVED iter-2),
  roadmap (0 orphans), implementation (Phase 4 adversarial).
- `pnpm build` + `tsc --noEmit` + `pnpm check:arch` clean; zero `__SCAFFOLD__`.

## Known gaps / follow-ups

- **Mutation testing not run**: chromato has no Stryker/mutation toolchain installed (CLAUDE.md declares a
  per-feature strategy, but the dependency is absent). Test suite strength rests on the teeth-proven integration
  test, the K8/F1 divergence coverage, and the adversarial review. Installing Stryker is a separate decision.
- **isTTY surrogate**: subprocess acceptance scenarios exercise the `chalk.level>0` arm of the guard's isTTY-OR
  (via FORCE_COLOR); the literal `process.stdout.isTTY` arm is covered by the `shouldShowHome` unit tests.
  Documented in code; a real-PTY harness would close the split.
- **MENU-01 footer string**: rendered key-hint uses a concatenated form vs the prototype's `·`-separated `<kbd>`
  glyphs — cosmetic, reconcile if a visual-fidelity pass is ever done.

## Artifacts

`docs/feature/returning-home/{discuss,design,distill,deliver}/` — full wave record incl. roadmap.json,
execution-log.json (DES traces), ADR-015, and per-wave decisions/reviews. Prototype:
`docs/design/returning-home-prototype.html`.
