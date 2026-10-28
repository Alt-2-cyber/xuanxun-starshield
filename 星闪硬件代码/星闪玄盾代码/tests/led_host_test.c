#include <stdio.h>

#include "../src/application/samples/products/starshield/starshield_led_color.h"

static int g_failures;

static void expect_rgb(const char *name, uint8_t mask, uint8_t red, uint8_t green, uint8_t blue)
{
    starshield_led_rgb_t actual = starshield_led_color_from_mask(mask);
    if (actual.red != red || actual.green != green || actual.blue != blue) {
        fprintf(stderr, "%s: expected RGB(%u,%u,%u), got RGB(%u,%u,%u)\n",
                name, red, green, blue, actual.red, actual.green, actual.blue);
        g_failures++;
    }
}

int main(void)
{
    expect_rgb("R-SF", 0x01U, 0xFFU, 0x00U, 0x00U);
    expect_rgb("R-SENSE", 0x02U, 0x00U, 0xFFU, 0x00U);
    expect_rgb("R-WIFI", 0x04U, 0x00U, 0x00U, 0xFFU);
    expect_rgb("C-SF", 0x03U, 0xFFU, 0xFFU, 0x00U);
    expect_rgb("C-WIFI", 0x05U, 0xFFU, 0x00U, 0xFFU);
    expect_rgb("off", 0x00U, 0x00U, 0x00U, 0x00U);

    if (g_failures != 0) {
        return 1;
    }
    puts("LED color mapping tests passed");
    return 0;
}
