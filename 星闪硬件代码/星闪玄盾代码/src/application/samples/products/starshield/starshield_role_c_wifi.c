#include <string.h>

#include "lwip/ip4_addr.h"
#include "lwip/netifapi.h"
#include "lwip/sockets.h"
#include "securec.h"
#include "soc_osal.h"
#include "wifi_device.h"

#include "starshield_config.h"
#include "starshield_protocol.h"
#include "starshield_uart.h"
#include "starshield_wifi_sta.h"

#define STARSHIELD_WIFI_IFNAME_MAX_SIZE 16U

static starshield_frame_decoder_t g_decoder;

static errcode_t start_sta(void)
{
    if (strlen(STARSHIELD_WIFI_STA_SSID) == 0U ||
        strlen(STARSHIELD_WIFI_STA_SSID) >= WIFI_MAX_SSID_LEN ||
        strlen(STARSHIELD_WIFI_STA_PASSWORD) == 0U ||
        strlen(STARSHIELD_WIFI_STA_PASSWORD) >= WIFI_MAX_KEY_LEN) {
        osal_printk("[STARSHIELD] C-WIFI requires a valid STA SSID and password\r\n");
        return ERRCODE_INVALID_PARAM;
    }
    return starshield_wifi_sta_connect(STARSHIELD_WIFI_STA_SSID,
                                       STARSHIELD_WIFI_STA_PASSWORD);
}

static void c_wifi_frame_callback(const uint8_t *frame,
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

void *starshield_role_c_wifi_run(const char *argument)
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
    uint8_t receive_buffer[STARSHIELD_MAX_FRAME_SIZE] = {0};
    struct sockaddr_in local_address = {0};
    struct sockaddr_in remote_address = {0};
    socklen_t remote_address_length = sizeof(remote_address);
    int socket_fd;

    (void)argument;
    if (starshield_uart_open(&uart_config) != ERRCODE_SUCC) {
        osal_printk("[STARSHIELD] C-WIFI UART0 is unavailable; role stopped\r\n");
        return NULL;
    }
    while (wifi_is_wifi_inited() == 0) {
        osal_msleep(10U);
    }
    if (start_sta() != ERRCODE_SUCC) {
        osal_printk("[STARSHIELD] C-WIFI STA start failed\r\n");
        return NULL;
    }
    socket_fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (socket_fd < 0) {
        osal_printk("[STARSHIELD] C-WIFI UDP socket failed\r\n");
        return NULL;
    }
    local_address.sin_family = AF_INET;
    local_address.sin_port = htons(STARSHIELD_WIFI_UDP_PORT);
    local_address.sin_addr.s_addr = htonl(INADDR_ANY);
    if (bind(socket_fd, (struct sockaddr *)&local_address, sizeof(local_address)) < 0) {
        osal_printk("[STARSHIELD] C-WIFI UDP bind failed\r\n");
        lwip_close(socket_fd);
        return NULL;
    }
    starshield_frame_decoder_init(&g_decoder);
    while (1) {
        remote_address_length = sizeof(remote_address);
        int received = recvfrom(socket_fd, receive_buffer, sizeof(receive_buffer), 0,
                                 (struct sockaddr *)&remote_address, &remote_address_length);
        if (received > 0) {
            starshield_frame_decoder_feed(&g_decoder, receive_buffer, (size_t)received,
                                          c_wifi_frame_callback, NULL);
        }
    }
    return NULL;
}
