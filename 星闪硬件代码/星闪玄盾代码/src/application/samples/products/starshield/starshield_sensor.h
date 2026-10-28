#ifndef STARSHIELD_SENSOR_H
#define STARSHIELD_SENSOR_H

#include <stdbool.h>
#include <stdint.h>

typedef struct {
    bool temperature_valid;
    float temperature_c;
    bool smoke_valid;
    float smoke_ratio;
    bool gas_valid;
    float gas_ratio;
    uint8_t trigger_bits;
    char level[10];
} starshield_sensor_sample_t;

int starshield_sensor_read(starshield_sensor_sample_t *sample);

#endif
