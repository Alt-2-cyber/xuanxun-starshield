#include "starshield_sensor.h"

#include <string.h>

/* Replace this weak hook with the board-specific AHT20/ADC implementation after wiring is verified. */
__attribute__((weak)) int starshield_sensor_read(starshield_sensor_sample_t *sample)
{
    if (sample == NULL) {
        return -1;
    }
    (void)memset(sample, 0, sizeof(*sample));
    sample->temperature_valid = true;
    sample->temperature_c = 24.0f;
    (void)strncpy(sample->level, "NORMAL", sizeof(sample->level) - 1U);
    return 0;
}
