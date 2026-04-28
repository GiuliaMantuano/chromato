# ADR-007: Falsification of DV-05 (tmux Version Matrix) and Removal of `tmux-matrix` / `integration-tests` CI Jobs

**Status**: Accepted
**Date**: 2026-04-28
**Feature**: pomodoro-timer-cli (status path; CI/CD pipeline)

---

## Context

DV-05 (DEVOPS wave, `docs/feature/pomodoro-timer-cli/devops/wave-decisions.md` lines 100-111) established a CI matrix testing chromato status output against tmux 2.6, 2.9, and 3.2. The decision text reads, verbatim:

> ### DV-05 -- tmux Version Matrix: 2.6, 2.9, 3.2
>
> **Decision**: CI tests chromato status output against tmux 2.6, 2.9, and 3.2 (from DESIGN wave OI-D1).
>
> **Rationale**:
> - tmux 2.6 (released 2017): oldest version still in active use on older Ubuntu LTS installs
> - tmux 2.9 (released 2019): format string color specifier syntax changed from 2.8 to 2.9
> - tmux 3.2 (released 2021): most recent widely-available version; ships with Ubuntu 22.04 default packages
>
> Format string color specifiers (`#[fg=colour200]`) and the empty-string IDLE behavior must be validated across these versions.

The premise is unambiguous: chromato would emit **tmux format strings** (e.g. `#[fg=colour200] 25:00 WORK #[default]`), and tmux's interpretation of those tokens varies between 2.6, 2.9, and 3.2 (the rationale specifically calls out the 2.8 -> 2.9 syntax change). Cross-version validation was therefore required.

The BUILD wave chose a different output strategy. The `tmux-matrix` CI job (and its sibling `integration-tests` job) were left in place and continued to point at directories that the implementation never created (`tests/integration/tmux/`, `tests/integration/`). Both jobs have been failing with vitest "No test files found" since the start of CI history -- not for tmux-related reasons, but because the entire test-directory premise is moot. Full RCA: `docs/troubleshooting/2026-04-27-rca-remaining-ci-reds.md` Categories 1 and 2.

This ADR records the decision to delete both jobs and update DV-05.

## Falsifying evidence

The relevant production code is `src/adapters/statusAdapter.ts`. The output construction for tmux (lines 65-73 in the current file):

```typescript
// Abbreviated label keeps visible length well within budget for all phases.
const label = phase === 'LONG_BREAK' ? 'LNG' : phase.substring(0, 4);
const plain = `${time} ${label}`;

if (noColor) {
  return enforceWidth(plain, plain, maxWidth);
}

const color = PHASE_COLORS[phase];
const colored = color ? chalk.hex(color)(plain) : plain;
return enforceWidth(colored, stripAnsi(colored), maxWidth);
```

`chalk.hex(color)(plain)` emits **ANSI escape sequences** (`\x1b[38;2;R;G;Bm ... \x1b[39m`) directly into the string returned by `chromato status --format tmux`. There are no `#[fg=...]` tokens; chromato never asks tmux to interpret a format string.

This is consequential: tmux 2.6, 2.9, and 3.2 all interpret raw ANSI escape sequences identically, because they do not interpret them at all -- ANSI is rendered by the terminal emulator (iTerm2, Alacritty, GNOME Terminal, etc.) at the layer below tmux. tmux merely passes those bytes through to the pane (when `set -g allow-passthrough on` is configured, or by default in modern versions for cells inside the status line via the `#(...)` invocation channel). The cross-version variability that DV-05 was designed to catch does not exist in chromato's output, because chromato never produces the kind of token whose interpretation varies.

The `tmux-matrix` job is therefore a regression guard against a class of bug that the implementation cannot produce. It has not actually been running tmux-version comparisons in any CI run -- it has only ever failed on a missing directory -- but even if `tests/integration/tmux/` existed, the matrix would be testing tmux's terminal-emulator passthrough behavior, not chromato's behavior.

## Decision

(a) Remove the `tmux-matrix` job from `.github/workflows/ci.yml`.
(b) Remove the `integration-tests` job from `.github/workflows/ci.yml`. This is covered separately by Decision 3a in `docs/troubleshooting/2026-04-27-rca-remaining-ci-reds.md` (the directory `tests/integration/` does not exist; the job has only ever failed for "No test files found"; real AC coverage is provided by the Cucumber acceptance suite at `tests/acceptance/pomodoro-timer-cli/`). Bundling both removals into one PR is operationally efficient and the rationales reinforce each other (both are CI-structural artifacts pointing at non-existent paths).
(c) Mark DV-05 as **falsified** in `docs/feature/pomodoro-timer-cli/devops/wave-decisions.md` with a back-link to this ADR. The original decision text is preserved (per ADR convention; historical record is not edited) and a status note is appended.
(d) Also remove the `security` (CodeQL SAST) job from the same `.github/workflows/ci.yml`. GHAS is unavailable on the free private personal-account plan; the job has been failing since the repository's first CI run for plan-limit reasons. This bundling is a separate decision documented in the RCA Category 4; it shares the same PR for budget reasons (one push to remote rather than three) but is mentioned here so the ci.yml diff is fully accounted for.

## Alternatives Considered

### Alternative A (Rejected): Implement tmux format strings (`#[fg=colour200]`) instead of ANSI

