# Journey: Palette Selection -- Visual Map

**Feature ID**: palette-themes
**Journey**: Palette Selection (existing chromato user applies a named palette)
**Persona**: Aiko Tanaka -- staff engineer, VS Code + iTerm2, r/unixporn and dotfiles aesthetic, catppuccin across her terminal but selects `lavender` in chromato (same purple/mauve mood); wants chromato to match without forking
**Wave**: DISCUSS
**Date**: 2026-05-30

---

## Emotional Arc

```
Emotional state:
  Bothered        Curious          Confident        Delighted        Proud
  (incoherence)   (discovery)      (setup)          (first render)   (shared)

  [STEP 1]  -->  [STEP 2]  -->  [STEP 3]  -->  [STEP 4]  -->  [STEP 5]
  Notice          Discover         Configure        Verify           Share
  Incoherence     --palette        palette in       coherent         screenshot
                  via --help       config.json      render           on r/unixporn
```

**Arc pattern**: Problem Relief -> Discovery Joy
Start: Bothered/Frustrated (surface incoherence feels unfinished) | Middle: Curious -> Confident (palette flag is discoverable; config is one line) | End: Delighted -> Proud (screenshot is publication-worthy)

**Emotional arc rationale**: Aiko already loves chromato for its timer function but is nagged by the logo/bar color mismatch. Discovering `--palette` is a moment of relief. Confirming the flag works in a trial run builds confidence. Persisting the choice in config.json closes the loop. Seeing the coherent lavender render for the first time is the delight peak. Sharing the screenshot is the social payoff.

---

## Journey Flow (ASCII)

```
[chromato is running; logo renders deep-ocean, bar renders cyan-ish]
         |
         | "the logo and bar don't match my catppuccin setup"
         v
  +--[STEP 1: NOTICE INCOHERENCE]---------+
  |  chromato start                        |
  |  Logo: deep-ocean #023e8a gradient     |
  |  Bar: separate per-phase cyan/blue     |
  |  iTerm2 theme: catppuccin Mauve/Lav.   |
  |  (wants chromato to match: lavender)   |
  |  Feels: Bothered -- "looks like two    |
  |  different programs"                   |
  +----------------------------------------+
         |
         | chromato --help (or chromato start --help)
         v
  +--[STEP 2: DISCOVER --palette]---------+
  |  --palette <name>  Select color        |
  |    palette (ocean, lavender,           |
  |    berry, forest)                      |
  |                                        |
  |  EXAMPLES                              |
  |    chromato start --palette lavender   |
  |    chromato start --palette ocean      |
  |                                        |
  |  Feels: Curious -> "oh, this exists"   |
  +----------------------------------------+
         |
         | chromato start --palette lavender
         v
  +--[STEP 3: TRIAL RUN]-----------------+
  |  Logo: lavender gradient renders      |
  |  Bar: lavender phase colors render    |
  |  Both surfaces visually unified       |
  |                                       |
  |  Feels: Confident -- "this is what    |
  |  I wanted"                            |
  +----------------------------------------+
         |
         | Edit ~/.config/chromato/config.json
         v
  +--[STEP 4: PERSIST IN CONFIG]----------+
  |  {                                     |
  |    "palette": "lavender"               |
  |  }                                     |
  |                                        |
  |  chromato start (no flag needed)       |
  |  Both surfaces render lavender         |
  |                                        |
  |  Feels: Confident -> Satisfied         |
  +----------------------------------------+
         |
         | Screenshot iTerm2 with chromato running
         v
  +--[STEP 5: SHARE SCREENSHOT]----------+
  |  r/unixporn post:                     |
  |  "chromato + lavender + my            |
  |  neovim setup -- config snippet in    |
  |  comments"                            |
  |                                       |
  |  Feels: Proud -- aesthetic coherence  |
  |  achieved; shareable dotfiles         |
  +----------------------------------------+
```

---

## Error Path: Unknown Palette Name

```
[Aiko tries a palette name she is not sure about]
         |
         | chromato start --palette noop
         v
  +--[ERROR: UNKNOWN PALETTE NAME]-------+
  |  Error: unknown palette "noop"        |
  |                                       |
  |  Valid palette names:                 |
  |    ocean (default)                    |
  |    lavender                           |
  |    berry                              |
  |    forest                             |
  |                                       |
  |  Exit code: 1                         |
  |  No session starts                    |
  |                                       |
  |  Feels: Corrected, not punished       |
  |  -- error is a menu, not a wall       |
  +----------------------------------------+
         |
         | chromato start --palette lavender
         v
  [Session starts with correct palette]
```

---

## Error Path: NO_COLOR Override

```
[Aiko runs chromato in a script or CI context]
         |
         | NO_COLOR=1 chromato start
         v
  +--[NO_COLOR PATH]---------------------+
  |  NO_COLOR detected before palette     |
  |  resolution                           |
  |  Palette setting ignored              |
  |  No ANSI sequences in any output      |
  |  All functional info present          |
  |  (phase label, timer, session count)  |
  |                                       |
  |  Feels: Expected -- "CI works"        |
  +----------------------------------------+
```

---

## TUI Mockups by Step

### Step 1: Default Rendering (Surface Incoherence)

