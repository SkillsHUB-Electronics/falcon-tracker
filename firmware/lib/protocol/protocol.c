#include "protocol.h"

uint16_t ft_crc16(const uint8_t *data, size_t len) {
  // CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no xorout.
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= (uint16_t)data[i] << 8;
    for (int b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);
    }
  }
  return crc;
}

static uint8_t *put16(uint8_t *p, uint16_t v) {
  p[0] = (uint8_t)v;
  p[1] = (uint8_t)(v >> 8);
  return p + 2;
}

static uint8_t *put32(uint8_t *p, uint32_t v) {
  p = put16(p, (uint16_t)v);
  return put16(p, (uint16_t)(v >> 16));
}

static uint16_t get16(const uint8_t *p) { return (uint16_t)(p[0] | (p[1] << 8)); }

static uint32_t get32(const uint8_t *p) { return get16(p) | ((uint32_t)get16(p + 2) << 16); }

void ft_encode(const ft_fix_t *f, uint8_t out[FT_FRAME_LEN]) {
  uint8_t *p = out;
  *p++ = FT_VERSION;
  p = put16(p, f->device_id);
  p = put16(p, f->seq);
  p = put32(p, f->time);
  p = put32(p, (uint32_t)f->lat_e7);
  p = put32(p, (uint32_t)f->lon_e7);
  p = put16(p, (uint16_t)f->alt_m);
  p = put16(p, f->speed_cms);
  p = put16(p, f->course_cdeg);
  *p++ = f->sats;
  *p++ = f->hdop_x10;
  p = put16(p, f->batt_mv);
  *p++ = f->flags;
  put16(p, ft_crc16(out, FT_FRAME_LEN - 2));
}

ft_status_t ft_decode(const uint8_t *b, size_t len, ft_fix_t *f) {
  if (len != FT_FRAME_LEN) return FT_ERR_LEN;
  if (b[0] != FT_VERSION) return FT_ERR_VERSION;
  if (get16(b + 28) != ft_crc16(b, FT_FRAME_LEN - 2)) return FT_ERR_CRC;
  f->device_id = get16(b + 1);
  f->seq = get16(b + 3);
  f->time = get32(b + 5);
  f->lat_e7 = (int32_t)get32(b + 9);
  f->lon_e7 = (int32_t)get32(b + 13);
  f->alt_m = (int16_t)get16(b + 17);
  f->speed_cms = get16(b + 19);
  f->course_cdeg = get16(b + 21);
  f->sats = b[23];
  f->hdop_x10 = b[24];
  f->batt_mv = get16(b + 25);
  f->flags = b[27];
  return FT_OK;
}
