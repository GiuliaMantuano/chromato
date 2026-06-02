/**
 * Shared presentational TUI helpers (ADR-015).
 *
 * Palette-agnostic Ink presentation primitives, extracted from setupWizardAdapter.tsx
 * so both the wizard and the home adapter import them — neither imports the other
 * (preserves dependency-cruiser Rule 4 adapters-no-cross-import). Rule-4 carve-out:
 * src/adapters/tui/** is an allowed import target; tui/** itself imports no sibling
 * (non-tui) adapter (rule tui-no-sibling-adapters).
 *
 * tui/** may import ink/react/chalk and src/domain/** (brand, palette) — it is on the
 * Ink side of the dynamic-import boundary (ADR-012), so it never reaches the cold
 * --help path.
 *
 * F1 (D-RH-4): PALETTE_META carries the display LABEL/description only (presentation).
 * Logo + swatch GRADIENT colours come from getPalette(name).gradient (domain).
 */

import React from 'react';
import { Text, Box } from 'ink';
import chalk from 'chalk';
import { getPalette, type PaletteName } from '../../domain/palette.js';
import { LOGO } from '../../domain/brand.js';

// Footer key-hint "buttons": a filled key-cap plus a readable (not dimmed) label,
// so the call-to-action reads as actionable rather than disabled (prototype kbd style).
const KEYCAP_BG = '#28384a';
const KEYCAP_FG = '#dfe7ef';
const HINT_LABEL_FG = '#aeb9c6';

export interface PaletteMeta {
  /** Capitalised display name, e.g. 'Ocean'. */
  readonly label: string;
  /** One-line option description, e.g. 'cool blue · the default'. */
  readonly description: string;
}

/**
 * Per-palette display copy for the theme option cards. Presentation concern
 * (UI labels/descriptions) — F1 (D-RH-4): label/description ONLY, no colour data.
 * Copy mirrors the approved prototype.
 */
export const PALETTE_META: Record<PaletteName, PaletteMeta> = {
  ocean: { label: 'Ocean', description: 'cool blue · the default' },
  lavender: { label: 'Lavender', description: 'soft violet · catppuccin mood' },
  berry: { label: 'Berry', description: 'warm rose · wine + gold' },
  forest: { label: 'Forest', description: 'sage green · earthy terminal' },
};

/** Renders a string in the given hex truecolor, honouring the process chalk level. */
export function colorize(hex: string, content: string): string {
  return chalk.hex(hex)(content);
}

/** A footer key hint as a filled key-cap "button" followed by a readable label. */
export function keyHint(keyName: string, label: string): string {
  return chalk.bgHex(KEYCAP_BG).hex(KEYCAP_FG).bold(` ${keyName} `) + chalk.hex(HINT_LABEL_FG)(` ${label}`);
}

/** A 6-stop colour swatch (one block per gradient stop) for a theme option card. */
export function swatch(paletteName: PaletteName): string {
  return getPalette(paletteName)
    .gradient.map((hex) => colorize(hex, '█'))
    .join('');
}

// ---------------------------------------------------------------------------
// Logo — the full 6-line ASCII logo rendered in a palette's gradient (one
// gradient stop per line). Same shape as the start-up banner, but sourced from
// the domain brand module so adapters need not import another adapter.
// ---------------------------------------------------------------------------

export const LogoBlock: React.FC<{ paletteName: PaletteName }> = ({ paletteName }) => {
  const { gradient } = getPalette(paletteName);
  return (
    <Box flexDirection="column">
      {LOGO.map((line, i) => (
        // LOGO and every palette gradient are both exactly 6 entries (palette.ts),
        // so the indices align one-stop-per-line.
        <Text key={i}>{colorize(gradient[i], line)}</Text>
      ))}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Footer keybar — a contextual row of key hints rendered via keyHint(), matching
// the prototype footer() (L162). Reusable: every screen passes its own ordered
// hint list.
// ---------------------------------------------------------------------------

export interface KeyHint {
  /** Key cap text, e.g. 'Enter' or '↑↓'. */
  readonly key: string;
  /** Readable action label, e.g. 'get started'. */
  readonly label: string;
}

export const Footer: React.FC<{ hints: readonly KeyHint[] }> = ({ hints }) => (
  <Box marginTop={1}>
    <Text>{`  ${hints.map((hint) => keyHint(hint.key, hint.label)).join('   ')}`}</Text>
  </Box>
);
