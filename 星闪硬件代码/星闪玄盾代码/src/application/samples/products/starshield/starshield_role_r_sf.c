#include <stdbool.h>

#include "sle_errcode.h"
#include "soc_osal.h"
#include "uart.h"

#include "starshield_config.h"
#include "starshield_protocol.h"
#include "starshield_queue.h"
#include "starshield_sle_client.h"
#include "starshield_uart.h"

static starshield_queue_t g_uart_queue;
static starshield_frame_decoder_t g_decoder;
static uint8_t g_uart_rx_buffer[CONFIG_STARSHIELD_UART_RX_BUFFER_SIZE];

static void r_sf_uart_rx_callback(const void *buffer, uint16_t length, bool error)
{
    (void)error;
    if (buffer != NULL && length > 0U) {
        (void)starshield_queue_push(&g_uart_queue, (const uint8_t *)buffer, length);
    }
}

static void r_sf_frame_callback(const uint8_t *frame,
                                uint16_t frame_length,
                                const uint8_t *payload,
                                uint16_t payload_length,
                                void *context)
{
    (void)frame;
    (void)payload;
    (void)payload_length;
    (void)context;
    if (starshield_sle_client_send(frame, frame_length) != ERRCODE_SLE_SUCCESS) {
        osal_printk("[STARSHIELD] R-SF SLE not ready; frame dropped\r\n");
    }
}

void *starshield_role_r_sf_run(const char *argument)
{
    const starshield_uart_config_t uart_config = {
        .bus = CONFIG_STARSHIELD_UART1_BUS,
        .tx_pin = CONFIG_STARSHIELD_UART1_TX_PIN,
        .rx_pin = CONFIG_STARSHIELD_UART1_RX_PIN,
        .pin_mode = CONFIG_STARSHIELD_UART_PIN_MODE,
        .baud_rate = CONFIG_STARSHIELD_UART_BAUDRATE,
        .rx_buffer = g_uart_rx_buffer,
        .rx_buffer_size = sizeof(g_uart_rx_buffer)
    };
    uint8_t queue_buffer[CONFIG_STARSHIELD_UART_RX_BUFFER_SIZE] = {0};
    uint32_t queue_length;

    (void)argument;
    if (starshield_queue_create(&g_uart_queue, "StarShieldRSfUart",
                                CONFIG_STARSHIELD_QUEUE_LENGTH,
                                CONFIG_STARSHIELD_UART_RX_BUFFER_SIZE) != 0) {
        osal_printk("[STARSHIELD] R-SF queue creation failed; role stopped\r\n");
        return NULL;
    }
    if (starshield_uart_open(&uart_config) != ERRCODE_SUCC) {
        osal_printk("[STARSHIELD] R-SF UART1 is unavailable; role stopped\r\n");
        return NULL;
    }
    uapi_uart_unregister_rx_callback(CONFIG_STARSHIELD_UART1_BUS);
    (void)uapi_uart_register_rx_callback(CONFIG_STARSHIELD_UART1_BUS,
                                          UART_RX_CONDITION_FULL_OR_SUFFICIENT_DATA_OR_IDLE,
                                          1, r_sf_uart_rx_callback);
    (void)starshield_sle_client_init();
    starshield_frame_decoder_init(&g_decoder);
    while (1) {
        queue_length = sizeof(queue_buffer);
        if (starshield_queue_pop(&g_uart_queue, queue_buffer, &queue_length, OSAL_WAIT_FOREVER) == 0) {
            starshield_frame_decoder_feed(&g_decoder, queue_buffer, queue_length,
                                          r_sf_frame_callback, NULL);
        }
    }
    return NULL;
}
