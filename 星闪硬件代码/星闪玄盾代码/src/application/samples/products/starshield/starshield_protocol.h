#ifndef STARSHIELD_PROTOCOL_H
#define STARSHIELD_PROTOCOL_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define STARSHIELD_PROTOCOL_VERSION 1U
#define STARSHIELD_FRAME_MAGIC_A 0xFAU
#define STARSHIELD_FRAME_MAGIC_B 0xCEU
#define STARSHIELD_FRAME_HEADER_SIZE 6U
#define STARSHIELD_FRAME_TRAILER_SIZE 2U
#define STARSHIELD_MAX_PAYLOAD 420U
#define STARSHIELD_MAX_FRAME_SIZE \
    (STARSHIELD_FRAME_HEADER_SIZE + STARSHIELD_MAX_PAYLOAD + STARSHIELD_FRAME_TRAILER_SIZE)

#define STARSHIELD_MAX_EVENT_ID_LEN 64U
#define STARSHIELD_MAX_ROBOT_ID_LEN 32U
#define STARSHIELD_MAX_SOURCE_ID_LEN 32U
#define STARSHIELD_MAX_MESSAGE_TYPE_LEN 12U
#define STARSHIELD_MAX_LEVEL_LEN 9U
#define STARSHIELD_MAX_CALIBRATION_ID_LEN 64U

#define STARSHIELD_TRIGGER_TEMP (1U << 0)
#define STARSHIELD_TRIGGER_SMOKE (1U << 1)
#define STARSHIELD_TRIGGER_GAS (1U << 2)
#define STARSHIELD_TRIGGER_VISION (1U << 3)

typedef struct {
    char event_id[STARSHIELD_MAX_EVENT_ID_LEN + 1U];
    char robot_id[STARSHIELD_MAX_ROBOT_ID_LEN + 1U];
    char source_id[STARSHIELD_MAX_SOURCE_ID_LEN + 1U];
    char message_type[STARSHIELD_MAX_MESSAGE_TYPE_LEN + 1U];
    char level[STARSHIELD_MAX_LEVEL_LEN + 1U];
    char calibration_id[STARSHIELD_MAX_CALIBRATION_ID_LEN + 1U];
    uint32_t sequence;
    uint64_t device_time_ms;
    bool temperature_valid;
    float temperature_c;
    bool smoke_valid;
    float smoke_ratio;
    bool gas_valid;
    float gas_ratio;
    uint8_t trigger_bits;
} starshield_event_t;

typedef struct {
    uint8_t frame[STARSHIELD_MAX_FRAME_SIZE];
    uint16_t used;
    uint16_t expected;
} starshield_frame_decoder_t;

typedef void (*starshield_frame_callback)(const uint8_t *frame,
                                          uint16_t frame_len,
                                          const uint8_t *payload,
                                          uint16_t payload_len,
                                          void *context);

uint16_t starshield_crc16(const uint8_t *data, size_t length);

int starshield_event_encode_json(const starshield_event_t *event,
                                 uint8_t *output,
                                 size_t output_capacity,
                                 uint16_t *output_length);

int starshield_frame_encode(const uint8_t *payload,
                            uint16_t payload_length,
                            uint8_t *output,
                            size_t output_capacity,
                            uint16_t *output_length);

void starshield_frame_decoder_init(starshield_frame_decoder_t *decoder);

void starshield_frame_decoder_feed(starshield_frame_decoder_t *decoder,
                                   const uint8_t *data,
                                   size_t length,
                                   starshield_frame_callback callback,
                                   void *context);

#endif
