# ADR-002: TUI Library -- Ink 4.x (with chalk-only status path)

**Status**: Accepted (revised 2026-03-28; updated for TypeScript ecosystem)
**Date**: 2026-03-28
**Feature**: pomodoro-timer-cli
**Deciders**: Morgan (solution-architect)

---

## Context

chromato requires a TUI rendering layer that:
1. Renders an animated, full-screen progress bar with color phase transitions (FR-01, FR-02)
2. Degrades gracefully to ASCII and no-color modes (FR-05.4, FR-05.5)
3. Provides a compact single-line display for narrow panes (US-01, example 2)
4. Is fast enough for the `chromato status --format tmux` path (<50ms, called every tmux refresh cycle -- AC-03.1)

The key constraint is that the same binary handles two very different render modes:
- **Full TUI mode** (`chromato start`): full-screen live rendering, ~1fps refresh, animated progress bar with color gradient transitions
- **Status mode** (`chromato status`): single-shot string format, called externally every 1-15 seconds; must not import heavy rendering dependencies

The language is TypeScript 5.x on Node.js 20 LTS, so the evaluation focuses on the Node.js TUI ecosystem.

---

## Decision

**Ink 4.x** is chosen for the full TUI mode (`chromato start`). The status and minimal paths use **chalk 5.x** for ANSI color and plain string formatting only. Ink is never imported on the status subcommand code path.

**Rationale summary**:
- Ink's React-based component model maps cleanly to the ports-and-adapters `RenderPort` contract: the `TuiAdapter` renders via Ink components; the `MinimalAdapter` uses chalk + process.stdout only
- Ink provides `useStdout`, `Static`, and `Box` primitives sufficient for the progress bar, phase label, and countdown display without building a custom render loop
- React's reconciler handles terminal state restoration on exit (Ink calls `process.stdout.write('\x1b[?1049l')` cleanup), satisfying AC-P6
- chalk 5.x (ESM-native, MIT) is the standard for ANSI color in Node.js CLI tools; it is a safe import on the status path because it adds <5ms to cold start (chalk does no terminal detection at import time)

---

## Alternatives Considered

### Alternative 1: blessed / neo-blessed

**Pros**:
- Low-level terminal control (cursor positioning, boxes, colors) with full ANSI support
- Mature API (blessed has been available since 2013)
- No React dependency; lighter import footprint than Ink

**Cons**:
- `neo-blessed` (the maintained fork) has irregular release cadence; last meaningful release was 2021. Community activity is low relative to Ink.
- blessed's imperative rendering model (mutating screen elements directly) produces adapter code that is harder to test than Ink's declarative component approach
- blessed's progress bar widget has limited customisation for gradient color transitions (FR-02 requirement); implementing color-phase transitions requires manual ANSI escape injection
- No TypeScript-first API; `@types/blessed` types are community-maintained and incomplete

**Rejection rationale**: Maintenance concerns and weaker testability. Ink's declarative rendering can be tested by rendering to a test renderer and asserting on the output string. blessed requires terminal emulation or complex mocking. Ink is the current community standard for React-based Node.js TUI (8k+ GitHub stars, active weekly commits, TypeScript-first).

### Alternative 2: terminal-kit

**Pros**:
- Full-featured terminal toolkit: input handling, progress bars, tables, spinners
- Good documentation and active maintenance

**Cons**:
- terminal-kit is a large dependency (~2MB) covering many features chromato does not need (form widgets, table rendering, input handling beyond Ctrl+C)
- Progress bar and color APIs are imperative; less composable with the ports-and-adapters pattern
- TypeScript types are incomplete; community-maintained `@types/terminal-kit`
- Import footprint is heavier than Ink + chalk combined for the features chromato actually uses

**Rejection rationale**: Over-featured for the requirements. chromato needs a progress bar, phase label, countdown display, and color gradients. Ink + chalk covers exactly these requirements with a better-maintained, TypeScript-native API.

### Alternative 3: chalk + readline (no TUI framework)

**Pros**:
- Minimal dependencies: chalk for ANSI colors, Node.js `readline` stdlib for cursor control
- Maximum control over every character written to the terminal
- Smallest possible import footprint -- ideal for the status subcommand path
- No framework overhead; a simple `setInterval` render loop with `process.stdout.write` is sufficient

**Cons**:
- Building a full-screen progress bar with live updates (FR-01) requires reimplementing what Ink provides: cursor save/restore, line clearing, terminal resize handling
- The raw readline approach does not handle terminal state cleanup on process exit (SIGINT, SIGTERM) without custom signal handlers and manual ANSI escape restoration
- No component model; the progress bar, phase label, and compact mode are implemented as ad-hoc strings -- harder to test and maintain than Ink's tree of typed components
- Animation quality (smooth gradient color transitions, FR-02) requires manual interpolation of ANSI 256-color codes across ticks

**Rejection rationale**: Chalk + readline is the correct choice for the status subcommand path (where Ink must not be imported). It is insufficient for the full TUI mode because it requires reimplementing terminal state management that Ink provides correctly. The architecture uses both: Ink for the `TuiAdapter`, chalk for `StatusAdapter` and `MinimalAdapter`.

### Alternative 4: Clack (@clack/prompts)

**Pros**:
- Beautiful, modern terminal UI primitives with good TypeScript support

**Cons**:
- Designed for interactive prompts (user input flows), not for a live countdown display loop
- No `Live`/`Progress` primitive analogous to Rich's `Live` context manager or Ink's stateful components
- Not applicable to the chromato render requirements

**Rejection rationale**: Wrong tool for the use case. chromato needs a live countdown renderer, not a prompt library.

---

## Consequences

**Positive**:
- Ink's `render()` function returns a cleanup handle; `TuiAdapter` can wrap the lifecycle cleanly in an adapter class that implements `RenderPort`
- Ink components are testable via `ink-testing-library` (MIT, renders to string output) -- equivalent to Rich's `Console(file=io.StringIO())` test approach
- chalk 5.x (ESM-native) provides `chalk.hex('#...')`, `chalk.ansi256(n)`, and `chalk.rgb(r,g,b)` for the phase color scheme; no magic ANSI strings in the adapter
- `chalk.level` detection (0=no color, 1=basic, 2=256, 3=true color) handles `NO_COLOR`, `TERM=dumb`, and CI environments correctly -- satisfies AC-P3
- The status subcommand path imports only chalk and Node.js built-ins (`fs`, `path`): cold start remains <50ms

**Negative**:
- Ink's React reconciler adds ~15-20ms to the first render initialisation (React virtual DOM setup). This is on the `chromato start` path only, where the 100ms startup budget accommodates it.
- Ink requires React as a peer dependency (~120KB gzipped, added to install size). For a CLI tool this is acceptable; it does not affect the status subcommand path.
- Ink's `useStdout` hook and React component model require the `TuiAdapter` to be implemented with React functional components. The crafter must understand basic React hooks (useState, useEffect, useRef) for the adapter implementation. This is a known constraint for the TypeScript ecosystem choice.

**Import boundary enforcement rule** (dependency-cruiser):
- `src/adapters/statusAdapter.ts` must not import `ink` or `react`
- `src/adapters/minimalAdapter.ts` must not import `ink` or `react`
- This ensures the status subcommand cold-start path stays under 50ms (AC-03.1)
