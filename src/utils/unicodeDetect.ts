/**
 * Detects whether the current environment supports Unicode block characters.
 * Returns true when ASCII fallback should be activated automatically.
 *
 * Detection rules (in order):
 * 1. TERM=dumb → no Unicode support
 * 2. LANG or LC_ALL does not contain 'UTF-8' → no Unicode support
 * 3. Otherwise → Unicode supported
 */
export function detectNonUnicode(): boolean {
  if (process.env['TERM'] === 'dumb') {
    return true;
  }
  const lang = process.env['LC_ALL'] ?? process.env['LANG'] ?? '';
  if (lang === '' || !lang.includes('UTF-8')) {
    return true;
  }
  return false;
}
