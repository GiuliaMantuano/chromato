/**
 * Returning-home driving adapter (Ink TUI) — DELIVER (returning-home).
 *
 * DESIGN D-RH-5 / architecture-design.md §2.2. Dynamic-imported by index.ts only
 * inside the `if (shouldShowHome(...))` branch (ADR-012). Renders the saved-config
 * recap + three-action menu, resolves the user's intent to a HomeChoice, and hands
 * control back to the composition root (which owns delegation to start / setup / quit).
 *
 * The adapter never imports setupWizardAdapter or tuiAdapter (Rule 4); it imports
 * only the shared presentational helpers from src/adapters/tui/ plus domain data
 * (palette, brand). The recap reads a ConfigResult prop ONLY — no loadConfig call
 * inside the adapter (D-RH-6 / K8).
 *
 * Step 02-01 implements the RENDER (recap + static menu + footer). The keypress
 * RESOLUTION of HomeChoice (Enter/R/Q/Ctrl+C → onChoose) is step 02-02.
 *
 * F1 (D-RH-4): logo + swatch gradient ← getPalette(name).gradient (domain);
 * theme display label ← PALETTE_META[name].label (presentation, tui/).
 */

import React from 'react';
import { render as inkRender, Text, Box, useApp, useInput } from 'ink';
import type { ConfigResult } from '../configLoader.js';
import { TAGLINE, DESCRIPTOR } from '../domain/brand.js';
import { MODE_LABELS } from '../domain/notificationMode.js';
import { LogoBlock, Footer, swatch, colorize, PALETTE_META } from './tui/components.js';

/** Render-intent seam (D-RH-5): the home resolves the user's action to this union. */
export type HomeChoice =
  | { kind: 'start' } // Enter on "Start a focus session"
  | { kind: 'reconfigure' } // R, or Enter on "Reconfigure…"
  | { kind: 'quit' }; // Q, Enter on "Quit", or Ctrl+C

export interface HomeAdapterProps {
  readonly config: ConfigResult;
  readonly tmuxDetected: boolean;
  readonly configPath: string;
  readonly onChoose: (choice: HomeChoice) => void;
}

// Recap copy colours (prototype: greeting #aeb9c6, key #7a8696, value #e7eef5, note #5a6b7a).
const GREET_FG = '#aeb9c6';
const KEY_FG = '#7a8696';
const VALUE_FG = '#e7eef5';
const NOTE_FG = '#5a6b7a';

/** Whole minutes from a domain seconds value (recap shows minutes, prototype). */
function minutes(seconds: number): number {
  return Math.round(seconds / 60);
}

interface RecapRowProps {
  readonly label: string;
  readonly value: string;
  readonly trailing?: React.ReactNode;
}

const RecapRow: React.FC<RecapRowProps> = ({ label, value, trailing }) => (
  <Box>
    <Box width={16}>
      <Text>{colorize(KEY_FG, `  ${label}`)}</Text>
    </Box>
    <Text>{colorize(VALUE_FG, value)}</Text>
    {trailing != null ? <Text> {trailing}</Text> : null}
  </Box>
);

interface MenuItem {
  readonly name: string;
  readonly desc: string;
  /** The HomeChoice this item resolves to when chosen with Enter. */
  readonly choice: HomeChoice['kind'];
}

/**
 * The three-action menu (prototype MENU). 02-01 rendered it statically; 02-02
 * wires the selection cursor (▸) and per-item HomeChoice for keypress resolution.
 * Single source of truth for the menu order, length, and per-row HomeChoice — the
 * render (HomeScreen), the wrap-navigation modulus, and the Enter-key resolution all
 * derive from this one list, so a new menu row only changes here.
 */
function menuItems(cadence: string): readonly MenuItem[] {
  return [
    { name: 'Start a focus session', desc: `${cadence} — your saved cadence`, choice: 'start' },
    {
      name: 'Reconfigure…',
      desc: 're-run setup to change theme / timing / notifications',
      choice: 'reconfigure',
    },
    { name: 'Quit', desc: '', choice: 'quit' },
  ];
}

// The selection cursor glyph; the highlighted row is bright, the rest muted.
const CURSOR = '▸';
const SELECTED_FG = '#e7eef5';

/**
 * The returning-user home screen: branded hero (logo gradient + tagline +
 * descriptor), a recap of the saved config, the three-action menu, and the footer
 * (config-path note + key hints). Pure render — all inputs are props (no I/O).
 */
export const HomeScreen: React.FC<
  Omit<HomeAdapterProps, 'onChoose'> & { readonly selectedIndex?: number }
