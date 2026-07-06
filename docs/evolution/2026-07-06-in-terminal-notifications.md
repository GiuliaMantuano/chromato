# Evolution: in-terminal-notifications

**Feature ID**: `in-terminal-notifications`
**Waves completed**: DISCOVER -> DISCUSS -> SPIKE -> DESIGN -> DISTILL -> DELIVER -> DEVOPS (finalize)
**Branch**: `feat/in-terminal-notifications-skeleton` (26 roadmap steps, all DONE; DES integrity verified — all 26 steps have complete DES traces)
**Status**: Implementation complete and committed locally. **Not pushed / no PR** — publishing is owner-gated (see Deployment Status below).

---

## What shipped

The OS desktop-notification surface (`osascript` on macOS, `notify-send` on Linux, via the
`node-notifier`-free `NotificationAdapter`/`NullNotificationAdapter` pair, ADR-010/ADR-016) is
**deleted entirely**, not offered alongside anything new. It is replaced by a single 4-mode
config enum — `notifications: "banner" | "banner+bell" | "bell" | "off"` (default
`"banner+bell"`, legacy `true`/`false` silently mapped) — that drives a composed set of
in-terminal signal adapters, fanned out via a new `CompositeNotificationAdapter`:

- **In-frame banner** (`TuiAdapter`) — inverse-video line below the timer frame, pulsing at the
  shipped OVERDUE-pulse cadence, auto-clears after 10s or is superseded by the next moment.
- **Single BEL** (`BellNotificationAdapter`) — exactly one `\x07` per real-world moment, TTY-gated;
  doubles as the zero-dependency tmux `monitor-bell` background-pane signal.
- **Window title** (`WindowTitleAdapter`) — OSC 0 title per phase (`🍅 WORK — chromato`, etc.) with
  XTWINOPS 22/23 save/restore around the session lifecycle, neutral-then-restore on exit.
- **`--minimal` / `NO_COLOR` parity** — plain `title — body` text line (no ANSI), `>>> … <<<`
  ASCII-emphasis degradation, zero BEL/title behavior change.

Net result: zero new runtime dependencies, net code shrinks (desktop adapter + null adapter + 3
test files deleted), and the mechanism now lives entirely inside the process — no OS shell-out,
no Focus/DND suppression, no per-app permission gate, works identically on macOS/Linux, and works
in full-screen terminal sessions where OS banners were invisible by construction.

Full requirements/design/test trail: `docs/feature/in-terminal-notifications/feature-delta.md`
(all wave sections, DISCOVER through DELIVER, plus the 3 Upstream Issues) and
`docs/feature/in-terminal-notifications/deliver/roadmap.json` (26-step plan) /
`execution-log.json` (full DES audit trail, one entry per step).

## Business context

Direct user feedback said OS desktop notifications were "not visible enough"; the product's own
OVERDUE state (dim-pulse rendering + "ran over" copy) was already compensating for the same
chronic failure. Technical analysis confirmed the delivery path is fragile by construction
(Focus/DND suppression, per-app permission gates, full-screen terminal hiding, Linux
DISPLAY/daemon dependency). Terminal-native precedent (irssi/WeeChat BEL, vim visualbell, tmux
monitor-bell) meant the persona already understood and expected in-terminal signalling. Owner
decision (fixed input, not re-validated by this discovery): desktop notifications are removed as
a user-facing option outright — DISCOVER validated the *replacement*, not the removal decision
itself. Full discovery evidence, opportunity scoring, and the CONDITIONAL-GO-to-GO gate history:
`feature-delta.md` DISCOVER section.

## Key decisions

- **[D1] Replace, don't multiplex** — the new mechanism fully replaces desktop notifications; no
  dual-surface config/wizard/testing burden for a channel users didn't notice.
- **[D2] `TuiAdapter` implements `NotificationPort` directly** — only the TUI may draw inside the
  alternate screen buffer; same instance wired to both `RenderPort` and `NotificationPort` at the
  composition root.
- **[D3] v1 signal bundle**: inverse-video banner + tick-driven pulse + single BEL (TUI); plain
  line (`--minimal`); plain-text ASCII banner (`NO_COLOR`).
- **[D4] "Loud" extras deferred** — full-frame flash and repeated-bell salience levels not shipped
  in v1; one more wiring-table row if ever needed.
- **[D5 -> superseded]** OSC window-title was originally deferred pending a compatibility spike;
  the spike (`spike/findings.md`) passed and the owner promoted it into v1 scope (US-06).
- **[D6] Legacy config mapping**: `notifications: true` -> `"banner+bell"`, `false` -> `"off"` —
  behavior-identical, zero user action required on upgrade.
