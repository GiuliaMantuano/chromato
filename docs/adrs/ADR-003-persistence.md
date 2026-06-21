# ADR-003: Persistence -- better-sqlite3 + JSON (state file)

**Status**: Accepted (revised 2026-03-28; updated for TypeScript/Node.js ecosystem)
**Date**: 2026-03-28
**Feature**: pomodoro-timer-cli
**Deciders**: the solution architect

---

## Context

chromato requires two distinct persistence behaviors:

**Behavior 1 -- Real-time state file**: The running session's current state (phase, remaining time, progress fraction, session count) must be readable by external processes (tmux format strings, shell prompt commands) at any time. Requirements:
- Always valid (never partial writes) -- AC-P4, AC-04.5
- Updated every 5 seconds and immediately on phase transitions -- AC-04.4
- Human-readable (composability requirement -- P5's explicit ask) -- NFR-04.3
- Fast to write (<5ms) and read (<5ms) -- AC-03.1 requires the status subcommand to complete in <50ms

**Behavior 2 -- Session history**: Completed session records for streak calculation and today's session count. Requirements:
- Append-only (sessions are never edited or deleted)
- Queryable by local date (for streak calculation -- BR-03)
- Persistent across process restarts -- BR-05
- Lightweight (no server process required) -- NFR-04.1

The language is TypeScript 6.x on Node.js 20 LTS. The evaluation focuses on Node.js persistence options.

---

## Decision

**State file**: Plain JSON written atomically via `fs.renameSync()` (Node.js `fs` built-in)
**Session history**: `better-sqlite3` (synchronous SQLite binding for Node.js)
**Configuration file**: Plain JSON (`config.json`) or TOML via `@iarna/toml` (optional; JSON preferred for zero-dep config parsing)

**Why synchronous (better-sqlite3 over async sqlite3 / sql.js)**:
The tick loop runs synchronously in the main thread (no `async/await` needed for a 1-second countdown). Synchronous SQLite writes eliminate Promise overhead and keep the tick loop straightforward. `better-sqlite3` is consistently recommended as the correct choice for synchronous Node.js SQLite use.

---

## Alternatives Considered

### Alternative 1: sqlite3 (async, callback-based, the older binding)

**Pros**:
- Long-established npm package; widely used
- Asynchronous API avoids blocking the event loop

**Cons**:
- Callback-based API requires Promise wrapping for modern async/await usage; adds boilerplate
- Asynchronous writes add complexity to the tick loop: `session.tick()` -> `await persist.writeState()` requires the loop to be async, which introduces async tick drift management
- `better-sqlite3` is faster than `sqlite3` for small synchronous writes (the session history insert is a single-row INSERT; synchronous is faster than async callback for this pattern)
- `sqlite3` relies on `node-gyp` native compilation; `better-sqlite3` also requires native compilation but has better prebuilt binary support

**Rejection rationale**: `better-sqlite3` is the current best practice for synchronous SQLite in Node.js. The tick loop's synchronous design makes the sync API the correct choice. The async overhead of `sqlite3` provides no benefit for single-row appends.

### Alternative 2: sql.js (SQLite compiled to WebAssembly)

**Pros**:
- Pure JavaScript / WebAssembly; no native compilation step
- Works in environments without native build tools

**Cons**:
- WebAssembly SQLite has significantly higher memory overhead (~6MB WASM heap vs <1MB for native binding)
- sql.js databases are in-memory by default; persistence requires explicit serialisation to a `Buffer` and manual file writes, reintroducing the atomic write complexity
- Slower than native SQLite for read/write operations
- The target environment (developer workstation Linux/macOS) always has native build tools; pure-JS advantage is irrelevant

**Rejection rationale**: Higher memory and complexity overhead with no benefit for the target environment. `better-sqlite3` with prebuilt binaries is the simpler path.

### Alternative 3: lowdb (JSON-based document store)

**Pros**:
- JSON-native; human-readable database files
- TypeScript-first API with generics
- Zero native compilation; pure JavaScript

**Cons**:
- Adds a runtime dependency for functionality that `fs.writeFileSync` + `JSON.stringify` already provides for the state file
- No indexed queries; streak calculation requires iterating all records in memory
- lowdb is designed for simple key-value stores, not for the date-range queries needed by BR-03 streak calculation
- For session history, a flat JSON array grows unboundedly (no WAL, no indexing, no AUTOINCREMENT primary key)

**Rejection rationale**: Inappropriate for structured append-only session history with date-range queries. The state file is already plain JSON (no library needed). lowdb adds a dependency without providing SQLite's query power. better-sqlite3 handles both the structured history requirement and provides WAL mode for concurrent read safety.

### Alternative 4: State file as SQLite (single DB for everything)

**Pros**:
- Single persistence mechanism; one adapter for all persistence concerns

**Cons**:
- SQLite reads are NOT safe from an external process perspective when the writer holds a write lock. A tmux format string calling `chromato status` queries an SQLite DB that may be locked by the running chromato process. Even with WAL mode, contention is possible under rapid polling.
- JSON is human-readable (P5's explicit composability requirement: "a file I could read in my prompt"). SQLite binary format is not.
- `jq` integration for P5's shell scripting use case requires JSON, not SQLite.

**Rejection rationale**: The state file must be JSON for composability (NFR-04.3). Separating concerns (JSON for real-time state, SQLite for history) is the correct design.

---

## Consequences

**Positive**:
- `better-sqlite3` is MIT licensed (https://github.com/WiseLibs/better-sqlite3, 6k+ GitHub stars, actively maintained)
- Synchronous API keeps the tick loop readable: `persistenceAdapter.writeState(snapshot)` with no Promise chain
- `fs.renameSync()` on the same filesystem directory provides POSIX atomic rename semantics -- satisfies AC-P4
- JSON state file is parseable with `jq` and Node.js built-in `JSON.parse` -- satisfies P5 composability
- `better-sqlite3` supports WAL mode (`db.pragma('journal_mode = WAL')`) for concurrent read safety
- The persistence adapter is testable with a temporary directory (`os.tmpdir()`) and no mocking

**Negative**:
- `better-sqlite3` requires native compilation (`node-gyp`). On most developer workstations this is transparent (Python 3 + a C++ compiler). The `npm install` will attempt to download prebuilt binaries first (via `node-pre-gyp`); native compilation is a fallback. This is a known friction point for Node.js native modules. **CI mitigation**: the GitHub Actions CI pipeline pins `ubuntu-22.04` as the runner for all jobs that build or test the native module. The release job uses the same runner to produce the distributed npm tarball, ensuring the prebuilt binary (if included) matches the glibc version of the most common Linux target. On macOS runners (`macos-12`, `macos-14`) Xcode Command Line Tools provide `clang`; no additional setup is required. The `pnpm install --frozen-lockfile` step in CI triggers native compilation automatically. If prebuilt binaries are not available for a given Node.js/OS/arch combination, the CI log will show a `node-gyp` compilation step — this is expected and not an error.
- The streak calculation logic requires correct handling of timezone-aware local dates. The crafter must store `local_date` (YYYY-MM-DD in the user's local timezone), not UTC timestamps, for streak calculation to be correct across midnight. This is a subtle correctness concern covered by domain tests.
- `fs.renameSync()` requires the temp file and the destination to be on the same filesystem. Since both are in `~/.local/share/chromato/`, this is guaranteed in practice.
- Configuration file format: TypeScript's native JSON support (`JSON.parse` / `fs.readFileSync`) makes JSON config the zero-dependency choice. TOML (`config.toml`) would require `@iarna/toml` (MIT, 500+ stars). The decision to use JSON or TOML for `config.json` / `config.toml` is deferred to the crafter with the constraint: no config parsing library may be added unless it is MIT or Apache 2.0 licensed.