Rewrite `statusAdapter.formatTmux` to emit `#[fg=...]` tokens that tmux interprets at the format-string layer.

- **Pros**: Matches DV-05's original premise; cross-version matrix testing becomes meaningful.
- **Cons (decisive)**: Contradicts AC-P3 ("`NO_COLOR` environment variable suppresses all ANSI sequences in all output modes"). `NO_COLOR` is honored by ANSI-aware terminals at the rendering layer; tmux format strings are interpreted by tmux earlier in the pipeline and are not affected by `NO_COLOR` in the user's terminal. Switching to format strings would create a second color path with its own `NO_COLOR` handling -- duplicating the suppression logic and creating divergence risk between minimal/tmux output modes for the same input. The current ANSI-via-chalk approach has one suppression path that works uniformly.

### Alternative B (Rejected): Keep the matrix as a regression guard for ANSI passthrough across tmux versions

Leave the matrix in place to verify that tmux 2.6/2.9/3.2 each correctly pass ANSI sequences through to the terminal.

- **Pros**: Could in principle catch tmux-version regressions in passthrough handling.
- **Cons (decisive)**: ANSI passthrough is tmux's own behavior, not chromato's. The matrix would be testing the tmux project's terminal-emulator handling -- which tmux's own test suite covers. Asserting that tmux works correctly is not chromato's responsibility, and a failure in the matrix would not yield a chromato fix; it would yield a tmux bug report. This is testing the wrong layer.

### Alternative C (Considered, deferred): Add a single passthrough sanity test in the acceptance suite

A lightweight scenario asserting that `chromato status --format tmux` produces non-empty ANSI bytes when not in `NO_COLOR` mode, run once on the existing acceptance OS matrix (ubuntu-22.04 + macos-14) with the system's default tmux.

- **Status**: Deferred to a possible follow-up. The existing acceptance suite already exercises `chromato status --format tmux` end-to-end without an explicit assertion of ANSI presence; the AC-03.1 50ms latency assertion in particular would catch most catastrophic regressions. Not bundling into this PR keeps scope tight.

## Consequences

### Positive

- **CI minutes recovered**: ~3 minutes of GitHub Actions time saved per push (3-version tmux matrix removed, plus 4-OS integration-tests matrix removed = 7 jobs eliminated total). Material at the current 1,808 / 2,000 monthly minute usage.
- **CI reds cleared**: Categories 1 and 2 from the RCA removed entirely; the `All CI Checks` aggregate gate can become green for the first time since the repository was created (RSS benchmark remains red as documented in Decision 3a, but it is the only remaining red).
- **`ci.yml` reflects reality**: The workflow file now describes only jobs that actually run and produce signal. Future contributors do not have to reverse-engineer why three job blocks reference paths that do not exist.
- **DV-05 status is honest**: Anyone reading the wave-decisions document sees the original rationale plus its falsification, with a pointer to the implementation evidence.

### Negative (residual risk)

- **No CI safety net for hypothetical future tmux format-string adoption**: If a future contributor changes `src/adapters/statusAdapter.ts` to emit `#[fg=...]` tokens (for example, to support tmux popup colors or some advanced tmux-only feature), there is no longer a cross-version CI matrix to catch tmux 2.6 vs 3.2 format-string differences.
- **Mitigation**: This ADR documents the removed safety net. Any reviewer of a future change to `statusAdapter.ts` should specifically check whether the change introduces tmux format strings; if it does, the `tmux-matrix` job (and its supporting `tests/integration/tmux/` test files) must be reinstated as part of that change. The onus is on the reviewer of the format-string-introducing PR, not on chromato's current CI.

### Neutral / explicitly out of scope

- **Real adapter integration tests**: Whether chromato's other adapters (persistence, notification, status) deserve their own integration test suite is a separate question (Decision 3b in the RCA, regarding AC-04.5 / AC-P6 coverage). This ADR does not prejudge that decision; it only removes the ci.yml entries for the test directories that do not exist today.
- **The CodeQL job removal**: Bundled into the same PR for operational efficiency (one push) but is a separate decision documented in RCA Category 4; not relitigated here.
- **No production source-code changes.** The fix is workflow + documentation only.

## Files affected

- `.github/workflows/ci.yml` (jobs `integration-tests`, `tmux-matrix`, `security` removed; `all-checks` `needs:` and shell condition updated)
- `docs/feature/pomodoro-timer-cli/devops/wave-decisions.md` (DV-05 marked falsified with back-link to this ADR)
- `docs/adrs/ADR-007-tmux-version-matrix-falsification.md` (this file)

## References

- DV-05 original decision: `docs/feature/pomodoro-timer-cli/devops/wave-decisions.md` lines 100-111
- Falsifying implementation: `src/adapters/statusAdapter.ts` lines 65-73 (chalk-based ANSI output)
- Full RCA for the removed jobs: `docs/troubleshooting/2026-04-27-rca-remaining-ci-reds.md` Categories 1, 2, and 4
- AC-P3 (`NO_COLOR` uniform suppression): `CLAUDE.md` Key Behavioral Contracts; `docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md`
- AC-03.1 (status command <50ms): `CLAUDE.md` Key Behavioral Contracts
- Precedent for documenting a falsified design assumption: `docs/adrs/ADR-006-startup-budget-alignment.md` (same shape: aspirational design value contradicted by measured implementation reality)
