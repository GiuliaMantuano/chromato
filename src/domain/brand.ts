/**
 * Brand constants — single source of truth for chromato's identity copy and logo.
 *
 * Domain-pure: zero imports. No I/O, no external packages, no colour (colour is
 * applied by adapters via chalk). Holds the ASCII logo, tagline and descriptor so
 * BOTH the banner adapter (chromato start) and the setup wizard adapter can render
 * the same identity without importing each other (adapters-no-cross-import).
 *
 * Per-palette wizard option copy (PALETTE_META) is a presentation concern and lives
 * with its sole consumer, setupWizardAdapter.tsx — not here.
 *
 * Extracted from bannerAdapter.ts (2026-06-01) per prototype-gap-analysis.md so the
 * first-run wizard's Welcome + Theme screens can match the approved prototype
 * (docs/design/splash-onboarding-prototype.html).
 */

/** 6-line ASCII logo. Each line is coloured with gradient stop i by the renderer. */
export const LOGO: readonly string[] = [
  ' ██████╗██╗  ██╗██████╗  ██████╗ ███╗   ███╗ █████╗ ████████╗ ██████╗ ',
  '██╔════╝██║  ██║██╔══██╗██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗',
  '██║     ███████║██████╔╝██║   ██║██╔████╔██║███████║   ██║   ██║   ██║',
  '██║     ██╔══██║██╔══██╗██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║   ██║',
  '╚██████╗██║  ██║██║  ██║╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝',
  ' ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ',
];

export const TAGLINE = 'Focus in full colour';
export const DESCRIPTOR = 'Work, break, repeat — right in your terminal';
export const DESCRIPTOR_ASCII = 'Work, break, repeat - right in your terminal';

/** First-run welcome body copy (prototype rWelcome). */
export const WELCOME_BODY = "Welcome! Let's tune chromato to your terminal — takes 20 seconds.";
