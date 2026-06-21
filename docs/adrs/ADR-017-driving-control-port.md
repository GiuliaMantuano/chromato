# ADR-017: Driving control port for in-session keypress controls

**Status**: Accepted
**Date**: 2026-06-03
**Wave**: DESIGN (in-session-controls, Slice 01)
**Author**: the solution architect
**Related**: ADR-004 (ports-and-adapters), CLAUDE.md Critical Architecture Rules R1-R4, `.dependency-cruiser.cjs`

---

## Context

`chromato start` runs a live TUI. Today the running timer is a **driven** surface
only: `TuiAdapter implements RenderPort`, and `SessionService.run()` pushes
snapshots into it on a 1s `setTimeout` tick loop (`sessionService.ts:82-134`).
All keypresses are swallowed: `useInput` at `tuiAdapter.tsx:103` is a deliberate
no-op whose sole purpose is to keep Ink in raw mode. Ctrl+C is handled separately
by a raw stdin `'data'` 0x03 listener (`tuiAdapter.tsx:93-100`) that emits SIGINT;
`run()` registers `process.on('SIGINT', () => session.interrupt())`
(`sessionService.ts:91-93`).

Slice 01 must let a keypress (`s` skip, `q`/`Q` quit) in the running TUI reach a
use case and mutate the **same `Session` instance** that `run()` captured as a
local const (`sessionService.ts:89`). This raises a hexagonal-boundary problem:

- The TUI must now also act as a **driving (primary) input** surface, not only a
  driven render surface.
- An adapter must not call another adapter (R4 `adapters-no-cross-import`).
- The domain must not import ink/react (R1); the application must not import
  adapters/ink/react (R2).
- The keypress effect must be **observable within one render frame** — i.e. an
  immediate re-render between the 1s ticks, not on the next tick.

### Constraints (5 HARD constraints from slice-01)

1. Ctrl+C -> SIGINT -> interrupt -> exit 0 must NOT regress.
2. Skip from OVERDUE must clear `overdueElapsedSeconds`.
3. Phase-aware footer must render in BOTH standard and compact (<40 col) branches.
4. `q`/`Q` must tear down through `TuiAdapter.stop()` (exit alternate screen), exit 0.
5. Keypress -> WORK must be observable synchronously via `getSnapshot()`.

---

## Decision

Introduce a **driving (primary) control port** owned by the domain layer:

```ts
// src/domain/ports.ts  (EXTEND — add alongside RenderPort etc.)
export interface SessionControlPort {
  skip(): void;   // request: leave current rest phase, start fresh WORK (no-op during WORK/IDLE)
  quit(): void;   // request: stop the session cleanly (parity with Ctrl+C)
}
```

`SessionService` **implements** `SessionControlPort` (application layer implements
a domain-owned interface — identical to how adapters implement `RenderPort`, fully
within R2). The composition root (`index.ts`) injects the *already-constructed
`SessionService` instance, typed as `SessionControlPort`*, into `TuiAdapter` as a
constructor dependency. `TuiAdapter` forwards it down to `TimerFrame` so the
`useInput` handler can call `control.skip()` / `control.quit()`.

Because `index.ts` is the composition root (the only file allowed to import across
all layers), the wiring `new TuiAdapter(palette, service)` does NOT violate R4:
the TUI receives an **interface reference**, never imports a sibling adapter, and
the type it depends on lives in `src/domain/ports.ts`.

### Immediate re-render between ticks (HARD #5)

`SessionService.skip()` mutates the active `session`, then **synchronously**
renders, persists, AND flushes events on the keypress frame:

```
skip():
  if (!this.session) return;                 // null-guard (no active session)
  this.session.skipToWork();                 // pushes PHASE_CHANGED into the session queue
  const snapshot = this.session.getSnapshot();
  this.renderPort.render(snapshot);          // immediate frame (HARD #5)
  this.statePort.writeState(snapshot);       // state.json reflects WORK this turn
  this.processEvents(this.config);           // drain PHASE_CHANGED NOW, not next tick
```

`processEvents(config)` is **mandatory** here, not optional: `skipToWork()` enqueues
a `PHASE_CHANGED` event. Without an immediate `processEvents` on this frame, that
event would be consumed by the *next* tick — firing `notifyPhaseChange()` and
resetting `overdueSecondNotified` (`sessionService.ts:168`) one tick (~1s) late.
Flushing here keeps notification/overdue-reset semantics exactly aligned with the
keypress.

This requires `skip()` to have access to the active `config`. **Contract**: `config`
is promoted to a `SessionService` field (`this.config`), assigned at the start of
`run()` (and used by `tickOnce()`), so the `SessionControlPort` methods can reach it.
The render/persist steps reuse the exact sequence already in `run()`'s tick body
(`sessionService.ts:121-124`), so the frame and `state.json` update on the same turn
of the event loop as the keypress — satisfying the "one render frame" /
synchronous-`getSnapshot()` contract without a new timing primitive. The next
scheduled `setTimeout(tick)` simply continues from the new WORK state.

### Quit path (HARD #1, #4)

`SessionService.quit()` calls `this.session.interrupt()` (behind a null-guard) and
returns. It performs **no teardown itself**. The existing `run()` tick loop detects
the interrupt on its next tick via the `isInterrupted()` branch
(`sessionService.ts:106-112`) and performs the full teardown there —
`printInterruptSummary(); renderPort.stop(); statePort.writeIdle(); resolve()`.
This is **exact parity with Ctrl+C**, which already works this way (interrupt set,
teardown on the next tick, up to ~1s latency). `quit()` therefore has a single,
unambiguous contract: *set interrupt, let the tick finalize.*

