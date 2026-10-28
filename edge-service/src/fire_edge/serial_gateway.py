from __future__ import annotations

from dataclasses import dataclass, field
import os
import threading
import time
from typing import Callable


MAGIC = b"\xfa\xce"
PROTOCOL_VERSION = 1
MAX_PAYLOAD = 420
HEADER_SIZE = 6
TRAILER_SIZE = 2


def crc16_ccitt_false(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def encode_frame(payload: bytes, *, version: int = PROTOCOL_VERSION, flags: int = 0) -> bytes:
    if len(payload) > MAX_PAYLOAD:
        raise ValueError(f"payload exceeds {MAX_PAYLOAD} bytes")
    header = bytes((version, flags, len(payload) & 0xFF, len(payload) >> 8))
    crc = crc16_ccitt_false(header + payload)
    return MAGIC + header + payload + crc.to_bytes(2, "little")


@dataclass(frozen=True)
class DecodedFrame:
    version: int
    flags: int
    payload: bytes
    raw: bytes
    received_ns: int


class FrameDecoder:
    def __init__(self, *, max_payload: int = MAX_PAYLOAD) -> None:
        self.max_payload = max_payload
        self._buffer = bytearray()
        self.crc_errors = 0
        self.unsupported_versions = 0

    def feed(self, data: bytes) -> list[DecodedFrame]:
        if data:
            self._buffer.extend(data)
        decoded: list[DecodedFrame] = []
        while True:
            magic_at = self._buffer.find(MAGIC)
            if magic_at < 0:
                # Keep a possible first magic byte for a frame split across reads.
                if self._buffer[-1:] == MAGIC[:1]:
                    self._buffer[:] = MAGIC[:1]
                else:
                    self._buffer.clear()
                break
            if magic_at:
                del self._buffer[:magic_at]
            if len(self._buffer) < HEADER_SIZE:
                break
            version = self._buffer[2]
            flags = self._buffer[3]
            payload_length = int.from_bytes(self._buffer[4:6], "little")
            if payload_length > self.max_payload:
                del self._buffer[:2]
                continue
            frame_length = HEADER_SIZE + payload_length + TRAILER_SIZE
            if len(self._buffer) < frame_length:
                break
            raw = bytes(self._buffer[:frame_length])
            del self._buffer[:frame_length]
            payload = raw[HEADER_SIZE : HEADER_SIZE + payload_length]
            expected_crc = int.from_bytes(raw[-2:], "little")
            actual_crc = crc16_ccitt_false(raw[2:-2])
            if expected_crc != actual_crc:
                self.crc_errors += 1
                continue
            if version != PROTOCOL_VERSION:
                self.unsupported_versions += 1
                continue
            decoded.append(DecodedFrame(version, flags, payload, raw, time.monotonic_ns()))
        return decoded


@dataclass
class SerialPortStatus:
    port: str
    label: str
    online: bool = False
    bytes_received: int = 0
    frames_received: int = 0
    crc_errors: int = 0
    unsupported_versions: int = 0
    last_frame_ns: int | None = None
    last_error: str | None = None

    def as_dict(self) -> dict[str, object]:
        return {
            "port": self.port,
            "label": self.label,
            "online": self.online,
            "bytes_received": self.bytes_received,
            "frames_received": self.frames_received,
            "crc_errors": self.crc_errors,
            "unsupported_versions": self.unsupported_versions,
            "last_frame_ns": self.last_frame_ns,
            "last_error": self.last_error,
        }


FrameCallback = Callable[[SerialPortStatus, DecodedFrame], None]


class SerialGateway:
    """Read framed C-SF/C-WIFI output without coupling the app to pyserial."""

    def __init__(
        self,
        ports: dict[str, str],
        on_frame: FrameCallback,
        *,
        baudrate: int = 115200,
    ) -> None:
        self.ports = ports
        self.on_frame = on_frame
        self.baudrate = baudrate
        self.statuses = {port: SerialPortStatus(port, label) for port, label in ports.items()}
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []

    @classmethod
    def from_env(cls, on_frame: FrameCallback) -> "SerialGateway":
        ports: dict[str, str] = {}
        raw = os.getenv("STARSHIELD_SERIAL_PORTS", "")
        for item in raw.replace(";", ",").split(","):
            item = item.strip()
            if not item:
                continue
            port, separator, label = item.partition(":")
            ports[port.strip()] = label.strip() if separator else port.strip()
        baudrate = int(os.getenv("STARSHIELD_SERIAL_BAUDRATE", "115200"))
        return cls(ports, on_frame, baudrate=baudrate)

    def start(self) -> None:
        if self._threads:
            return
        for port in self.ports:
            thread = threading.Thread(target=self._read_port, args=(port,), daemon=True)
            self._threads.append(thread)
            thread.start()

    def stop(self) -> None:
        self._stop.set()
        for thread in self._threads:
            thread.join(timeout=1.0)
        self._threads.clear()

    def snapshot(self) -> list[dict[str, object]]:
        return [status.as_dict() for status in self.statuses.values()]

    def _read_port(self, port: str) -> None:
        status = self.statuses[port]
        decoder = FrameDecoder()
        try:
            import serial

            with serial.Serial(port, self.baudrate, timeout=0.2) as connection:
                status.online = True
                while not self._stop.is_set():
                    chunk = connection.read(connection.in_waiting or 1)
                    if not chunk:
                        continue
                    status.bytes_received += len(chunk)
                    for frame in decoder.feed(chunk):
                        status.frames_received += 1
                        status.last_frame_ns = frame.received_ns
                        self.on_frame(status, frame)
        except Exception as exc:
            status.last_error = str(exc)
        finally:
            status.online = False
            status.crc_errors = decoder.crc_errors
            status.unsupported_versions = decoder.unsupported_versions
