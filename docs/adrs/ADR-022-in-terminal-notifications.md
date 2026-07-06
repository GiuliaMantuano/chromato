# ADR-022: In-Terminal Notification Delivery via Composite NotificationPort

**Status**: Accepted — implemented across 26 DELIVER steps on
`feat/in-terminal-notifications-skeleton` (2026-07-04 -- 2026-07-06); canonical record. The
DESIGN-wave draft remains at
`docs/product/architecture/adr-022-in-terminal-notifications.md` (local-only, gitignored),
mirroring the ADR-018/ADR-020 lifecycle.
**Date**: 2026-07-04 (decision) / 2026-07-06 (accepted, post-DELIVER correction folded in)
**Feature**: in-terminal-notifications
**Deciders**: Morgan (nw-solution-architect, Propose mode); owner decisions [D1]-[D14]/OQ-D fixed inputs
**Related**: ADR-004 (ports-and-adapters), ADR-010 (native OS notifications, superseded),
ADR-014 (null-object off switch), ADR-016 (zero-dep native notifications), ADR-017 (driving
control port), spike `docs/feature/in-terminal-notifications/spike/findings.md`

---

## Context

Desktop notifications are removed as a user-facing option (owner decision [D1]); the v1 signal
bundle is: in-frame banner (TUI) / plain line (`--minimal`), single BEL, and an OSC-0 window
title with XTWINOPS save/restore — selected by one config enum
`notifications: "banner" | "banner+bell" | "bell" | "off"` (default `"banner+bell"`, legacy
`true`/`false` mapped, invalid value → stderr warn + default). `"off"` means everything off,
title included (OQ-D). Constraints: zero new runtime deps (SC-2); alt-screen integrity — only
the TUI may draw printable output during a session (SC-1); dependency-cruiser Rule 4 forbids
adapter cross-imports; `--minimal`/status paths must stay ink/react-free (Rule 3, <50ms);
piped output byte-identical ([D8]); `chromato status` untouched (SC-4).

Fait accompli: the walking skeleton already ships `TuiAdapter implements NotificationPort`
(banner below the frame, 10s auto-clear, pulse, supersession) wired at the composition root.

Terminology: throughout this feature, "banner" means the **in-frame notification banner** — it
is unrelated to the pre-existing `src/adapters/bannerAdapter.ts` (the startup ASCII-art logo
banner), which is untouched.

Code facts that shaped the decision:

- `buildNotificationPort` in `index.ts` is the single historical selection point (ADR-014),
  currently boolean → desktop-or-null; the TUI paths bypass it since the skeleton.
- The initial IDLE→WORK start does **not** emit `PHASE_CHANGED` (`session.ts` IDLE branch pushes
  no event), so "title set on session start" (AC-06.1) cannot ride `NotificationPort` — it needs
  an explicit lifecycle call.
- `MinimalAdapter` owns a `\r`-overwrite line protocol on TTYs; any second writer interleaving
  printable text with it would corrupt the live timer line.
- Every exit path (Q, Ctrl+C→SIGINT, SIGTERM, session complete) converges on
  `SessionService.run()` resolving — a single post-`await` hook covers all exits.

---

## Decision

Six coupled decisions, one mechanism family:

1. **Mode enum lives in a new pure domain module** `src/domain/notificationMode.ts`: the
   `NotificationMode` union, default, `parseNotificationMode` (legacy boolean mapping +
   invalid→default with an `invalid` marker), `MODE_LABELS` (single display-label source for
   wizard rows, wizard summary, home recap), and signal predicates. `configTypes.ts` keeps
   pure types (`PersistedConfig.notifications?: boolean | NotificationMode` on read;
   `WizardResult.notifications: NotificationMode` on write) — precedent: it already imports
   `PaletteName` from the domain. `configLoader.loadConfig` calls the parser at its existing
   single parse (DD-4), surfaces `ConfigResult.notifications: NotificationMode`, and writes the
   one stderr warning for invalid values ([D10]) at that single choke point.

2. **`buildNotificationPort` becomes a mode→composite factory.** A new
   `CompositeNotificationAdapter` (implements `NotificationPort`, holds
   `children: NotificationPort[]`, forwards every call to each child; imports domain types only)
   is returned for every mode; the children per mode:
   `banner+bell` → [visual, bell, title] · `banner` → [visual, title] · `bell` → [bell, title] ·
   `off` → [] (the empty composite IS the null object). "visual" is the render-owning adapter
   of the active path — `TuiAdapter` (TUI) or `MinimalAdapter` (minimal/NO_COLOR), both
   implementing `NotificationPort`. **No mode flags inside any adapter** — selection stays an
   injection choice at the composition root, extending ADR-014's principle from a 2-way swap to
   a composed set.

