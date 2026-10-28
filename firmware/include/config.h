// Build-time configuration shared by the TX (falcon tag) and RX (base station).
// Anything you are likely to change lives here. Values can also be overridden
// from platformio.ini with -D flags, e.g. -D DEVICE_ID=2.
#pragma once

// ---------------------------------------------------------------- identity
#ifndef DEVICE_ID
#define DEVICE_ID 1  // unique per falcon tag; shown on the map
#endif

// ------------------------------------------------- ESP32-C3 Super Mini pins
// SPI to XL1278-SMT (SX1278). GPIO4..7 are the board's default SPI pins.
#define LORA_SCK   4
#define LORA_MISO  5
#define LORA_MOSI  6
#define LORA_NSS   7
#define LORA_RST   10
#define LORA_DIO0  3  // TxDone / RxDone interrupt

// UART1 to ATGM336H. Pins named from the ESP32 side.
#define GPS_RX_PIN 20  // ESP32 RX  <- GPS TX
#define GPS_TX_PIN 21  // ESP32 TX  -> GPS RX
#define GPS_BAUD   9600

// Optional high-side switch (P-MOSFET) that cuts GPS power between fixes.
// -1 = GPS always powered (simplest wiring). See docs/hardware.md.
#ifndef GPS_EN_PIN
#define GPS_EN_PIN -1
#endif

// Battery sense through a 100k/100k divider. -1 disables it.
#define BATT_ADC_PIN  0
#define BATT_DIVIDER  2.0f
#define LOW_BATT_MV   3500

#define LED_PIN        8  // on-board blue LED, active LOW
#define LED_ACTIVE_LOW 1

// ------------------------------------------------------------------- radio
// Both ends MUST use identical values. Check your local regulations for the
// 433 MHz band (frequency, max power, duty cycle) before deploying.
#define LORA_FREQ_MHZ   433.775f
#define LORA_BW_KHZ     125.0f
#define LORA_SF         9
#define LORA_CR         7      // 4/7
#define LORA_SYNC_WORD  0x12   // private network
#define LORA_TX_DBM     17     // 2..17 dBm on PA_BOOST (20 needs +PA config)
#define LORA_PREAMBLE   8

// -------------------------------------------------------------- TX timing
#ifndef TX_INTERVAL_MS
#define TX_INTERVAL_MS 5000UL  // time between position reports
#endif
// When GPS_EN_PIN is set and the interval is at least this long, the GPS is
// switched off while the tag sleeps. Hot start (with the module's backup
// cell) usually takes 1-5 s.
#define GPS_POWER_SAVE_MIN_INTERVAL_MS 30000UL
#define GPS_FIX_TIMEOUT_MS 20000UL  // give up waiting for a fresh fix after this
