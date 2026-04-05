/**
 * HelpAdapter: prints a dim horizontal divider to stdout to separate
 * the chromato banner from Commander's built-in help text.
 *
 * CRITICAL: Must NOT import ink, react, or any other adapter module.
 * Must NOT emit ANSI sequences when noColor=true or NO_COLOR is set.
 */

import chalk from 'chalk';

const DIVIDER_WIDTH = 41; // matches TAGLINE.length in bannerAdapter

export function printHelpSplash(noColor: boolean, useAscii: boolean): void {
  if (process.env['NODE_ENV'] === 'test') return;

  const useColor = !noColor && !process.env['NO_COLOR'];
  const dividerChar = useAscii ? '-' : '─';
  const divider = dividerChar.repeat(DIVIDER_WIDTH);
  const out = process.stdout;

  out.write('\n');
  if (useColor) {
    out.write(chalk.dim('  ' + divider) + '\n');
  } else {
    out.write('  ' + divider + '\n');
  }
  out.write('\n');
}
