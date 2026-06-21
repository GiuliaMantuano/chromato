# ADR-001: Language Choice -- TypeScript

**Status**: Accepted (supersedes Python decision; revised 2026-03-28 per user feedback). Startup-budget references in this document (line 13 "sub-100ms startup", line 63 "within the 100ms target") are partially superseded by [ADR-006](ADR-006-startup-budget-alignment.md) -- the 100ms target was always defined in `acceptance-criteria.md` as the post-MVP compiled-binary target; the Node.js MVP budget is 700ms.
**Date**: 2026-03-28
**Feature**: pomodoro-timer-cli
**Deciders**: the solution architect

---

## Context

chromato is a greenfield CLI/TUI Pomodoro timer targeting terminal-native developers. The tool must:
- Deliver a visually rich animated TUI with sub-100ms startup
- Run on Linux and macOS with minimal installation friction
- Be maintainable by a solo developer with a demo showcase purpose
- Support a test suite that is comprehensible to the demo audience
- Demonstrate clean architecture through a strong static type system

The language choice was revised from Python 3.11+ to TypeScript 6.x (Node.js 20 LTS) per user direction. This ADR documents the full evaluation against quality attributes.

---

## Decision

**TypeScript 6.x on Node.js 20 LTS** is chosen as the implementation language.

TypeScript's discriminated unions and interfaces are a first-class advantage for modelling domain types (`PomodoroPhase`, `SessionState`, `TimerEvent`) in a ports-and-adapters architecture. The type system enforces port contracts at compile time, complementing the runtime boundary enforcement provided by `dependency-cruiser`.

---

## Alternatives Considered

### Alternative 1: Python 3.11+ (original choice)

**Pros**:
- Rich TUI ecosystem (Rich, Textual) with large community
- pytest + pytest-bdd provide excellent BDD test demonstration
- `pip install` / `pipx install` universally understood by Python-oriented audiences
- import-linter for architecture boundary enforcement

**Cons**:
- Dynamic typing requires runtime checks or separate type annotation tooling (mypy) to achieve comparable safety to TypeScript
- Python's structural typing via `Protocol` is less expressive than TypeScript discriminated unions for modelling phase state machines
- Python startup time (~80-150ms cold start) requires careful import discipline for the status subcommand hot path
- TypeScript's type system is a better demonstration of compile-time safety for domain modelling

**Rejection rationale**: TypeScript's type system provides a stronger showcase for clean architecture's domain modelling. Discriminated unions for `PomodoroPhase` and `TimerEvent` make illegal state unrepresentable at compile time -- a quality that directly supports the Testability and Maintainability quality attributes. Python achieves this only partially via runtime checks or third-party tools.

### Alternative 2: Go (CGO_ENABLED=0, Bubble Tea TUI library)

**Pros**:
- Single statically linked binary with zero runtime dependencies (strongest A7 support)
- ~10-40ms startup time
- Bubble Tea (Charm) is excellent, actively maintained, MIT licensed
- Strong type system with interfaces

**Cons**:
- Go's goroutine/channel mental model adds cognitive load for a demo project
- Go interfaces are structural but lack discriminated unions; modelling the phase state machine requires more boilerplate than TypeScript
- Node.js ecosystem (npm, Vitest, tsx) is more familiar to a JavaScript-oriented audience than Go tooling
- `go install` path is less familiar than `npm install -g` for the target demo audience

**Rejection rationale**: TypeScript offers a comparable type system with a broader audience reach (JavaScript developers) and a richer ecosystem of terminal UI libraries. Go's startup advantage is within the acceptable range (Node.js 20 cold start with tsx is ~80-120ms, within the 100ms target with optimisation).

### Alternative 3: Rust (musl static binary, Ratatui TUI library)

**Pros**:
- Best-in-class startup time (<10ms) and memory footprint (<5MB)
- Musl static linking produces a truly zero-dependency binary
- Ratatui (formerly tui-rs) is excellent and MIT licensed
- Strongest safety guarantees (no data races, no segfaults)

**Cons**:
- Rust's learning curve (ownership, lifetimes, borrow checker) makes the demo codebase inaccessible to most of the demo audience
- Compile times add friction to the development loop
- The borrow checker adds structural complexity to the state machine that provides no benefit for a single-threaded timer
- Rust is not the target language of the demo audience

**Rejection rationale**: The primary quality attribute is testability-as-demo, not raw performance. TypeScript's 30-35MB RSS (Node.js 20 baseline) meets the <35MB NFR (revised from original <20MB — see Consequences). Accessibility of the codebase to the demo audience outweighs binary size advantages.

---

## Consequences

**Positive**:
- TypeScript discriminated unions make the `PomodoroPhase` state machine unambiguous: `type PomodoroPhase = 'IDLE' | 'WORK' | 'BREAK' | 'LONG_BREAK' | 'OVERDUE'` -- exhaustiveness checking at compile time
- TypeScript interfaces enforce port contracts at compile time (the `RenderPort`, `StatePort`, `NotificationPort` interfaces are verified by the compiler, not just by runtime injection)
- Vitest provides a modern, fast test runner with first-class ESM and TypeScript support; no transpile step required in tests
- `npm install -g chromato` or `npx chromato` are universally understood install paths
- `dependency-cruiser` provides ESM-aware architectural boundary enforcement (replaces `import-linter`)
- `esbuild` or `pkg` enable single-binary distribution (post-MVP); Node.js SEA (Single Executable Applications, Node.js 20+) is a zero-dependency bundling path

**Negative**:
- Node.js startup time: cold start for a simple Node.js ESM script is ~80-120ms. The status subcommand path must avoid importing Ink or heavy dependencies to stay under 50ms. This mirrors the Python/Rich import discipline -- enforced via `dependency-cruiser` rules.
- Node.js baseline RSS: ~30MB (Node.js 20 + V8 heap minimum). This exceeds the original <20MB NFR-01.4. The NFR must be revised to <35MB RSS for steady-state operation, which is still well within acceptable developer workstation resource use. The status subcommand is a fast-exit process and does not accumulate RSS.
- TypeScript compilation adds a build step. `tsx` (MIT, https://github.com/privatenumber/tsx) eliminates this for development; production uses `esbuild` to produce a bundled `.js` entry point. This is standard Node.js toolchain practice.

**Y-Statement**: In the context of a solo-developer demo CLI tool, facing the need to balance type safety, demo accessibility, and time-to-market, we chose TypeScript 6.x (Node.js 20 LTS) over Python, Go, and Rust to achieve compile-time domain model correctness and a broad audience reach, accepting a slightly higher RSS baseline and a build step in the development workflow.
