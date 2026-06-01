/**
 * SetupWizardAdapter — first-run setup wizard (Slice 01: Welcome + Theme).
 *
 * Driving adapter (Ink/React). Slice 01 implements ONLY the Welcome screen and
 * the Theme step with a live two-column truecolor preview built from the real
 * src/domain/palette.ts registry. Timing / Notifications / tmux / Summary /
 * skip / back are LATER steps (03-xx / 04-01) and are intentionally absent here.
 *
 * On completion the wizard emits a WizardResult: the chosen palette plus the
 * locked Slice-01 defaults for the not-yet-built fields (work 25, break 5,
 * longBreak 15, cycles 4, notifications true), and persists it via the injected
 * ConfigWritePort. Q on the Welcome screen quits and resolves null (writes nothing).
 *
 * MUST NOT import other adapters (dependency-cruiser adapters-no-cross-import).
 * ConfigWritePort is imported from the domain (../domain/ports.js).
 *
 * Dynamic-imported from index.ts only when shouldRunWizard() passes (step 01-03),
 * so ink/react stay off the --help / non-interactive paths (ADR-012, AC-HSS-07).
 */

import React from 'react';
import { render as inkRender, Text, Box, useApp, useInput } from 'ink';
import chalk from 'chalk';
import {
  getPalette,
  VALID_PALETTE_NAMES,
  DEFAULT_PALETTE_NAME,
  type PaletteName,
} from '../domain/palette.js';
import { LOGO, TAGLINE, DESCRIPTOR, WELCOME_BODY } from '../domain/brand.js';
import type { WizardResult } from '../configTypes.js';
import type { ConfigWritePort } from '../domain/ports.js';

// Recommended ("Default") timing, also the seed for Custom edits. Matches the
// prototype rTiming "25 · 5 × 4 (recommended)" option.
const RECOMMENDED_TIMING = {
  work: 25,
  break: 5,
  longBreak: 15,
  cycles: 4,
} as const;

// Locked default for the not-yet-built Notifications step (03-02 makes it real).
const NOTIFICATIONS_DEFAULT = true;

// The tmux integration hint (03-03): a COPY-PASTE-ONLY status-bar snippet shown on
// the Notifications step when tmux is detected ($TMUX). The wizard NEVER writes
// ~/.tmux.conf — it only displays this exact line for the user to paste. Mirrors
// the approved prototype rNotify tmuxDetected branch (splash-onboarding-prototype.html).
const TMUX_STATUS_RIGHT_SNIPPET = 'set -g status-right "#(chromato status --format tmux)"';

type WizardStep = 'welcome' | 'theme' | 'timing' | 'notify' | 'summary';

// Cross-step Esc-back chain (04-01): Esc steps back one screen, preserving prior
// selections. Welcome is the root (Esc is inert there — Q/Ctrl+C quit instead).
const PREVIOUS_STEP: Record<WizardStep, WizardStep | null> = {
  welcome: null,
  theme: 'welcome',
  timing: 'theme',
  notify: 'timing',
  summary: 'notify',
};

/** A custom timing field: its WizardResult key, label, value range, and step. */
interface TimingField {
  readonly key: 'work' | 'break' | 'longBreak' | 'cycles';
  readonly label: string;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

// Field ranges/steps from the step 03-01 spec (prototype rTiming FIELDS):
//   work 1–90 (×1), break 1–30 (×1), longBreak 5–60 (×5), cycles 1–8 (×1).
const TIMING_FIELDS: readonly TimingField[] = [
  { key: 'work', label: 'Work', unit: 'm', min: 1, max: 90, step: 1 },
  { key: 'break', label: 'Break', unit: 'm', min: 1, max: 30, step: 1 },
  { key: 'longBreak', label: 'Long break', unit: 'm', min: 5, max: 60, step: 5 },
  { key: 'cycles', label: 'Cycles', unit: '', min: 1, max: 8, step: 1 },
];

interface TimingValues {
  work: number;
  break: number;
  longBreak: number;
  cycles: number;
}

/** Clamp v into [min, max] (steppers never push a field out of range). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface PaletteMeta {
  /** Capitalised display name, e.g. 'Ocean'. */
  readonly label: string;
  /** One-line option description, e.g. 'cool blue · the default'. */
  readonly description: string;
}

