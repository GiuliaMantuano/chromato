# ADR-016: Notification Delivery Mechanism for Branded Notifications

**Status**: Accepted
**Date**: 2026-06-02
**Feature**: notification-branding
**Deciders**: the solution architect, maintainer (confirmed Option C via Propose mode 2026-06-02)

---

## Context

The notification-branding feature must deliver a chromato app identity (warm copy, app name, and a
timer-ring icon) at five moments. The blocking question is the **delivery mechanism**: on macOS the
current `osascript display notification` path (ADR-010) **cannot set a custom app icon** — the popup
borrows the calling terminal's icon ("Terminal — chromato"), which is exactly the recognition
problem US-NB-01/03 exist to solve.

Three facts constrain the choice:

1. **`node-notifier` is NOT installed** (DISCUSS D4 correction). `package.json` runtime deps are
   `better-sqlite3, chalk, commander, ink, react`. Adopting a custom-icon mechanism means **adding a
   new dependency or external binary**, not enabling an existing one. (`CLAUDE.md` lists
   `node-notifier ^10.0`, but that is stale/aspirational — see ADR-010 and the reconciliation note in
   `wave-decisions.md`.)
2. **ADR-010** removed `node-notifier` precisely because the terminal-notifier 1.7.2 it bundles calls
   `NSUserNotificationCenter`, an API **removed in macOS 14**, producing **ghost delivery** (synthetic
   `err: null` / `deliveredAt`, but no visible banner — an *invisible* failure node-notifier cannot
   detect).
3. The dependency/availability anxiety is the dominant risk force (DISCUSS `jtbd-four-forces.md`): a
   missing or misbehaving mechanism must **never crash chromato or go silently dark**.

Quality attributes that drive the decision (in priority order): **reliability/never-crash** (a
notification timer that fails loudly or silently is worse than a plain one), **operational
simplicity / install footprint** (a single-binary global CLI install; chromato Actions-budget),
**recognition** (the icon — the feature's reason to exist), **maintainability** (no unmaintained
dependency in the macOS-14+ risk class).

---

## Decision

**Adopt Option C: native per-platform commands through the existing injected `CommandRunner`, with
zero new runtime dependencies.**

| Platform | Mechanism | Icon | Notes |
|----------|-----------|------|-------|
| **macOS** (`darwin`) | `osascript -e 'display notification …'` | **No** | OS limitation: osascript cannot set a custom app icon. Branded **copy** ships; icon is deferred (see Consequences + `upstream-changes.md` (a)). Modern `UNUserNotificationCenter` path, verified working (ADR-010). |
| **Linux** | `notify-send -i <icon> "<title>" "<body>"` | **Yes** | libnotify CLI; `-i` attaches `assets/icon-timer-ring.png` — real icon parity. |
| **headless / unsupported / `NODE_ENV=test`** | terminal bell | n/a | Unchanged from ADR-010; also the universal error-degradation target. |

The branded **copy** (warm-voice D3 strings) and the new session-complete notification ship on **all**
platforms. The **icon** ships on **Linux only** this slice; macOS icon is deferred to a future
`terminal-notifier` adoption (Alternative B), which is gated and NOT taken now.

`terminal-notifier` ≥2.0 is recorded as a **documented, probe-gated FUTURE upgrade** (Alternative B),
not part of this slice.

---

## Alternatives Considered

### Alternative A (REJECTED) — `node-notifier` (bundled terminal-notifier)

`node-notifier` wraps terminal-notifier on macOS and `notify-send` on Linux, exposing an `icon`
option — superficially the smallest path to a macOS icon.

**Rejected**: this is the exact mechanism ADR-010 removed. node-notifier 10.0.1 bundles
terminal-notifier 1.7.2, which calls the macOS-14-removed `NSUserNotificationCenter` and produces
**ghost delivery** (a synthetic success with no visible banner, undetectable by node-notifier). See
**ADR-010's RCA** (the `nm`/`otool` symbol verification performed on Darwin 25.5.0) for the
ghost-delivery reproduction evidence. It is
effectively unmaintained for macOS 14+. Re-adopting it would reintroduce the defect ADR-010 fixed,
add a dependency in the worst risk class, and grow the install footprint — for an icon that osascript
already proves we cannot get from this family on modern macOS anyway. **This reaffirms and refines
ADR-010**: node-notifier remains rejected for chromato.

### Alternative B (DEFERRED, probe-gated) — `terminal-notifier` ≥2.0 on PATH

terminal-notifier ≥2.0 uses the modern `UNUserNotificationCenter` and supports `-appIcon` /
`-contentImage` / `-sender` — it *can* deliver a macOS icon and app identity correctly.

