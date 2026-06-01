# ADR-012: First-Run Wizard — Launch Trigger, Guard, and Dynamic-Import Gating

**Status**: Proposed
**Date**: 2026-05-31
**Feature**: first-run-setup-wizard
**Deciders**: Morgan (solution-architect), maintainer (confirmed DD-2/DD-3 via Propose mode 2026-05-31)

---

## Context

The setup wizard is an Ink/React TUI. Two coupled questions: (1) *when* does it launch, and (2)
*how* do we keep ink/react off the `--help` and non-interactive paths (contract AC-HSS-07:
`chromato --help` <100ms, no ink/react; SPIKE measured 47.8ms). The SPIKE proved a 3-line guard
`shouldRunWizard(env, isTTY)` returns correct booleans for non-TTY / NO_COLOR / CI, and that Ink
throws "Raw mode is not supported" without a TTY — so the guard is mandatory and must run *before*
Ink `render()`.

The composition root (`src/index.ts`) already gates `tuiAdapter` behind a dynamic `import()` —
an eager parallel pre-load block (`:77-84`, fired when `argv[2] === 'start'`) plus the action-time
await (`:226-231`) — with esbuild `splitting: true`, and intercepts the no-subcommand case via a
root action `program.action(() => program.help())` (`:257`).

---

## Decision

**DD-2 — Guard placement**: a pure function `shouldRunWizard({ isTTY, env, configExists }): boolean`
in a new `src/firstRun.ts`. Returns `true` only when `configExists === false`, `isTTY === true`,
`NO_COLOR` unset, and `CI` unset. The composition root evaluates it **before** the wizard's dynamic
`import()`, so ink/react never load when it returns false.

**DD-3 — Trigger surface**: auto-launch on the **bare `chromato`** invocation only (the root
action). `chromato setup` always launches the wizard (TTY required). `chromato start` is **never**
hijacked — an explicit `start` is explicit intent to run a session. `chromato status` and `--help`
are unaffected.

**Wizard adapter**: `src/adapters/setupWizardAdapter.tsx`, a new driving adapter, dynamic-imported
exactly like `tuiAdapter`. It must not import `tuiAdapter` (`adapters-no-cross-import`).

**`chromato setup` in a non-TTY**: prints guidance and exits non-zero (cannot run an interactive
wizard without a TTY). Recommended; DISTILL writes the scenario.

**Pre-seed on re-run**: `chromato setup` pre-seeds steps from the existing config (current palette
highlighted, etc.). Recommended; DELIVER detail.

---

## Alternatives Considered

### A1 — Auto-launch on `chromato start` first-run too (rejected)
Matches the journey's original "chromato (or chromato start)" wording. **Rejected**: hijacking an
explicit `start` (often with flags) is surprising and breaks muscle memory / scripts. Narrowed to
bare invocation; logged as an upstream clarification to US-01.

### A2 — Guard inside the wizard adapter (rejected)
**Rejected**: by the time the adapter module loads, ink/react are already imported — defeating the
performance and crash-safety goals. The guard must precede the import.

### A3 — Guard inside `configLoader` (rejected)
**Rejected**: `configLoader` resolves session config; first-run launch is a composition concern.
Mixing them couples unrelated responsibilities and makes the guard hard to unit-test in isolation.
A pure `firstRun.ts` is trivially testable (the SPIKE template).

### A4 — A `--wizard` / `--no-wizard` flag instead of auto-detection (rejected)
**Rejected**: nobody discovers a flag on first run; the whole point is zero-knowledge first contact.

---

## Consequences

**Positive**: ink/react stay off the help + non-interactive paths (AC-HSS-07 / AC-07.3, structurally
guaranteed by the pre-import guard + esbuild splitting); `shouldRunWizard` is a pure, fully
unit-testable function; explicit `start`/`status` behaviour is unchanged (no regression surface).

**Negative**: the root action grows from a one-liner to a guard+branch; a new split chunk
(`setupWizardAdapter-*.js`) is emitted (loaded only on guard-pass).

**Neutral**: `chromato setup` is a new documented command; help text gains a line for it. The
wizard is interactive and has **no latency budget**, so it does **not** need the
`startModulesP`-style parallel pre-load that `start` uses (`:77-84`) — a plain dynamic `import()`
inside the guard branch is sufficient. (Noted to prevent over-engineering by analogy with `start`.)

**Guard input — `configExists`**: `shouldRunWizard` is pure and takes `configExists` as an argument.
The composition root supplies it by calling a new `configFileExists(): boolean` helper exported from
`configLoader.ts` (which already owns `resolveConfigFilePath()`, currently private at `:66`). The
config-path resolution stays in one place — `index.ts` must NOT re-implement it.

---

## Compliance

- AC-HSS-07 (help <100ms, no ink/react), AC-07.* (non-interactive safety), ADR-005 (commander help hook unchanged), ADR-004 (ports-and-adapters), ADR-002 (Ink TUI). dependency-cruiser: new adapter obeys `adapters-no-cross-import`.
- **`firstRun.ts` purity enforcement**: `src/firstRun.ts` sits outside the existing `^src/domain/` and `^src/adapters/` dependency-cruiser globs, so its "pure, no ink/react/adapter imports" property is currently unenforced. DELIVER must add a `firstRun-no-external` rule (forbid `ink`/`react`/`^src/adapters/` from `^src/firstRun\.`) OR relocate the file under `src/domain/`. Decision: add the rule (keeps composition proximity to `configLoader.ts`).