/**
 * Per-palette display copy for the wizard's theme option cards. Presentation
 * concern (UI labels/descriptions), so it lives with its sole consumer — the
 * wizard adapter — not in the domain. Copy mirrors the approved prototype.
 */
const PALETTE_META: Record<PaletteName, PaletteMeta> = {
  ocean: { label: 'Ocean', description: 'cool blue · the default' },
  lavender: { label: 'Lavender', description: 'soft violet · catppuccin mood' },
  berry: { label: 'Berry', description: 'warm rose · wine + gold' },
  forest: { label: 'Forest', description: 'sage green · earthy terminal' },
};

// Preview chrome constants — faithful to the approved prototype (splash-onboarding-
// prototype.html: bar() L153, rTheme preview L187). Named here so the prototype
// origin is traceable and a later step can parameterise the countdown.
const CHIP_TEXT_FG = '#08121b'; // dark foreground for phase chips (any palette bg)
const BAR_TRACK_HEX = '#2a3744'; // unfilled WORK-bar track
const PREVIEW_BAR_FRAC = 0.62; // illustrative fill fraction in the live preview
const PREVIEW_BAR_WIDTH = 22; // WORK-bar cell count in the live preview
const PREVIEW_TIME_LABEL = '15:24'; // illustrative remaining-time label
// Below this terminal width the theme step stacks the preview under the options
// instead of beside them, so the 72-col logo never overflows. The side-by-side
// layout needs ~35 (option column) + 3 (gap) + 72 (logo) + padding ≈ 112 cols.
const SIDE_BY_SIDE_MIN_COLS = 112;
// Footer key-hint "buttons": a filled key-cap plus a readable (not dimmed) label,
// so the call-to-action reads as actionable rather than disabled (prototype kbd style).
const KEYCAP_BG = '#28384a';
const KEYCAP_FG = '#dfe7ef';
const HINT_LABEL_FG = '#aeb9c6';
// Breadcrumb chrome — faithful to the prototype crumbs() (L155-161): the three
// wizard steps, the active step highlighted, completed steps marked done (✓).
const WIZARD_STEP_LABELS = ['Theme', 'Timing', 'Setup'] as const;
const CRUMB_SEPARATOR_FG = '#2f3b48'; // the "───" divider between steps (prototype)
const CRUMB_ACTIVE_FG = '#dfe7ef'; // active step label — bright
const CRUMB_DONE_FG = '#7a8696'; // completed step — muted
const CRUMB_UPCOMING_FG = '#4a5663'; // not-yet-reached step — dim

/** Renders a string in the given hex truecolor, honouring the process chalk level. */
function colorize(hex: string, content: string): string {
  return chalk.hex(hex)(content);
}

/** A filled "chip": a label on a coloured background (prototype phase chips). */
function chip(bgHex: string, label: string): string {
  return chalk.bgHex(bgHex).hex(CHIP_TEXT_FG).bold(` ${label} `);
}

/** A footer key hint as a filled key-cap "button" followed by a readable label. */
function keyHint(keyName: string, label: string): string {
  return chalk.bgHex(KEYCAP_BG).hex(KEYCAP_FG).bold(` ${keyName} `) + chalk.hex(HINT_LABEL_FG)(` ${label}`);
}

/** A 6-stop colour swatch (one block per gradient stop) for a theme option card. */
function swatch(paletteName: PaletteName): string {
  return getPalette(paletteName)
    .gradient.map((hex) => colorize(hex, '█'))
    .join('');
}

