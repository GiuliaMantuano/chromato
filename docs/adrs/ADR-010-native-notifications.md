# ADR-010: Replace node-notifier with native OS commands (osascript / notify-send)

**Status**: Accepted
**Date**: 2026-05-30
**Feature**: pomodoro-timer-cli (bugfix: fix-macos-notification-silent)

---

## Context

`technology-stack.md:83-93` selected **node-notifier 10.x** in the DESIGN wave specifically because *"a single dependency covers both Linux and macOS targets (NFR-02.1),"* with a terminal-bell fallback for reliability.

A root-cause analysis on 2026-05-30 (macOS 26.5 / Darwin 25.5.0, arm64) found that assumption no longer holds:

- **node-notifier 10.0.1 (latest) bundles terminal-notifier 1.7.2**, which calls **`NSUserNotificationCenter`** — an API **deprecated in macOS 11 and removed in macOS 14 (Sonoma)**. Verified: `nm` shows only `NSUserNotificationCenter` (no `UNUserNotificationCenter`); `otool` shows the binary built against the 10.12 SDK.
- On macOS 14+, the removed API is a no-op stub. The x86_64 binary runs under Rosetta, **reports a synthetic `deliveredAt` / `err: null`, but never shows a banner** ("ghost delivery"). node-notifier cannot detect this — the failure is invisible.
- Independently, the adapter's bell fallback was **dead code**: `notificationAdapter.ts` wrapped `notify()` in try/catch, but node-notifier reports failures via a callback it never passed — so failures produced *no banner and no bell* (total silence).
- node-notifier is effectively **unmaintained for macOS 14+**; no released version uses the modern `UNUserNotificationCenter`.

Verified working alternative on the same machine: **`osascript -e 'display notification …'`** delivered a visible banner (exit 0, modern API).

This is SSOT drift between the DESIGN technology choice and the reality on the supported platform. Per the discipline established by ADR-007 (falsified DV-05) and ADR-008 (rebaselined an NFR), the record is changed explicitly rather than worked around silently.

---

## Decision

Replace `node-notifier` with **native per-platform commands**, selected at runtime in the notification adapter:

| Platform | Mechanism | Notes |
|----------|-----------|-------|
| **macOS** (`darwin`) | `osascript -e 'display notification "<msg>" with title "<title>"'` | Modern `UNUserNotificationCenter`; verified on Darwin 25; no new dependency |
| **Linux** | `notify-send "<title>" "<message>"` | libnotify CLI; current/maintained; the same tool node-notifier already shelled out to |
| **Any failure / unsupported / headless** | terminal bell (``) | The fallback now *actually fires*, because spawn errors are observed via callback/exit code |

**Remove** the `node-notifier` and `@types/node-notifier` dependencies entirely.

**Platform scope** (per NFR-02.1): macOS + Linux. For v1.0, **macOS is maintainer-verified**; **Linux is community-validated**, de-risked by the working bell fallback (worst case is an audible bell, never silence). Windows was never in scope; dropping node-notifier removes its latent `toaster` path, and the bell fallback covers any non-darwin/non-linux platform.

---

## Alternatives Considered

### Alternative A (Rejected): Keep node-notifier, point `customPath` at a modern terminal-notifier
node-notifier supports a `customPath` to a user-supplied terminal-notifier ≥2.0 (which uses `UNUserNotificationCenter`).
**Rejected**: requires shipping/vendoring a signed binary in the npm package, or a `brew install` precondition — heavier than osascript, still wraps an unmaintained library, and adds distribution complexity for zero benefit over the native command.

### Alternative B (Rejected): Swap to a different notification library (e.g. a node-notifier fork)
**Rejected**: introduces a new third-party dependency in the same risk class (native-helper resolution, maintenance drift), for capability that two built-in OS commands already provide.

### Alternative C (Chosen): Native OS commands, drop node-notifier
**Chosen**: zero new dependencies; both platforms use first-party, maintained OS tools; symmetric `error → bell` degradation; removes the unmaintained dependency that caused the defect. Reduces the runtime dependency count from 6 to 5. The only cost is a small `process.platform` branch in the adapter — which is exactly the layer (a driven adapter) where platform-specific I/O detail belongs, so hexagonal boundaries are preserved.

---

## Consequences

### Positive
- Desktop notifications work on macOS 14+ (the supported macOS line), fixing the reported defect.
- Removes an unmaintained dependency; runtime deps 6 → 5; smaller install + RSS surface.
- The bell fallback is now real graceful degradation, satisfying AC-02.6 honestly.
- Both platforms use maintained native tooling; behavior is symmetric and easy to reason about.

### Negative
- Adds a `process.platform` branch in `notificationAdapter.ts` (acceptable — adapter layer).
- **Linux notification delivery is unverified by the maintainer** (macOS-only test capability). Mitigated by: (a) bell fallback on any failure, (b) `notify-send` being standard on GNOME/KDE, (c) planned community validation.
- `osascript` / `notify-send` are spawned per notification — identical cost profile to what node-notifier already did.

### Residual Risk
- Linux delivery should be validated on a real Linux desktop (maintainer VM or community report). The Linux acceptance scenario is retained but its verification status is recorded as community-validated until confirmed. Special characters in titles/messages must be escaped before shell interpolation (messages are currently static, low risk, but the implementation must escape defensively).

---

## Files Affected

- `docs/adrs/ADR-010-native-notifications.md` (this file)
- `docs/feature/pomodoro-timer-cli/design/technology-stack.md` (node-notifier entry → native commands; dep count 6 → 5) — *updated in DELIVER*
- `docs/feature/pomodoro-timer-cli/design/architecture-design.md` (§5.4 notification mechanism) — *updated in DELIVER*
- `package.json` (remove `node-notifier`, `@types/node-notifier`) — *DELIVER*
- `build.mjs` (remove `node-notifier` from esbuild `external`) — *DELIVER*
- `.dependency-cruiser.cjs` (the rule scoping `node-notifier` imports to the adapter) — *DELIVER*
- `src/adapters/notificationAdapter.ts` (implementation) — *DELIVER*
- `tests/regression/…` + `tests/unit/adapters/notificationAdapter.test.ts` (regression + unit) — *DISTILL scaffolds, DELIVER green*

---

## References

- RCA (this session): node-notifier/terminal-notifier `NSUserNotificationCenter` removal on macOS 14+; `osascript` verified working on Darwin 25.5.0
- Original selection: `docs/feature/pomodoro-timer-cli/design/technology-stack.md:83-93` (node-notifier, NFR-02.1)
- Notification ACs: AC-02.4 (fires within 1s of transition), AC-02.5, AC-02.6 (graceful bell fallback)
- SSOT-change precedent: ADR-007 (falsified DV-05), ADR-008 (NFR rebaseline)
- Apple: `NSUserNotificationCenter` deprecated macOS 11, removed macOS 14; `UNUserNotificationCenter` is the replacement
