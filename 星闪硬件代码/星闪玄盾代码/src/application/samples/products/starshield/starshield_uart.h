#ifndef STARSHIELD_UART_H
#define STARSHIELD_UART_H

#include <stdint.h>

#include "errcode.h"

typedef struct {
    uint8_t bus;
    uint16_t tx_pin;
    uint16_t rx_pin;
    uint8_t pin_mode;
    uint32_t baud_rate;
    uint8_t *rx_buffer;
    uint16_t rx_buffer_size;
} starshield_uart_config_t;

errcode_t starshield_uart_open(const starshield_uart_config_t *config);
int32_t starshield_uart_write(uint8_t bus, const uint8_t *data, uint16_t length);

#endif