**Deferred, not chosen**, for this slice, because adopting it carries real costs that are not yet
paid:
- **Distribution**: it is a separate signed binary. Either it must be **bundled/vendored** in the
  npm package (signing + size + notarization concerns) or required as a **`brew install`
  precondition** on PATH (availability anxiety — the dominant risk force). Bundling affects install
  size (Actions-budget note).
- **Sender identity / permissions**: `-sender` ties notifications to a bundle identifier and
  re-opens the permissions/authorization question that Option C sidesteps (D-NB-5).
- **Earned-Trust gate**: terminal-notifier's behaviour on the macOS line is exactly where ADR-010's
  ghost-delivery bug lived. Adoption MUST therefore be gated on a **macOS-14+ real-delivery probe**
  that confirms a banner is *actually shown* (not a synthetic success), AND a clean `pnpm audit
  --audit-level=high`.

**Conditions for future adoption** (the ADR-016 gate, carried as constraint C-NB-2 in
`wave-decisions.md`):
1. `pnpm audit --audit-level=high` passes for the added dependency/toolchain, AND
2. a macOS-14+ delivery probe demonstrates a real visible banner (composition-root `wire → probe →
   use`; on probe failure, refuse the branded path and degrade to osascript), AND
3. a documented bundling vs PATH-precondition decision and the sender-identity/permissions decision.

Until all three are met, macOS ships branded copy without a custom icon.

### Alternative C (CHOSEN) — native OS commands, zero new dependencies

osascript (macOS, copy only) / `notify-send -i` (Linux, copy + icon) / bell (headless/error), all via
the existing `CommandRunner`.

**Chosen**: zero new runtime dependencies; no install-footprint or signing/notarization burden; no
unmaintained dependency reintroduced; both platforms use first-party, maintained OS tools; symmetric
`error → bell` degradation already proven (ADR-010). It ships the feature's **copy** everywhere and
the **icon** on Linux immediately, while deferring only the macOS icon — the one capability genuinely
blocked by an OS limitation — behind an explicit, probe-gated future decision. The only cost is the
deliberate macOS icon deferral, accepted as a known limitation rather than paid for with risk.

---

## Consequences

### Positive
- **Zero new dependencies**; no install-size, signing, or supply-chain surface added (the safest
  possible answer to the dominant availability/anxiety risk force).
- Branded copy + session-complete ship on **all** platforms; the timer-ring icon ships on **Linux**
  immediately.
- Reaffirms ADR-010's removal of node-notifier; no regression to the ghost-delivery defect.
- The existing `error → bell` degradation, `escapeForAppleScript` injection guard, and headless/test
  detection are reused unchanged — a small, low-risk change surface.
- Permissions/sender-identity stay sidestepped (osascript inherits the terminal's authorization).

### Negative
- **macOS gets no custom icon this slice** — branded copy + app name only. This is an OS limitation
  of osascript, not a chromato choice. It forces US-NB-03's ACs to become **platform-aware** (assert
  the icon arg on the Linux `notify-send` path; assert branded copy with no icon arg on macOS) — see
  `upstream-changes.md` (a).
- macOS icon parity remains a **future** capability, contingent on the Alternative B probe gate.

### Earned-Trust posture (this slice)
The only external dependencies are the two OS CLIs already in use. The probe obligation for this
slice is satisfied by the **error-degradation contract**: every spawn outcome (exit 0 / non-zero /
ENOENT / thrown) resolves to delivered-or-bell, observed via the `CommandRunner` seam and verified in
CI by injecting simulated failure (no real binary required). There is no branded-binary dependency to
probe in Option C — which is the point. The macOS-14+ delivery probe becomes mandatory only if and
when Alternative B is adopted (C-NB-2).

---

## Compliance / References

- **ADR-010** (native notifications; node-notifier removal; ghost-delivery RCA) — reaffirmed and
  refined here.
- **ADR-014** (off-switch via NullNotificationAdapter at the composition root) — unchanged; the new
  `notifySessionComplete` is a no-op there.
- **ADR-004** (ports-and-adapters; composition-root injection) — preserved; the delivery switch is an
  adapter-internal concern behind `NotificationPort`.
- SC-05 / NFR-01 / AC-NB-01.x (graceful, never-crash delivery); SC-03/04 (single icon source);
  D4 dependency correction (DISCUSS `wave-decisions.md`).
- `escapeForAppleScript` carry-through (review H3) — constraint C-NB-3 in `wave-decisions.md`.