/** WORK progress bar: `width` cells, `frac` filled in the palette WORK colour. */
function workBar(paletteName: PaletteName, frac: number, width: number): string {
  const fill = Math.round(width * frac);
  const work = getPalette(paletteName).phases.WORK.fg;
  return colorize(work, '█'.repeat(fill)) + colorize(BAR_TRACK_HEX, '░'.repeat(width - fill));
}

export interface SetupWizardProps {
  /** Set when running inside tmux ($TMUX) — gates the tmux integration hint. */
  readonly tmuxDetected: boolean;
  /** Pre-seed values on re-run (`chromato setup`); undefined on first run. */
  readonly initial?: Partial<WizardResult>;
  /** Called with the final selections when the user finishes the wizard. */
  readonly onComplete: (result: WizardResult) => void;
  /** Called when the user quits (Q) without finishing. */
  readonly onQuit: () => void;
}

// ---------------------------------------------------------------------------
// Logo — the full 6-line ASCII logo rendered in a palette's gradient (one
// gradient stop per line). Same shape as the start-up banner, but sourced from
// the domain brand module so the wizard need not import another adapter.
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
// Theme preview — live panel from the REAL palette registry: the full logo in
// the selected gradient, a WORK bar with a countdown, and the phase chips.
// Matches the approved prototype's rTheme right-hand preview.
// ---------------------------------------------------------------------------