Ctrl+C keeps its **separate, untouched** stdin 0x03 -> SIGINT ->
`session.interrupt()` path. `q` and Ctrl+C converge on the *same* `interrupt()`
domain call and the *same* tick-driven teardown, through two independent input
mechanisms — Ctrl+C does not depend on `useInput` at all (see alternative C
rejection). HARD #4 (`q` -> `TuiAdapter.stop()` alt-screen teardown, exit 0) is
satisfied precisely because it reuses the proven Ctrl+C teardown path verbatim.

**Rejected option — immediate teardown from within `quit()`**: having `quit()`
directly call `renderPort.stop(); statePort.writeIdle(); resolve()` would race with
the tick's own render/stop/resolve sequence (double-stop, double-resolve) and would
require leaking the `run()` Promise resolver out into the port so `quit()` could call
it. Rejected — the next-tick path is strictly simpler and already proven by Ctrl+C.

---

## Alternatives Considered

### Alternative A — TUI holds a direct `SessionService` reference (REJECTED)

Inject the concrete `SessionService` class into `TuiAdapter` and call
`service.skipPhase()` directly.

- Pro: least new code.
- Con: couples the adapter to a concrete application class rather than a
  domain-owned interface; weakens testability (cannot inject a fake control
  surface into `TimerFrame` without standing up a real `SessionService`); blurs
  the driving-port boundary that ADR-004 establishes for every other seam.
  Structurally, it would force an adapter (`TuiAdapter`) to import a concrete
  application class (`SessionService`), violating the dependency-inversion intent of
  ADR-004 at the structural level — not only on testability grounds.
- Rejected: a one-method-pair interface is cheap and preserves the dependency-
  inversion property uniformly. Dependency points inward (adapter -> domain
  interface), not adapter -> application concretion.

### Alternative B — Event-emitter / callback-bus seam (REJECTED)

TUI emits abstract `'skip'`/`'quit'` events on a shared `EventEmitter`;
`SessionService` subscribes.

- Pro: fully decoupled; no interface import in the TUI.
- Con: indirection with no current second consumer; harder to trace; event
  ordering vs. the tick loop becomes a reasoning hazard (the very "debugging /
  ordering" trade-off flagged for event-driven designs). Resume-driven
  complexity for a 2-method control surface on a single-process CLI.
- Rejected: violates "simplest solution first." A typed port is clearer and
  directly testable.

### Alternative C — Move Ctrl+C into the new `useInput` handler (REJECTED)

Unify all input (Ctrl+C, `s`, `q`) inside one `useInput` body, dropping the raw
stdin 0x03 listener.

- Pro: single input mechanism.
- Con: directly endangers HARD #1. The existing 0x03 listener is registered
  **synchronously in the render body** specifically because `useInput` registers
  via `useEffect` (async), which is too late for the synchronous stdin writes used
  by test helpers (documented at `tuiAdapter.tsx:78-90`). Folding Ctrl+C into
  `useInput` would reintroduce the race the current code was written to avoid and
  risk regressing the exit-0 contract (AC-P6).
- Rejected: **keep the two mechanisms separate.** `useInput` gains real `s`/`q`/`Q`
  handling; the raw 0x03 -> SIGINT listener stays byte-for-byte as is. They
  coexist: Ink's raw mode (kept active by `useInput` being non-empty now) still
  delivers bytes to the stdin `'data'` listener, so 0x03 continues to fire SIGINT.

---

## Consequences

### Positive

- Uniform dependency inversion: the running timer becomes a first-class driving
  adapter against a domain-owned port, consistent with ADR-004 and every other seam.
- Testability: `TimerFrame` can be unit-tested with a fake `SessionControlPort`
  (assert `skip()`/`quit()` called on the right keys, per phase); `SessionService`
  control logic is testable headless via `tickOnce` + a direct `skip()`/`quit()`.
- Ctrl+C non-regression is structural, not incidental: the design explicitly keeps
  the proven 0x03 listener untouched.
- No new runtime dependency; no dependency-cruiser rule change required (the new
  interface lives in `src/domain/ports.ts`; the injection happens only in the
  composition root).

### Negative / trade-offs

- `SessionService` gains a second responsibility (driving control surface) beyond
  the tick loop. Mitigated: `skip()`/`quit()` are thin and reuse the existing
  render/persist/interrupt sequences; no new orchestration concept.
- `TuiAdapter` gains a control dependency (via `attachControl()`, see §8). There are
  **3 TuiAdapter contexts** in `index.ts`: the direct-start action (`:274`) and
  `launchSessionFromConfigResult` (`:327`) are the **2 full-TUI sites that need
  `attachControl()`**; the minimal path (`:249`) is **unaffected** (non-interactive,
  no control surface). So: 3 total contexts, 2 wired. Justified and enumerated in
  `wave-decisions.md` / `upstream-changes.md`.
- The control port is wired only on the full-TUI path. `--minimal` has no keyboard
  surface in Slice 01 (acceptable: minimal mode is non-interactive by design; skip
  is out of scope there and the slice scopes controls to the TUI).

### Enforcement

- R1-R4 continue to be enforced by `dependency-cruiser` (`check:arch` in CI). The
  new interface in `src/domain/ports.ts` is import-safe for all layers. No rule
  edit needed; add a focused arch assertion is unnecessary because the existing
  `application-no-adapters` + `domain-no-*` rules already forbid every illegal edge
  this design could introduce.
- Behavioral non-regression of Ctrl+C is covered by the existing exit-0 acceptance
  test (AC-P6) plus the new US-02 Ctrl+C scenario; DISTILL owns formalizing these.
