#include <stdbool.h>
#include <string.h>

#include "cmsis_os2.h"
#include "lwip/ip4_addr.h"
#include "lwip/netifapi.h"
#include "lwip/nettool/misc.h"
#include "lwip/sockets.h"
#include "securec.h"
#include "soc_osal.h"
#include "uart.h"
#include "wifi_device.h"
#include "starshield_config.h"
#include "starshield_protocol.h"
#include "starshield_queue.h"
#include "starshield_uart.h"
#include "starshield_wifi_config.h"
#include "starshield_wifi_sta.h"

static starshield_queue_t g_uart_queue;
static starshield_frame_decoder_t g_decoder;
static uint8_t g_uart_rx_buffer[CONFIG_STARSHIELD_UART_RX_BUFFER_SIZE];
static int g_udp_socket = -1;
static struct sockaddr_in g_udp_peer;

static void r_wifi_uart_rx_callback(const void *buffer, uint16_t length, bool error)
{
    (void)error;
    if (buffer != NULL && length > 0U) {
        (void)starshield_queue_push(&g_uart_queue, (const uint8_t *)buffer, length);
    }
}

static void r_wifi_frame_callback(const uint8_t *frame,
                                  uint16_t frame_length,
                                  const uint8_t *payload,
                                  uint16_t payload_length,
                                  void *context)
{
    int sent;
    (void)payload;
    (void)payload_length;
    (void)context;
    if (g_udp_socket < 0) {
        return;
    }
    sent = sendto(g_udp_socket, frame, frame_length, 0,
                  (struct sockaddr *)&g_udp_peer, sizeof(g_udp_peer));
    if (sent != (int)frame_length) {
        osal_printk("[STARSHIELD] R-WIFI UDP send failed: %d\r\n", sent);
    }
}

void *starshield_role_r_wifi_run(const char *argument)
{
    const starshield_uart_config_t uart_config = {
        .bus = CONFIG_STARSHIELD_UART2_BUS,
        .tx_pin = CONFIG_STARSHIELD_UART2_TX_PIN,
        .rx_pin = CONFIG_STARSHIELD_UART2_RX_PIN,
        .pin_mode = CONFIG_STARSHIELD_UART_PIN_MODE,
        .baud_rate = CONFIG_STARSHIELD_UART_BAUDRATE,
        .rx_buffer = g_uart_rx_buffer,
        .rx_buffer_size = sizeof(g_uart_rx_buffer)
    };
    uint8_t queue_buffer[CONFIG_STARSHIELD_UART_RX_BUFFER_SIZE] = {0};
    uint32_t queue_length;
    errcode_t connect_ret;
    (void)argument;
    if (starshield_queue_create(&g_uart_queue, "StarShieldRWifiUart",
                                CONFIG_STARSHIELD_QUEUE_LENGTH,
                                CONFIG_STARSHIELD_UART_RX_BUFFER_SIZE) != 0) {
        osal_printk("[STARSHIELD] R-WIFI queue creation failed; role stopped\r\n");
        return NULL;
    }
    if (starshield_uart_open(&uart_config) != ERRCODE_SUCC) {
        osal_printk("[STARSHIELD] R-WIFI UART2 is unavailable; role stopped\r\n");
        return NULL;
    }
    uapi_uart_unregister_rx_callback(CONFIG_STARSHIELD_UART2_BUS);
    (void)uapi_uart_register_rx_callback(CONFIG_STARSHIELD_UART2_BUS,
                                          UART_RX_CONDITION_FULL_OR_SUFFICIENT_DATA_OR_IDLE,
                                          1, r_wifi_uart_rx_callback);
    while (wifi_is_wifi_inited() == 0) {
        osDelay(10U);
    }
    while ((connect_ret = starshield_wifi_sta_connect(STARSHIELD_WIFI_STA_SSID,
                                                       STARSHIELD_WIFI_STA_PASSWORD)) != ERRCODE_SUCC) {
        if (connect_ret == ERRCODE_INVALID_PARAM) {
            return NULL;
        }
        osal_printk("[STARSHIELD] R-WIFI STA connect retry\r\n");
        osal_msleep(1000U);
    }
    g_udp_socket = socket(AF_INET, SOCK_DGRAM, 0);
    if (g_udp_socket < 0) {
        osal_printk("[STARSHIELD] R-WIFI UDP socket failed\r\n");
        return NULL;
    }
    (void)memset(&g_udp_peer, 0, sizeof(g_udp_peer));
    g_udp_peer.sin_family = AF_INET;
    g_udp_peer.sin_port = htons(STARSHIELD_WIFI_UDP_PORT);
    g_udp_peer.sin_addr.s_addr = inet_addr(STARSHIELD_WIFI_PEER_IP);
    if (starshield_wifi_peer_is_broadcast(STARSHIELD_WIFI_PEER_IP)) {
        int broadcast_enabled = 1;
        (void)setsockopt(g_udp_socket, SOL_SOCKET, SO_BROADCAST,
                         &broadcast_enabled, sizeof(broadcast_enabled));
        osal_printk("[STARSHIELD] R-WIFI UDP broadcast peer=%s:%u\r\n",
                    STARSHIELD_WIFI_PEER_IP, STARSHIELD_WIFI_UDP_PORT);
    }

    starshield_frame_decoder_init(&g_decoder);
    while (1) {
        queue_length = sizeof(queue_buffer);
        if (starshield_queue_pop(&g_uart_queue, queue_buffer, &queue_length, OSAL_WAIT_FOREVER) == 0) {
            starshield_frame_decoder_feed(&g_decoder, queue_buffer, queue_length,
                                          r_wifi_frame_callback, NULL);
        }
    }
    return NULL;
}
