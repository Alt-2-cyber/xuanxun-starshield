#include "starshield_queue.h"

#include "soc_osal.h"

int starshield_queue_create(starshield_queue_t *queue,
                            const char *name,
                            uint32_t queue_length,
                            uint16_t max_message_size)
{
    int ret;

    if (queue == NULL || name == NULL || queue_length == 0U || max_message_size == 0U) {
        return -1;
    }
    ret = osal_msg_queue_create(name, queue_length, &queue->id, 0U, max_message_size);
    if (ret != OSAL_SUCCESS) {
        return ret;
    }
    queue->max_message_size = max_message_size;
    queue->ready = 1U;
    return 0;
}

int starshield_queue_push(starshield_queue_t *queue, const uint8_t *data, uint16_t length)
{
    if (queue == NULL || queue->ready == 0U || data == NULL || length == 0U ||
        length > queue->max_message_size) {
        return -1;
    }
    return (int)osal_msg_queue_write_copy(queue->id, (void *)data, length, 0U);
}

int starshield_queue_pop(starshield_queue_t *queue,
                         uint8_t *data,
                         uint32_t *length,
                         uint32_t timeout)
{
    if (queue == NULL || queue->ready == 0U || data == NULL || length == NULL) {
        return -1;
    }
    return (int)osal_msg_queue_read_copy(queue->id, data, length, timeout);
}
