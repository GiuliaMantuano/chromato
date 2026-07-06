-- Measurement window: edit these dates (ISO). Baseline = pre-ship window; comparison = post-ship window.
-- Q1: context — sessions and pomodoros in the window (works on TODAY's schema already)
SELECT COUNT(*) AS sessions, COALESCE(SUM(completed_pomodoros), 0) AS pomodoros
FROM sessions
WHERE recorded_at >= '2026-07-05' AND recorded_at < '2026-08-05';

-- Q2: KPI 1 — OVERDUE episodes per session (requires the overdue_episodes table)
SELECT
  (SELECT COUNT(*) FROM overdue_episodes
    WHERE recorded_at >= '2026-07-05' AND recorded_at < '2026-08-05') AS overdue_episodes,
  (SELECT COUNT(*) FROM sessions
    WHERE recorded_at >= '2026-07-05' AND recorded_at < '2026-08-05') AS sessions,
  ROUND(
    (SELECT COUNT(*) * 1.0 FROM overdue_episodes
      WHERE recorded_at >= '2026-07-05' AND recorded_at < '2026-08-05')
    / MAX(1, (SELECT COUNT(*) FROM sessions
      WHERE recorded_at >= '2026-07-05' AND recorded_at < '2026-08-05')), 3) AS entries_per_session;

-- Q3: KPI 2 — median OVERDUE episode duration in seconds (requires overdue_episodes)
SELECT duration_seconds AS median_overdue_seconds
FROM overdue_episodes
WHERE recorded_at >= '2026-07-05' AND recorded_at < '2026-08-05'
ORDER BY duration_seconds
LIMIT 1
OFFSET (SELECT (COUNT(*) - 1) / 2 FROM overdue_episodes
        WHERE recorded_at >= '2026-07-05' AND recorded_at < '2026-08-05');

-- Q4: context that works today — daily activity (NOT an OVERDUE proxy; trend context only)
SELECT date(recorded_at, 'localtime') AS day, COUNT(*) AS sessions, SUM(completed_pomodoros) AS pomodoros
FROM sessions GROUP BY day ORDER BY day DESC LIMIT 30;
