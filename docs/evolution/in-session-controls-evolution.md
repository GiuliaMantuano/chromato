# Evolution Archive — in-session-controls

**Shipped**: 2026-06-03 | **Branch**: `feature/in-session-controls` | **Model**: nWave legacy multi-file (no SSOT)
**Waves**: DISCUSS → DESIGN → DISTILL → DELIVER (DISCOVER/SPIKE/DEVOPS n/a — brownfield UX gap, no new infra; interactive `useInput` already proven in wizard/home so no spike)

## What shipped

In-session keyboard controls on the running `chromato start` timer. **`s`** skips the current phase — short
break, long break, or the OVERDUE count-up — into a fresh WORK session (countdown resets, POMODORO badge
advances to a new cycle, today-count unchanged, overdue counter cleared); **`q`/`Q`** quits cleanly (parity
with home/wizard). The footer is phase-aware ("skip break" / "start work" / suppressed in WORK) across standard
and compact (<40 col) layouts. **Zero new dependencies.**

## The gap this closed

The running TUI wired **only Ctrl+C** across every phase (`tuiAdapter.tsx` `useInput` was a deliberate no-op).
Worse, after any break ended the timer entered **OVERDUE and counted up forever** with no in-app way back to
work — `PhaseStateMachine.completeBreak()` (break→WORK) existed but was **dead code, zero callers**. So a user
who wanted to end a long break early and start a new cycle had to Ctrl+C and relaunch. A pre-release rough edge
the maintainer caught by dogfooding (a project doc, `chromato-overdue-phase.md:86`, had even pre-named this as
future step "09-01").

## The decisive design call (ADR-017 — driving control port)

A keypress had to reach the application without an adapter importing a sibling adapter (cruiser R4) or the
application importing an adapter (R2). Solution: a NEW **driving** `SessionControlPort { skip(); quit(); }` in
the domain, implemented by `SessionService`, **late-injected** into `TuiAdapter` via `attachControl(service)` at
the composition root — which resolves the RenderPort↔SessionControlPort circularity inside `index.ts` with **no
dependency-cruiser rule change**. The domain skip primitive `Session.skipToWork()` reuses the dead
`completeBreak()`. Alternatives rejected: direct concrete-service injection (structural DI violation), event bus
(ordering hazards, no second consumer), folding Ctrl+C into `useInput` (reintroduces the async-registration race).

## Architecture (as built)

- `src/domain/ports.ts` — `SessionControlPort` (driving) + `SessionReadPort { getSnapshot() }` (DN-3 read surface).
- `src/domain/session.ts` — `Session.skipToWork()`: ORDER-MATTERS (phase→WORK, then reset elapsed + overdue,
  then one PHASE_CHANGED); no-op outside BREAK/LONG_BREAK/OVERDUE; completedToday untouched; no SESSION_COMPLETED.
- `src/application/sessionService.ts` — implements both ports; `skip()` flushes `processEvents(this.config)` on the
  keypress frame (HARD #5 / DN-2); `quit()` = interrupt-only → next-tick teardown (Ctrl+C parity); `run()` publishes
  `this.session`/`this.config`.
- `src/adapters/tuiAdapter.tsx` — pure `footerHint(phase)`, `useInput` s/q/Q routing, `attachControl()`; the raw
  0x03→SIGINT listener stays the SOLE Ctrl+C owner (DN-1).
- `src/index.ts` — `attachControl(service)` on both full-TUI start paths before `run()`; minimal path unwired.

## Test strategy

**Vitest + ink-testing-library only, 21 scenarios** (1 walking skeleton + 20). Cucumber was deliberately NOT used:
raw-mode keypresses can't be driven through a subprocess, so a cucumber feature would orphan and burn CI for no
observable value (the notification-branding "vitest-only when that's the real seam" precedent). All assertions are
port-observable (rendered frames, `getSnapshot()`, the injected notification/state ports) — never private fields.

## Known limitations / follow-ups

- **macOS notification icon** remains deferred/NO-GO (separate spike, 2026-06-03) — unrelated to this feature.
- **Mutation testing not run** — chromato still has no Stryker toolchain (standing repo debt, open since returning-home).
- **Production composition-root wiring (index.ts) has no automated AT** — the walking skeleton wires `attachControl`
  in-test, so production wiring is verified by design-compliance + build + manual dogfood, not a subprocess AT.
  Inherent to a raw-mode-keypress CLI; documented, not a defect.
- **Deferred slices**: pause/resume (`p`, slice 02) and restart (`r`, slice 03) were scoped out of Slice 01;
  skip-during-WORK is intentionally a no-op (a different intent — abandoning focus). Slice briefs exist.
- **Deferred testability note DN-4/DN-5**: a `q` walking-skeleton variant for alternate-screen-restore; an extra
  no-spurious-event assertion on the WORK no-op. Cosmetic; recorded in distill/wave-decisions.md.

## Gate retrospective (every review caught something real)

DISCUSS/Eclipse fixed footer + AC ambiguities and a today-count data inconsistency. DESIGN/Atlas caught **three**
runtime-wiring bugs before any code (quit-timing race, processEvents-must-fire-on-frame, run() must publish
this.session). DISTILL/Sentinel caught a **scenario seed off-by-one** the scaffold-throw was masking. The roadmap
review confirmed 0 orphans. The DELIVER adversarial review confirmed no testing theater and tightened the footer
assertions. A clean DELIVER (no mid-flight escalations) — the upstream gates had already removed the rework.

## Artifacts

The full wave record (`discuss/`, `design/`, `distill/`, `deliver/`, `slices/` — roadmap.json,
execution-log.json with 20 DES events, per-wave decisions/reviews) lived under
`docs/feature/in-session-controls/` and is preserved in the git history (workspace archived + removed).
ADR-017 was migrated to `docs/adrs/ADR-017-driving-control-port.md`. Tests:
`tests/unit/adapters/inSessionControls.interaction.test.ts` + the `skipToWork()` block in `tests/unit/domain/session.test.ts`.
