# ADR-013: Config Write Port, Persisted Schema, and Read Consolidation

**Status**: Proposed
**Date**: 2026-05-31
**Feature**: first-run-setup-wizard
**Deciders**: the solution architect, maintainer (confirmed DD-4/DD-5 via Propose mode 2026-05-31)

---

## Context

Today `configLoader` only **reads**, and only the `palette` key (`readConfigFilePalette()`,
`configLoader.ts:76`). The wizard must **write** six keys and the runtime must **read** all of them
(DISCUSS D-OPEN-1/-3, SPIKE edge case 4). The SPIKE validated an atomic `config.json` round-trip
(tmp+rename) on a temp dir. ADR-011 already established that `configLoader` owns precedence and
that "future config keys follow the same pattern", and that `ConfigResult` is the extension point.

Note the existing asymmetry: config **read** is a plain module function (not a port/adapter), while
the project's other persistence (`state.json`) goes through `StatePort`/`PersistenceAdapter`.

---

## Decision

**DD-4 — Read consolidation**: replace `readConfigFilePalette()` with a single
`readConfigFile(): Partial<PersistedConfig>` that parses `config.json` **once** and returns a typed
partial (`{}` if absent; throws on invalid JSON, unchanged). All keys fold into the precedence
chain in one place. Read stays a **module function** (matches existing style; not promoted to a
port — out of scope).

**DD-5 — Write port**: a new driven port `ConfigWritePort { write(config: PersistedConfig): void }`
in `domain/ports.ts`, implemented by `ConfigFileWriterAdapter` (`src/adapters/configWriterAdapter.ts`):
serialise JSON → write `config.json.tmp` → `renameSync` over `config.json` (atomic; creates the
`chromato/` dir if absent). The wizard depends on the **port**, enabling an in-memory writer in tests.

**Persisted schema (D-OPEN-3)**: `config.json` stores timing in **minutes**; the domain stores
**seconds**. `loadConfig` multiplies timing keys by 60 (matches the `--work <minutes>` flag
convention). Full schema + ranges in `design/data-models.md`.

**Precedence (D-OPEN-4)**: insert `config.json` **between flag and default** for timing; do **not**
reorder the pre-existing env-first quirk (`CHROMATO_*_SECONDS` is load-bearing for acceptance
tests). Palette precedence unchanged. A regression test guards this (AC-03.4).
> Env-var asymmetry to preserve: only `work` and `break` have env overrides
> (`CHROMATO_WORK_SECONDS`/`CHROMATO_BREAK_SECONDS`, `configLoader.ts:138-142`). `longBreak` and
> `cycles` have **no** env var (`:143-146`) — their chain is `flag → config.json → default`. The
> crafter must NOT invent `CHROMATO_LONG_BREAK_SECONDS`/`CHROMATO_CYCLES_SECONDS` lookups.

**Write-failure policy (DECIDED)**: if the atomic write fails (e.g. read-only config dir), the
wizard surfaces a clear error and **still launches the session with the chosen-but-unpersisted
values** (graceful degrade) rather than aborting. Exit code is non-zero only if the session itself
cannot start. This is the binding policy — DISTILL writes the acceptance scenario against it
(no longer an open question).

---

## Alternatives Considered

### A1 — Five per-key readers (`readConfigFileWork`, …) (rejected)
**Rejected**: parses `config.json` up to 5× and grows the exact asymmetry D-OPEN-1 flags. One
`readConfigFile()` parse is simpler and symmetric with the write.

### A2 — Write as a plain `configWriter.ts` function, no port (rejected)
Consistent with the read-as-module style. **Rejected**: the wizard (a driving adapter) needs the
write to be injectable so it can be unit-tested without touching disk; a port gives that seam. The
read has no such consumer pressure, so it stays a function — the asymmetry is intentional.

### A3 — Reuse `PersistenceAdapter` for config (rejected)
**Rejected**: it owns `state.json` (live session state, different lifecycle/format). Overloading it
couples two unrelated files; a dedicated `ConfigFileWriterAdapter` is clearer.

### A4 — Store timing in seconds in `config.json` (rejected)
**Rejected**: minutes match the user-facing `--work` flag and the wizard UI; storing seconds would
make the file confusing to hand-edit and diverge from the flag convention.

---

## Consequences

**Positive**: one place owns config precedence (ADR-011 continuity); atomic write keeps `config.json`
always-valid (K5); the write port makes the wizard testable in memory; schema is now an explicit
contract (data-models.md).

**Negative**: `configLoader` grows; a regression test is required to protect the precedence order; a
new port + adapter + a `PersistedConfig` type are added.

**Neutral**: promoting config **read** to a symmetric port is left as possible future tidy-up.

---

## Compliance

- ADR-004 (domain owns ports; adapter implements), ADR-011 (configLoader precedence ownership;
  ConfigResult extension), AC-05.2 / K5 (atomic valid-JSON write), AC-03.4 / D-OPEN-4 (precedence
  regression). dependency-cruiser: `configWriterAdapter` is a driven adapter (fs/os/path + domain
  types); `ports.ts` gains an interface only.
