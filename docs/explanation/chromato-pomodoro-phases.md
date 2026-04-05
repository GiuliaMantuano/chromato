# The Pomodoro Cycle in chromato: Understanding IDLE, WORK, BREAK, LONG_BREAK, and OVERDUE

When you run `chromato start`, you're launching a five-phase state machine. These phases are not isolated features — they form a connected rhythm that implements the Pomodoro Technique while adding one critical extension: the OVERDUE phase, which makes break expiry unmissable without coercing your behavior.

This document explores why these phases exist, how they connect, and what design philosophy shapes their interaction.

---

## The Five Phases

### IDLE: The Resting State

IDLE is where every session begins. When you first run `chromato start`, the timer exists in IDLE — a state of readiness waiting for the first pulse.

The moment the first `tick` occurs (which happens automatically, triggered by the rendering loop), IDLE immediately transitions to WORK. You'll never see IDLE linger on screen for long — it's a transient one-tick state. Its purpose is to act as a clean starting point: all elapsed counters reset to zero, and the work phase begins.

IDLE re-appears in one other circumstance: when you press Ctrl+C during any phase (WORK, BREAK, or OVERDUE). At that point, chromato moves the session back to IDLE and stops processing. The session is saved to disk with whatever progress you'd made. When you run `chromato start` again, the system will load that saved state and resume from where you left off.

Think of IDLE as the "off" state. It's the beginning, and it's the stop point.

### WORK: The Primary Phase

WORK is the core of the Pomodoro Technique. This is where focus happens.

When IDLE transitions to WORK on that first tick, the countdown timer begins. With default settings, you have 25 minutes. The progress bar fills slowly from left to right, rendered in cyan and green — colors meant to evoke focus and activity. As seconds tick by, the "Time: MM:SS" display counts down toward zero.

What makes WORK special is that it's the only phase where `completedToday` increments. The moment your 25 minutes expire and the timer reaches zero, two things happen simultaneously:

1. Your session count increases (you see "Today: 1" on the screen, then "Today: 2" after the next WORK phase ends, and so on)
2. The system transitions to either BREAK or LONG_BREAK, depending on how many work sessions you've already completed

This increment is permanent and persisted to disk, so even if you close chromato and restart it, your count survives. It's the foundation for the "daily sessions completed" metric.

WORK phases are all the same duration. The timer always counts down to the same configured length (25 minutes by default, but you can customize this with the `--work` flag).

### BREAK: Short Recovery

After WORK expires, you enter BREAK — a short recovery phase. With defaults, BREAK lasts 5 minutes.

The progress bar now renders in blue and indigo, colors that evoke calm and rest. The countdown timer again starts from a configured duration and ticks down to zero.

The crucial design detail: BREAK does not automatically lead back to WORK. This is intentional. When your 5-minute break is over, if you haven't explicitly acted to continue, chromato doesn't force the next work session to begin. Instead, it transitions to OVERDUE.

Why? Because the Pomodoro Technique treats breaks as non-negotiable structural rest. You're not allowed to skip them quietly. If you do, chromato makes sure you notice.

### LONG_BREAK: The Cycle Reward

After every N completed work sessions (default: every 4), you earn a LONG_BREAK instead of a regular BREAK.

With default settings, LONG_BREAK lasts 15 minutes — three times longer than a regular break. The progress bar renders in purple and teal, a color scheme visually distinct from both WORK and BREAK. This visual distinction reinforces the idea that you've completed a full cycle and earned an extended rest.

LONG_BREAK works identically to BREAK under the hood: the timer counts down from a configured duration, and when it expires (without user action), you enter OVERDUE.

The cycle is driven by the `cycleCount` parameter. With `cycleCount: 4`:

- After work session 1, 2, 3 → BREAK (5 min)
- After work session 4 → LONG_BREAK (15 min)
- After work session 5, 6, 7 → BREAK (5 min)
- After work session 8 → LONG_BREAK (15 min)
- And so on...

This count persists across restarts. If you close chromato after completing 3 sessions and restart it tomorrow within the same day, the 4th session will correctly trigger LONG_BREAK. The cycle state survives because `completedToday` is loaded from the persisted state file.

---

## The Countdown vs. Count-Up Contrast

Here's a fundamental design choice that shapes the entire experience:

**WORK, BREAK, and LONG_BREAK all count DOWN.** They have a configured duration. The progress bar fills from empty (0%) to full (100%) as time passes. The countdown timer displays "MM:SS" — time remaining. When the timer reaches zero, the phase ends automatically.