- **[D7] Outcome measured behaviorally** — OVERDUE frequency/duration from session history, not
  solicited opinions (H1/H2 post-ship signals).
- **[DDD-13] Concurrent-moment / same-drain policy**: `SessionService.processEvents()` can drain
  more than one domain event for a single real-world moment (`PHASE_CHANGED` +
  `SESSION_COMPLETED` on every WORK->rest transition; `PHASE_CHANGED` + `OVERDUE_ACTIVATED` on
  every rest->OVERDUE timeout). Resolved as "PHASE_CHANGE wins" on slotted/signal surfaces
  (banner, title, bell), while the append-only `--minimal` renderer intentionally prints both
  lines where they carry distinct information. This decision was **corrected mid-DELIVER** — see
  Lessons Learned below — and the corrected version is now canonical in
  `docs/product/architecture/brief.md` (local SSOT) and in the promoted
  `docs/adrs/ADR-022-in-terminal-notifications.md`.

Full decision ledger with rationale: `feature-delta.md` Wave Decisions sections (DISCOVER,
DISCUSS, DESIGN, DISTILL).

## Steps completed (from roadmap.json / execution-log.json)

26/26 roadmap steps DONE across 6 slices:

1. Notification mode enum + mode-driven factory (slice-03 foundation)
2. `CompositeNotificationAdapter` + `BellNotificationAdapter` (slice-02)
3. Mode config, legacy mapping, invalid-value warning, desktop-surface deletion (slice-03)
4. Wizard 4-mode picker + home recap label (slice-04)
5. `--minimal` / `NO_COLOR` / ASCII parity (slice-05)
6. `WindowTitleAdapter` + OSC 0 / XTWINOPS lifecycle (slice-06)

Plus 3 in-flight bug fixes discovered and closed during DELIVER (steps 03-05, 06-04, 06-05 — see
Lessons Learned) and a mutation-testing gate on the feature-owned notification subsystem: 96.09%
kill rate (172/179), pass threshold >=80%.

Full per-step DES audit trail (inputs, outputs, verification evidence): `deliver/execution-log.json`.

## Lessons learned — 3 bugs found during DELIVER, not by the original test suite

All three bugs shared one root cause shape, and are worth naming explicitly as a testing
methodology lesson:

> **When a domain fires paired/co-occurring events for a single real-world moment, tests must
> simulate the pairing, not just exercise each event type independently.**

`SessionService.processEvents()` (application layer, unchanged pre-existing code) can drain
**more than one** domain event in a single synchronous pass — a fact the original design (DDD-13
/ [D-DISTILL-1]) only partially recognized. The unit test suite for every `NotificationPort`
adapter called each method (`notifyPhaseChange`, `notifySessionComplete`, `notifyOverdue`) as
**independent, sequential** invocations. Each such test was individually correct and green — but
none of them proved what actually happens when two of those calls fire together, in the same
drain, for the same moment. That gap let all three bugs ship past the full acceptance suite and
mutation gate, and only surfaced through live dogfooding and adversarial review.

1. **Window title clobbered on every work->rest transition** (found in owner dogfood, fixed step
   03-05). `WindowTitleAdapter.notifySessionComplete()` was left un-arbitrated on the (wrong)
   assumption that "session complete" only ever meant "no phase currently running." In reality
   `PHASE_CHANGED` + `SESSION_COMPLETED` fire together on **every** work block ending, not just the
   final one — so the correct phase title was set, then immediately overwritten back to neutral,
   every single work->rest transition. Fix: extend the banner path's existing "PHASE_CHANGE wins"
   arbitration to the title.

2. **Bell rang twice on every phase transition** (found during the DELIVER elevator-pitch demo
   against real `dist/index.js` output, fixed step 06-04). `BellNotificationAdapter.ring()` had no
   same-drain awareness at all, so both paired calls each wrote a BEL — 4 real bell bytes observed
   for 2 real moments. This also exposed a **second, previously undocumented** same-drain
   collision pair (`PHASE_CHANGED(to='OVERDUE')` + `OVERDUE_ACTIVATED`) that the original DDD-13
   write-up never analyzed — it had been invisible on the banner/title paths by accident (Ink
   batches same-tick renders; the title happened to write an identical string from both calls) but
   not on the bell, which has no such accidental protection.

