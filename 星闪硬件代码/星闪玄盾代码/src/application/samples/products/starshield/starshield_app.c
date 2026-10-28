#include "app_init.h"
#include "soc_osal.h"

#include "starshield_config.h"
#include "starshield_led.h"

#if defined(CONFIG_STARSHIELD_ROLE_R_SENSE)
void *starshield_role_r_sense_run(const char *argument);
#define STARSHIELD_ROLE_RUN starshield_role_r_sense_run
#define STARSHIELD_ROLE_NAME "R-SENSE"
#elif defined(CONFIG_STARSHIELD_ROLE_R_SF)
void *starshield_role_r_sf_run(const char *argument);
#define STARSHIELD_ROLE_RUN starshield_role_r_sf_run
#define STARSHIELD_ROLE_NAME "R-SF"
#elif defined(CONFIG_STARSHIELD_ROLE_R_WIFI)
void *starshield_role_r_wifi_run(const char *argument);
#define STARSHIELD_ROLE_RUN starshield_role_r_wifi_run
#define STARSHIELD_ROLE_NAME "R-WIFI"
#elif defined(CONFIG_STARSHIELD_ROLE_C_SF)
void *starshield_role_c_sf_run(const char *argument);
#define STARSHIELD_ROLE_RUN starshield_role_c_sf_run
#define STARSHIELD_ROLE_NAME "C-SF"
#elif defined(CONFIG_STARSHIELD_ROLE_C_WIFI)
void *starshield_role_c_wifi_run(const char *argument);
#define STARSHIELD_ROLE_RUN starshield_role_c_wifi_run
#define STARSHIELD_ROLE_NAME "C-WIFI"
#else
#error "Select one CONFIG_STARSHIELD_ROLE_* role in Kconfig"
#endif

#define STARSHIELD_TASK_STACK_SIZE 0x2000U
#define STARSHIELD_TASK_PRIORITY 24U

static void starshield_entry(void)
{
    osal_task *task;

    if (starshield_led_init() != ERRCODE_SUCC) {
        osal_printk("[STARSHIELD] identity LED initialization failed\r\n");
    }
    osal_printk("[STARSHIELD] role=%s led_mask=%u uart2_tx=%u uart2_rx=%u\r\n",
                STARSHIELD_ROLE_NAME,
                CONFIG_STARSHIELD_LED_MASK,
                CONFIG_STARSHIELD_UART2_TX_PIN,
                CONFIG_STARSHIELD_UART2_RX_PIN);
    osal_kthread_lock();
    task = osal_kthread_create((osal_kthread_handler)STARSHIELD_ROLE_RUN,
                               0, "StarShieldRole", STARSHIELD_TASK_STACK_SIZE);
    if (task != NULL) {
        osal_kthread_set_priority(task, STARSHIELD_TASK_PRIORITY);
        osal_kfree(task);
    }
    osal_kthread_unlock();
}

app_run(starshield_entry);