export const ThemePreview: React.FC<{ paletteName: PaletteName; stacked?: boolean }> = ({
  paletteName,
  stacked = false,
}) => {
  const palette = getPalette(paletteName);
  return (
    <Box flexDirection="column" {...(stacked ? { marginTop: 1 } : { marginLeft: 3 })}>
      <Text dimColor>{`live preview · ${PALETTE_META[paletteName].label}`}</Text>
      <LogoBlock paletteName={paletteName} />
      <Box marginTop={1}>
        <Text>
          {colorize(palette.phases.WORK.fg, 'WORK ')}
          {workBar(paletteName, PREVIEW_BAR_FRAC, PREVIEW_BAR_WIDTH)}
          {chalk.dim(` ${PREVIEW_TIME_LABEL}`)}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          {chip(palette.phases.WORK.fg, 'WORK')} {chip(palette.phases.BREAK.fg, 'BREAK')}{' '}
          {chip(palette.phases.LONG_BREAK.fg, 'LONG')}
        </Text>
      </Box>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Timing "your cycle" timeline — a live preview of the chosen cadence in the
// selected palette's phase colours. Matches the prototype rTiming timeline
// (L213-223): up to 4 cycles of "{work}m work → {break}m" with the final cycle's
// break replaced by "{longBreak}m long", and an ellipsis when cycles > 4.
// ---------------------------------------------------------------------------

export const TimingTimeline: React.FC<{ paletteName: PaletteName; timing: TimingValues }> = ({
  paletteName,
  timing,
}) => {
  const palette = getPalette(paletteName);
  const workFg = palette.phases.WORK.fg;
  const breakFg = palette.phases.BREAK.fg;
  const shown = Math.min(timing.cycles, 4);
  const segments: React.ReactNode[] = [];
  for (let cycle = 1; cycle <= shown; cycle += 1) {
    const isLast = cycle === timing.cycles;
    const breakLabel = isLast ? `${timing.longBreak}m long` : `${timing.break}m`;
    segments.push(
      <Text key={`c${cycle}`}>
        {colorize(workFg, `${timing.work}m work`)}
        {colorize(CRUMB_SEPARATOR_FG, ' → ')}
        {colorize(breakFg, breakLabel)}
        {cycle < shown ? colorize(CRUMB_SEPARATOR_FG, '  ·  ') : ''}
      </Text>,
    );
  }
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>your cycle</Text>
      <Box>
        {segments}
        {timing.cycles > 4 ? <Text>{colorize(CRUMB_SEPARATOR_FG, ' …')}</Text> : null}
      </Box>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Footer keybar — a contextual row of key hints rendered via keyHint(), matching
// the prototype footer() (L162). Reusable: every wizard screen passes its own
// ordered hint list. Generalises the inline footers added in step 01-04.
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

// ---------------------------------------------------------------------------
// Breadcrumbs — the three wizard steps (Theme · Timing · Setup) with the active
// step highlighted and completed steps marked done (✓). Matches the prototype
// crumbs() (L155-161). Reusable: each step passes its own active index (1-based).
// ---------------------------------------------------------------------------

export const Breadcrumbs: React.FC<{ active: number }> = ({ active }) => (
  <Box marginBottom={1}>
    <Text>
      {`  `}
      {WIZARD_STEP_LABELS.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === active;
        const isDone = stepNumber < active;
        const fg = isActive ? CRUMB_ACTIVE_FG : isDone ? CRUMB_DONE_FG : CRUMB_UPCOMING_FG;
        const marker = isDone ? '✓' : String(stepNumber);
        const separator = index > 0 ? colorize(CRUMB_SEPARATOR_FG, ' ─── ') : '';
        return (
          <Text key={label}>
            {separator}
            {colorize(fg, isActive ? chalk.bold(`${marker} ${label}`) : `${marker} ${label}`)}
          </Text>
        );
      })}
    </Text>
  </Box>
);

// ---------------------------------------------------------------------------
// Wizard component — Welcome → Theme (Slice 01).
// ---------------------------------------------------------------------------

export const SetupWizard: React.FC<SetupWizardProps> = ({ tmuxDetected, initial, onComplete, onQuit }) => {
  const { exit } = useApp();
  const initialPalette = initial?.palette ?? DEFAULT_PALETTE_NAME;
  const initialIndex = Math.max(0, VALID_PALETTE_NAMES.indexOf(initialPalette));

  const [step, setStep] = React.useState<WizardStep>('welcome');
  const [paletteIndex, setPaletteIndex] = React.useState(initialIndex);

  // Timing step state. timingMode: 0 = Default (recommended), 1 = Custom.
  // editingCustom: inside the Custom field editor (↑↓ field / ←→ adjust).
  const seededTiming: TimingValues = {
    work: initial?.work ?? RECOMMENDED_TIMING.work,
    break: initial?.break ?? RECOMMENDED_TIMING.break,
    longBreak: initial?.longBreak ?? RECOMMENDED_TIMING.longBreak,
    cycles: initial?.cycles ?? RECOMMENDED_TIMING.cycles,
  };
  const [timingMode, setTimingMode] = React.useState(0);
  const [editingCustom, setEditingCustom] = React.useState(false);
  const [customField, setCustomField] = React.useState(0);
  const [custom, setCustom] = React.useState<TimingValues>(seededTiming);

  // Notifications step state (03-02): On/Off toggle (default On). notifyRow:
  // 0 = the toggle row, 1 = the "Finish & start my first session →" action row.
  const [notifyOn, setNotifyOn] = React.useState(initial?.notifications ?? NOTIFICATIONS_DEFAULT);
  const [notifyRow, setNotifyRow] = React.useState(0);

  // The timing values chosen on the Timing step, carried into Notifications so
  // the final WizardResult assembles all six fields when the user finishes.
  const chosenTiming = React.useRef<TimingValues>(seededTiming);

  const finished = React.useRef(false);

  /** Advance from Timing to the Notifications step, remembering the timing choice. */
  const goToNotify = (timing: TimingValues): void => {
    chosenTiming.current = timing;
    setStep('notify');
  };

  /** Step Esc-back to the previous screen, preserving prior selections (04-01). */
  const goBack = (): void => {
    const previous = PREVIOUS_STEP[step];
    if (previous !== null) {
      setStep(previous);
    }
  };

  const complete = (palette: PaletteName, timing: TimingValues, notifications: boolean): void => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    onComplete({ palette, ...timing, notifications });
    exit();
  };

  const quit = (): void => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    onQuit();
    exit();
  };

  useInput((input, key) => {
    // Universal escape hatch on EVERY screen: Ctrl+C quits without writing config.
    // The wizard disables Ink's default exitOnCtrlC, and per-screen Esc-back is not
    // wired until 04-01, so without this a user is trapped once past Welcome.
    if (key.ctrl && input === 'c') {
      quit();
      return;
    }

    // Universal Q quit on EVERY screen: Q was previously scoped inside the welcome
    // branch and inert on every inner screen (Theme/Timing/Notify/Custom editor),
    // leaving users with no visible quit key past Welcome. Q is bound to nothing on
    // any inner screen, so a global Q-quit is collision-free. quit() guards double-fire.
    if (input.toLowerCase() === 'q') {
      quit();
      return;
    }

    if (step === 'welcome') {
      if (key.return) {
        setStep('theme');
        return;
      }
      // S skip · use defaults (rWelcome): jump straight to the Summary pre-filled
      // with the locked defaults (ocean · 25·5·15 · 4 · On), bypassing every step.
      if (input.toLowerCase() === 's') {
        setPaletteIndex(Math.max(0, VALID_PALETTE_NAMES.indexOf(DEFAULT_PALETTE_NAME)));
        chosenTiming.current = { ...RECOMMENDED_TIMING };
        setNotifyOn(NOTIFICATIONS_DEFAULT);
        setStep('summary');
        return;
      }
      return;
    }

    if (step === 'theme') {
      if (key.upArrow) {
        setPaletteIndex((index) => (index - 1 + VALID_PALETTE_NAMES.length) % VALID_PALETTE_NAMES.length);
        return;
      }
      if (key.downArrow) {
        setPaletteIndex((index) => (index + 1) % VALID_PALETTE_NAMES.length);
        return;
      }
      if (key.return) {
        setStep('timing');
        return;
      }
      if (key.escape) {
        goBack();
      }
      return;
    }

    if (step === 'summary') {
      // Enter "begin": write the full config + resolve the launch intent.
      if (key.return) {
        complete(VALID_PALETTE_NAMES[paletteIndex] as PaletteName, chosenTiming.current, notifyOn);
        return;
      }
      if (key.escape) {
        goBack();
      }
      return;
    }

    if (step === 'notify') {
      // ↑↓ move between the toggle row and the finish row.
      if (key.upArrow || key.downArrow) {
        setNotifyRow((row) => (row === 0 ? 1 : 0));
        return;
      }
      // ←→ toggle notifications On/Off (only meaningful on the toggle row, but
      // accepted on either row so the key never feels dead).
      if (key.leftArrow || key.rightArrow) {
        setNotifyOn((on) => !on);
        return;
      }
      if (key.return) {
        // Advance to the Summary review screen (notifyOn state carries the choice).
        setStep('summary');
        return;
      }
      if (key.escape) {
        goBack();
      }
      return;
    }

    // step === 'timing'
    if (editingCustom) {
      // Custom field editor: ↑↓ pick field, ←→ adjust by the field's step, Enter confirm.
      if (key.upArrow) {
        setCustomField((field) => (field - 1 + TIMING_FIELDS.length) % TIMING_FIELDS.length);
        return;
      }
      if (key.downArrow) {
        setCustomField((field) => (field + 1) % TIMING_FIELDS.length);
        return;
      }
      if (key.leftArrow || key.rightArrow) {
        const field = TIMING_FIELDS[customField] as TimingField;
        const delta = key.rightArrow ? field.step : -field.step;
        setCustom((values) => ({
          ...values,
          [field.key]: clamp(values[field.key] + delta, field.min, field.max),
        }));
        return;
      }
      if (key.return) {
        goToNotify(custom);
        return;
      }
      // Esc leaves the field editor back to the Default/Custom choice, so picking
      // Custom is never a one-way trap. (Full cross-step Esc-back arrives in 04-01.)
      if (key.escape) {
        setEditingCustom(false);
      }
      return;
    }

    // timing choose-mode: ↑↓ choose Default/Custom, Enter continue.
    if (key.upArrow || key.downArrow) {
      setTimingMode((mode) => (mode === 0 ? 1 : 0));
      return;
    }
    if (key.return) {
      if (timingMode === 0) {
        goToNotify({ ...RECOMMENDED_TIMING });
        return;
      }
      // Custom selected → enter the field editor (a second Enter confirms).
      setEditingCustom(true);
      return;
    }
    // Esc on the Default/Custom choice steps back to the Theme step (04-01).
    if (key.escape) {
      goBack();
    }
  });

  if (step === 'welcome') {
    const palette = getPalette(DEFAULT_PALETTE_NAME);
    return (
      <Box flexDirection="column" padding={1}>
        <LogoBlock paletteName={DEFAULT_PALETTE_NAME} />
        <Box marginTop={1}>
          <Text>{chalk.hex(palette.gradient[2]).bold(`  ${TAGLINE}`)}</Text>
        </Box>
        <Text dimColor>{`  ${DESCRIPTOR}`}</Text>
        <Box marginTop={1}>
          <Text>{`  ${WELCOME_BODY}`}</Text>
        </Box>
        <Footer
          hints={[
            { key: 'Enter', label: 'get started' },
            { key: 'S', label: 'skip · use defaults' },
            { key: 'Q', label: 'quit' },
          ]}
        />
      </Box>
    );
  }

  const selectedPalette = VALID_PALETTE_NAMES[paletteIndex] as PaletteName;

  if (step === 'summary') {
    // Summary review (rSummary L247-262): small logo, the "You're all set"
    // confirmation, the Theme/Timing/Notify recap, and a "WORK · POMODORO 1 of N"
    // bar at 00:00. Breadcrumbs: all three steps done. Enter "begin" writes the
    // full config and launches; Esc steps back to Notifications.
    const palette = getPalette(selectedPalette);
    const timing = chosenTiming.current;
    const workClock = `${String(timing.work).padStart(2, '0')}:00`;
    return (
      <Box flexDirection="column" padding={1}>
        <LogoBlock paletteName={selectedPalette} />
        <Box marginTop={1}>
          <Text>{colorize(palette.phases.WORK.fg, "  ✓ You're all set")}</Text>
        </Box>
        <Text dimColor>{'  Starting your first WORK session…'}</Text>

        <Box flexDirection="column" marginTop={1}>
          <Text>
            {colorize(CRUMB_DONE_FG, '  Theme   ')}
            {colorize(palette.gradient[2], chalk.bold(PALETTE_META[selectedPalette].label))}
          </Text>
          <Text>
            {colorize(CRUMB_DONE_FG, '  Timing  ')}
            {`${timing.work} · ${timing.break} × ${timing.cycles} `}
            {chalk.dim(`(long break ${timing.longBreak}m)`)}
          </Text>
          <Text>
            {colorize(CRUMB_DONE_FG, '  Notify  ')}
            {notifyOn ? 'On' : 'Off'}
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text>{colorize(palette.phases.WORK.fg, chalk.bold(`  WORK · POMODORO 1 of ${timing.cycles}`))}</Text>
        </Box>
        <Box>
          <Text>
            {'  '}
            {workBar(selectedPalette, 0, PREVIEW_BAR_WIDTH)}
            {chalk.dim(` ${workClock}`)}
          </Text>
        </Box>

        <Footer
          hints={[
            { key: 'Enter', label: 'begin' },
            { key: 'Esc', label: 'back' },
          ]}
        />
      </Box>
    );
  }

  if (step === 'notify') {
    // Notifications step (03-02 + 03-03) — prototype rNotify (L230-245). When tmux
    // is detected the title gains "& integration" and a copy-paste status-bar
    // snippet is shown (03-03); the wizard never writes ~/.tmux.conf.
    const toggleSelected = notifyRow === 0;
    const finishSelected = notifyRow === 1;
    const finishColor = getPalette(selectedPalette).phases.WORK.fg;
    return (
      <Box flexDirection="column" padding={1}>
        <Breadcrumbs active={3} />
        <Text bold>{tmuxDetected ? 'Notifications & integration' : 'Notifications'}</Text>
        <Text dimColor>Last step — a couple of finishing touches.</Text>

        <Box marginTop={1}>
          <Text {...(toggleSelected ? { bold: true } : {})}>
            {toggleSelected ? '▸ ' : '  '}
            Desktop notifications{'   '}
            <Text {...(notifyOn ? { bold: true } : { dimColor: true })}>On</Text>
            {' / '}
            <Text {...(!notifyOn ? { bold: true } : { dimColor: true })}>Off</Text>
          </Text>
        </Box>
        <Text dimColor>{'    Ping me when a phase ends (work → break, break → work).'}</Text>

        {tmuxDetected ? (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>
              {'  tmux detected — add the live timer to your status bar? Paste into ~/.tmux.conf:'}
            </Text>
            <Text>{`    ${TMUX_STATUS_RIGHT_SNIPPET}`}</Text>
          </Box>
        ) : null}

        <Box marginTop={1}>
          <Text dimColor>
            {'  Your choices are saved to ~/.config/chromato/config.json · re-run with '}
            chromato setup
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text {...(finishSelected ? { bold: true } : {})}>
            {finishSelected ? '▸ ' : '  '}
            {colorize(finishColor, 'Finish & start my first session →')}
          </Text>
        </Box>

        <Footer
          hints={[
            { key: '↑↓', label: 'move' },
            { key: '←→', label: 'toggle' },
            { key: 'Enter', label: 'finish' },
            { key: 'Esc', label: 'back' },
            { key: 'Q', label: 'quit' },
          ]}
        />
      </Box>
    );
  }

  if (step === 'timing') {
    // The preview cadence: Default uses the recommended values, Custom mirrors
    // the live-edited fields. Matches the prototype rTiming timeline source.
    const previewTiming: TimingValues = timingMode === 0 ? { ...RECOMMENDED_TIMING } : custom;
    const defaultSelected = timingMode === 0;
    const customSelected = timingMode === 1;
    const footerHints = editingCustom
      ? [
          { key: '↑↓', label: 'field' },
          { key: '←→', label: 'adjust' },
          { key: 'Enter', label: 'confirm' },
          { key: 'Esc', label: 'back' },
          { key: 'Q', label: 'quit' },
        ]
      : [
          { key: '↑↓', label: 'choose' },
          { key: 'Enter', label: 'continue' },
          { key: 'Esc', label: 'back' },
          { key: 'Q', label: 'quit' },
        ];
    return (
      <Box flexDirection="column" padding={1}>
        <Breadcrumbs active={2} />
        <Text bold>Session timing</Text>
        <Text dimColor>How long is a focus session and a break? You can change this anytime later.</Text>

        <Box marginTop={1}>
          <Text {...(defaultSelected ? { bold: true } : {})}>
            {defaultSelected ? '▸ ' : '  '}
            {'Default — '}
            <Text bold>25 · 5 × 4 </Text>
            <Text dimColor>(recommended)</Text>
          </Text>
        </Box>
        <Text dimColor>{'    25 min work · 5 min break · 15 min long break · 4 cycles'}</Text>

        <Box marginTop={1}>
          <Text {...(customSelected ? { bold: true } : {})}>
            {customSelected ? '▸ ' : '  '}
            Custom
          </Text>
        </Box>
        <Text dimColor>
          {editingCustom
            ? '    Use ↑↓ to pick a field, ←→ to adjust, Enter to confirm.'
            : '    Set your own work, break and cycle lengths.'}
        </Text>

        {editingCustom ? (
          <Box flexDirection="column" marginTop={1}>
            {TIMING_FIELDS.map((field, index) => {
              const isSelected = index === customField;
              const value = custom[field.key];
              return (
                <Box key={field.key}>
                  <Text {...(isSelected ? { bold: true } : {})}>
                    {isSelected ? '▸ ' : '  '}
                    {field.label.padEnd(11)}
                  </Text>
                  <Text>{` ◂ ${value}${field.unit} ▸`}</Text>
                </Box>
              );
            })}
          </Box>
        ) : null}

        <TimingTimeline paletteName={selectedPalette} timing={previewTiming} />
        <Footer hints={footerHints} />
      </Box>
    );
  }

  // Side-by-side (like the prototype) when the terminal is wide enough for the
  // 72-col logo beside the option list; otherwise stack so nothing overflows.
  const sideBySide = (process.stdout.columns ?? 80) >= SIDE_BY_SIDE_MIN_COLS;

  return (
    <Box flexDirection="column" padding={1}>
      <Breadcrumbs active={1} />
      <Text bold>Choose a colour theme</Text>
      <Text dimColor>Sets the logo gradient and the work/break phase colours.</Text>
      <Box flexDirection={sideBySide ? 'row' : 'column'} marginTop={1}>
        <Box flexDirection="column">
          {VALID_PALETTE_NAMES.map((name, index) => {
            const isSelected = index === paletteIndex;
            const isSaved = initial?.palette === name;
            const meta = PALETTE_META[name];
            return (
              <Box key={name} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text {...(isSelected ? { bold: true } : {})}>
                    {isSelected ? '▸ ' : '  '}
                    {meta.label}
                  </Text>
                  <Text>{`  ${swatch(name)}`}</Text>
                  {isSaved ? <Text>{' ●'}</Text> : null}
                </Box>
                <Text dimColor>{`    ${meta.description}`}</Text>
              </Box>
            );
          })}
          <Footer
            hints={[
              { key: '↑↓', label: 'preview' },
              { key: 'Enter', label: 'continue' },
              { key: 'Esc', label: 'back' },
              { key: 'Q', label: 'quit' },
            ]}
          />
        </Box>
        <ThemePreview paletteName={selectedPalette} stacked={!sideBySide} />
      </Box>
    </Box>
  );
};

