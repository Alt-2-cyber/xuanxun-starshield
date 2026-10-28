#include "starshield_sle_client.h"

#include <stdbool.h>
#include <stddef.h>
#include <string.h>

#include "bts_le_gap.h"
#include "common_def.h"
#include "product.h"
#include "securec.h"
#include "sle_connection_manager.h"
#include "sle_device_discovery.h"
#include "sle_errcode.h"
#include "sle_ssap_client.h"
#include "soc_osal.h"

#include "starshield_config.h"

static sle_announce_seek_callbacks_t g_seek_callbacks = {0};
static sle_connection_callbacks_t g_connection_callbacks = {0};
static ssapc_callbacks_t g_ssapc_callbacks = {0};
static sle_addr_t g_remote_addr = {0};
static ssapc_write_param_t g_write_param = {0};
static uint16_t g_connection_id;
static uint8_t g_ready;

static bool data_contains(const uint8_t *data, uint8_t data_length, const char *needle)
{
    size_t needle_length;

    if (data == NULL || needle == NULL) {
        return false;
    }
    needle_length = strlen(needle);
    if (needle_length == 0U || needle_length > data_length) {
        return false;
    }
    for (size_t index = 0U; index + needle_length <= data_length; index++) {
        if (memcmp(data + index, needle, needle_length) == 0) {
            return true;
        }
    }
    return false;
}

static void starshield_sle_start_scan(void)
{
    sle_seek_param_t parameter = {0};
    parameter.own_addr_type = 0;
    parameter.filter_duplicates = 0;
    parameter.seek_filter_policy = 0;
    parameter.seek_phys = 1;
    parameter.seek_type[0] = 1;
    parameter.seek_interval[0] = STARSHIELD_SLE_SCAN_INTERVAL;
    parameter.seek_window[0] = STARSHIELD_SLE_SCAN_WINDOW;
    (void)sle_set_seek_param(&parameter);
    (void)sle_start_seek();
}

static void starshield_sle_enable_callback(errcode_t status)
{
    osal_printk("[STARSHIELD] SLE enable status=0x%x\r\n", status);
    if (status == ERRCODE_SLE_SUCCESS) {
        starshield_sle_start_scan();
    }
}

static void seek_enable_callback(errcode_t status)
{
    if (status != ERRCODE_SLE_SUCCESS) {
        osal_printk("[STARSHIELD] SLE seek enable failed: 0x%x\r\n", status);
    }
}

static void seek_result_callback(sle_seek_result_info_t *result)
{
    if (result == NULL || result->data == NULL) {
        return;
    }
    if (data_contains(result->data, result->data_length, STARSHIELD_SLE_SERVER_NAME)) {
        (void)memcpy_s(&g_remote_addr, sizeof(g_remote_addr), &result->addr, sizeof(result->addr));
        (void)sle_stop_seek();
    }
}

static void seek_disable_callback(errcode_t status)
{
    if (status != ERRCODE_SLE_SUCCESS) {
        osal_printk("[STARSHIELD] SLE seek disable failed: 0x%x\r\n", status);
        return;
    }
    (void)sle_remove_paired_remote_device(&g_remote_addr);
    (void)sle_connect_remote_device(&g_remote_addr);
}

static void connect_state_changed_callback(uint16_t connection_id,
                                           const sle_addr_t *address,
                                           sle_acb_state_t connection_state,
                                           sle_pair_state_t pair_state,
                                           sle_disc_reason_t disconnect_reason)
{
    (void)address;
    (void)disconnect_reason;
    g_connection_id = connection_id;
    if (connection_state == SLE_ACB_STATE_CONNECTED) {
        g_ready = 0U;
        if (pair_state == SLE_PAIR_NONE) {
            (void)sle_pair_remote_device(&g_remote_addr);
        }
    } else if (connection_state == SLE_ACB_STATE_DISCONNECTED) {
        g_ready = 0U;
        starshield_sle_start_scan();
    }
}

static void pair_complete_callback(uint16_t connection_id, const sle_addr_t *address, errcode_t status)
{
    (void)address;
    if (status == ERRCODE_SLE_SUCCESS) {
        ssap_exchange_info_t information = {0};
        g_connection_id = connection_id;
        information.mtu_size = STARSHIELD_SLE_MTU;
        information.version = 1;
        (void)ssapc_exchange_info_req(0, connection_id, &information);
    }
}