3. **Bell is a dedicated `BellNotificationAdapter`**: exactly one `\x07` to stdout per moment,
   emitted only when `process.stdout.isTTY` ([D8], M8-08 invariant), shared verbatim by TUI and
   minimal paths. (Supersedes the US-02 technical-note sketch "emitted by the render-owning
   adapter" — a mechanism note, not an AC; observable behavior is identical, so no story/AC
   change and no upstream-changes.md.)

4. **Window title is a dedicated `WindowTitleAdapter`** with `NotificationPort` methods PLUS a
   lifecycle: `start()` (XTWINOPS 22 save + initial WORK title) called by the composition root
   before `service.run()`; moment methods set the destination-phase title
   (`notifySessionComplete` → neutral `chromato`); `stop()` called once after `run()` resolves,
   emitting **neutral title first, then XTWINOPS 23 restore** — supporting terminals pop the
   user's title, non-supporting ones are left neutral, never a stale phase title (AC-06.3).
   Pure phase→title strings (incl. ASCII variants) live in new `src/domain/windowTitle.ts`.
   TTY gating inside the adapter. Constructed for all non-off modes only (OQ-D).
   Byte sequences (spike-verified): OSC 0 set = `\x1b]0;{title}\x07`; XTWINOPS save =
   `\x1b[22;0t`, restore = `\x1b[23;0t`.

5. **The desktop surface is DELETED, not unwired**: `notificationAdapter.ts`,
   `nullNotificationAdapter.ts` (subsumed by the empty composite), their 3 test files, and
   `assets/icon-timer-ring.png` (if no other referent) are removed in slice-03, when the enum
   makes them unreachable. Git history + ADR-010/016 preserve the mechanism knowledge.

