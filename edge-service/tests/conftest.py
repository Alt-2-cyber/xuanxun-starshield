from __future__ import annotations

import importlib
import os

import pytest


# App imports happen during collection, before fixtures run. Never open the
# operator's configured database (or data/edge.db) just by collecting tests.
os.environ["EDGE_DB_PATH"] = ":memory:"


@pytest.fixture(autouse=True)
def edge_service(tmp_path, monkeypatch):
    edge = importlib.import_module("fire_edge.app")
    from fire_edge.replay_store import ReplayStore
    from fire_edge.twin_state import TwinState
    from fire_edge.vision_worker import OnnxVisionWorker, VisionGate

    monkeypatch.setenv("EDGE_DB_PATH", str(tmp_path / "edge.db"))
    monkeypatch.setenv("EDGE_RAW_LOG_PATH", str(tmp_path / "raw.jsonl"))
    monkeypatch.setenv("STARSHIELD_SERIAL_PORTS", "")
    monkeypatch.setenv("EDGE_ROS_ENABLE", "0")
    monkeypatch.setenv("ROS_BRIDGE_URL", "")
    store = ReplayStore(tmp_path / "edge.db", tmp_path / "raw.jsonl")
    monkeypatch.setattr(edge, "replay_store", store)
    monkeypatch.setattr(edge, "state", edge.EdgeState())
    monkeypatch.setattr(edge, "twin", TwinState())
    monkeypatch.setattr(edge, "vision_worker", OnnxVisionWorker(None))
    monkeypatch.setattr(edge, "vision_gate", VisionGate())
    yield edge
    edge.replay_store.close()
    store.close()
