#include "starshield_uart.h"

#include "pinctrl.h"
#include "soc_osal.h"
#include "uart.h"

#include "starshield_config.h"

static uint8_t g_unused_rx_buffer;

errcode_t starshield_uart_open(const starshield_uart_config_t *config)
{
    uart_attr_t attributes = {0};
    uart_pin_config_t pins = {
        .tx_pin = PIN_NONE,
        .rx_pin = PIN_NONE,
        .cts_pin = PIN_NONE,
        .rts_pin = PIN_NONE
    };
    uart_buffer_config_t buffer;

    if (config == NULL) {
        return ERRCODE_FAIL;
    }
    attributes.baud_rate = config->baud_rate;
    attributes.data_bits = UART_DATA_BIT_8;
    attributes.stop_bits = UART_STOP_BIT_1;
    attributes.parity = UART_PARITY_NONE;
    attributes.flow_ctrl = UART_FLOW_CTRL_NONE;
    buffer.rx_buffer = config->rx_buffer == NULL ? &g_unused_rx_buffer : config->rx_buffer;
    buffer.rx_buffer_size = config->rx_buffer_size == 0U ? 1U : config->rx_buffer_size;
    if (!starshield_pinmux_is_configured(config->tx_pin) ||
        !starshield_pinmux_is_configured(config->rx_pin)) {
        osal_printk("[STARSHIELD] UART%u PinMux is unverified; configure both pins before starting\r\n",
                    config->bus);
        return ERRCODE_INVALID_PARAM;
    }
    pins.tx_pin = (pin_t)config->tx_pin;
    pins.rx_pin = (pin_t)config->rx_pin;
    (void)uapi_pin_set_mode(pins.tx_pin, (pin_mode_t)config->pin_mode);
    (void)uapi_pin_set_mode(pins.rx_pin, (pin_mode_t)config->pin_mode);
    uapi_uart_deinit(config->bus);
    return uapi_uart_init(config->bus, &pins, &attributes, NULL, &buffer);
}

int32_t starshield_uart_write(uint8_t bus, const uint8_t *data, uint16_t length)
{
    if (data == NULL || length == 0U) {
        return -1;
    }
    return (int32_t)uapi_uart_write(bus, data, length, 0U);
}
