#ifndef STARSHIELD_LED_H
#define STARSHIELD_LED_H

#include <stdint.h>

#include "errcode.h"
#include "starshield_led_color.h"

errcode_t starshield_led_init(void);
errcode_t starshield_led_set_mask(uint8_t mask);

#endif
