#!/usr/bin/env node
/**
 * preview-palettes.mjs
 * Shows the chromato logo (ANSI Shadow) in all available color palettes.
 * Run: node scripts/preview-palettes.mjs
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

const PALETTES = [
  {
    name: 'A — Catppuccin Ocean (cyan → teal)',
    colors: ['#74c7ec', '#89dceb', '#89dceb', '#94e2d5', '#74c7ec', '#74c7ec'],
  },
  {
    name: 'B — Electric Blue (monochromatic)',
    colors: ['#00d7ff', '#00d7ff', '#00d7ff', '#00d7ff', '#00d7ff', '#00d7ff'],
  },
  {
    name: 'C — Deep Ocean (navy → ice)',
    colors: ['#023e8a', '#0077b6', '#0096c7', '#00b4d8', '#90e0ef', '#caf0f8'],
  },
  {
    name: 'D — Purple Neon (violet → lavender)',
    colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#8b5cf6', '#7c3aed'],
  },
  {
    name: 'E — Matrix Green (terminal green)',
    colors: ['#00ff41', '#00e63a', '#00cc33', '#00b32c', '#009926', '#00ff41'],
  },
  {
    name: 'F — Sunset Gold (gold → amber)',
    colors: ['#ffd60a', '#ffc300', '#ffb703', '#fb8500', '#ffc300', '#ffd60a'],
  },
];

for (const palette of PALETTES) {
  console.log('\n' + chalk.bold.white(`  ── ${palette.name} ──`));
  console.log();
  for (let i = 0; i < LOGO.length; i++) {
    console.log(chalk.hex(palette.colors[i])(LOGO[i]));
  }
}

console.log('\n' + chalk.dim('  Tell Claude which palette letter you prefer to apply it.') + '\n');
