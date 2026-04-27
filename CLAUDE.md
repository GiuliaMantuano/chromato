# chromato -- Project Context for Claude

**Feature ID**: pomodoro-timer-cli
**UVP**: "The Pomodoro timer your terminal deserves"
**Wave status**: DESIGN complete (TypeScript revision applied 2026-03-28); handoff to acceptance-designer (DISTILL) and software-crafter (BUILD) cleared

---

## Project Overview

chromato is an open-source CLI/TUI Pomodoro timer for terminal-native developers. It provides an animated, color-gradient progress bar, unmissable phase transitions, and first-class tmux/shell prompt integration.

**Target users**: Terminal-native developers (Vim/Neovim, tmux, dotfiles culture) on Linux and macOS.

**License**: MIT

---

## Development Paradigm

**Paradigm**: Object-Oriented Programming (OOP)

**Language**: TypeScript 5.x on Node.js 20 LTS with class-based design throughout. The architecture uses a **ports-and-adapters (hexagonal) pattern** with strict dependency inversion:

- `src/domain/` -- Pure TypeScript classes and interfaces. Zero external imports. Contains all business rules. Domain types are expressed as TypeScript interfaces and discriminated unions.
- `src/application/` -- Orchestration classes. Imports domain only. No adapters.
- `src/adapters/` -- Concrete adapter classes. Implement domain port interfaces.
- `src/index.ts` -- Composition root. Wires adapters to ports. Only file that imports everything.

**Key OOP conventions**:
- Domain objects: classes for aggregate root (`Session`) and state machine; TypeScript `interface` with `readonly` properties for value objects
- Port interfaces: TypeScript `interface` declarations (compiler-verified, no runtime overhead)
- Discriminated unions: `type PomodoroPhase = 'IDLE' | 'WORK' | 'BREAK' | 'LONG_BREAK' | 'OVERDUE'` and `type TimerEvent = PhaseChangedEvent | SessionCompletedEvent | OverdueActivatedEvent`
- No global state; all state flows through `Session` aggregate root
- Dependency injection at the composition root (no service locators, no singletons)
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)

**Agent**: Use `@nw-software-crafter` for all implementation tasks.

---

## Architecture Reference

| Document | Location |
|----------|----------|
| Architecture design (C4 diagrams) | `docs/feature/pomodoro-timer-cli/design/architecture-design.md` |
| Component boundaries | `docs/feature/pomodoro-timer-cli/design/component-boundaries.md` |
| Data models | `docs/feature/pomodoro-timer-cli/design/data-models.md` |
| Technology stack | `docs/feature/pomodoro-timer-cli/design/technology-stack.md` |
| DESIGN wave decisions | `docs/feature/pomodoro-timer-cli/design/wave-decisions.md` |
| ADR-001: Language (TypeScript) | `docs/adrs/ADR-001-language-choice.md` |
| ADR-002: TUI library (Ink 4.x) | `docs/adrs/ADR-002-tui-library.md` |
| ADR-003: Persistence (better-sqlite3 + json) | `docs/adrs/ADR-003-persistence.md` |
| ADR-004: Architecture pattern | `docs/adrs/ADR-004-architecture-pattern.md` |

---

## Technology Stack (Runtime)

| Package | Version | Role |
|---------|---------|------|
| Node.js | 20 LTS | Runtime |
| TypeScript | ^5.0 | Language |
| ink | ^4.0 | Full TUI rendering (start command path only) |
| react | ^18.0 | Ink peer dependency |
| chalk | ^5.0 | ANSI color (status + minimal paths) |
| commander | ^12.0 | CLI framework |
| better-sqlite3 | ^12.8.0 | Session history SQLite (synchronous) |
| node-notifier | ^10.0 | OS desktop notifications |

**Dev dependencies**: vitest, @vitest/coverage-v8, ink-testing-library, tsx, esbuild, dependency-cruiser, TypeScript type packages

**Package manager**: pnpm

---

## Package Structure

