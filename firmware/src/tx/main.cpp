// Falcon tag (TX): read GPS, send one LoRa frame, sleep, repeat.
//
// Power strategy
//   - radio sleeps (~1 uA) except while transmitting
//   - MCU light-sleeps between reports (~130 uA, RAM and GPS state kept)
//   - optionally the GPS itself is switched off for long intervals
#include <Arduino.h>
#include <RadioLib.h>
#include <SPI.h>
#include <TinyGPSPlus.h>
#include <driver/gpio.h>
#include <esp_sleep.h>

#include "config.h"
#include "protocol.h"

static SX1278 radio = new Module(LORA_NSS, LORA_DIO0, LORA_RST, RADIOLIB_NC);
static TinyGPSPlus gps;
static HardwareSerial gpsSerial(1);
static ft_fix_t last = {};  // last frame sent; keeps the last known position
static uint16_t seq = 0;

static const bool kGpsPowerSave =
    GPS_EN_PIN >= 0 && TX_INTERVAL_MS >= GPS_POWER_SAVE_MIN_INTERVAL_MS;

static void led(bool on) {
  digitalWrite(LED_PIN, (on ^ LED_ACTIVE_LOW) ? HIGH : LOW);
}

static void gpsPower(bool on) {
  if (GPS_EN_PIN < 0) return;
  gpio_hold_dis((gpio_num_t)GPS_EN_PIN);
  digitalWrite(GPS_EN_PIN, on ? LOW : HIGH);  // P-MOSFET: gate LOW = on
  gpio_hold_en((gpio_num_t)GPS_EN_PIN);       // keep level during light sleep
}

static uint16_t readBatteryMv() {
  if (BATT_ADC_PIN < 0) return 0;
  uint32_t sum = 0;
  for (int i = 0; i < 8; i++) sum += analogReadMilliVolts(BATT_ADC_PIN);
  return (uint16_t)(sum / 8 * BATT_DIVIDER);
}

// Days since 1970-01-01 for a proleptic Gregorian date (H. Hinnant).
static int32_t daysFromCivil(int y, unsigned m, unsigned d) {
  y -= m <= 2;
  const int era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = (unsigned)(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + (int32_t)doe - 719468;
}

static uint32_t gpsUnixTime() {
  if (!gps.date.isValid() || !gps.time.isValid() || gps.date.year() < 2020) return 0;
  return (uint32_t)daysFromCivil(gps.date.year(), gps.date.month(), gps.date.day()) * 86400UL +
         gps.time.hour() * 3600UL + gps.time.minute() * 60UL + gps.time.second();
}

// Feed NMEA until a position newer than the previous call arrives.
static bool waitForFreshFix(uint32_t timeout_ms) {
  gps.location.lat();  // reading clears TinyGPS's "updated" flag
  const uint32_t start = millis();
  while (millis() - start < timeout_ms) {
    while (gpsSerial.available()) gps.encode(gpsSerial.read());
    if (gps.location.isUpdated() && gps.location.isValid()) return true;
    delay(5);
  }
  return false;
}

static void buildFrame(ft_fix_t &f, bool fresh) {
  f.device_id = DEVICE_ID;
  f.seq = seq++;
  f.flags = kGpsPowerSave ? FT_FLAG_GPS_OFF : 0;
  if (fresh) {
    f.time = gpsUnixTime();
    f.lat_e7 = (int32_t)lround(gps.location.lat() * 1e7);
    f.lon_e7 = (int32_t)lround(gps.location.lng() * 1e7);
    f.alt_m = gps.altitude.isValid() ? (int16_t)lround(gps.altitude.meters()) : 0;
    f.speed_cms = gps.speed.isValid() ? (uint16_t)lround(gps.speed.mps() * 100) : 0;
    f.course_cdeg = gps.course.isValid() ? (uint16_t)lround(gps.course.deg() * 100) : 0;
    f.flags |= FT_FLAG_FIX;
  }  // else: keep the last known position, FIX flag cleared
  f.sats = gps.satellites.isValid() ? (uint8_t)min<uint32_t>(gps.satellites.value(), 255) : 0;
  f.hdop_x10 = gps.hdop.isValid() ? (uint8_t)min<int32_t>(gps.hdop.value() / 10, 255) : 255;
  f.batt_mv = readBatteryMv();
  if (f.batt_mv && f.batt_mv < LOW_BATT_MV) f.flags |= FT_FLAG_LOW_BATT;
}

static void sleepUntil(uint32_t wake_at_ms) {
  const int32_t left = (int32_t)(wake_at_ms - millis());
  if (left <= 0) return;
  esp_sleep_enable_timer_wakeup((uint64_t)left * 1000ULL);
  esp_light_sleep_start();
}

static void haltWithError(int code) {
  // Fast blink forever: the radio did not answer. Check SPI wiring and 3V3.
  for (;;) {
    Serial.printf("radio init failed: %d\n", code);
    for (int i = 0; i < 10; i++) { led(i & 1); delay(100); }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  led(true);
  if (GPS_EN_PIN >= 0) pinMode(GPS_EN_PIN, OUTPUT);
  gpsPower(true);
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  if (BATT_ADC_PIN >= 0) analogSetPinAttenuation(BATT_ADC_PIN, ADC_11db);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  int st = radio.begin(LORA_FREQ_MHZ, LORA_BW_KHZ, LORA_SF, LORA_CR, LORA_SYNC_WORD,
                       LORA_TX_DBM, LORA_PREAMBLE);
  if (st != RADIOLIB_ERR_NONE) haltWithError(st);
  radio.setCRC(true);
  radio.sleep();
  led(false);
  Serial.printf("falcon tag %d ready, interval %lu ms, gps power-save %s\n", DEVICE_ID,
                (unsigned long)TX_INTERVAL_MS, kGpsPowerSave ? "on" : "off");
}

void loop() {
  const uint32_t cycle_start = millis();

  if (kGpsPowerSave) gpsPower(true);
  const bool fresh = waitForFreshFix(kGpsPowerSave ? GPS_FIX_TIMEOUT_MS : 1500);
  if (kGpsPowerSave) gpsPower(false);

  buildFrame(last, fresh);
  uint8_t frame[FT_FRAME_LEN];
  ft_encode(&last, frame);

  led(true);
  const int st = radio.transmit(frame, sizeof(frame));
  led(false);
  radio.sleep();

  Serial.printf("seq=%u fix=%d lat=%.6f lon=%.6f sats=%u batt=%umV tx=%d\n", last.seq, fresh,
                last.lat_e7 / 1e7, last.lon_e7 / 1e7, last.sats, last.batt_mv, st);

  sleepUntil(cycle_start + TX_INTERVAL_MS);
}
