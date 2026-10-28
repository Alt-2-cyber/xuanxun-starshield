#include "starshield_led.h"

#include "common_def.h"
#include "gpio.h"
#include "pinctrl.h"
#include "soc_osal.h"
#include "tcxo.h"

#include "starshield_config.h"

#define STARSHIELD_SK6805_PIN_MODE 4U
#define STARSHIELD_GPIO_OUTPUT_SET_REG 0x44028030U
#define STARSHIELD_GPIO_OUTPUT_CLEAR_REG 0x44028034U
#define STARSHIELD_SK6805_RESET_US 100U

/* The SDK exposes this timing primitive without declaring it in tcxo.h. */
extern errcode_t uapi_tcxo_delay_count(uint16_t ticks_delay);

static void starshield_led_write_one(void)
{
    uapi_reg_setbit(STARSHIELD_GPIO_OUTPUT_SET_REG, CONFIG_STARSHIELD_LED_DATA_PIN);
    (void)uapi_tcxo_delay_count(8U);
    uapi_reg_setbit(STARSHIELD_GPIO_OUTPUT_CLEAR_REG, CONFIG_STARSHIELD_LED_DATA_PIN);
    (void)uapi_tcxo_delay_us(2U);
}

static void starshield_led_write_zero(void)
{
    uint32_t sample = 0U;

    uapi_reg_setbit(STARSHIELD_GPIO_OUTPUT_SET_REG, CONFIG_STARSHIELD_LED_DATA_PIN);
    for (uint8_t index = 0U; index < 7U; index++) {
        (void)uapi_reg_read32(STARSHIELD_GPIO_OUTPUT_SET_REG, sample);
    }
    uapi_reg_setbit(STARSHIELD_GPIO_OUTPUT_CLEAR_REG, CONFIG_STARSHIELD_LED_DATA_PIN);
    (void)uapi_tcxo_delay_us(2U);
}

static void starshield_led_write_byte(uint8_t value)
{
    for (int8_t bit = 7; bit >= 0; bit--) {
        if ((value & (uint8_t)(1U << bit)) != 0U) {
            starshield_led_write_one();
        } else {
            starshield_led_write_zero();
        }
    }
}

errcode_t starshield_led_init(void)
{
    errcode_t ret = uapi_pin_set_mode(CONFIG_STARSHIELD_LED_DATA_PIN,
                                      STARSHIELD_SK6805_PIN_MODE);
    if (ret != ERRCODE_SUCC) {
        osal_printk("[STARSHIELD] SK6805 GPIO%u pinmux failed: 0x%x\r\n",
                    CONFIG_STARSHIELD_LED_DATA_PIN, ret);
        return ret;
    }

    uapi_gpio_init();
    ret = uapi_gpio_set_dir(CONFIG_STARSHIELD_LED_DATA_PIN, GPIO_DIRECTION_OUTPUT);
    if (ret != ERRCODE_SUCC) {
        osal_printk("[STARSHIELD] SK6805 GPIO%u direction failed: 0x%x\r\n",
                    CONFIG_STARSHIELD_LED_DATA_PIN, ret);
        return ret;
    }

    uapi_reg_setbit(STARSHIELD_GPIO_OUTPUT_CLEAR_REG, CONFIG_STARSHIELD_LED_DATA_PIN);
    (void)uapi_tcxo_delay_us(STARSHIELD_SK6805_RESET_US);
    return starshield_led_set_mask(CONFIG_STARSHIELD_LED_MASK);
}

errcode_t starshield_led_set_mask(uint8_t mask)
{
    starshield_led_rgb_t color;

    if ((mask & (uint8_t)~(STARSHIELD_LED_RED | STARSHIELD_LED_GREEN | STARSHIELD_LED_BLUE)) != 0U) {
        return ERRCODE_INVALID_PARAM;
    }

    color = starshield_led_color_from_mask(mask);
    /* SK6805 uses GRB byte order; the reset-low interval latches the pixel. */
    starshield_led_write_byte(color.green);
    starshield_led_write_byte(color.red);
    starshield_led_write_byte(color.blue);
    (void)uapi_tcxo_delay_us(STARSHIELD_SK6805_RESET_US);
    return ERRCODE_SUCC;
}
