# The OVERDUE Phase: Why Chromato Doesn't Let Breaks Go Unnoticed

## Overview

When you finish a work session in chromato, your timer transitions to BREAK or LONG_BREAK depending on where you are in your Pomodoro cycle. You've earned your rest. But what happens if you don't take it — if the break timer counts down to zero and you're still working?

Most timers would simply reset or wait for you to acknowledge. Chromato does something different. It enters a phase called OVERDUE.

OVERDUE is not a failure state, and it's not a punishment. It is a distinct phase in chromato's state machine, designed to make one thing unmistakable: your break has expired, and you are aware of that fact. The design reflects a particular philosophy about how a tool should behave — one rooted in the Pomodoro Technique's core principle that breaks are not optional extras, but structural elements essential to sustained productivity.

---

## The Philosophy: Visibility Without Coercion

The Pomodoro Technique, created by Francesco Cirillo, rests on a simple insight: focused work followed by complete rest creates a sustainable rhythm. The breaks are not pauses you can skip when you're "on a roll." They are part of the system. Without them, the cycle breaks down.

But enforcing breaks is a design problem. A timer that locks your keyboard and forces you to step away is frustrating — it violates your agency as a developer. A timer that gently reminds you and then moves on is ignorable — you might not even notice it's time.

Chromato chooses a third path: **non-negotiable visibility without coercion**. The tool will not prevent you from continuing to work during or past your break. It is a terminal application; you could ignore it or kill it if you wanted to. But it will make it impossible for you to miss that your break has ended.

This is the purpose of OVERDUE. When your break timer reaches zero, chromato does not reset. It does not fade to the background. Instead, it enters a state of escalating, persistent visual alarm — a state that says: "I'm telling you the break has expired. What you do with that information is your choice."

---

## Why OVERDUE Exists: The User Research

The design of OVERDUE emerged from studying how terminal developers actually use Pomodoro timers.

One archetype stands out: the staff engineer with a physical health dependency on breaks. This person — call them P2 — works in a high-focus environment. They are good at entering flow states and staying there. But sustained concentration, without rest and movement, causes them real physical problems. They need the Pomodoro timer not as a nice-to-have productivity tool, but as a health intervention.

For P2, a break that goes unnoticed is worse than having no timer at all. If the timer quietly expires and they keep working, they've lost the protection the technique provides. They might not realize 15 minutes has passed until an hour has, and the damage is done.

This is where OVERDUE comes in. The phase exists because P2 — and users like P2 — need a signal that is impossible to ignore. Not a gentle notification. Not a countdown that resets. An unmistakable, persistent, escalating visual statement: "Your break is over. You are still working."

---

## What OVERDUE Looks Like

When OVERDUE activates, chromato's visual behavior changes dramatically.

The progress bar — normally a cyan-to-green gradient during WORK, or blue-to-indigo during BREAK — becomes **pure red**. But it does not stay static. Every two seconds, the bar pulses: solid red, then dimmed, then solid red again. This pulse cycle is deliberate. The repetition at regular intervals captures peripheral vision in a way that a static bar cannot.

The progress bar is also always full. Unlike the WORK and BREAK phases, where the bar fills progressively from left to right as time passes, OVERDUE shows 100% fill from the moment it activates. This conveys a sense of "something is maxed out" — tension that needs resolution.

The timer display changes too. During WORK and BREAK, you see a countdown: how many minutes and seconds remain. During OVERDUE, the display becomes an **upward counter**: `+00:05`, `+00:10`, `+00:15`. The plus sign emphasizes that this is not time remaining — it is time spent past the boundary. As the counter climbs, it becomes a visible measure of how long you have been ignoring the signal.

Finally, the phase label is always visible as text. The word **"OVERDUE"** appears alongside the red bar. This is critical for accessibility. Even if color-blindness or terminal configuration differences make the red less vivid, the text label makes the state unmistakable.

When OVERDUE activates, your system also receives a desktop notification: "Your break is over." If you remain in OVERDUE for a full minute, a second notification arrives: "Still working? Take a break now." These notifications are part of the graduated escalation — an immediate alert at the boundary, then a gentle follow-up reminder if you missed the first signal.

---

## How OVERDUE Differs from WORK and BREAK

To understand why OVERDUE is its own distinct phase — and not just a variant of BREAK — consider how the three active phases relate to time.

**WORK** counts down. You configure a work interval (typically 25 minutes). The timer descends from `25:00` toward `00:00`. The progress bar fills as time elapses. At zero, the phase ends automatically. WORK has a clear endpoint, defined by your configuration.

