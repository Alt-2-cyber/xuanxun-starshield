from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .models import VisionDetection, VisionStatus


@dataclass(frozen=True)
class VisionObservation:
    frame_id: str
    label: str
    confidence: float
    timestamp: datetime = datetime.now(timezone.utc)


@dataclass(frozen=True)
class VisionConfirmation:
    label: str
    confidence: float
    hit_count: int
    window_size: int
    frame_ids: tuple[str, ...]
    timestamp: datetime


class VisionGate:
    def __init__(self, window_size: int = 7, required_hits: int = 5, confidence_threshold: float = 0.75) -> None:
        if required_hits > window_size:
            raise ValueError("required_hits cannot exceed window_size")
        self.window_size = window_size
        self.required_hits = required_hits
        self.confidence_threshold = confidence_threshold
        self._windows: dict[str, deque[VisionObservation]] = defaultdict(
            lambda: deque(maxlen=self.window_size)
        )
        self._seen_frames: set[str] = set()

    def observe(self, observation: VisionObservation) -> VisionConfirmation | None:
        if observation.frame_id in self._seen_frames:
            return None
        self._seen_frames.add(observation.frame_id)
        window = self._windows[observation.label]
        window.append(observation)
        hits = [item for item in window if item.confidence >= self.confidence_threshold]
        if len(hits) < self.required_hits:
            return None
        return VisionConfirmation(
            label=observation.label,
            confidence=max(item.confidence for item in hits),
            hit_count=len(hits),
            window_size=len(window),
            frame_ids=tuple(item.frame_id for item in window),
            timestamp=observation.timestamp,
        )

    def reset(self) -> None:
        self._windows.clear()
        self._seen_frames.clear()


class OnnxVisionWorker:
    """External ONNX adapter; model weights are intentionally not committed."""

    def __init__(self, model_path: str | None = None, model_version: str = "external-onnx") -> None:
        self.model_path = model_path
        self.model_version = model_version
        self._session = None
        self.fault: str | None = None
        if model_path:
            self._load(Path(model_path))
        else:
            self.fault = "VISION_MODEL_PATH is not configured"

    def _load(self, path: Path) -> None:
        if not path.is_file():
            self.fault = f"model file not found: {path}"
            return
        try:
            import onnxruntime as ort

            self._session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        except Exception as exc:
            self.fault = str(exc)

    def status(self) -> VisionStatus:
        return VisionStatus(
            loaded=self._session is not None,
            model_path=self.model_path,
            model_version=self.model_version,
            fault=self.fault,
        )

    def infer(self, _frame: object) -> list[VisionDetection]:
        if self._session is None:
            return []
        raise NotImplementedError(
            "The external model adapter requires a project-specific preprocessing/postprocessing contract"
        )