static void exchange_info_callback(uint8_t client_id,
                                   uint16_t connection_id,
                                   ssap_exchange_info_t *information,
                                   errcode_t status)
{
    ssapc_find_structure_param_t parameter = {0};
    (void)client_id;
    (void)information;
    if (status != ERRCODE_SLE_SUCCESS) {
        return;
    }
    parameter.type = SSAP_FIND_TYPE_PROPERTY;
    parameter.start_hdl = 1;
    parameter.end_hdl = 0xFFFF;
    (void)ssapc_find_structure(0, connection_id, &parameter);
}

static void find_structure_callback(uint8_t client_id,
                                    uint16_t connection_id,
                                    ssapc_find_service_result_t *service,
                                    errcode_t status)
{
    (void)client_id;
    (void)connection_id;
    if (status == ERRCODE_SLE_SUCCESS && service != NULL) {
        osal_printk("[STARSHIELD] SLE service discovered 0x%x-0x%x\r\n",
                    service->start_hdl, service->end_hdl);
    }
}

static void find_property_callback(uint8_t client_id,
                                   uint16_t connection_id,
                                   ssapc_find_property_result_t *property,
                                   errcode_t status)
{
    (void)client_id;
    (void)connection_id;
    if (status == ERRCODE_SLE_SUCCESS && property != NULL) {
        g_write_param.handle = property->handle;
        g_write_param.type = SSAP_PROPERTY_TYPE_VALUE;
        g_ready = 1U;
    }
}

static void find_structure_complete_callback(uint8_t client_id,
                                             uint16_t connection_id,
                                             ssapc_find_structure_result_t *result,
                                             errcode_t status)
{
    (void)client_id;
    (void)connection_id;
    (void)result;
    (void)status;
}

static void write_confirmation_callback(uint8_t client_id,
                                        uint16_t connection_id,
                                        ssapc_write_result_t *result,
                                        errcode_t status)
{
    (void)client_id;
    (void)connection_id;
    (void)result;
    if (status != ERRCODE_SLE_SUCCESS) {
        osal_printk("[STARSHIELD] SLE write failed: 0x%x\r\n", status);
    }
}

static void notification_callback(uint8_t client_id,
                                  uint16_t connection_id,
                                  ssapc_handle_value_t *data,
                                  errcode_t status)
{
    (void)client_id;
    (void)connection_id;
    (void)data;
    (void)status;
}

static void indication_callback(uint8_t client_id,
                                uint16_t connection_id,
                                ssapc_handle_value_t *data,
                                errcode_t status)
{
    (void)client_id;
    (void)connection_id;
    (void)data;
    (void)status;
}

errcode_t starshield_sle_client_init(void)
{
    errcode_t ret;

    g_seek_callbacks.sle_enable_cb = starshield_sle_enable_callback;
    g_seek_callbacks.seek_enable_cb = seek_enable_callback;
    g_seek_callbacks.seek_result_cb = seek_result_callback;
    g_seek_callbacks.seek_disable_cb = seek_disable_callback;
    (void)sle_announce_seek_register_callbacks(&g_seek_callbacks);

    g_connection_callbacks.connect_state_changed_cb = connect_state_changed_callback;
    g_connection_callbacks.pair_complete_cb = pair_complete_callback;
    (void)sle_connection_register_callbacks(&g_connection_callbacks);

    g_ssapc_callbacks.exchange_info_cb = exchange_info_callback;
    g_ssapc_callbacks.find_structure_cb = find_structure_callback;
    g_ssapc_callbacks.ssapc_find_property_cbk = find_property_callback;
    g_ssapc_callbacks.find_structure_cmp_cb = find_structure_complete_callback;
    g_ssapc_callbacks.write_cfm_cb = write_confirmation_callback;
    g_ssapc_callbacks.notification_cb = notification_callback;
    g_ssapc_callbacks.indication_cb = indication_callback;
    (void)ssapc_register_callbacks(&g_ssapc_callbacks);

    osal_msleep(STARSHIELD_SLE_START_DELAY_MS);
    ret = enable_sle();
    if (ret != ERRCODE_SLE_SUCCESS) {
        osal_printk("[STARSHIELD] enable_sle failed: 0x%x\r\n", ret);
    }
    return ret;
}

errcode_t starshield_sle_client_send(const uint8_t *data, uint16_t length)
{
    if (data == NULL || length == 0U || length > STARSHIELD_SLE_MTU || g_ready == 0U) {
        return ERRCODE_FAIL;
    }
    g_write_param.data = (uint8_t *)data;
    g_write_param.data_len = length;
    return ssapc_write_req(0, g_connection_id, &g_write_param);
}

uint8_t starshield_sle_client_is_ready(void)
{
    return g_ready;
}