/**
 * Renderer abstraction: the production renderer is ink's `render`; tests inject
 * ink-testing-library's `render` to drive the wizard headlessly via stdin. The
 * adapter only needs to mount an element — the return shape is opaque here.
 */
export type WizardRenderer = (element: React.ReactElement) => unknown;

const defaultRenderer: WizardRenderer = (element) =>
  inkRender(element, { exitOnCtrlC: false });

/**
 * Mounts the Ink wizard, persists the result via the injected ConfigWritePort,
 * and resolves once the user completes or quits.
 *
 * `renderer` defaults to ink's real `render`. Tests inject ink-testing-library's
 * `render` (which returns a `stdin` to drive keystrokes) so the flow can be
 * exercised headlessly without a TTY.
 */
export class SetupWizardAdapter {
  constructor(
    private readonly _configWriter: ConfigWritePort,
    private readonly _renderer: WizardRenderer = defaultRenderer,
  ) {}

  run(props: Omit<SetupWizardProps, 'onComplete' | 'onQuit'>): Promise<WizardResult | null> {
    return new Promise<WizardResult | null>((resolve) => {
      const handleComplete = (result: WizardResult): void => {
        // Atomic full-write of the six-key config. Graceful-degrade (DD-8): a write
        // failure must NOT crash the wizard — surface a clear error and still resolve
        // the in-memory result so the composition root can launch the session anyway.
        try {
          this._configWriter.write(result);
        } catch (error) {
          process.stderr.write(
            `chromato: could not save your config (${(error as Error).message}). ` +
              'Starting your session with the choices you just made — re-run `chromato setup` to retry saving.\n',
          );
        }
        resolve(result);
      };
      const handleQuit = (): void => {
        resolve(null);
      };
      const element = React.createElement(SetupWizard, {
        ...props,
        onComplete: handleComplete,
        onQuit: handleQuit,
      });
      this._renderer(element);
    });
  }
}
