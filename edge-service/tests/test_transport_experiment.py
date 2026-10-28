from fire_edge.models import TransportSample
from fire_edge.transport_experiment import summarize_transport_samples


def test_pairs_same_event_across_sle_and_wifi_by_receive_timestamp() -> None:
    summary = summarize_transport_samples(
        [
            TransportSample(event_id="e1", transport="C-SF", t0_device_ms=1, t2_receive_ns=1_000_000_000),
            TransportSample(event_id="e1", transport="C-WIFI", t0_device_ms=1, t2_receive_ns=1_012_000_000),
            TransportSample(event_id="e2", transport="C-SF", t0_device_ms=2, t2_receive_ns=2_030_000_000),
            TransportSample(event_id="e2", transport="C-WIFI", t0_device_ms=2, t2_receive_ns=2_000_000_000),
        ]
    )

    assert summary["paired_events"] == 2
    assert summary["sle_wins"] == 1
    assert summary["wifi_wins"] == 1
    assert summary["samples"][0]["event_id"] == "e1"
    assert summary["samples"][0]["sle_minus_wifi_ms"] == -12.0


def test_unpaired_events_are_not_counted_as_formal_ab_samples() -> None:
    summary = summarize_transport_samples(
        [TransportSample(event_id="only-sle", transport="C-SF", t0_device_ms=1, t2_receive_ns=1_000_000_000)]
    )

    assert summary["paired_events"] == 0
    assert summary["samples"] == []
