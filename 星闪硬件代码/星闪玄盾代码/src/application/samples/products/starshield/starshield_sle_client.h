#ifndef STARSHIELD_SLE_CLIENT_H
#define STARSHIELD_SLE_CLIENT_H

#include <stdint.h>

#include "errcode.h"

errcode_t starshield_sle_client_init(void);
errcode_t starshield_sle_client_send(const uint8_t *data, uint16_t length);
uint8_t starshield_sle_client_is_ready(void);

#endif
