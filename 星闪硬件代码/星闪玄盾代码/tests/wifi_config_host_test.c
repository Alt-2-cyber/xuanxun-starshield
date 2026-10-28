#include <stdio.h>

#include "../src/application/samples/products/starshield/starshield_wifi_config.h"

static int failures;

static void expect_broadcast(const char *address, int expected)
{
    int actual = starshield_wifi_peer_is_broadcast(address);
    if (actual != expected) {
        fprintf(stderr, "%s: expected broadcast=%d, got %d\n", address, expected, actual);
        failures++;
    }
}

int main(void)
{
    expect_broadcast("10.19.20.255", 1);
    expect_broadcast("192.168.1.255", 1);
    expect_broadcast("10.19.20.63", 0);
    expect_broadcast("10.19.20.1", 0);
    expect_broadcast("invalid", 0);

    if (failures != 0) {
        return 1;
    }
    puts("Wi-Fi endpoint configuration tests passed");
    return 0;
}
