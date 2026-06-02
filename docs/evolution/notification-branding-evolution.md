# Evolution Archive — notification-branding

**Shipped**: 2026-06-02 | **Branch**: `feature/notification-branding` | **Model**: nWave legacy multi-file (no SSOT)
**Waves**: DISCUSS → DESIGN → DISTILL → DELIVER (DISCOVER/SPIKE/DEVOPS n/a — brownfield brand-polish, no new infra)

## What shipped

Desktop notifications are now on-brand. Warm-voice copy (the D3 matrix) replaces the terse strings on
every phase change + overdue; a **new session-complete notification** reports the session's focused minutes;
a static **ocean timer-ring icon** appears on Linux (`notify-send -i`). All delivery goes through the
existing injected `CommandRunner` — **zero new dependencies**. macOS keeps `osascript` (the OS cannot set a
custom icon there); headless/non-interactive falls back to the terminal bell. The wizard's notifications
on/off preference still gates everything (NullNotificationAdapter at the composition root).

## The decisive call (ADR-016, Option C)

The feature was premised on switching delivery to `terminal-notifier`/`node-notifier` for a custom icon —
but **ADR-010 (2026-05-30) had already rejected exactly that**: node-notifier bundles an old terminal-notifier
that uses `NSUserNotificationCenter`, removed in macOS 14 → "ghost delivery" (reports success, shows nothing),
on the maintainer's own platform. DESIGN reframed to **Option C**: native `osascript`/`notify-send`/bell,
zero deps, with `terminal-notifier ≥2.0` documented as a probe-gated *future* upgrade. Consequence: the
timer-ring icon ships on **Linux only** this slice; the **macOS icon is deferred** (US-NB-03 platform split).

## Architecture (as built)

- `src/domain/notificationCopy.ts` — NEW pure `resolveCopy(moment, numbers)` → {title, body}; the D3 matrix;
  **break-agnostic Break→Work** (both SHORT_BREAK→WORK and LONG_BREAK→WORK → the same "Break's over" copy,
  keyed on `to === 'WORK'`, so a long-break exit never throws→silent-bell). Domain-pure (imports only
  `PomodoroPhase`). *Originally mis-placed under `src/adapters/` by DESIGN; moved to domain during DELIVER —
  see "Escalations".*
- `src/adapters/notificationAdapter.ts` — 2-arg ctor `(numbers, runner?)` (numbers now required); internal
  DeliveryMechanism: headless→bell, else platform (Linux `notify-send -i <icon>` / macOS `osascript` no-icon
  with `escapeForAppleScript` on the osascript path **only** — notify-send uses `execFile` args[], no shell);
  `notifySessionComplete`; fire-and-forget `.catch(()=>bell())` never-crash preserved.
- `src/application/sessionService.ts` — `processEvents(config)` (CRIT-1); session-local `completedThisSession`
  counter reset at each `new Session(...)`; SESSION_COMPLETED computes **session-scoped**
  `focusedMinutes = completedThisSession × workDurationSeconds/60` (CRIT-2); historyPort still gets the daily total.
- `src/index.ts` — `buildNotificationPort` derives `NotificationCopyNumbers` from the already-loaded
  `ConfigResult.config` (single-sourced, SC-07) and injects them.
- `assets/icon-timer-ring.png` — 512×512 ocean timer-ring, rasterized from the prototype `iconRing` SVG.

## Test strategy

Vitest-only, **25 specs**. The OS draws the card, so every assertion is on the **CommandRunner payload**
(command + args), never the rendered notification (SC-01). No cucumber (a subprocess can't observe the payload;
adding it would orphan + burn CI budget). Notable guards: S24 (CRIT-2 — session-scoped 25 not 100; historyPort
still daily total 4), S19 (non-vacuous osascript injection escaping), S16/S17/S18 (never-crash → bell).

## Delivery facts

- 4 TDD steps, DES-monitored (legacy 5-phase), all complete integrity traces.
- Final: 25/25 NB specs + **358/358 vitest**, **103/103 cucumber regression** (no notification regression),
  `pnpm build` + `tsc --noEmit` + `pnpm check:arch` + `pnpm audit --audit-level=high` all clean, zero `__SCAFFOLD__`.
- Reviews: DISCUSS (Eclipse), DESIGN (Atlas — caught CRIT-1/CRIT-2), roadmap (0 orphans), DISTILL (Sentinel —
  S19 + LONG_BREAK), DELIVER adversarial (caught a latent vacuous `includes('')` bell check + stale type-imports).

## Escalations (the DES discipline working)

Three mid-flight corrections, each surfaced by a crafter/reviewer refusing to proceed on a flaw:
1. **DISTILL test-gap back-propagation** — pre-existing `notificationAdapter.test.ts`/regression still asserted
   the retired terse copy + 1-arg ctor (DESIGN superseded them but DISTILL never updated the executable tests).
2. **DESIGN Rule-4 placement error** — `notificationCopy.ts` was specced under `src/adapters/` ("Rule 4 intact,
   PALETTE_META precedent") but that import violates `adapters-no-cross-import`; the module is domain-pure →
   moved to `src/domain/`. The cited precedent was inaccurate (brand constants live in `domain/brand.ts`).
3. **Adversarial-review test-quality** — a genuinely-vacuous `includes('')` bell assertion + stale `import type`
   refs to the moved module, fixed; `numbers` made a required ctor param (dead `DEFAULT_NUMBERS` removed).

## Known gaps / follow-ups

- **macOS timer-ring icon deferred** — needs `terminal-notifier ≥2.0` (probe-gated per ADR-016 C-NB-2). Future slice.
- **Mutation testing not run** — chromato has no Stryker toolchain (CLAUDE.md declares per-feature; the dep is
  absent). Standing repo debt (also open from returning-home).
- **Action buttons / notification sound** — deferred (a CLI has no click listener; sound left silent, no config sub-pref).
- Cosmetic: `src/homeGuard.ts:4` still carries a "RED scaffold" doc-comment from returning-home (implemented code).

## Artifacts

`docs/feature/notification-branding/{discuss,design,distill,deliver}/` — full wave record incl. roadmap.json,
execution-log.json (DES traces), ADR-016, per-wave decisions/reviews, and the DELIVER back-propagation in
`distill/upstream-issues.md`. Prototype: `docs/design/notifications-prototype.html`.
