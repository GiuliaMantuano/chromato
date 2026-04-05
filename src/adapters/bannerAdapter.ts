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

const LOGO = [
  ' ██████╗██╗  ██╗██████╗  ██████╗ ███╗   ███╗ █████╗ ████████╗ ██████╗ ',
  '██╔════╝██║  ██║██╔══██╗██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗',
  '██║     ███████║██████╔╝██║   ██║██╔████╔██║███████║   ██║   ██║   ██║',
  '██║     ██╔══██║██╔══██╗██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║   ██║',
  '╚██████╗██║  ██║██║  ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝',
  ' ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ',
];

const LOGO_COLORS = [
  '#023e8a',
  '#0077b6',
  '#0096c7',
  '#00b4d8',
  '#90e0ef',
  '#caf0f8',
];

export const TAGLINE = 'The Pomodoro timer your terminal deserves';
const HINT = 'Ctrl+C to quit';
const DIVIDER_UNICODE = '─'.repeat(TAGLINE.length);
const DIVIDER_ASCII = '-'.repeat(TAGLINE.length);

export function printBanner(noColor: boolean, useAscii: boolean = false): void {
  if (process.env['NODE_ENV'] === 'test') return;

  const useColor = !noColor && !process.env['NO_COLOR'];
  const divider = useAscii ? DIVIDER_ASCII : DIVIDER_UNICODE;
  const out = process.stdout;

  out.write('\n');

  if (useColor) {
    for (let i = 0; i < LOGO.length; i++) {
      out.write(chalk.hex(LOGO_COLORS[i])(LOGO[i]) + '\n');
    }
    out.write('\n');
    out.write(chalk.dim(`  ${divider}`) + '\n');
    out.write(chalk.bold.white(`  ${TAGLINE}`) + '\n');
    out.write(chalk.dim(`  ${divider}`) + '\n');
    out.write('\n');
    out.write(chalk.dim(`  ${HINT}`) + '\n');
  } else {
    for (const line of LOGO) {
      out.write(line + '\n');
    }
    out.write('\n');
    out.write(`  ${divider}\n`);
    out.write(`  ${TAGLINE}\n`);
    out.write(`  ${divider}\n`);
    out.write('\n');
    out.write(`  ${HINT}\n`);
  }

  out.write('\n');
}
