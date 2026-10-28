#ifndef STARSHIELD_WIFI_STA_H
#define STARSHIELD_WIFI_STA_H

#include "errcode.h"

errcode_t starshield_wifi_sta_connect(const char *ssid, const char *password);

#endif