> = ({ config, tmuxDetected, configPath, selectedIndex = 0 }) => {
  // The palette NAME comes straight off the single-read ConfigResult (DD-4): no
  // reverse-lookup over the Palette object. The presentation helpers (LogoBlock,
  // swatch, PALETTE_META) key off the name; the gradient is its domain palette.
  const { paletteName, resolvedPalette } = config;
  const { gradient } = resolvedPalette;
  const { config: session, notifications } = config;

  const work = minutes(session.workDurationSeconds);
  const brk = minutes(session.breakDurationSeconds);
  const longBreak = minutes(session.longBreakDurationSeconds);
  const cadence = `${work} · ${brk} × ${session.cycleCount}`;

  return (
    <Box flexDirection="column">
      <LogoBlock paletteName={paletteName} />
      <Box marginTop={1}>
        <Text>{colorize(gradient[2], `  ${TAGLINE}`)}</Text>
      </Box>
      <Text>{colorize(NOTE_FG, `  ${DESCRIPTOR}`)}</Text>

      <Box marginTop={1}>
        <Text>{colorize(GREET_FG, "  Welcome back. Here's your setup:")}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <RecapRow
          label="Theme"
          value={PALETTE_META[paletteName].label}
          trailing={swatch(paletteName)}
        />
        <RecapRow
          label="Timing"
          value={cadence}
          trailing={colorize(NOTE_FG, `long break ${longBreak}m`)}
        />
        <RecapRow label="Notifications" value={MODE_LABELS[notifications]} />
        {tmuxDetected ? <RecapRow label="tmux" value="status bar ready" /> : null}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {menuItems(cadence).map((item, index) => {
          const isSelected = index === selectedIndex;
          const marker = isSelected ? `${CURSOR} ` : '  ';
          const labelFg = isSelected ? SELECTED_FG : VALUE_FG;
          return (
            <Box key={item.name}>
              <Text>{colorize(labelFg, `${marker}${item.name}`)}</Text>
              {item.desc !== '' ? <Text>{colorize(NOTE_FG, `  ${item.desc}`)}</Text> : null}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text>
          {colorize(NOTE_FG, `  Settings live in ${configPath} · or run chromato setup anytime.`)}
        </Text>
      </Box>

      <Footer
        hints={[
          { key: '↑↓', label: 'move' },
          { key: 'Enter', label: 'choose' },
          { key: 'R', label: 'reconfigure' },
          { key: 'Q', label: 'quit' },
        ]}
      />
    </Box>
  );
};

// The menu order, length, and per-row HomeChoice all derive from menuItems() — the
// single source of truth. cadence only affects a row's description text, never its
// order/choice, so an empty cadence is fine for deriving navigation + resolution.
const MENU = menuItems('');
const MENU_LENGTH = MENU.length;
const MENU_CHOICES: readonly HomeChoice[] = MENU.map((item) => ({ kind: item.choice }));

/**
 * The interactive home screen: renders the recap + menu via HomeScreen, owns the
 * selection cursor, and resolves the user's intent to a HomeChoice via onChoose.
 *
 * Keybindings (prototype, D-RH-5): ↑/↓ wrap-navigate, Enter chooses the highlighted
 * item, R = reconfigure, Q = quit, Ctrl+C = quit. The adapter never writes config —
 * its sole output is the resolved HomeChoice (the composition root owns delegation).
 */
const Home: React.FC<HomeAdapterProps> = ({ config, tmuxDetected, configPath, onChoose }) => {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const resolved = React.useRef(false);

  const choose = (choice: HomeChoice): void => {
    if (resolved.current) {
      return;
    }
    resolved.current = true;
    onChoose(choice);
    exit();
  };

  useInput((input, key) => {
    if ((key.ctrl && input === 'c') || input === 'q' || input === 'Q') {
      choose({ kind: 'quit' });
      return;
    }
    if (input === 'r' || input === 'R') {
      choose({ kind: 'reconfigure' });
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((current) => (current + 1) % MENU_LENGTH);
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((current) => (current - 1 + MENU_LENGTH) % MENU_LENGTH);
      return;
    }
    if (key.return) {
      choose(MENU_CHOICES[selectedIndex]);
    }
  });

  return (
    <HomeScreen
      config={config}
      tmuxDetected={tmuxDetected}
      configPath={configPath}
      selectedIndex={selectedIndex}
    />
  );
};

/** Injection seam so tests can drive the Ink surface headlessly (ink-testing-library). */
export type HomeRenderer = (element: React.ReactElement) => unknown;

const defaultRenderer: HomeRenderer = (element) => inkRender(element, { exitOnCtrlC: false });

/**
 * Mounts Ink, resolves with the HomeChoice once the user acts, then unmounts.
 *
 * The recap consumes the already-loaded ConfigResult prop ONLY — no loadConfig
 * call inside the adapter (D-RH-6 / K8). The adapter has no config-write port:
 * its sole output is the resolved HomeChoice, so quitting writes nothing.
 */
export class HomeAdapter {
  constructor(private readonly _renderer: HomeRenderer = defaultRenderer) {}

  run(props: Omit<HomeAdapterProps, 'onChoose'>): Promise<HomeChoice> {
    return new Promise<HomeChoice>((resolve) => {
      const handleChoose = (choice: HomeChoice): void => {
        resolve(choice);
      };
      const element = React.createElement(Home, { ...props, onChoose: handleChoose });
      this._renderer(element);
    });
  }
}