```
+-- chromato start (default / no palette) ─────────────────────+
|                                                                |
|  ██████╗██╗  ██╗██████╗  ██████╗ ███╗   ███╗ █████╗ ████████╗|
|  [rows 2-6 in deep-ocean gradient: #023e8a → #caf0f8]        |
|                                                                |
|  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                |
|  Focus in full colour                                          |
|  Work, break, repeat — right in your terminal                  |
|                                                                |
|  ┌────────────────────────────────────────────────────────┐   |
|  │  POMODORO 1 of 4         WORK              25:00       │   |
|  │  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │   |
|  │  [bar fill color: #00d7ff / phase-specific cyan]       │   |
|  └────────────────────────────────────────────────────────┘   |
|                                                                |
|  Logo: ${PALETTE_GRADIENT[0..5]} from palette.gradient        |
|  Bar: ${PALETTE_PHASES.WORK.fg} from palette.phases.WORK      |
|                                                                |
|  NOTE: default ocean gradient ≠ phase cyan -- incoherence     |
+────────────────────────────────────────────────────────────────+

Emotional state: Bothered ("two different programs")
```

### Step 2: --help with --palette documented

```
+-- chromato --help ───────────────────────────────────────────+
|                                                               |
|  chromato - Focus in full colour                              |
|                                                               |
|  USAGE                                                        |
|    chromato [command] [flags]                                 |
|                                                               |
|  FLAGS                                                        |
|    -w, --work      Work duration in minutes   [default: 25]  |
|    -b, --break     Short break in minutes     [default: 5]   |
|        --palette   Color palette name         [default: ocean]|
|                    ocean | lavender | berry | forest           |
|        --no-color  Disable all color output                  |
|    -h, --help      Show this help message                     |
|                                                               |
|  EXAMPLES                                                     |
|    chromato start                   # default ocean palette   |
|    chromato start --palette lavender                          |
|    chromato start --palette berry                             |
|                                                               |
|  CONFIGURATION                                                |
|    ~/.config/chromato/config.json:                            |
|    { "palette": "lavender" }                                  |
|    Precedence: --palette flag > $CHROMATO_PALETTE > config    |
+───────────────────────────────────────────────────────────────+

Shared artifacts: ${VALID_PALETTE_NAMES}, ${CONFIG_FILE_PATH}
Emotional state: Curious -> "this exists, let me try it"
```

### Step 3: Trial Run -- lavender Applied

```
+-- chromato start --palette lavender ─────────────────────────+
|                                                               |
|  ██████╗██╗  ██╗██████╗  ██████╗ ███╗   ███╗ █████╗ ████████╗|
|  [rows in lavender gradient: purple/mauve family]             |
|                                                               |
|  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔               |
|  Focus in full colour                                         |
|  Work, break, repeat — right in your terminal                 |
|                                                               |
|  ┌────────────────────────────────────────────────────────┐  |
|  │  POMODORO 1 of 4         WORK              25:00       │  |
|  │  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  |
|  │  [bar fill: lavender WORK phase fg -- same family]     │  |
|  └────────────────────────────────────────────────────────┘  |
|                                                               |
|  Logo gradient source: palette.gradient (lavender)           |
|  Bar phase colors source: palette.phases.WORK (lavender)     |
|  Both surfaces: same palette struct, zero divergence         |
+───────────────────────────────────────────────────────────────+

Emotional state: Confident -- "logo and bar look like one thing"
Integration checkpoint: IC-PT-1 (gradient === phases same palette)
```

### Step 4: Config File Persistence

```
+-- ~/.config/chromato/config.json ───────────────────────────+
|                                                              |
|  {                                                           |
|    "palette": "lavender"                                     |
|  }                                                           |
|                                                              |
+──────────────────────────────────────────────────────────────+

+-- chromato start (no flag) ─────────────────────────────────+
|  [lavender palette applied automatically]                    |
|  Precedence: no flag -> no env -> config key read -> lavender|
+──────────────────────────────────────────────────────────────+

Shared artifacts: ${CONFIG_FILE_PATH} = ~/.config/chromato/config.json
                  ${PALETTE_NAME} = "lavender"
Emotional state: Satisfied -- "it just works now"
```

### Step 5: Error Path -- Unknown Palette Name

```
+-- chromato start --palette noop ────────────────────────────+
|                                                              |
|  Error: unknown palette "noop"                               |
|                                                              |
|  Valid palette names:                                        |
|    ocean (default)                                           |
|    lavender                                                  |
|    berry                                                     |
|    forest                                                    |
|                                                              |
|  Exit: 1                                                     |
|  (no session started)                                        |
+──────────────────────────────────────────────────────────────+

Emotional state: Corrected not punished -- error is a discovery surface
```

---

## Integration Checkpoints

| Checkpoint | What must be validated | Risk if missed |
|------------|----------------------|----------------|
| IC-PT-1 | Logo gradient and bar phase colors are resolved from the same palette struct (not independent hardcoded constants) | Surface incoherence: the problem we are solving recurs |
| IC-PT-2 | Default ocean palette renders per the refined `palette-spec.md` spec; milestone-1-visual-progress and milestone-2 visual baselines rebaselined to new ocean colors in Phase A | Unintended further visual change after the rebaseline; trust eroded |
| IC-PT-3 | Precedence chain (flag > env > config > default) resolves correctly; config key does not override flag | User sets flag but config key wins; palette behaves unpredictably |
| IC-PT-4 | NO_COLOR check fires before palette resolution; palette config is never applied in NO_COLOR mode | CI/script contexts emit ANSI sequences; breaks piped output |
| IC-PT-5 | Unknown palette name exits with code 1 BEFORE any session state is initialized | Session starts on wrong palette; partial state written |
