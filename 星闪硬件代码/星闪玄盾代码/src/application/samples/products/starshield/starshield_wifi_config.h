#ifndef STARSHIELD_WIFI_CONFIG_H
#define STARSHIELD_WIFI_CONFIG_H

#include <stdio.h>

static inline int starshield_wifi_peer_is_broadcast(const char *address)
{
    unsigned int octets[4] = {0U, 0U, 0U, 0U};
    char trailing = '\0';

    if (address == NULL || sscanf(address, "%u.%u.%u.%u%c",
                                  &octets[0], &octets[1], &octets[2], &octets[3],
                                  &trailing) != 4) {
        return 0;
    }
    return octets[0] <= 255U && octets[1] <= 255U &&
           octets[2] <= 255U && octets[3] == 255U;
}

#endif
