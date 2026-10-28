from datetime import datetime, timedelta, timezone

from fire_edge.models import AlertEvent, AlertLevel, PoseSnapshot, SensorValues
from fire_edge.replay_store import ReplayStore
from fire_edge.twin_state import HeatmapEngine, RiskZone
from fire_edge.vision_worker import VisionGate, VisionObservation


def test_vision_gate_requires_five_hits_in_seven_frames() -> None:
    gate = VisionGate(window_size=7, required_hits=5, confidence_threshold=0.75)

    results = [
        gate.observe(VisionObservation(frame_id=f"f-{index}", label="smoke", confidence=confidence))
        for index, confidence in enumerate([0.8, 0.8, 0.4, 0.8, 0.8, 0.8, 0.4])
    ]

    assert results[-1] is not None
    assert results[-1].label == "smoke"
    assert results[-1].hit_count == 5


def test_vision_gate_does_not_confirm_below_threshold() -> None:
    gate = VisionGate(window_size=7, required_hits=5, confidence_threshold=0.75)

    results = [
        gate.observe(VisionObservation(frame_id=f"f-{index}", label="fire", confidence=0.74))
        for index in range(7)
    ]

    assert all(result is None for result in results)


def test_heatmap_decays_by_half_life() -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    event = AlertEvent(
        event_id="evt-1",
        level=AlertLevel.P3,
        sensor_values=SensorValues(temperature_c=32.0),
        pose=PoseSnapshot(x=2.0, y=3.0),
        created_at=now,
    )
    engine = HeatmapEngine(spatial_radius_m=1.5, half_life_s=300)

    fresh = engine.build([event], [], now)[0].intensity
    decayed = engine.build([event], [], now + timedelta(seconds=300))[0].intensity

    assert fresh == 1.0
    assert 0.49 < decayed < 0.51


def test_replay_store_round_trips_event_and_frames(tmp_path) -> None:
    store = ReplayStore(tmp_path / "edge.db", tmp_path / "raw.jsonl")
    event = AlertEvent(event_id="evt-2", level=AlertLevel.P2)
    store.record_event(event)
    store.record_frame(event_id=event.event_id, payload={"timestamp": "2026-01-01T00:00:00Z", "heat_points": []})

    assert store.get_event(event.event_id)["event_id"] == "evt-2"
    assert len(store.get_replay(event.event_id)) == 1
    store.close()
