#include "starshield_protocol.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

static int append_bytes(uint8_t *output, size_t capacity, size_t *offset,
                        const char *text, size_t text_length)
{
    if (output == NULL || offset == NULL || text == NULL || *offset > capacity ||
        text_length > capacity - *offset) {
        return -1;
    }
    (void)memcpy(output + *offset, text, text_length);
    *offset += text_length;
    return 0;
}

static int append_format(uint8_t *output, size_t capacity, size_t *offset,
                         const char *format, ...)
{
    va_list arguments;
    int written;

    if (output == NULL || offset == NULL || format == NULL || *offset >= capacity) {
        return -1;
    }
    va_start(arguments, format);
    written = vsnprintf((char *)output + *offset, capacity - *offset, format, arguments);
    va_end(arguments);
    if (written < 0 || (size_t)written >= capacity - *offset) {
        return -1;
    }
    *offset += (size_t)written;
    return 0;
}

static int append_json_string(uint8_t *output, size_t capacity, size_t *offset, const char *value)
{
    const unsigned char *cursor = (const unsigned char *)(value == NULL ? "" : value);

    if (append_bytes(output, capacity, offset, "\"", 1U) != 0) {
        return -1;
    }
    while (*cursor != '\0') {
        switch (*cursor) {
            case '"':
                if (append_bytes(output, capacity, offset, "\\\"", 2U) != 0) {
                    return -1;
                }
                break;
            case '\\':
                if (append_bytes(output, capacity, offset, "\\\\", 2U) != 0) {
                    return -1;
                }
                break;
            case '\n':
                if (append_bytes(output, capacity, offset, "\\n", 2U) != 0) {
                    return -1;
                }
                break;
            case '\r':
                if (append_bytes(output, capacity, offset, "\\r", 2U) != 0) {
                    return -1;
                }
                break;
            case '\t':
                if (append_bytes(output, capacity, offset, "\\t", 2U) != 0) {
                    return -1;
                }
                break;
            default:
                if (*cursor < 0x20U) {
                    if (append_format(output, capacity, offset, "\\u%04x", *cursor) != 0) {
                        return -1;
                    }
                } else if (append_bytes(output, capacity, offset, (const char *)cursor, 1U) != 0) {
                    return -1;
                }
                break;
        }
        cursor++;
    }
    return append_bytes(output, capacity, offset, "\"", 1U);
}

static int append_json_field_string(uint8_t *output, size_t capacity, size_t *offset,
                                    const char *name, const char *value)
{
    if (append_format(output, capacity, offset, ",\"%s\":", name) != 0) {
        return -1;
    }
    return append_json_string(output, capacity, offset, value);
}

static int append_json_field_number_or_null(uint8_t *output, size_t capacity, size_t *offset,
                                            const char *name, bool valid, float value)
{
    if (append_format(output, capacity, offset, ",\"%s\":", name) != 0) {
        return -1;
    }
    if (!valid) {
        return append_bytes(output, capacity, offset, "null", 4U);
    }
    return append_format(output, capacity, offset, "%.3f", (double)value);
}

uint16_t starshield_crc16(const uint8_t *data, size_t length)
{
    uint16_t crc = 0xFFFFU;

    if (data == NULL && length != 0U) {
        return 0U;
    }
    for (size_t index = 0; index < length; index++) {
        crc ^= (uint16_t)data[index] << 8U;
        for (uint8_t bit = 0; bit < 8U; bit++) {
            if ((crc & 0x8000U) != 0U) {
                crc = (uint16_t)((crc << 1U) ^ 0x1021U);
            } else {
                crc <<= 1U;
            }
        }
    }
    return crc;
}

