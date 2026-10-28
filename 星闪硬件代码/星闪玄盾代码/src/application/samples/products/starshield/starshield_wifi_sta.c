#include <string.h>

#include "cmsis_os2.h"
#include "td_type.h"
#include "soc_osal.h"
#include "wifi_device.h"
#include "wifi_event.h"
#include "wifi_hotspot.h"
#include "wifi_hotspot_config.h"
#include "lwip/ip4_addr.h"
#include "lwip/netifapi.h"

#include "starshield_wifi_sta.h"

#define STARSHIELD_WIFI_SCAN_LIMIT 64U
#define STARSHIELD_WIFI_CONNECT_TRIES 5U
#define STARSHIELD_WIFI_DHCP_TRIES 20U
#define STARSHIELD_WIFI_SCAN_WAIT_TRIES 50U
#define STARSHIELD_WIFI_IFNAME_MAX_SIZE 16U

static wifi_event_stru g_wifi_events = {0};
static volatile uint8_t g_wifi_scan_done;

static void wifi_scan_state_changed(td_s32 state, td_s32 size)
{
    (void)state;
    (void)size;
    g_wifi_scan_done = 1U;
}

static void wifi_connection_changed(td_s32 state,
                                    const wifi_linked_info_stru *info,
                                    td_s32 reason_code)
{
    (void)info;
    (void)reason_code;
    osal_printk("[STARSHIELD] Wi-Fi STA connection state=%d\r\n", state);
}

static errcode_t get_matching_network(const char *ssid,
                                      const char *password,
                                      wifi_sta_config_stru *network)
{
    uint32_t count = STARSHIELD_WIFI_SCAN_LIMIT;
    uint32_t scan_length = sizeof(wifi_scan_info_stru) * STARSHIELD_WIFI_SCAN_LIMIT;
    wifi_scan_info_stru *results;
    uint32_t index;
    size_t ssid_length;
    size_t password_length;

    if (ssid == NULL || password == NULL || network == NULL) {
        return ERRCODE_INVALID_PARAM;
    }
    ssid_length = strlen(ssid);
    password_length = strlen(password);
    if (ssid_length == 0U || ssid_length >= WIFI_MAX_SSID_LEN ||
        password_length == 0U || password_length >= WIFI_MAX_KEY_LEN) {
        return ERRCODE_INVALID_PARAM;
    }
    results = osal_kmalloc(scan_length, OSAL_GFP_ATOMIC);
    if (results == NULL) {
        return ERRCODE_MALLOC;
    }
    (void)memset(results, 0, scan_length);
    if (wifi_sta_get_scan_info(results, &count) != ERRCODE_SUCC) {
        osal_kfree(results);
        return ERRCODE_FAIL;
    }
    if (count > STARSHIELD_WIFI_SCAN_LIMIT) {
        count = STARSHIELD_WIFI_SCAN_LIMIT;
    }
    for (index = 0U; index < count; index++) {
        if (ssid_length == strlen(results[index].ssid) &&
            memcmp(ssid, results[index].ssid, ssid_length) == 0) {
            break;
        }
    }
    if (index >= count) {
        osal_kfree(results);
        return ERRCODE_FAIL;
    }
    if (memcpy_s(network->ssid, sizeof(network->ssid), results[index].ssid,
                 ssid_length + 1U) != EOK ||
        memcpy_s(network->bssid, WIFI_MAC_LEN, results[index].bssid,
                 WIFI_MAC_LEN) != EOK ||
        memcpy_s(network->pre_shared_key, sizeof(network->pre_shared_key),
                 password, password_length + 1U) != EOK) {
        osal_kfree(results);
        return ERRCODE_MEMCPY;
    }
    network->security_type = results[index].security_type;
    network->wifi_psk_type = 0;
    network->strengthen_verify = 0;
    network->ip_type = DHCP;
    osal_kfree(results);
    return ERRCODE_SUCC;
}

errcode_t starshield_wifi_sta_connect(const char *ssid, const char *password)
{
    char ifname[STARSHIELD_WIFI_IFNAME_MAX_SIZE + 1U] = "wlan0";
    wifi_sta_config_stru network = {0};
    wifi_linked_info_stru status = {0};
    struct netif *netif;
    uint8_t try_index;
    uint8_t scan_wait;

    if (ssid == NULL || password == NULL || strlen(ssid) == 0U ||
        strlen(ssid) >= WIFI_MAX_SSID_LEN || strlen(password) == 0U ||
        strlen(password) >= WIFI_MAX_KEY_LEN) {
        return ERRCODE_INVALID_PARAM;
    }
    if (wifi_sta_enable() != ERRCODE_SUCC) {
        return ERRCODE_FAIL;
    }
    g_wifi_events.wifi_event_scan_state_changed = wifi_scan_state_changed;
    g_wifi_events.wifi_event_connection_changed = wifi_connection_changed;
    if (wifi_register_event_cb(&g_wifi_events) != ERRCODE_SUCC) {
        osal_printk("[STARSHIELD] Wi-Fi STA event callback registration failed\r\n");
    }
    for (try_index = 0U; try_index < STARSHIELD_WIFI_CONNECT_TRIES; try_index++) {
        g_wifi_scan_done = 0U;
        if (wifi_sta_scan() != ERRCODE_SUCC) {
            osDelay(100U);
            continue;
        }
        for (scan_wait = 0U; scan_wait < STARSHIELD_WIFI_SCAN_WAIT_TRIES; scan_wait++) {
            if (g_wifi_scan_done != 0U) {
                break;
            }
            osDelay(20U);
        }
        if (g_wifi_scan_done == 0U ||
            get_matching_network(ssid, password, &network) != ERRCODE_SUCC ||
            wifi_sta_connect(&network) != ERRCODE_SUCC) {
            continue;
        }
        for (uint8_t status_try = 0U; status_try < STARSHIELD_WIFI_CONNECT_TRIES; status_try++) {
            osDelay(50U);
            (void)memset(&status, 0, sizeof(status));
            if (wifi_sta_get_ap_info(&status) == ERRCODE_SUCC &&
                status.conn_state == WIFI_CONNECTED) {
                break;
            }
        }
        if (status.conn_state == WIFI_CONNECTED) {
            break;
        }
    }
    if (status.conn_state != WIFI_CONNECTED) {
        return ERRCODE_FAIL;
    }
    netif = netifapi_netif_find(ifname);
    if (netif == NULL || netifapi_dhcp_start(netif) != ERR_OK) {
        return ERRCODE_FAIL;
    }
    for (try_index = 0U; try_index < STARSHIELD_WIFI_DHCP_TRIES; try_index++) {
        osDelay(50U);
        if (netifapi_dhcp_is_bound(netif) == ERR_OK) {
            osal_printk("[STARSHIELD] Wi-Fi STA DHCP bound\r\n");
            return ERRCODE_SUCC;
        }
    }
    return ERRCODE_FAIL;
}
