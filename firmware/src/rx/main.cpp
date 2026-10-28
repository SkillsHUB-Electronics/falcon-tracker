// Base station (RX): receive LoRa frames and print one JSON object per line
// on USB serial. The laptop app (app/) reads these lines; you can also watch
// them with any serial monitor at 115200 baud.
//
// Lines that start with '{' are data. Anything else is a human-readable log.
#include <Arduino.h>
#include <RadioLib.h>
#include <SPI.h>

#include "config.h"
#include "protocol.h"

static SX1278 radio = new Module(LORA_NSS, LORA_DIO0, LORA_RST, RADIOLIB_NC);
static volatile bool packetReady = false;

static void IRAM_ATTR onDio0() { packetReady = true; }

static void led(bool on) {
  digitalWrite(LED_PIN, (on ^ LED_ACTIVE_LOW) ? HIGH : LOW);
}

static void printFix(const ft_fix_t &f, float rssi, float snr) {
  Serial.printf(
      "{\"id\":%u,\"seq\":%u,\"time\":%lu,\"lat\":%.7f,\"lon\":%.7f,\"alt\":%d,"
      "\"speed\":%.2f,\"course\":%.2f,\"sats\":%u,\"hdop\":%.1f,\"batt\":%.3f,"
      "\"fix\":%s,\"low_batt\":%s,\"rssi\":%.1f,\"snr\":%.2f}\n",
      f.device_id, f.seq, (unsigned long)f.time, f.lat_e7 / 1e7, f.lon_e7 / 1e7, f.alt_m,
      f.speed_cms / 100.0, f.course_cdeg / 100.0, f.sats, f.hdop_x10 / 10.0, f.batt_mv / 1000.0,
      (f.flags & FT_FLAG_FIX) ? "true" : "false", (f.flags & FT_FLAG_LOW_BATT) ? "true" : "false",
      rssi, snr);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  led(false);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  int st = radio.begin(LORA_FREQ_MHZ, LORA_BW_KHZ, LORA_SF, LORA_CR, LORA_SYNC_WORD,
                       LORA_TX_DBM, LORA_PREAMBLE);
  if (st != RADIOLIB_ERR_NONE) {
    for (;;) {
      Serial.printf("# radio init failed: %d (check SPI wiring and 3V3)\n", st);
      delay(1000);
    }
  }
  radio.setCRC(true);
  radio.setPacketReceivedAction(onDio0);
  radio.startReceive();
  Serial.printf("# falcon base ready on %.3f MHz SF%d BW%.0f\n", LORA_FREQ_MHZ, LORA_SF,
                LORA_BW_KHZ);
}

void loop() {
  if (!packetReady) {
    delay(1);
    return;
  }
  packetReady = false;

  uint8_t buf[64];
  const size_t len = radio.getPacketLength();
  const int st = radio.readData(buf, min(len, sizeof(buf)));
  const float rssi = radio.getRSSI();
  const float snr = radio.getSNR();

  ft_fix_t fix;
  const ft_status_t ds = (st == RADIOLIB_ERR_NONE) ? ft_decode(buf, len, &fix) : FT_ERR_CRC;
  if (ds == FT_OK) {
    led(true);
    printFix(fix, rssi, snr);
    led(false);
  } else {
    Serial.printf("{\"err\":%d,\"radio\":%d,\"len\":%u,\"rssi\":%.1f,\"snr\":%.2f}\n", ds, st,
                  (unsigned)len, rssi, snr);
  }
  radio.startReceive();
}