int starshield_event_encode_json(const starshield_event_t *event,
                                 uint8_t *output,
                                 size_t output_capacity,
                                 uint16_t *output_length)
{
    size_t offset = 0U;
    uint8_t trigger_index = 0U;
    bool wrote_trigger = false;
    const uint8_t trigger_values[] = {
        STARSHIELD_TRIGGER_TEMP, STARSHIELD_TRIGGER_SMOKE,
        STARSHIELD_TRIGGER_GAS, STARSHIELD_TRIGGER_VISION
    };
    const char *trigger_names[] = {"TEMP", "SMOKE", "GAS", "VISION"};

    if (event == NULL || output == NULL || output_length == NULL || output_capacity < 2U ||
        event->event_id[0] == '\0' || event->robot_id[0] == '\0' || event->source_id[0] == '\0' ||
        event->message_type[0] == '\0' || event->level[0] == '\0') {
        return -1;
    }
    if (append_bytes(output, output_capacity, &offset, "{\"protocol_version\":1",
                     sizeof("{\"protocol_version\":1") - 1U) != 0 ||
        append_json_field_string(output, output_capacity, &offset, "event_id", event->event_id) != 0 ||
        append_json_field_string(output, output_capacity, &offset, "robot_id", event->robot_id) != 0 ||
        append_json_field_string(output, output_capacity, &offset, "source_id", event->source_id) != 0 ||
        append_json_field_string(output, output_capacity, &offset, "message_type", event->message_type) != 0 ||
        append_format(output, output_capacity, &offset, ",\"sequence\":%lu,\"device_time_ms\":%llu",
                      (unsigned long)event->sequence, (unsigned long long)event->device_time_ms) != 0 ||
        append_json_field_string(output, output_capacity, &offset, "level", event->level) != 0 ||
        append_bytes(output, output_capacity, &offset, ",\"sensor_values\":{",
                     sizeof(",\"sensor_values\":{") - 1U) != 0 ||
        append_json_field_number_or_null(output, output_capacity, &offset, "temperature_c",
                                         event->temperature_valid, event->temperature_c) != 0 ||
        append_json_field_number_or_null(output, output_capacity, &offset, "smoke_ratio",
                                         event->smoke_valid, event->smoke_ratio) != 0 ||
        append_json_field_number_or_null(output, output_capacity, &offset, "gas_ratio",
                                         event->gas_valid, event->gas_ratio) != 0 ||
        append_bytes(output, output_capacity, &offset, "},\"trigger_bits\":[",
                     sizeof("},\"trigger_bits\":[") - 1U) != 0) {
        return -1;
    }

    for (trigger_index = 0U; trigger_index < (uint8_t)(sizeof(trigger_values) / sizeof(trigger_values[0]));
         trigger_index++) {
        if ((event->trigger_bits & trigger_values[trigger_index]) == 0U) {
            continue;
        }
        if (wrote_trigger && append_bytes(output, output_capacity, &offset, ",", 1U) != 0) {
            return -1;
        }
        if (append_json_string(output, output_capacity, &offset, trigger_names[trigger_index]) != 0) {
            return -1;
        }
        wrote_trigger = true;
    }
    if (append_bytes(output, output_capacity, &offset, "]", 1U) != 0) {
        return -1;
    }
    if (event->calibration_id[0] != '\0') {
        if (append_json_field_string(output, output_capacity, &offset, "calibration_id",
                                     event->calibration_id) != 0) {
            return -1;
        }
    } else if (append_bytes(output, output_capacity, &offset, ",\"calibration_id\":null", 22U) != 0) {
        return -1;
    }
    if (append_bytes(output, output_capacity, &offset, "}", 1U) != 0 || offset >= output_capacity) {
        return -1;
    }
    output[offset] = '\0';
    *output_length = (uint16_t)offset;
    return 0;
}