**OVERDUE counts UP.** It has no configured duration. The progress bar stays perpetually full (100%). The display switches from "MM:SS" (time remaining) to "+MM:SS" (time elapsed since break expiration). The plus sign is visual language: this number is not time remaining — it's time *past the deadline*.

Why this inversion matters: A countdown phase tells you "time is passing and will end." OVERDUE tells you "time has ended and nothing is happening." The growing `+MM:SS` counter makes the cost of inaction quantifiable. Each second that ticks by is visible proof that you're working during break.

---

## The Complete Cycle Arc

With default settings, a full cycle looks like this:

```
Start
  ↓
IDLE (1 tick) → transitions immediately
  ↓
WORK (25 min countdown)
  ↓ expires
  │ completedToday += 1
  ↓
BREAK (5 min countdown) — 1st break
  ↓ expires
  ↓
OVERDUE (counts up +MM:SS, pulsing red bar)
  ↓ you press Ctrl+C or (post-v1.0) Enter/Space
  ↓
IDLE → (restart chromato to continue)

─────────────────────────────────────────────

WORK (25 min countdown) — 2nd session
  ↓ expires
  │ completedToday = 2
  ↓
BREAK (5 min countdown) — 2nd break
  ↓ expires
  ↓
OVERDUE
  ↓ you press Ctrl+C
  ↓
IDLE → (restart to continue)

WORK (25 min countdown) — 3rd session
BREAK (5 min countdown) — 3rd break
OVERDUE
(and so on...)

─────────────────────────────────────────────
After 4 WORK sessions:

WORK (25 min countdown) — 4th session
  ↓ expires
  │ completedToday = 4
  │ completedToday % 4 === 0 → award LONG_BREAK
  ↓
LONG_BREAK (15 min countdown) — extended rest
  ↓ expires
  ↓
OVERDUE (counts up, pulsing red bar)
  ↓ you press Ctrl+C
  ↓
IDLE → cycle repeats
```

Every time a break phase expires, OVERDUE activates. There is no grace period. The moment your 5 or 15 minutes are up, the phase changes color and the counter switches to count-up mode.

---

## OVERDUE: Visibility Without Coercion

OVERDUE is the fifth phase and the heart of chromato's philosophy.

### What It Is

When your BREAK or LONG_BREAK timer reaches zero without you taking action to continue to the next WORK session, chromato doesn't silently end the break. It doesn't force you back to work. Instead, it enters OVERDUE — a perpetual phase that escalates your awareness that the break has ended.

OVERDUE is a first-class phase in the state machine, not a flag or a modifier. It has its own distinct visual identity:

- **Color**: A pulsing red bar with amber background. This color scheme is intentionally alarming and visually distinct from WORK (cyan/green) and BREAK (blue/indigo).
- **Animation**: The bar pulses between solid red and dim red every 2 seconds. The pulsing creates an unmissable ambient signal.
- **Counter**: The display switches to "+MM:SS" format. The plus sign emphasizes that this is *time past the deadline*, not time remaining.
- **Label**: The word "OVERDUE" is always displayed as bold text, ensuring that even colorblind users or users with `NO_COLOR` enabled can see the phase name.

### Why It Exists

The Pomodoro Technique is built on the idea that breaks are structural rest periods, not optional pauses. Skipping breaks erodes the technique's effectiveness — and the research that drives chromato includes a user persona (P2) with a physical health dependency on breaks.

But chromato respects your agency. It doesn't lock the keyboard, prevent you from typing, or force you to stop. You can keep working if you choose to. What chromato does instead is make that choice *visible*. The red pulsing bar is designed to be unmissable peripherally — you can't accidentally skip a break without noticing.

The design philosophy is: **non-negotiable visibility without coercion**. chromato says "I'm telling you that break time ended. What you do with that information is your choice."

### How Notifications Work

OVERDUE includes a two-stage notification system:

1. **At 0:00 overdue**: The moment your break expires, your system's desktop notification fires ("Time is up!" or similar). This is immediate feedback.
2. **At +1:00 overdue**: If you're still in OVERDUE after a full minute has passed without action, a second notification fires ("Still working? Take a break now." or similar). This is a follow-up reminder for users who missed or dismissed the first notification.

Beyond +1:00, no further notifications send. Continuous prompting becomes noise and defeats the purpose of an ambient signal.

### The Current Limitation: Ctrl+C Is the Only Exit in v1.0

In chromato v1.0, OVERDUE has only one exit: pressing Ctrl+C.

