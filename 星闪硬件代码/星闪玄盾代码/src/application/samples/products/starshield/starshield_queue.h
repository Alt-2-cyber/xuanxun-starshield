#ifndef STARSHIELD_QUEUE_H
#define STARSHIELD_QUEUE_H

#include <stdint.h>

typedef struct {
    unsigned long id;
    uint16_t max_message_size;
    uint8_t ready;
} starshield_queue_t;

int starshield_queue_create(starshield_queue_t *queue,
                            const char *name,
                            uint32_t queue_length,
                            uint16_t max_message_size);
int starshield_queue_push(starshield_queue_t *queue, const uint8_t *data, uint16_t length);
int starshield_queue_pop(starshield_queue_t *queue,
                         uint8_t *data,
                         uint32_t *length,
                         uint32_t timeout);

#endif
