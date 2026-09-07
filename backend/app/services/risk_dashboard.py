"""Milestone 4 Phase 4, task 107 - the traffic-light heuristic behind a
team member's risk-and-support dashboard.

The spec ("derived from open alert severity + open action count") leaves
the exact thresholds undefined - a business-rule decision nobody has made
yet. This is a defensible first default, isolated as a pure function (no DB,
no request context) so the real rule can be swapped in later without
touching the route or its tests.
"""

from __future__ import annotations

from typing import Literal

from app.models.tenant import AlertSeverity

_HIGH_SEVERITIES = (AlertSeverity.high, AlertSeverity.critical)
_RED_ACTION_THRESHOLD = 3
_AMBER_ACTION_THRESHOLD = 1

TrafficLightLevel = Literal["green", "amber", "red"]


def traffic_light(*, open_alert_severities: list[AlertSeverity], open_action_count: int) -> tuple[TrafficLightLevel, str]:
    """Returns (level, label) - always both. Never rely on colour alone
    (client accessibility ask), so there is deliberately no code path here
    that returns a level without its label."""
    has_high_severity_alert = any(severity in _HIGH_SEVERITIES for severity in open_alert_severities)
    if has_high_severity_alert or open_action_count >= _RED_ACTION_THRESHOLD:
        return "red", "Needs attention"
    if open_alert_severities or open_action_count >= _AMBER_ACTION_THRESHOLD:
        return "amber", "Watch"
    return "green", "On track"
