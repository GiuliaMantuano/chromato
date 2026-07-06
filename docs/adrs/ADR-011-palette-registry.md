# ADR-011: Palette Registry Placement and Adapter Injection Pattern

**Status**: Accepted — implemented as described (see `src/domain/palette.ts`, `configLoader.ts`'s
`resolvedPalette`/`paletteName`). Status corrected 2026-07-06; this ADR sat marked "Proposed" after
the feature had already shipped. Superseding design-wave working docs (`docs/architecture/
palette-themes/`) removed the same day — this ADR is the durable record.
**Date**: 2026-05-31
**Feature**: palette-themes
**Deciders**: the solution architect, maintainer (confirmed)

---

## Context

palette-themes eliminates hardcoded color constants from `bannerAdapter.ts` (`LOGO_COLORS`) and `tuiAdapter.tsx` (`PHASE_COLORS`) by introducing a palette registry. Two design questions arise simultaneously and are addressed in a single ADR because they are coupled:

1. Where does the palette registry live in the module hierarchy?
2. How do adapters receive the resolved palette without violating the hexagonal architecture (ADR-004)?

The project enforces a strict dependency rule (`.dependency-cruiser.cjs`): `src/domain/**` must not import from adapters, application, or external packages. Adapters may import domain types. `src/index.ts` is the composition root and the only file that imports all layers.

The existing pattern for adapter configuration is constructor injection at the composition root — confirmed by the `TuiAdapter` class (which already has a constructor) and the recently added `NotificationAdapter` constructor injection.

---

## Decision

**Registry placement**: `src/domain/palette.ts` — a single new module containing:
- `PaletteName` string literal union
- `PhaseColorEntry` and `Palette` TypeScript interfaces
- `PALETTES` registry (`Record<PaletteName, Palette>`)
- `getPalette()`, `resolvePaletteName()`, `VALID_PALETTE_NAMES`, `DEFAULT_PALETTE_NAME`

**Adapter injection**: constructor injection at the composition root (`src/index.ts`).
- `TuiAdapter` receives `palette: Palette` in its constructor; passes it as a prop to `TimerFrame`
- `printBanner` receives `palette: Palette` as its first parameter (function parameter injection; no class wrapper added)

**Resolution location**: `configLoader.ts` is extended (not replaced by a new loader) to resolve the full precedence chain: `--palette` flag → `CHROMATO_PALETTE` env → `config.json "palette"` key → `'ocean'` default. NO_COLOR is evaluated before palette resolution; if `noColor === true`, palette resolution is skipped.

---

## Alternatives Considered

### Alternative 1: Registry in a new `src/config/paletteRegistry.ts` (rejected)

A separate configuration layer module between domain and adapters.

**Rejected because**: introduces a fourth layer not present in the existing architecture; adapters would need to import from a new path, requiring new dependency-cruiser rules; the "palette data" is pure static domain data with zero I/O, making `src/domain/` the correct home.

### Alternative 2: Split registry into `palette.ts` (types) + `paletteData.ts` (hex data) (rejected)

Two domain files to separate interface schema from data.

**Rejected because**: over-engineering for a 4-palette static set; the existing pattern (`src/domain/config.ts` co-locates the `SessionConfig` interface, `DEFAULT_CONFIG`, and `validateConfig`) demonstrates that co-location is the project convention; the split provides no benefit until the palette data source changes (deferred: custom hex D4).

### Alternative 3: Per-frame `render()` argument (palette in `SessionSnapshot`) (rejected)

Embed `Palette` in `SessionSnapshot` so it is available at every render call.

**Rejected because**: `SessionSnapshot` is a domain type; embedding a rendering concern in it violates the separation between domain and presentation; the palette does not change during a session, making per-frame passing wasteful; changes to the snapshot interface propagate to all snapshot consumers (persistence adapter, status adapter), which do not use palette data.

### Alternative 4: Module-level mutable variable (setPalette pattern) (rejected)

Set a module-level variable once after resolution; adapters read it on first render.

**Rejected because**: introduces global mutable state; breaks test isolation (tests cannot inject different palettes without module-level mutation); contradicts the dependency injection discipline already established in ADR-004.

### Alternative 5: Separate `paletteLoader.ts` alongside `configLoader.ts` (rejected)

A dedicated `src/paletteLoader.ts` handles only palette precedence resolution.

**Rejected because**: `configLoader.ts` already owns the precedence resolution responsibility; a second file would need to independently implement the `config.json` read and XDG path resolution, risking divergence; the existing `ConfigResult` interface can be extended with one field (`resolvedPalette: Palette`); the config.json read is a new capability that benefits all future config keys — centralising it in `configLoader` is the correct single-responsibility boundary.

---

## Consequences

### Positive

- Domain layer purity preserved: `palette.ts` has zero external imports; `dependency-cruiser` rule covers it automatically
- No new runtime dependencies introduced
- Type-safe registry: `Record<PaletteName, Palette>` produces a compile error if any of the 4 palettes is missing an entry
- Constructor injection is consistent with the existing adapter pattern; no new wiring convention
- `configLoader.ts` owns all precedence resolution in one place; future config keys follow the same pattern
- `resolvePaletteName` provides a safe parse boundary between raw user input and typed domain values

### Negative

- `configLoader.ts` grows to include config.json reading logic; mitigated by extracting it to a named private function `readConfigFilePalette()`
- `TuiAdapter` constructor signature changes from zero-argument to one-argument; all construction sites (one: `src/index.ts`) must be updated
- `printBanner` signature changes (new first parameter); all call sites (one: `src/index.ts`, plus any tests that call it directly) must be updated

### Neutral

- Adding a fifth palette in a future increment requires updating the `PaletteName` union and `PALETTES` registry — a compile-time change, not a runtime one; TypeScript will flag missing cases
- Custom-hex support (deferred D4) would add a new resolution path in `configLoader.ts` before the name lookup; the `Palette` interface is unchanged

---

## Compliance

- ADR-004 (ports-and-adapters): domain stays pure; adapters receive resolved values from composition root
- ADR-001 (TypeScript): string literal union and `Record` generics are idiomatic TypeScript
- `.dependency-cruiser.cjs`: no new rules needed; existing `src/domain/**` glob covers `palette.ts`
