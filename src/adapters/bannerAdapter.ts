/**
 * BannerAdapter: prints the chromato ASCII art banner to stdout.
 *
 * Printed to stdout once at `chromato start` in the minimal/plain-text path.
 * In TUI mode the banner is NOT printed (alternate-screen buffer incompatibility —
 * the banner would be erased when the alternate screen activates).
 *
 * CRITICAL: Must NOT import ink or react.
 * Must NOT emit ANSI sequences in noColor mode.
 */

import chalk from 'chalk';
import type { Palette } from '../domain/palette.js';
import { LOGO, TAGLINE, DESCRIPTOR, DESCRIPTOR_ASCII } from '../domain/brand.js';

// Re-exported for existing importers (index-help.test, bannerAdapter.tagline.test).
// The canonical definition now lives in src/domain/brand.ts.
export { TAGLINE };

const HINT = 'Ctrl+C to quit';
const RULE_WIDTH = 35;
const RULE_UNICODE = '▔'.repeat(RULE_WIDTH);
const RULE_ASCII = '-'.repeat(RULE_WIDTH);

/**
 * Interpolated hex colour at position `t` (0..1) across the palette gradient
 * stops. Used to draw the accent underline as a smooth left-to-right gradient
 * without pulling in an external gradient library.
 */
function hexAt(stops: readonly string[], t: number): string {
  const seg = (stops.length - 1) * Math.min(Math.max(t, 0), 1);
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const f = seg - i;
  const c1 = parseInt(stops[i].slice(1), 16);
  const c2 = parseInt(stops[i + 1].slice(1), 16);
  const lerp = (a: number, b: number): number => Math.round(a + (b - a) * f);
  const r = lerp((c1 >> 16) & 0xff, (c2 >> 16) & 0xff);
  const g = lerp((c1 >> 8) & 0xff, (c2 >> 8) & 0xff);
  const b = lerp(c1 & 0xff, c2 & 0xff);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function printBanner(palette: Palette, noColor: boolean, useAscii: boolean = false): void {
  if (process.env['NODE_ENV'] === 'test') return;

  const useColor = !noColor && !process.env['NO_COLOR'];
  const rule = useAscii ? RULE_ASCII : RULE_UNICODE;
  const descriptor = useAscii ? DESCRIPTOR_ASCII : DESCRIPTOR;
  const out = process.stdout;

  out.write('\n');

  if (useColor) {
    for (let i = 0; i < LOGO.length; i++) {
      out.write(`${chalk.hex(palette.gradient[i])(LOGO[i])}\n`);
    }
    // Accent underline: a smooth gradient drawn one character at a time.
    const ruleChars = Array.from(rule);
    const coloredRule = ruleChars
      .map((ch, idx) =>
        chalk.hex(
          hexAt(palette.gradient, ruleChars.length <= 1 ? 0 : idx / (ruleChars.length - 1)),
        )(ch),
      )
      .join('');
    out.write(`  ${coloredRule}\n`);
    out.write(`${chalk.hex(palette.gradient[2]).bold(`  ${TAGLINE}`)}\n`);
    out.write(`${chalk.dim(`  ${descriptor}`)}\n`);
    out.write('\n');
    out.write(`${chalk.dim(`  ${HINT}`)}\n`);
  } else {
    for (const line of LOGO) {
      out.write(`${line}\n`);
    }
    out.write(`  ${rule}\n`);
    out.write(`  ${TAGLINE}\n`);
    out.write(`  ${descriptor}\n`);
    out.write('\n');
    out.write(`  ${HINT}\n`);
  }

  out.write('\n');
}
