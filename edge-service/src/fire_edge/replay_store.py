from __future__ import annotations

import json
import sqlite3
from datetime import timezone
from pathlib import Path
from typing import Any

from .models import AlertEvent, TransportSample


class ReplayStore:
    def __init__(self, database_path: str | Path = "data/edge.db", jsonl_path: str | Path = "data/raw.jsonl") -> None:
        self.database_path = str(database_path)
        self.jsonl_path = Path(jsonl_path)
        if self.database_path != ":memory:":
            Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
            self.jsonl_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(self.database_path, check_same_thread=False)
        self.connection.execute("CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT)")
        self.connection.execute("CREATE TABLE IF NOT EXISTS replay_frames (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, payload TEXT NOT NULL)")
        self.connection.execute("CREATE TABLE IF NOT EXISTS transport_samples (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT, payload TEXT NOT NULL)")
        columns = {row[1] for row in self.connection.execute("PRAGMA table_info(events)")}
        if "created_at" not in columns:
            self.connection.execute("ALTER TABLE events ADD COLUMN created_at TEXT")
        for event_id, payload in self.connection.execute("SELECT event_id, payload FROM events WHERE created_at IS NULL").fetchall():
            event = AlertEvent.model_validate_json(payload)
            self.connection.execute(
                "UPDATE events SET created_at = ? WHERE event_id = ?",
                (self._sort_timestamp(event), event_id),
            )
        self.connection.execute("CREATE INDEX IF NOT EXISTS events_created_at ON events(created_at DESC)")
        self.connection.commit()

    @staticmethod
    def _sort_timestamp(event: AlertEvent) -> str:
        created_at = event.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return created_at.astimezone(timezone.utc).isoformat(timespec="microseconds")

    def record_event(self, event: AlertEvent) -> bool:
        """Keep the first event immutable when another receiver reports its ID."""
        payload = event.model_dump(mode="json")
        text = json.dumps(payload, ensure_ascii=False)
        cursor = self.connection.execute(
            "INSERT OR IGNORE INTO events(event_id, payload, created_at) VALUES (?, ?, ?)",
            (event.event_id, text, self._sort_timestamp(event)),
        )
        self.connection.commit()
        if cursor.rowcount:
            self._append_raw({"type": "event", "data": payload})
            return True
        return False

    def list_events(self, *, limit: int = 200, offset: int = 0) -> list[AlertEvent]:
        # Python query integers can exceed SQLite's signed 64-bit binding range.
        if offset > 2**63 - 1:
            return []
        rows = self.connection.execute(
            "SELECT payload FROM events ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [AlertEvent.model_validate_json(row[0]) for row in rows]

    def acknowledge_event(self, event_id: str) -> AlertEvent | None:
        # Update this field alone: confirming receipt never clears the risk,
        # replaces evidence, or changes an event's original creation time.
        with self.connection:
            cursor = self.connection.execute(
                "UPDATE events SET payload = json_set(payload, '$.acked', json('true')) "
                "WHERE event_id = ? AND json_extract(payload, '$.acked') IS NOT 1",
                (event_id,),
            )
            event = self.get_event(event_id)
        if event is None:
            return None
        if cursor.rowcount:
            self._append_raw({"type": "alert.updated", "data": event})
        return AlertEvent.model_validate(event)

    def record_frame(self, event_id: str | None, payload: dict[str, Any]) -> None:
        text = json.dumps(payload, ensure_ascii=False)
        self.connection.execute("INSERT INTO replay_frames(event_id, payload) VALUES (?, ?)", (event_id, text))
        self.connection.commit()
        self._append_raw({"type": "replay_frame", "event_id": event_id, "data": payload})

    def record_transport_sample(
        self,
        sample: TransportSample,
        *,
        raw_frame_hex: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        record = {
            "sample": sample.model_dump(mode="json"),
            "raw_frame_hex": raw_frame_hex,
            "payload": payload or {},
        }
        text = json.dumps(record, ensure_ascii=False)
        self.connection.execute(
            "INSERT INTO transport_samples(event_id, payload) VALUES (?, ?)",
            (sample.event_id, text),
        )
        self.connection.commit()
        self._append_raw({"type": "transport_sample", "event_id": sample.event_id, "data": record})

    def get_event(self, event_id: str) -> dict[str, Any] | None:
        row = self.connection.execute("SELECT payload FROM events WHERE event_id = ?", (event_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def get_evidence(self, event_id: str) -> dict[str, Any] | None:
        event = self.get_event(event_id)
        if event is None:
            return None
        rows = self.connection.execute(
            "SELECT payload FROM transport_samples WHERE event_id = ? ORDER BY id",
            (event_id,),
        ).fetchall()
        samples = [json.loads(row[0]) for row in rows]
        return {**event, "transport_samples": samples}

    def get_replay(self, event_id: str) -> list[dict[str, Any]]:
        rows = self.connection.execute("SELECT payload FROM replay_frames WHERE event_id = ? ORDER BY id", (event_id,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def list_transport_samples(self) -> list[TransportSample]:
        rows = self.connection.execute(
            "SELECT payload FROM transport_samples ORDER BY id"
        ).fetchall()
        result: list[TransportSample] = []
        for row in rows:
            record = json.loads(row[0])
            try:
                result.append(TransportSample.model_validate(record["sample"]))
            except (KeyError, TypeError, ValueError):
                continue
        return result

    def _append_raw(self, record: dict[str, Any]) -> None:
        if self.database_path == ":memory:":
            return
        with self.jsonl_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    def close(self) -> None:
        self.connection.close()
