#ifndef STARSHIELD_LED_COLOR_H
#define STARSHIELD_LED_COLOR_H

#include <stdint.h>

#define STARSHIELD_LED_RED 0x01U
#define STARSHIELD_LED_GREEN 0x02U
#define STARSHIELD_LED_BLUE 0x04U

typedef struct {
    uint8_t red;
    uint8_t green;
    uint8_t blue;
} starshield_led_rgb_t;

static inline starshield_led_rgb_t starshield_led_color_from_mask(uint8_t mask)
{
    starshield_led_rgb_t color = {
        .red = (mask & STARSHIELD_LED_RED) != 0U ? 0xFFU : 0x00U,
        .green = (mask & STARSHIELD_LED_GREEN) != 0U ? 0xFFU : 0x00U,
        .blue = (mask & STARSHIELD_LED_BLUE) != 0U ? 0xFFU : 0x00U
    };
    return color;
}

#endif
