# ADR-023: Drop macOS from CI Entirely

- **Status:** Accepted. Approved by Giulia 2026-07-07, after a dedicated evidence-based investigation (not just deferring to CLAUDE.md's "targets macOS" line). Implemented in the `ci-drop-macos-acceptance-tests` PR: `.github/workflows/ci.yml`'s `acceptance-tests` matrix drops `macos-14`, running `ubuntu-22.04` only. **Coupled precondition, done as this PR opens:** `Acceptance Tests (macos-14)` removed from the `protect-main` ruleset's required status checks — otherwise every PR (including this one) deadlocks waiting on a check that no longer reports.
- **Date:** 2026-07-07
- **Deciders:** Giulia Mantuano

## Context

chromato went public on 2026-07-07. GitHub's "unlimited free Actions for public repos" covers **Linux-hosted runners only** — macOS runners are **never free**, on any repo, and bill at a **10x minutes multiplier**. The `acceptance-tests` job ran `[ubuntu-22.04, macos-14]` on every PR and push to `main`; this macOS leg was the dominant, unavoidable cost even after going public, and fully exhausted the account's 2,000 included minutes the same day, blocking the v1.0.0 release workflow (`startup_failure`).

An initial fix (release-only macOS, still the full suite) was drafted and reviewed, but before adopting it the maintainer asked a more fundamental question: is macOS testing needed in this pipeline **at all**? A dedicated investigation (not assumption) found:

1. **Zero OS-divergent code exists in the shipped product (`src/`) or its test suite (`tests/`) today.** `grep -rn "process\.platform\|os\.platform\|darwin\|win32" src/ tests/` returns nothing. The only OS-related call (`os.homedir()` in `configLoader.ts`/`persistenceAdapter.ts`/`configWriterAdapter.ts`) is the same XDG-spec path on both platforms, not a branch. (`scripts/benchmark-rss.cjs` does have real `darwin`-branching logic, but it's local-dogfood tooling for the `benchmarks` job, which has always run `ubuntu-22.04` only — unaffected by, and irrelevant to, this decision.)
2. **The one macOS-specific bug this project ever had (`fix-macos-notification-silent`, ADR-010) was found by the maintainer manually dogfooding on a real Mac — not by the macOS CI leg.** The code it lived in (`osascript` desktop notifications, via `node-notifier`) has since been **deleted entirely** (ADR-016 → ADR-022 replaced it with the current in-terminal-only banner/bell/window-title system). The one class of risk macOS CI ever caught no longer exists in the codebase.
3. **The acceptance suite's own design already concluded a CI runner isn't a faithful stand-in for a real terminal.** `tests/acceptance/in-terminal-notifications/slice-06-window-title.feature` explicitly routes real Terminal.app/iTerm2 rendering validation to owner dogfooding, not CI — because a headless macOS GitHub Actions runner doesn't exercise real terminal chrome any more than a headless Linux runner does. The acceptance scenarios assert on captured subprocess stdout strings (Ink's layout math, Node's TTY/env-var logic), which is identical on any POSIX runner.
4. **The one genuine remaining cross-platform risk is `better-sqlite3`'s native-addon install** (prebuilt binary or from-source build succeeding on macOS/arm64) — an install-time risk, not a behavioral one. Running all 130 Cucumber scenarios doesn't cover this any better than a one-line smoke check would, and no such targeted smoke check currently exists either way.

## Decision

Drop macOS from CI entirely — no macOS leg on PRs/pushes, and no macOS leg even at release time (rejecting the narrower "release-only" alternative that was drafted first).

1. `ci.yml`: `acceptance-tests` matrix becomes `os: [ubuntu-22.04]` only.
2. `release.yml`: no change needed — it already just calls `./.github/workflows/ci.yml` with no OS override, so it inherits the Linux-only matrix automatically.
3. Branch ruleset: `Acceptance Tests (macos-14)` removed from `protect-main`'s required status checks (it would never report again, otherwise). `Acceptance Tests (ubuntu-22.04)` remains required.
4. macOS remains chromato's stated target platform (CLAUDE.md's "Linux and macOS" line is unchanged and still accurate) — this decision is about **CI verification cost**, not about dropping macOS support. macOS behavior is no longer machine-verified; it now relies on the same mechanism that already caught the one real macOS bug this project ever had: the maintainer's own dogfooding, plus real-user bug reports.

## Consequences

**Positive**
- Every routine CI run (every PR, every push, every release) is now entirely free — permanently, not just "cheaper." Fully satisfies the never-pay constraint with no ongoing budget risk from this source.
- No loss of any acceptance coverage that was actually testing macOS-specific behavior, because none of the 130 scenarios exercise a macOS-specific code path today.

**Negative / risks**
- A future `better-sqlite3` install/ABI regression on macOS would not be caught by CI — it would surface as a real user's install failure. For a solo hobby project, this is a real but survivable tradeoff (a goodwill/support-burden cost, not an SLA breach), consistent with how Linux desktop-notification behavior was already validated pre-ADR-016 (community-reported, not CI-verified).
- If chromato ever gains genuinely OS-divergent code (a new native dependency, a platform-specific code path), this decision must be revisited — the investigation's conclusion is conditioned on the codebase as it exists today, not a permanent guarantee.

**Neutral**
- The commented-out post-MVP SEA-binary-build stub in `release.yml` still lists macOS targets (`macos-14`/`macos-12`) — left untouched, since it's inert and a separate, not-yet-active decision about future binary distribution, unrelated to acceptance-test CI.

## Alternatives considered

- **Release-only, full macOS suite** (the first draft of this ADR, before the deeper investigation): still pays the full 10x-multiplied 20-minute macOS leg, just less often (once per release instead of every PR). Rejected once the investigation showed the full suite has no macOS-specific signal to justify even that reduced cost.
- **Release-only, minimal macOS smoke test** (install + native-addon load + CLI launch): would cheaply cover the one real remaining risk (better-sqlite3 install). Rejected for now in favor of the simpler full drop, per the maintainer's explicit choice — revisit if a real macOS install issue is ever reported.
- **Keep full matrix on every PR** (status quo): the cost that caused the v1.0.0 release-blocking incident in the first place. Rejected.
