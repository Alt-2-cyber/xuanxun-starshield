#include <stdio.h>
#include <string.h>

#include "soc_osal.h"
#include "systick.h"

#include "starshield_config.h"
#include "starshield_protocol.h"
#include "starshield_sensor.h"
#include "starshield_uart.h"

static errcode_t open_output_uart(uint8_t bus, uint16_t tx_pin, uint16_t rx_pin)
{
    const starshield_uart_config_t config = {
        .bus = bus,
        .tx_pin = tx_pin,
        .rx_pin = rx_pin,
        .pin_mode = CONFIG_STARSHIELD_UART_PIN_MODE,
        .baud_rate = CONFIG_STARSHIELD_UART_BAUDRATE,
        .rx_buffer = NULL,
        .rx_buffer_size = 0U
    };
    return starshield_uart_open(&config);
}

static int build_event(uint32_t sequence, starshield_event_t *event)
{
    starshield_sensor_sample_t sample = {0};
    uint64_t device_time_ms;
    int written;

    if (event == NULL || starshield_sensor_read(&sample) != 0) {
        return -1;
    }
    (void)memset(event, 0, sizeof(*event));
    device_time_ms = uapi_systick_get_ms();
    written = snprintf(event->event_id, sizeof(event->event_id), "HH-D02-RS-%08llu-%08lu",
                       (unsigned long long)device_time_ms, (unsigned long)sequence);
    if (written < 0 || (size_t)written >= sizeof(event->event_id)) {
        return -1;
    }
    (void)snprintf(event->robot_id, sizeof(event->robot_id), "%s", STARSHIELD_ROBOT_ID);
    (void)snprintf(event->source_id, sizeof(event->source_id), "%s", STARSHIELD_SOURCE_ID);
    (void)snprintf(event->message_type, sizeof(event->message_type), "TELEMETRY");
    (void)snprintf(event->level, sizeof(event->level), "%s", sample.level[0] == '\0' ? "NORMAL" : sample.level);
    event->sequence = sequence;
    event->device_time_ms = device_time_ms;
    event->temperature_valid = sample.temperature_valid;
    event->temperature_c = sample.temperature_c;
    event->smoke_valid = sample.smoke_valid;
    event->smoke_ratio = sample.smoke_ratio;
    event->gas_valid = sample.gas_valid;
    event->gas_ratio = sample.gas_ratio;
    event->trigger_bits = sample.trigger_bits;
    return 0;
}

void *starshield_role_r_sense_run(const char *argument)
{
    uint8_t payload[STARSHIELD_MAX_PAYLOAD] = {0};
    uint8_t frame[STARSHIELD_MAX_FRAME_SIZE] = {0};
    uint16_t payload_length;
    uint16_t frame_length;
    uint32_t sequence = 0U;
    errcode_t sf_uart_ret;
    errcode_t wifi_uart_ret;

    (void)argument;
    sf_uart_ret = open_output_uart(CONFIG_STARSHIELD_RSENSE_UART_SF_BUS,
                                   CONFIG_STARSHIELD_UART1_TX_PIN, CONFIG_STARSHIELD_UART1_RX_PIN);
    wifi_uart_ret = open_output_uart(CONFIG_STARSHIELD_RSENSE_UART_WIFI_BUS,
                                     CONFIG_STARSHIELD_UART2_TX_PIN, CONFIG_STARSHIELD_UART2_RX_PIN);
    osal_printk("[STARSHIELD] R-SENSE UART SF=0x%x WIFI=0x%x PinMuxVerified=%u\r\n",
                sf_uart_ret, wifi_uart_ret, CONFIG_STARSHIELD_PINMUX_VERIFIED);

    while (1) {
        starshield_event_t event;
        if (build_event(sequence, &event) == 0 &&
            starshield_event_encode_json(&event, payload, sizeof(payload), &payload_length) == 0 &&
            starshield_frame_encode(payload, payload_length, frame, sizeof(frame), &frame_length) == 0) {
            if (sf_uart_ret == ERRCODE_SUCC) {
                (void)starshield_uart_write(CONFIG_STARSHIELD_RSENSE_UART_SF_BUS, frame, frame_length);
            }
            if (wifi_uart_ret == ERRCODE_SUCC) {
                (void)starshield_uart_write(CONFIG_STARSHIELD_RSENSE_UART_WIFI_BUS, frame, frame_length);
            }
        }
        sequence++;
        osal_msleep(CONFIG_STARSHIELD_SAMPLE_PERIOD_MS);
    }
    return NULL;
}
