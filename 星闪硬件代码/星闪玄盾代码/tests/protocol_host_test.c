#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "starshield_protocol.h"

static int g_callback_count;
static uint16_t g_callback_frame_len;
static uint16_t g_callback_payload_len;
static uint8_t g_callback_frame[STARSHIELD_MAX_FRAME_SIZE];
static int g_failures;

static void check(int condition, const char *message)
{
    if (!condition) {
        (void)fprintf(stderr, "FAIL: %s\n", message);
        g_failures++;
        return;
    }
    (void)printf("PASS: %s\n", message);
}

static void on_frame(const uint8_t *frame, uint16_t frame_len,
                     const uint8_t *payload, uint16_t payload_len, void *context)
{
    (void)context;
    g_callback_count++;
    g_callback_frame_len = frame_len;
    g_callback_payload_len = payload_len;
    (void)memcpy(g_callback_frame, frame, frame_len);
    check(payload != NULL && payload_len > 0, "decoder exposes a non-empty payload");
}

int main(void)
{
    starshield_event_t event = {0};
    uint8_t payload[STARSHIELD_MAX_PAYLOAD] = {0};
    uint8_t frame[STARSHIELD_MAX_FRAME_SIZE] = {0};
    uint16_t payload_len = 0;
    uint16_t frame_len = 0;
    starshield_frame_decoder_t decoder = {0};

    (void)snprintf(event.event_id, sizeof(event.event_id), "HH-D02-RS-00000001");
    (void)snprintf(event.robot_id, sizeof(event.robot_id), "robot-01");
    (void)snprintf(event.source_id, sizeof(event.source_id), "r-sense");
    (void)snprintf(event.message_type, sizeof(event.message_type), "TELEMETRY");
    (void)snprintf(event.level, sizeof(event.level), "P1");
    (void)snprintf(event.calibration_id, sizeof(event.calibration_id), "cal\"A\\B");
    event.sequence = 7;
    event.device_time_ms = 123456;
    event.temperature_valid = true;
    event.temperature_c = 36.5f;
    event.smoke_valid = false;
    event.gas_valid = true;
    event.gas_ratio = 0.125f;
    event.trigger_bits = STARSHIELD_TRIGGER_TEMP | STARSHIELD_TRIGGER_GAS;

    check(starshield_event_encode_json(&event, payload, sizeof(payload), &payload_len) == 0,
          "event JSON encodes");
    check(strstr((const char *)payload, "\"event_id\":\"HH-D02-RS-00000001\"") != NULL,
          "event_id is present");
    check(strstr((const char *)payload, "\"sequence\":7") != NULL,
          "sequence is present");
    check(strstr((const char *)payload, "\"device_time_ms\":123456") != NULL,
          "device_time_ms is present");
    check(strstr((const char *)payload, "\"trigger_bits\":[\"TEMP\",\"GAS\"]") != NULL,
          "trigger bits preserve order and names");
    check(strstr((const char *)payload, "\"calibration_id\":\"cal\\\"A\\\\B\"") != NULL,
          "JSON string fields are escaped");

    check(starshield_frame_encode(payload, STARSHIELD_MAX_PAYLOAD + 1U,
                                  frame, sizeof(frame), &frame_len) != 0,
          "payload larger than protocol limit is rejected");

    check(starshield_frame_encode(payload, payload_len, frame, sizeof(frame), &frame_len) == 0,
          "frame encodes");
    check(frame[0] == STARSHIELD_FRAME_MAGIC_A && frame[1] == STARSHIELD_FRAME_MAGIC_B,
          "frame has FA CE magic");

    starshield_frame_decoder_init(&decoder);
    for (uint16_t i = 0; i < frame_len; i++) {
        starshield_frame_decoder_feed(&decoder, &frame[i], 1, on_frame, NULL);
    }
    check(g_callback_count == 1, "fragmented frame reassembles once");
    check(g_callback_frame_len == frame_len && g_callback_payload_len == payload_len,
          "reassembled lengths match");
    check(memcmp(g_callback_frame, frame, frame_len) == 0,
          "forwarded frame bytes are unchanged");

    frame[frame_len - 1] ^= 0x01;
    starshield_frame_decoder_init(&decoder);
    starshield_frame_decoder_feed(&decoder, frame, frame_len, on_frame, NULL);
    check(g_callback_count == 1, "bad CRC is rejected");

    check(starshield_frame_encode(payload, payload_len, frame, sizeof(frame), &frame_len) == 0,
          "frame can be rebuilt after a rejected frame");
    frame[2] = STARSHIELD_PROTOCOL_VERSION + 1U;
    starshield_frame_decoder_init(&decoder);
    starshield_frame_decoder_feed(&decoder, frame, frame_len, on_frame, NULL);
    check(g_callback_count == 1, "unsupported protocol version is rejected");
    return g_failures == 0 ? 0 : 1;
}
