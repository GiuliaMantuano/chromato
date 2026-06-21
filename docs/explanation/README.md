# Explanation Documents

Explanation documents answer "why?" They explore design decisions, architectural choices, and conceptual foundations. They build understanding of the bigger picture.

## Documents in This Directory

### chromato-pomodoro-phases.md
**Audience**: Terminal developers using chromato

**Purpose**: Explains how all five Pomodoro phases (IDLE, WORK, BREAK, LONG_BREAK, OVERDUE) connect as a system, why each exists, and what design philosophy shapes their interaction.

**Key Concepts**:
- The five phases as a first-class peer system (discriminated union in the state machine)
- IDLE as the starting and stopping state
- WORK as the productivity engine (where completedToday increments)
- BREAK and LONG_BREAK as mandatory recovery phases (5 min and 15 min defaults)
- cycleCount mechanism (LONG_BREAK every Nth completed session)
- The countdown vs. count-up contrast (WORK/BREAK count down; OVERDUE counts up with +MM:SS)
- OVERDUE as unbounded, escalating phase with no auto-forward transition
- Design philosophy: non-negotiable visibility without coercion
- Persistence of state and session count across process restarts
- Color scheme per phase and accessibility requirements

**Related Documents**:
- See [Tutorial: Getting Started] for hands-on first steps (when available)
- See [How-to: Customize Durations] for task-focused guidance on configuration (when available)
- See [Reference: CLI Commands] for API details (when available)
- See [Design: Architecture] for technical implementation details