3. **Wrong notification copy on break-timeout, visible in `--minimal`** (found by Phase 4
   adversarial review, fixed step 06-05). `resolvePhaseChangeCopy(to='OVERDUE')` fell through to
   the generic "Pomodoro complete — Time for a N-minute break" branch instead of "Break ran
   over — Ready to focus again?" — correct for `to='BREAK'`, silently wrong for `to='OVERDUE'`. In
   the TUI banner path this was very likely invisible (same Ink-batching effect as bug 2); in
   `--minimal`, every write is immediately and separately flushed, so the wrong line was
   permanently visible in scrollback. The existing unit test suite covered `to=WORK/BREAK/LONG_BREAK`
   and the standalone `OVERDUE` moment kind, but never the `PHASE_CHANGE` moment with `to='OVERDUE'`
   combination — the exact gap that let it through.

**Design correction made in the same wave**: `docs/product/architecture/brief.md`'s DDD-13
section was rewritten in place to name both same-drain collision pairs (`SESSION_COMPLETED`
pairing on WORK->rest, `OVERDUE_ACTIVATED` pairing on rest->OVERDUE) as the common case, not a
rare edge case — this correction is carried forward into the promoted
`docs/adrs/ADR-022-in-terminal-notifications.md`.

**Actionable takeaway for future features on this codebase**: whenever a domain event stream can
emit more than one event per user-observable moment, write at least one test per consuming
adapter that exercises the *paired* call in the same synchronous pass, not only each event type in
isolation. `SessionService.processEvents()`'s multi-event-per-drain behavior is now documented in
DDD-13 precisely so the next adapter added to `NotificationPort` (or any future driven port
consuming these events) inherits this test obligation by design, not by rediscovery.

## Issues encountered

- No IMPORT_ERROR / FIXTURE_BROKEN / SETUP_FAILURE scenarios at any red-classification checkpoint
  (`distill/red-classification.md`) — every RED failed at an assertion on genuinely missing
  behavior.
- One pre-existing, unrelated test failure carried through the whole feature and confirmed on
  `main` before this branch existed: `tests/regression/status/width-validation.regression.test.ts`
  (`chromato status --width N` doesn't bound output length when ANSI color is present). Not
  touched by this feature; candidate backlog item.
- US-04 (wizard/home) demo evidence: a scripted `expect`-driven pty run for the Post-Merge
  Integration Gate did not reliably land keystrokes on the intended wizard screens (harness
  timing/pty fragility, not a product defect). Verified instead via the direct
  `setupWizardAdapter.test.ts` ink-testing-library twins plus the full 130/130 acceptance gate.

## Verification evidence (Post-Merge Integration Gate, 2026-07-06)

Real subprocess executions against the built `dist/index.js` (not test doubles), captured via pty
for TTY scenarios and plain pipe for non-TTY. All 5 independently-verifiable stories (US-01, 02,
03, 05, 06) passed live byte-level inspection after the two live-found bugs were fixed; US-04
verified via targeted component tests instead of a fragile scripted pty run. Full table:
`feature-delta.md` "Demo Evidence (Post-Merge Integration Gate, 2026-07-06)".

Test suite at finalize: 130/130 acceptance scenarios, 500+ unit/integration tests green (one
pre-existing unrelated failure noted above). Mutation testing (feature-owned files): 96.09% kill
rate, gate >=80%, PASS.

## Deployment status

**Committed locally on `feat/in-terminal-notifications-skeleton`. Not pushed, no PR opened.**
Per the project's standing rule, pushing/publishing requires Giulia's explicit, in-the-moment
go-ahead — not given at finalize time. DELIVER (implementation + verification) is complete;
DEVOPS deployment execution (push, PR, merge, production rollout, outcome measurement against
H1/H2) awaits that explicit go.

## Migrated / promoted artifacts

- `docs/product/architecture/adr-022-in-terminal-notifications.md` (DESIGN-wave draft, local-only
  / gitignored) -> promoted to canonical `docs/adrs/ADR-022-in-terminal-notifications.md`
  (Status: Accepted), including a post-acceptance note capturing the DDD-13 correction.
- `docs/product/architecture/brief.md` Component Inventory (local SSOT, gitignored) — component
  rows for this feature updated from NEW/EXTEND/DELETE to SHIPPED.

## Full history reference

- `docs/feature/in-terminal-notifications/feature-delta.md` — complete wave-by-wave record
  (DISCOVER through DELIVER), including the 3 Upstream Issues in full detail.
- `docs/feature/in-terminal-notifications/deliver/roadmap.json` — 26-step execution plan.
- `docs/feature/in-terminal-notifications/deliver/execution-log.json` — full DES audit trail.
- `docs/feature/in-terminal-notifications/distill/red-classification.md` — fail-for-right-reason
  gate evidence.
- `docs/feature/in-terminal-notifications/deliver/mutation/mutation-report.md` — mutation testing
  detail.

The `docs/feature/in-terminal-notifications/` workspace is preserved (not deleted) per nWave
convention — it remains the detailed process history behind this summary.
