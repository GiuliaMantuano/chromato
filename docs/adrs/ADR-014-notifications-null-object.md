# ADR-014: Honour `notifications` Preference via Null-Object Adapter

**Status**: Proposed. Superseded by ADR-022 (in-terminal-notifications, 2026-07-06).
**Date**: 2026-05-31
**Feature**: first-run-setup-wizard
**Deciders**: the solution architect, maintainer (confirmed DD-1 via Propose mode 2026-05-31)

---

## Context

The wizard lets the user turn desktop notifications off. The preference must change real behaviour:
with `notifications: false`, no notification (and no bell fallback) fires at phase transitions
(AC-04.2). DISCUSS D-OPEN-2 suggested adding `notifications` to the domain `SessionConfig`.

The notification path is a driven port: `NotificationPort { notifyPhaseChange(); notifyOverdue() }`
(`domain/ports.ts:23`), implemented by `NotificationAdapter` and injected into `SessionService` at
the composition root (`index.ts:213`/`:243`). `SessionService` calls the port on transitions; it
does not reason about *whether* the user wants notifications.

---

## Decision

Honour the preference with the **null-object pattern**: when `notifications === false`, the
composition root injects a `NullNotificationAdapter` (a no-op `NotificationPort`) instead of the
real `NotificationAdapter`. `SessionService`, `NotificationAdapter`, and the domain are untouched.

The preference rides in **`ConfigResult.notifications`** (returned by `loadConfig`), **not** in the
domain `SessionConfig` — refining D-OPEN-2. Rationale: whether notifications fire is an adapter-
selection concern, not session logic; the `Session` aggregate has no reason to know about it.
Keeping it out of `SessionConfig` preserves domain purity (ADR-004) and avoids threading a
presentation concern through the aggregate.

---

## Alternatives Considered

### A1 — Add `notifications: boolean` to `SessionConfig` (DISCUSS D-OPEN-2, rejected)
**Rejected**: pollutes a pure domain value object with an adapter concern; `validateConfig` and
every `SessionConfig` consumer would carry a field the session logic never uses. The null-object +
`ConfigResult` approach keeps the domain clean.

### A2 — Branch inside `NotificationAdapter` (early-return when disabled) (rejected)
**Rejected**: the adapter would need to know the preference (constructor flag), and "do nothing"
adapters are exactly what the null-object pattern expresses more cleanly; injection keeps the
decision at the composition root where all wiring lives.

### A3 — Conditional `service.notify` flag on `SessionService` (rejected)
**Rejected**: adds a branch to application logic for what is purely a wiring choice; the port
abstraction already lets us swap behaviour by swapping the implementation.

---

## Consequences

**Positive**: domain + application + existing adapter unchanged; the preference is honoured by a
~5-line no-op class chosen at the composition root; trivially testable (assert the null adapter is
selected when `notifications:false`).

**Negative**: one new tiny adapter file (`nullNotificationAdapter.ts`); `ConfigResult` gains a field.

**Neutral**: if a future feature needs per-phase notification control, the port can carry richer
config without revisiting this decision.

---

## Compliance

- ADR-004 (ports-and-adapters; composition-root injection), AC-04.1/04.2 (preference round-trips and
  suppresses notifications + bell). Refines DISCUSS D-OPEN-2 (see `design/upstream-changes.md`).
