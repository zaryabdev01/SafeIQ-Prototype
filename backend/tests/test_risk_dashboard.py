"""Milestone 4 Phase 4, task 107 - pure unit tests for the traffic-light
heuristic. No DB, no request context - these run anywhere pytest does."""

from __future__ import annotations

from app.models.tenant import AlertSeverity
from app.services.risk_dashboard import traffic_light


def test_green_when_nothing_open() -> None:
    assert traffic_light(open_alert_severities=[], open_action_count=0) == ("green", "On track")


def test_amber_with_a_low_severity_alert() -> None:
    assert traffic_light(open_alert_severities=[AlertSeverity.low], open_action_count=0) == ("amber", "Watch")


def test_amber_with_one_or_two_open_actions() -> None:
    assert traffic_light(open_alert_severities=[], open_action_count=1) == ("amber", "Watch")
    assert traffic_light(open_alert_severities=[], open_action_count=2) == ("amber", "Watch")


def test_red_with_a_high_or_critical_severity_alert() -> None:
    assert traffic_light(open_alert_severities=[AlertSeverity.high], open_action_count=0) == ("red", "Needs attention")
    assert traffic_light(open_alert_severities=[AlertSeverity.critical], open_action_count=0) == ("red", "Needs attention")


def test_red_with_three_or_more_open_actions() -> None:
    assert traffic_light(open_alert_severities=[], open_action_count=3) == ("red", "Needs attention")
    assert traffic_light(open_alert_severities=[], open_action_count=10) == ("red", "Needs attention")


def test_high_severity_alert_wins_even_with_few_actions() -> None:
    assert traffic_light(open_alert_severities=[AlertSeverity.medium, AlertSeverity.critical], open_action_count=0) == (
        "red",
        "Needs attention",
    )


def test_always_returns_a_non_empty_label_never_just_a_level() -> None:
    """Client accessibility ask: never rely on colour (the `level`) alone."""
    cases = [
        traffic_light(open_alert_severities=[], open_action_count=0),
        traffic_light(open_alert_severities=[AlertSeverity.medium], open_action_count=0),
        traffic_light(open_alert_severities=[AlertSeverity.critical], open_action_count=5),
    ]
    for level, label in cases:
        assert level in ("green", "amber", "red")
        assert label
