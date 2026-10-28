#include <stdbool.h>

#include "sle_errcode.h"
#include "sle_ssap_server.h"
#include "sle_uart_server.h"
#include "sle_uart_server_adv.h"
#include "soc_osal.h"

#include "starshield_config.h"
#include "starshield_protocol.h"
#include "starshield_queue.h"
#include "starshield_uart.h"

static starshield_queue_t g_sle_queue;
static starshield_frame_decoder_t g_decoder;

static void c_sf_frame_callback(const uint8_t *frame,
                                uint16_t frame_length,
                                const uint8_t *payload,
                                uint16_t payload_length,
                                void *context)
{
    (void)payload;
    (void)payload_length;
    (void)context;
    (void)starshield_uart_write(CONFIG_STARSHIELD_UART0_BUS, frame, frame_length);
}

static void c_sf_read_callback(uint8_t server_id,
                               uint16_t connection_id,
                               ssaps_req_read_cb_t *request,
                               errcode_t status)
{
    (void)server_id;
    (void)connection_id;
    (void)request;
    (void)status;
}

static void c_sf_write_callback(uint8_t server_id,
                                uint16_t connection_id,
                                ssaps_req_write_cb_t *request,
                                errcode_t status)
{
    (void)server_id;
    (void)connection_id;
    if (status == ERRCODE_SLE_SUCCESS && request != NULL && request->value != NULL && request->length > 0U) {
        (void)starshield_queue_push(&g_sle_queue, request->value, request->length);
    }
}

void *starshield_role_c_sf_run(const char *argument)
{
    const starshield_uart_config_t uart_config = {
        .bus = CONFIG_STARSHIELD_UART0_BUS,
        .tx_pin = CONFIG_STARSHIELD_UART0_TX_PIN,
        .rx_pin = CONFIG_STARSHIELD_UART0_RX_PIN,
        .pin_mode = CONFIG_STARSHIELD_UART_PIN_MODE,
        .baud_rate = CONFIG_STARSHIELD_UART_BAUDRATE,
        .rx_buffer = NULL,
        .rx_buffer_size = 0U
    };
    uint8_t queue_buffer[STARSHIELD_MAX_FRAME_SIZE] = {0};
    uint32_t queue_length;

    (void)argument;
    if (starshield_queue_create(&g_sle_queue, "StarShieldCSfSle",
                                CONFIG_STARSHIELD_QUEUE_LENGTH,
                                STARSHIELD_MAX_FRAME_SIZE) != 0) {
        osal_printk("[STARSHIELD] C-SF queue creation failed; role stopped\r\n");
        return NULL;
    }
    if (starshield_uart_open(&uart_config) != ERRCODE_SUCC) {
        osal_printk("[STARSHIELD] C-SF UART0 is unavailable; role stopped\r\n");
        return NULL;
    }
    sle_uart_server_adv_set_identity(STARSHIELD_SLE_SERVER_NAME, NULL);
    if (sle_uart_server_init(c_sf_read_callback, c_sf_write_callback) != ERRCODE_SLE_SUCCESS) {
        osal_printk("[STARSHIELD] C-SF SLE server init failed\r\n");
    }
    starshield_frame_decoder_init(&g_decoder);
    while (1) {
        queue_length = sizeof(queue_buffer);
        if (starshield_queue_pop(&g_sle_queue, queue_buffer, &queue_length, OSAL_WAIT_FOREVER) == 0) {
            starshield_frame_decoder_feed(&g_decoder, queue_buffer, queue_length,
                                          c_sf_frame_callback, NULL);
        }
    }
    return NULL;
}