```
src/
  index.ts                    # CLI entry point + composition root
  domain/
    session.ts                # Session aggregate root
    phase.ts                  # PhaseStateMachine, PomodoroPhase discriminated union
    timer.ts                  # TimerSnapshot value object
    config.ts                 # SessionConfig interface + validation
    events.ts                 # TimerEvent discriminated union
    ports.ts                  # Port interfaces (RenderPort, StatePort, NotificationPort, HistoryPort)
    types.ts                  # Shared domain types (SessionSnapshot, etc.)
  application/
    sessionService.ts         # start/tick/stop use case
    statusService.ts          # status subcommand use case
  adapters/
    tuiAdapter.ts             # Ink React component TUI renderer
    minimalAdapter.ts         # Plain-text stdout renderer (--minimal)
    statusAdapter.ts          # tmux + prompt format strings
    notificationAdapter.ts    # node-notifier + bell fallback
    persistenceAdapter.ts     # state.json atomic writer + better-sqlite3
  configLoader.ts             # Resolves flags > env > config file > defaults
tests/
  unit/                       # Domain + application layer (no I/O)
  integration/                # Adapter tests (temp dirs, Ink test renderer)
  acceptance/                 # BDD tests (Vitest feature specs)
package.json                  # npm manifest, bin entry, pnpm engine
tsconfig.json                 # TypeScript strict config (ESM, node20)
.dependency-cruiser.cjs       # Architectural boundary enforcement rules
```

---

## Critical Architecture Rules

These rules are enforced by `dependency-cruiser` (`check:arch` in CI):

1. `src/domain/**` must NOT import from `src/adapters/**`, `src/application/**`, `ink`, `react`, `commander`, or `better-sqlite3`
2. `src/application/**` must NOT import from `src/adapters/**`, `ink`, or `react`
3. `src/adapters/statusAdapter.ts` and `src/adapters/minimalAdapter.ts` must NOT import `ink` or `react`
4. Adapter modules must NOT import each other

Rule 3 is critical for performance: the `chromato status --format tmux` path must complete in <50ms (AC-03.1). Ink/React import adds 15-20ms on cold start.

---

## Key Behavioral Contracts (Observable)

These are behavioral invariants the crafter must preserve. They are tested in the acceptance test suite.

- `chromato start` renders first frame within 700ms of invocation (AC-NF1; aligned with documented AC value 2026-04-27 -- post-MVP compiled-binary target remains <100ms; see ADR-006)
- `chromato status --format tmux` completes in under 50ms (AC-03.1)
- `state.json` is valid JSON at all times, including during concurrent writes (AC-P4)
- Phase transitions are atomic: no intermediate render state visible (AC-02.1)
- CPU usage stays below 1% during steady-state session (AC-NF2)
- Memory stays below 35MB RSS during steady-state session (revised from 20MB; Node.js 20 baseline)
- `NO_COLOR` environment variable suppresses all ANSI sequences in all output modes (AC-P3)
- `chromato stop` and Ctrl+C produce exit code 0 with no zombie processes (AC-P6)
- Phase labels (WORK, BREAK, OVERDUE) are always visible as text alongside color coding (NFR-05.1 accessibility)

---

## Requirements and Acceptance Criteria

| Document | Location |
|----------|----------|
| Requirements | `docs/feature/pomodoro-timer-cli/discuss/requirements.md` |
| Acceptance criteria | `docs/feature/pomodoro-timer-cli/discuss/acceptance-criteria.md` |
| User stories | `docs/feature/pomodoro-timer-cli/discuss/user-stories.md` |
| Story map | `docs/feature/pomodoro-timer-cli/discuss/story-map.md` |

---

## Mutation Testing Strategy

This project uses **per-feature** mutation testing. Runs after refactoring during each delivery, scoped to modified files. Kill rate gate: >= 80%.

---

## Excluded from MVP

The following are explicitly post-MVP (per DISCOVER wave D4 decision):
- Named color themes (nord, dracula, gruvbox, catppuccin) -- O4
- Pre/post-session hooks and socket/file API -- O6
- Session history reporting (`pomo report`) -- O5
- Shell completion scripts
- Neovim plugin
- Windows / WSL2 support
- Node.js SEA single-file binary (MVP uses npm install -g / npx)
- Homebrew formula (post-MVP)