**BREAK** also counts down. You configure a break duration (typically 5 minutes). The timer descends from `05:00` toward `00:00`. At zero, the phase would end automatically — but here's the critical detail: BREAK does not transition back to WORK. Instead, it transitions to OVERDUE.

**OVERDUE** has no countdown and no preconfigured duration. Instead, it counts *upward*: `00:00`, `00:01`, `00:02`... The progress bar is permanently full. There is no timer ticking down toward resolution. The phase cannot resolve itself. It persists until you act — until you supply the user input that says: "I acknowledge the break has ended; let me continue."

This difference is conceptually important. WORK and BREAK are *bounded* — they have a defined length, and they progress toward completion. OVERDUE is *unbounded* — it is the system's representation of an open question that only you can answer. It is chromato asking: "What happens next?" and waiting for your response.

---

## The Current User Experience: Ctrl+C

In chromato v1.0, there is only one way to exit OVERDUE: **Ctrl+C**. This stops the entire process.

This is a deliberate limitation, not an oversight. The Ctrl+C exit means that to continue your Pomodoro session after a break expires, you must:

1. Press Ctrl+C to stop the timer
2. Run `chromato start` again to begin the next work interval

This might sound cumbersome, but it serves a purpose. The interruption — the act of stopping, the half-second of re-launching — is a deliberate friction point. It ensures that re-entering the timer after an expired break is not an absentminded key press. It is a conscious decision.

Additionally, your session data is preserved. When you stop and restart, chromato remembers how many Pomodoros you have completed today and maintains your streak. The friction is in the re-launch, not in data loss.

---

## The Future: Keystroke Dismissal (Post-v1.0)

The roadmap includes a post-v1.0 feature — currently planned for step 09-01 — that will reduce this friction. In a future release, you will be able to press **Enter** or **Space** while OVERDUE is active to dismiss the phase and immediately start the next work interval, without exiting the process.

The domain model already supports this transition. The `PhaseStateMachine` class includes a `completeBreak()` method that transitions from BREAK to WORK. When 09-01 ships, the TUI layer will intercept the Enter/Space keypress and invoke this domain method, allowing you to continue the session without restarting.

This feature was deferred to v1.0 to reduce complexity during the initial delivery. In the shipping version, Ctrl+C is the only way out. But the design was built with this future capability in mind, so the transition is architecturally straightforward.

---

## Connection to Pomodoro Philosophy

The Pomodoro Technique is not just a time-management gimmick. It rests on a specific theory of productivity: sustained focus requires rhythmic rest.

The traditional Pomodoro structure is rigid: 25 minutes of work, 5-minute break, repeat. After four cycles, take a longer 15-minute break. The rigidity is the point. You do not negotiate whether you "feel like" taking a break. You take it because the system says so.

But here is the tension that chromato is designed to navigate: the Pomodoro Technique depends on its rigor, but modern tools cannot enforce rigor through coercion. A keyboard lock-out is hostile. A hidden reminder is ignorable.

OVERDUE is chromato's answer. It enforces rigor through *visibility*. The technique says breaks are non-negotiable. Chromato cannot force you to stop working, but it can make it impossible to claim you did not know the break was over.

In this way, OVERDUE is an expression of respect for the user — for you, the terminal developer. Chromato trusts you to make your own decision about whether to take the break. But it does not let you make that decision by accident. The pulsing red bar, the climbing counter, the notifications, the "OVERDUE" label — all of these are chromato saying: "The Pomodoro structure says you have earned rest. You are aware of that fact. The choice is yours."

---

## Accessibility: Color Is Not Enough

One more detail: OVERDUE's visual design includes explicit support for users who are colorblind or who have terminal color configuration differences.

The phase label "OVERDUE" is always rendered as text, not as a color-only indicator. The red bar might be rendered differently depending on terminal capabilities, but the word "OVERDUE" is unambiguous. This ensures that the state is conveyed through multiple channels — color, plus text — so that no user can miss it due to color perception differences or terminal settings.

---

## Summary

The OVERDUE phase exists because some Pomodoro timers are just reminders, but chromato is designed as a structural support for your productivity rhythm.

OVERDUE is not a failure state. It is not a punishment for bad time management. It is a distinct phase that acknowledges a specific user need: the need to know, with absolute certainty, that your break has expired. The pulsing red bar, the upward counter, the notifications, and the text label all work together to create a visual and auditory statement that cannot be ignored.

This design reflects a deeper philosophy: the Pomodoro Technique's core principle — that breaks are structural, not optional — can be honored through visibility without coercion. Chromato will not force you to rest, but it will never let a break go unnoticed.
