from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any, Iterable

from .models import TransportSample


def _link_name(transport: str) -> str | None:
    value = transport.upper()
    if "SF" in value or value == "SLE":
        return "SLE"
    if "WIFI" in value or "WI-FI" in value:
        return "Wi-Fi"
    return None


def _p95(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(round(0.95 * (len(ordered) - 1)))))
    return round(ordered[index], 3)


def summarize_transport_samples(samples: Iterable[TransportSample]) -> dict[str, Any]:
    grouped: dict[str, dict[str, TransportSample]] = defaultdict(dict)
    for sample in samples:
        link = _link_name(sample.transport)
        if link is None or sample.t2_receive_ns is None:
            continue
        current = grouped[sample.event_id].get(link)
        if current is None or sample.t2_receive_ns < (current.t2_receive_ns or sample.t2_receive_ns):
            grouped[sample.event_id][link] = sample

    paired: list[dict[str, Any]] = []
    for event_id, links in grouped.items():
        sle = links.get("SLE")
        wifi = links.get("Wi-Fi")
        if sle is None or wifi is None or sle.t2_receive_ns is None or wifi.t2_receive_ns is None:
            continue
        delta = round((sle.t2_receive_ns - wifi.t2_receive_ns) / 1_000_000, 3)
        paired.append({
            "event_id": event_id,
            "sle_receive_ns": sle.t2_receive_ns,
            "wifi_receive_ns": wifi.t2_receive_ns,
            "sle_minus_wifi_ms": delta,
            "winner": "SLE" if delta < 0 else "Wi-Fi" if delta > 0 else "TIE",
            "sle_retry_count": sle.retry_count,
            "wifi_retry_count": wifi.retry_count,
        })
    paired.sort(key=lambda item: item["event_id"])
    deltas = [float(item["sle_minus_wifi_ms"]) for item in paired]
    return {
        "paired_events": len(paired),
        "sle_wins": sum(item["winner"] == "SLE" for item in paired),
        "wifi_wins": sum(item["winner"] == "Wi-Fi" for item in paired),
        "ties": sum(item["winner"] == "TIE" for item in paired),
        "mean_abs_delta_ms": round(mean(abs(item) for item in deltas), 3) if deltas else 0.0,
        "p95_abs_delta_ms": _p95([abs(item) for item in deltas]),
        "samples": paired,
    }
