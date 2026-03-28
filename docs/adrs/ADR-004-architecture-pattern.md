# ADR-004: Architecture Pattern -- Modular Monolith with Ports-and-Adapters

**Status**: Accepted (revised 2026-03-28; technology references updated for TypeScript; pattern unchanged)
**Date**: 2026-03-28
**Feature**: pomodoro-timer-cli
**Deciders**: Morgan (solution-architect)

---

## Context

chromato is a CLI/TUI tool developed by a single developer, completable in days, with no distributed components. The top quality attributes are testability and maintainability (in that order).

The architecture must:
- Support isolated unit testing of the timer/session business logic without any TUI, filesystem, or OS notification dependencies
- Enable the rendering layer to be swapped (Ink TUI, minimal text, tmux formatter) without touching business logic
- Remain simple enough for a solo developer to maintain indefinitely
- Enforce boundaries automatically (not by convention) to prevent architectural drift

Conway's Law check: one developer, one repo, one deployable unit. No organizational reason for service boundaries.

The implementation language is TypeScript 5.x (Node.js 20 LTS). The ES module system (`import`/`export`) is used throughout. TypeScript interfaces and discriminated unions enforce port contracts at compile time.

---

## Decision

**Modular monolith with ports-and-adapters (hexagonal architecture)**.

The domain core (session state machine, timer logic, business rules) is isolated from all infrastructure (TUI rendering, filesystem, OS notifications) via TypeScript port interfaces. Adapters implement these interfaces with concrete technology. The dependency direction is always inward (adapters depend on domain; domain never depends on adapters).

TypeScript interfaces replace Python ABCs as the mechanism for port definition. The same conceptual pattern applies -- the domain declares `interface RenderPort`, `interface StatePort`, etc.; adapters implement them; the CLI entry point wires implementations to interfaces.

Enforcement: `dependency-cruiser` rules in `.dependency-cruiser.cjs` fail the CI build if dependency rules are violated.

---

## Alternatives Considered

### Alternative 1: Traditional Layered Architecture (n-tier)

**Description**: Presentation layer -> Service layer -> Data layer. Each layer imports only the layer below it.

**Pros**:
- Familiar to most developers
- Simple to implement; no inversion-of-control ceremony

**Cons**:
- In practice, the service layer accumulates I/O calls (rendering, file writes) that make it untestable without mocking the entire layer below
- The "data layer" abstraction in a layered architecture tends to leak implementation details upward (e.g., `better-sqlite3` row types appearing in service layer)
- Testability quality attribute is not well-served: testing the service layer requires either a real database/terminal or extensive mocking

**Rejection rationale**: The #1 quality attribute is testability. Layered architecture does not provide the isolation needed to test `SessionService` with fake adapters. Ports-and-adapters is the same family of patterns (Clean/Hexagonal/Onion are all dependency-inversion + inward-dependency) and provides strictly better testability at no additional complexity cost for this scale.

### Alternative 2: Microservices

**Description**: Separate processes for timer engine, TUI renderer, and status server communicating via IPC (sockets, pipes, or shared memory).

**Pros**:
- Independent deployment and update of components
- Potential for language-per-service optimization

**Cons**:
- Single developer, single deployable unit. Conway's Law: there is no organizational structure that requires service boundaries.
- IPC adds latency, serialization complexity, and failure modes. The status subcommand already solves the inter-process state sharing problem with a JSON file.
- Operational complexity: multiple processes to start, stop, and monitor. This violates the zero-friction requirement (P3).
- No quality attribute in the requirements justifies the operational overhead.

**Rejection rationale**: Resume-driven development pattern. Microservices for a solo CLI tool with no scaling requirement is textbook over-engineering. This would score CRITICAL in the critique dimensions (complexity exceeds team size/requirements). Rejected unconditionally.

### Alternative 3: Pure functional / pipeline architecture

**Description**: Immutable data flowing through pure functions; state held in a single top-level mutable reference; effects applied at the boundary.

**Pros**:
- Maximum testability of pure functions
- No side effects inside the pipeline; all I/O at the outer boundary
- TypeScript supports functional patterns well (readonly types, discriminated unions, `fp-ts` if desired)

**Cons**:
- The preferred paradigm is OOP (class-based design, stakeholder constraint; the ports-and-adapters pattern maps naturally to TypeScript classes and interfaces)
- Functional-core architectures in TypeScript can mix functional and class conventions awkwardly if the team is not fully committed to the functional style
- The ports-and-adapters pattern already achieves the key benefit (pure domain, effects at boundary) within the OOP idiom

**Rejection rationale**: OOP is specified as the development paradigm. The ports-and-adapters pattern achieves the same effect isolation as functional core/imperative shell within the class-based idiom. The functional pipeline alternative would require `fp-ts` or similar, adding learning curve without architectural benefit at this scale.

---

## Consequences

**Positive**:
- Domain core (`src/domain/`) is fully unit-testable with no mocks, no real files, no real terminal: pure TypeScript classes with deterministic behavior. TypeScript interfaces guarantee at compile time that all domain objects satisfy their contracts.
- Adding a new output format (e.g., Waybar widget, post-MVP) requires only a new adapter implementing `RenderPort`; zero domain changes
- The `--minimal` mode is implemented by selecting `MinimalAdapter` instead of `TuiAdapter` at the CLI entry point; zero domain or application layer changes
- Architectural rules are machine-enforceable via `dependency-cruiser`; the architecture does not erode silently
- TypeScript discriminated unions (`type PomodoroPhase = 'IDLE' | 'WORK' | 'BREAK' | 'LONG_BREAK' | 'OVERDUE'`) enable exhaustive `switch` statements in the domain -- the TypeScript compiler will error if a new phase is added without handling it in all switch sites

**Negative**:
- The ports-and-adapters pattern requires explicit wiring at the entry point (`src/index.ts` is the composition root). For a small project, this is a small overhead. The crafter must understand the dependency injection idiom.
- There are more files than a simple script would require. For a demo project, this is intentional -- demonstrating clean architecture is a stated quality attribute.
- TypeScript requires a build step (transpile to JavaScript) for production. `tsx` eliminates this for development. `esbuild` produces the production bundle. This is standard Node.js TypeScript toolchain practice.

**Architectural rule enforcement** (in `.dependency-cruiser.cjs`):

The following rules are expressed as behavioral constraints; the crafter determines the exact dependency-cruiser DSL syntax:

| Rule | Description |
|------|-------------|
| Domain independence | `src/domain/**` must not import from `src/adapters/**`, `src/application/**`, `ink`, `react`, `better-sqlite3`, or `commander` |
| Application layer independence | `src/application/**` must not import from `src/adapters/**`, `ink`, or `react` |
| Status adapter Ink-free | `src/adapters/statusAdapter.ts` and `src/adapters/minimalAdapter.ts` must not import `ink` or `react` |
| No cross-adapter imports | Adapter modules must not import each other |

These rules run as the `check:arch` script in CI and fail the build if violated.
