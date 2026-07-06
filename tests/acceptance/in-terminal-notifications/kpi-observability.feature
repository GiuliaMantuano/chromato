# KPI observability: the overdue-episode trend measurement is emittable
#
# Feature ID : in-terminal-notifications
# Wave       : DISTILL | Date: 2026-07-04
# Traceability: kpi-1 / kpi-2 (docs/product/kpi-contracts.yaml), DEVOPS
#               required_delta (overdue_episodes table), Owner decision
#               Option B (ship now, trend after — 2026-07-04)
#
# Per the owner's Option B decision, the additive overdue_episodes table
# ships WITH the feature (DELIVER scope, zero telemetry, owner-local only).
# This scenario verifies the measurement EVENT IS PRODUCIBLE — one episode
# row per OVERDUE episode, written when the episode ends or the session
# exits while overdue — not any monitoring infrastructure. Without it,
# kpi-1 (post-ship overdue-entry trend) and kpi-2 (median overdue duration
# ≤60s) have no data source.
#
# The session history DB is the user-facing KPI surface (the owner queries
# it with scripts/kpi-baseline.sql), so asserting the recorded episode IS
# the observable outcome at the driven-port boundary.

@in-terminal-notifications @slice-03 @kpi
Feature: A missed break leaves a measurable trace in the session history

  @real-io @env-E2
  Scenario: An overdue episode is recorded when the session ends while overdue
    Given chromato is installed for in-terminal notifications
    When the user runs a session that falls overdue and then ends it
    Then the session history records one overdue episode with its duration