int starshield_frame_encode(const uint8_t *payload,
                            uint16_t payload_length,
                            uint8_t *output,
                            size_t output_capacity,
                            uint16_t *output_length)
{
    uint16_t crc;
    size_t required = STARSHIELD_FRAME_HEADER_SIZE + (size_t)payload_length + STARSHIELD_FRAME_TRAILER_SIZE;

    if (payload == NULL || output == NULL || output_length == NULL ||
        payload_length > STARSHIELD_MAX_PAYLOAD || output_capacity < required) {
        return -1;
    }
    output[0] = STARSHIELD_FRAME_MAGIC_A;
    output[1] = STARSHIELD_FRAME_MAGIC_B;
    output[2] = STARSHIELD_PROTOCOL_VERSION;
    output[3] = 0U;
    output[4] = (uint8_t)(payload_length & 0xFFU);
    output[5] = (uint8_t)(payload_length >> 8U);
    (void)memcpy(output + STARSHIELD_FRAME_HEADER_SIZE, payload, payload_length);
    crc = starshield_crc16(output + 2U, 4U + payload_length);
    output[STARSHIELD_FRAME_HEADER_SIZE + payload_length] = (uint8_t)(crc & 0xFFU);
    output[STARSHIELD_FRAME_HEADER_SIZE + payload_length + 1U] = (uint8_t)(crc >> 8U);
    *output_length = (uint16_t)required;
    return 0;
}

void starshield_frame_decoder_init(starshield_frame_decoder_t *decoder)
{
    if (decoder == NULL) {
        return;
    }
    (void)memset(decoder, 0, sizeof(*decoder));
}

static void decoder_reset(starshield_frame_decoder_t *decoder)
{
    decoder->used = 0U;
    decoder->expected = 0U;
}

void starshield_frame_decoder_feed(starshield_frame_decoder_t *decoder,
                                   const uint8_t *data,
                                   size_t length,
                                   starshield_frame_callback callback,
                                   void *context)
{
    if (decoder == NULL || data == NULL) {
        return;
    }
    for (size_t index = 0U; index < length; index++) {
        uint8_t byte = data[index];
        if (decoder->used == 0U) {
            if (byte == STARSHIELD_FRAME_MAGIC_A) {
                decoder->frame[0] = byte;
                decoder->used = 1U;
            }
            continue;
        }
        if (decoder->used == 1U) {
            if (byte == STARSHIELD_FRAME_MAGIC_B) {
                decoder->frame[1] = byte;
                decoder->used = 2U;
            } else if (byte == STARSHIELD_FRAME_MAGIC_A) {
                decoder->frame[0] = byte;
            } else {
                decoder_reset(decoder);
            }
            continue;
        }
        if (decoder->used >= STARSHIELD_MAX_FRAME_SIZE) {
            decoder_reset(decoder);
            continue;
        }
        decoder->frame[decoder->used++] = byte;
        if (decoder->used == STARSHIELD_FRAME_HEADER_SIZE) {
            uint16_t payload_length = (uint16_t)decoder->frame[4] |
                                      ((uint16_t)decoder->frame[5] << 8U);
            if (payload_length > STARSHIELD_MAX_PAYLOAD) {
                decoder_reset(decoder);
                continue;
            }
            decoder->expected = (uint16_t)(STARSHIELD_FRAME_HEADER_SIZE + payload_length +
                                           STARSHIELD_FRAME_TRAILER_SIZE);
        }
        if (decoder->expected != 0U && decoder->used == decoder->expected) {
            uint16_t payload_length = (uint16_t)decoder->frame[4] |
                                      ((uint16_t)decoder->frame[5] << 8U);
            uint16_t received_crc = (uint16_t)decoder->frame[decoder->expected - 2U] |
                                    ((uint16_t)decoder->frame[decoder->expected - 1U] << 8U);
            uint16_t calculated_crc = starshield_crc16(decoder->frame + 2U, 4U + payload_length);
            if (received_crc == calculated_crc && decoder->frame[2] == STARSHIELD_PROTOCOL_VERSION && callback != NULL) {
                callback(decoder->frame, decoder->expected,
                         decoder->frame + STARSHIELD_FRAME_HEADER_SIZE, payload_length, context);
            }
            decoder_reset(decoder);
        }
    }
}
