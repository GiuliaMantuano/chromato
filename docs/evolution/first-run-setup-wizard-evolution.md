# Evolution Archive — first-run-setup-wizard

**Shipped**: 2026-06-01 | **Branch**: `feature/first-run-setup-wizard` (PR #60, squash `4578d5b`)
**Model**: nWave legacy multi-file (no SSOT)
**Waves**: SPIKE → DISCUSS → DESIGN → DISTILL → DELIVER (DEVOPS n/a — no new infra)

## What shipped

On first run (bare `chromato` with no `~/.config/chromato/config.json`) the CLI now launches
an interactive Ink TUI onboarding instead of dumping Commander help:
**Welcome → Theme** (live colour preview) **→ Timing** (25·5×4 default, or Custom) **→ Notifications**
(with a tmux hint shown only under `$TMUX`) **→ Summary**, then it writes the config atomically and
launches the first focus session. `chromato setup` always re-runs the wizard. Every non-interactive
path (pipe, `NO_COLOR`, `--no-color`, CI) and `chromato --help` stay Ink-free and unchanged.

## The decisive design calls

- **ADR-012 (launch guard)** — bare `chromato` auto-launches the wizard *only* on first run, via a
  pure `shouldRunWizard` guard in `src/firstRun.ts`; `--help` stays a fast non-Ink path (<100ms, K3).
- **ADR-013 (config write port)** — `ConfigWritePort` + `configWriterAdapter` do an atomic six-key
  write; `config.json` stores minutes, converted ×60 → domain seconds on load. *(This ADR lives in
  `docs/adrs/ADR-013-config-write-port-and-schema.md` and is cited by `src/configTypes.ts`.)*
- **ADR-014 (notifications null-object)** — notifications are delivered via a `NullNotificationAdapter`
  selected at the composition root; the on/off preference is kept **out** of the domain `SessionConfig`.

## Architecture (as built)

- `src/firstRun.ts` — pure `shouldRunWizard()` launch guard (config-absent ∧ interactive colour TTY).
- `src/adapters/setupWizardAdapter.tsx` — the Ink wizard: Welcome hero + live-logo theme preview,
  breadcrumbs + shared `Footer`/`keyHint` chrome, Timing step with custom editor, Notifications step
  (+conditional tmux hint), Summary screen.
- `src/adapters/configWriterAdapter.ts` + `ConfigWritePort` — atomic config.json writer.
- `src/domain/brand.ts` — brand identity (LOGO / TAGLINE "Focus in full colour" / DESCRIPTOR),
  zero-import pure.
- `src/index.ts` — composition-root wiring for both the bare-command and `chromato setup` paths,
  including `launchSessionFromWizard`.

## Test strategy

Two-harness split: **ink-testing-library** (vitest) drives the interactive wizard; **cucumber
subprocess** covers the guard + config consume, joined by a real `config.json`. 12 TDD steps,
DES-monitored. Final: 300 vitest + 88 cucumber green, `--help` ~50ms, zero `__SCAFFOLD__`.

## Known follow-ups (deferred, non-blocking)

- Extract a shared `runWizardAndLaunch()` helper (the launch block is duplicated across the two
  index.ts action handlers).
- Under a config-**write** failure, a session launches but `notifications:false` reverts to On
  because `loadConfig` re-reads from the unwritten file (DD-8 edge).
- Mutation testing not run — chromato has no Stryker toolchain (standing repo debt).

## Artifacts

The full wave record (`spike/`, `discuss/`, `design/`, `distill/`, `deliver/`, `slices/` — roadmap.json,
execution-log.json DES traces, prototype-gap-analysis, per-wave decisions/reviews) lived under
`docs/feature/first-run-setup-wizard/` and is preserved in the git history (workspace archived +
removed). Design rationale endures as ADR-012/013/014 in `docs/adrs/`. Approved prototype:
`docs/design/splash-onboarding-prototype.html`.
