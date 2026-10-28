import json

from fire_edge.serial_gateway import FrameDecoder, encode_frame


def test_decoder_reassembles_fragmented_starshield_frame() -> None:
    payload = json.dumps(
        {
            "protocol_version": 1,
            "event_id": "evt-1",
            "robot_id": "R01",
            "source_id": "R-SENSE",
            "message_type": "ALERT",
            "sequence": 7,
            "device_time_ms": 1234,
            "level": "P2",
            "sensor_values": {"temperature_c": 46.2},
            "trigger_bits": ["TEMP"],
        },
        separators=(",", ":"),
    ).encode()
    frame = encode_frame(payload)
    decoder = FrameDecoder()

    assert decoder.feed(frame[:4]) == []
    decoded = decoder.feed(frame[4:])

    assert len(decoded) == 1
    assert decoded[0].payload == payload
    assert decoded[0].version == 1


def test_decoder_discards_bad_crc_and_recovers_on_next_frame() -> None:
    valid = encode_frame(b'{"event_id":"valid"}')
    invalid = bytearray(encode_frame(b'{"event_id":"bad"}'))
    invalid[-1] ^= 0xFF
    decoder = FrameDecoder()

    decoded = decoder.feed(bytes(invalid) + valid)

    assert [item.payload for item in decoded] == [b'{"event_id":"valid"}']
    assert decoder.crc_errors == 1


def test_encode_frame_uses_little_endian_length_and_crc16_ccitt_false() -> None:
    frame = encode_frame(b"abc")

    assert frame[:2] == b"\xfa\xce"
    assert frame[2] == 1
    assert frame[4:6] == b"\x03\x00"
    assert len(frame) == 11