When you Ctrl+C during OVERDUE, the session moves back to IDLE and is saved. The session count (`completedToday`) and all state persist. To continue, you run `chromato start` again, which restarts the timer and moves from IDLE → WORK. The restart incurs no data loss — only the friction of re-launching the process.

This limitation is intentional and documented in the roadmap. The next planned feature (step 09-01, post-v1.0) will add keystroke dismissal: pressing Enter or Space during OVERDUE will transition directly to the next WORK session without exiting. But that requires careful keyboard event routing through the TUI layer, so it was deferred to reduce v1.0 delivery risk.

---

## The Cycle Count and Daily Session Tracking

The `cycleCount` parameter controls the position of the LONG_BREAK trigger within each cycle. With default `cycleCount: 4`, every 4th work session awards LONG_BREAK.

Importantly: `completedToday` is the authoritative counter for sessions completed, and it persists to disk. This counter increments at the moment each WORK phase expires, not when a break completes. So the "Today: N sessions" display reflects completed work blocks, and it survives process restarts.

The cycle position also persists. Because `completedToday` is loaded from the state file when chromato starts, the modulo arithmetic that decides BREAK vs. LONG_BREAK operates on the accurate count across restarts. If you completed 3 sessions yesterday, finished OVERDUE, and today run chromato again, the system still knows that today's first session is session 4 (if the date is the same) or session 1 (if the date changed).

---

## Colors as Communication

Each phase has a distinct color scheme:

- **WORK**: Cyan foreground / green background. Warm, energetic colors that signal "focus, activity, engagement."
- **BREAK**: Blue foreground / indigo background. Cool, calm colors that signal "rest, recovery, mental reset."
- **LONG_BREAK**: Purple foreground / teal background. Deeper, more extended colors that signal "extended earned rest" — visually distinct from the short break.
- **OVERDUE**: Red foreground / amber background. High-contrast alarming colors that signal "warning, deadline exceeded, action needed."
- **IDLE**: Grey. Neutral, indicating an inactive state.

These colors are never the only way chromato communicates phase information. The phase label is always rendered as text: "WORK", "BREAK", "LONG BREAK", "OVERDUE", "IDLE". This ensures that the display remains accessible to colorblind users and users who run with `NO_COLOR` enabled.

---

## The Design Philosophy in Action

The five-phase cycle, the countdown-to-count-up transition, the persistence of state, and the OVERDUE escalation all work together to achieve chromato's core UVP: **"The Pomodoro timer your terminal deserves."**

A terminal-native developer using chromato gets:

- **Ambient awareness**: Colors and animations update in your terminal window, visible from peripheral vision.
- **Unmissable escalation**: Breaks that expire become progressively harder to ignore (color change → pulsing → notification → second notification).
- **Persistence**: Your daily session count, the cycle position, and the current timer state all survive restarts.
- **Agency**: The system shows you what's happening but doesn't prevent you from continuing to work. The choice is informed and visible.
- **Rhythm**: The default 25-5-15 cycle mirrors the Pomodoro Technique, but you can customize all durations and the cycle length to match your preferences.

This is why OVERDUE exists, why it persists, why it pulses red, and why it's the only phase without an autonomous forward transition. It's chromato's way of saying: "Breaks matter. I'm here to make sure you notice."

---

## Summary: The Phases as a System

| Phase | Duration | Counter | Color | Transitions | Philosophy |
|-------|----------|---------|-------|-------------|-----------|
| **IDLE** | None | None | Grey | → WORK (first tick) or ← Any phase (Ctrl+C) | Ready state and stop state |
| **WORK** | 25 min (default) | Counts down | Cyan/green | → BREAK or LONG_BREAK (on expiry) | Focus and productivity |
| **BREAK** | 5 min (default) | Counts down | Blue/indigo | → OVERDUE (on expiry, no grace period) | Short recovery, mandatory |
| **LONG_BREAK** | 15 min (default) | Counts down | Purple/teal | → OVERDUE (on expiry, no grace period) | Extended recovery, earned |
| **OVERDUE** | Unlimited | Counts up (+MM:SS) | Red/amber (pulsing) | → Requires user action (Ctrl+C in v1.0) | Unmissable break expiry signal |

The cycle never lets a break go unnoticed. WORK drives the session count forward. BREAK and LONG_BREAK enforce rest. And OVERDUE ensures that if you choose to skip the rest, it's a conscious, visible choice — not an accident.

---

## Next Steps

Ready to get started? See the tutorial for your first session setup.

Want to understand the technical implementation? See the architecture design.

Need to customize durations or export session history? See the command reference.
