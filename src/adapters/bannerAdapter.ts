/**
 * BannerAdapter: renders the chromato ASCII art logo and welcome message.
 *
 * Printed to stdout once at `chromato start`, before the TUI renders.
 * Respects NO_COLOR and --no-color flag (AC-P3).
 *
 * No ink/react imports — stdout only.
 * Not used in the `status` command path (performance: AC-03.1).
 */

import chalk from 'chalk';

// ANSI Shadow font — chromato (8 chars, ~100 visual columns, 6 lines)
const LOGO: readonly string[] = [
  ' ██████╗██╗  ██╗██████╗  ██████╗ ███╗   ███╗ █████╗ ████████╗ ██████╗ ',
  '██╔════╝██║  ██║██╔══██╗██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗',
  '██║     ███████║██████╔╝██║   ██║██╔████╔██║███████║   ██║   ██║   ██║',
  '██║     ██╔══██║██╔══██╗██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║   ██║',
  '╚██████╗██║  ██║██║  ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝',
  ' ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ',
];

// Deep Ocean palette — navy → ice (top to bottom)
const LOGO_COLORS: readonly string[] = [
  '#023e8a',
  '#0077b6',
  '#0096c7',
  '#00b4d8',
  '#90e0ef',
  '#caf0f8',
];

const TAGLINE = 'The Pomodoro timer your terminal deserves';
const HINT    = 'Ctrl+C to quit';
const DIVIDER = '─'.repeat(TAGLINE.length);

export function printBanner(noColor: boolean): void {
  // Skip in test environments — tests assert on TUI output, not banner output.
  if (process.env['NODE_ENV'] === 'test') return;

  const useColor = !noColor && !process.env['NO_COLOR'];
  const out = process.stdout;

  out.write('\n');

  if (useColor) {
    for (let i = 0; i < LOGO.length; i++) {
      out.write(chalk.hex(LOGO_COLORS[i]!)(LOGO[i]!) + '\n');
    }
    out.write('\n');
    out.write(chalk.dim(`  ${DIVIDER}`) + '\n');
    out.write(chalk.bold.white(`  ${TAGLINE}`) + '\n');
    out.write(chalk.dim(`  ${DIVIDER}`) + '\n');
    out.write('\n');
    out.write(chalk.dim(`  ${HINT}`) + '\n');
  } else {
    for (const line of LOGO) {
      out.write(line + '\n');
    }
    out.write('\n');
    out.write(`  ${DIVIDER}\n`);
    out.write(`  ${TAGLINE}\n`);
    out.write(`  ${DIVIDER}\n`);
    out.write('\n');
    out.write(`  ${HINT}\n`);
  }

  out.write('\n');
}