6. **Concurrent-moment policy (DDD-13 — retroactive ratification of DISTILL's
   [D-DISTILL-1])**: when `PHASE_CHANGED` and `SESSION_COMPLETED` fire in the same event drain
   (spike `upstream-issues.md`: originally assumed only "the final work-block tick enqueues
   both" — **corrected during DELIVER, see Post-Acceptance Correction below**), the TUI banner
   path resolves it as **PHASE_CHANGE wins** — the same-drain `notifySessionComplete` is a no-op
   on the banner slot; `--minimal` prints **both** lines. Architectural rationale: (a) the frame
   has a **single banner slot** by design (AC-01.3 "at most one banner"); (b) Ink batches
   same-tick renders, so an intra-drain supersession would be invisible — the "winner" is the
   only banner a user could ever see; (c) no information is lost — the frame's Today counter
   already carries the cumulative session count. The minimal renderer is append-only (no slot
   constraint), so both lines print. This decision is architect-owned as of this ratification;
   [D-DISTILL-1] is its acceptance-test pinning.

Enforcement: dependency-cruiser gains no-ink/no-react rules for the three new adapters (they
ride the minimal path); Rule 4 already forbids every illegal edge (the composite composes
instances, imports only `domain/ports`).

Sequencing: R2 (launch-path consolidation, 3 wiring blocks → 1) lands as a pure-refactor commit
between slice-01 and slice-02 so the composite is wired once; R1 (wizard split) is deferred to
post-ship hardening — the 4-row picker replaces one step branch without it.

---

## Post-Acceptance Correction (DELIVER wave, 2026-07-05/06)

Decision 6 (DDD-13) understated the same-drain collision's scope, and its arbitration was
initially applied to only one of two consuming adapters. Both gaps were found live, after
acceptance, via owner dogfood and adversarial review — not by the original test suite (root
cause: unit tests exercised each `NotificationPort` method independently, never simulating the
paired-call reality; see the feature's evolution doc for the full retrospective). Corrections,
now part of the accepted decision:

- The `PHASE_CHANGED` + `SESSION_COMPLETED` collision fires on **every** WORK→rest transition,
  not only the final one. `WindowTitleAdapter` had not received the "PHASE_CHANGE wins"
  arbitration the banner already had, so it clobbered the correct phase title back to neutral on
  every rest transition. Fixed (roadmap step 03-05) by extending the same arbitration to the
  title.
- A **second, previously undocumented** same-drain collision pair exists:
  `PHASE_CHANGED(to='OVERDUE')` + `OVERDUE_ACTIVATED`, firing on every BREAK/LONG_BREAK→OVERDUE
  timeout. It was invisible on the banner/title paths by accident (Ink batches same-tick
  renders; the title happened to write an identical string from both calls) but doubled the bell
  on every break timeout. Fixed (roadmap step 06-04) with the same "PHASE_CHANGE wins" rule,
  preserving the genuinely-standalone 60-second overdue follow-up reminder as a real, separate
  ring.
- A related copy bug surfaced by the same collision pair: `resolvePhaseChangeCopy(to='OVERDUE')`
  fell through to the BREAK-default copy instead of the correct "Break ran over" text, visible as
  a wrong line in `--minimal` sessions at every break timeout. Fixed (roadmap step 06-05) with an
  explicit `to='OVERDUE'` branch, single-sourced with the standalone OVERDUE moment kind, plus a
  `--minimal`-only suppression of the resulting duplicate correct line (the `SESSION_COMPLETED`
  pairing's two-different-lines behavior is intentionally untouched).

Full incident detail: `docs/feature/in-terminal-notifications/feature-delta.md`, "Wave: DELIVER
/ [WHY] Upstream Issues" (Issues 1-3).

---

## Alternatives Considered

### A1 — Render-owning adapters own ALL signals (bell + title baked into TuiAdapter/MinimalAdapter, mode flag in constructor) — REJECTED
Smallest file count, but: bell + title logic duplicated across two adapters; per-signal mode
flags inside adapters are exactly what ADR-014 rejected (its alternative A2, "branch inside the
adapter"); the title's exit-restore would tangle window-chrome state into the alt-screen owner
AND still need a separate path for `bell`-only mode (no visual adapter in the composite yet a
title must be set). Composition keeps one concern per class and the wiring table in one place.

### A2 — Refactor `NotificationPort` to a single `notify(moment: NotificationMoment)` method (spike suggestion) — REJECTED
Marginally cleaner fan-out, but churns `SessionService`, every implementation, and every
existing test for zero observable gain. The 3-method port already models all moments; keeping
it means the application layer ships untouched. Can be revisited if a fourth moment ever lands.

### A3 — Keep `NotificationAdapter`/`NullNotificationAdapter` as unwired dead code — REJECTED
Meets the letter of [D1] (unreachable) but: an unreachable osascript shell-out is latent
security/maintenance surface; the repo is mid-hygiene-drive (comment-archaeology cleanup);
DISCOVER's viability case counted on net code shrink; git history and ADR-016 already preserve
recovery. If desktop ever returns it will be behind the ADR-016 Alternative-B probe gate, i.e.
rewritten anyway.

### A4 — Shared pure title helper called from inside TuiAdapter and MinimalAdapter (no title adapter) — REJECTED
Avoids one class but duplicates set/save/restore call sites in two adapters, cannot serve
`bell`-only mode (neither visual adapter is wired there), and leaves exit-restore split between
`TuiAdapter.stop()` and `MinimalAdapter.stop()` instead of one root-owned lifecycle around
`run()`. The IDLE→WORK no-event fact forces an explicit `start()` regardless — a lifecycle the
render adapters don't otherwise need.

### A5 — Runtime terminal-capability probing (DA/XTGETTCAP queries) before emitting title/bell — REJECTED
Earned-Trust considered explicitly: query round-trips need raw-mode reads with timeouts and
per-terminal quirks — disproportionate for signals that are harmless when ignored. The spike is
the probe; the neutral-then-restore ordering converts the one dangerous lie (ignored XTWINOPS)
into a benign outcome; byte-stream acceptance tests assert emission; owner dogfood (DoD 9)
verifies the visual contract in the real target terminals.

---

## Consequences

**Positive**: zero new dependencies; `SessionService` and the port interface untouched; one
mode source, one label source, one bell implementation, one title owner; net LOC shrinks
(desktop adapter + null adapter + 3 test files deleted); every signal independently unit-testable
by capturing stdout bytes; wiring table readable at a glance in one factory; ADR-014's
injection-over-flags principle preserved and extended.

**Negative / trade-offs**: three new small files (composite, bell, title) + two pure domain
modules; the composition root gains the title start/stop lifecycle calls (mitigated: R2 gives it
exactly one launch path); crash paths (uncaught exception) don't restore the title — accepted,
identical to the existing alt-screen limitation; banner emoji padding keeps the spike's ±1-cell
drift on emoji-single-width terminals (grapheme-aware width without a new dep is a DELIVER
refinement, drift accepted for v1); the same-drain arbitration logic (DDD-13) is now duplicated
across three adapters (title, bell, and the banner's existing slot logic) — each keyed on the
same "did notifyPhaseChange fire in this drain" flag, and each requiring its own regression test;
a fourth `NotificationPort` consumer would need to independently rediscover this obligation unless
the flag is centralized (candidate future refactor, not required for v1).

**Neutral**: if a "loud" salience level ever ships ([D4] deferral), it is one more row in the
wiring table + one more child adapter — no structural change.

---

## Compliance

ADR-004 (all dependencies point inward; injection at the root) · ADR-014 (extended, not
contradicted) · ADR-016 (zero-dep line held; desktop deletion reaffirms ADR-010) · ADR-017
(control port untouched; Q/Ctrl+C exit convergence reused for title restore) · CLAUDE.md Rules
1-4 + new dep-cruiser rules · SC-1…SC-7 · [D8]/[D9]/[D10]/[D11]/[D14]/OQ-D as resolved.
