set(STARSHIELD_REFERENCE_SLE_DIR
    ${ROOT_DIR}/application/samples/products/sle_relay)

set(STARSHIELD_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_app.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_protocol.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_queue.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_sensor.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_uart.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_led.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_role_r_sense.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_role_r_sf.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_role_r_wifi.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_role_c_sf.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_role_c_wifi.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_sle_client.c
    ${CMAKE_CURRENT_SOURCE_DIR}/starshield_wifi_sta.c
)

set(STARSHIELD_HEADERS
    ${CMAKE_CURRENT_SOURCE_DIR}
)

if(EXISTS ${STARSHIELD_REFERENCE_SLE_DIR}/sle_uart_server/sle_uart_server.c AND
   EXISTS ${STARSHIELD_REFERENCE_SLE_DIR}/sle_uart_server/sle_uart_server_adv.c)
    list(APPEND STARSHIELD_SOURCES
        ${STARSHIELD_REFERENCE_SLE_DIR}/sle_uart_server/sle_uart_server.c
        ${STARSHIELD_REFERENCE_SLE_DIR}/sle_uart_server/sle_uart_server_adv.c
    )
    list(APPEND STARSHIELD_HEADERS
        ${STARSHIELD_REFERENCE_SLE_DIR}/sle_uart_server
    )
else()
    message(FATAL_ERROR "StarShield requires the local reference SLE UART server sources")
endif()

set(SOURCES "${SOURCES}" ${STARSHIELD_SOURCES} PARENT_SCOPE)
set(PUBLIC_HEADER "${PUBLIC_HEADER}" ${STARSHIELD_HEADERS} PARENT_SCOPE)
