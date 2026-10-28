// Falcon Tracker over-the-air packet format.
//
// One fixed-size, little-endian frame of FT_FRAME_LEN bytes. Fields are
// written byte by byte (no struct packing), so the encoding is identical on
// every compiler and CPU. The same layout is documented in docs/protocol.md
// and decoded in app/falcon_tracker/protocol.py -- keep the three in sync.
//
//  off size field       unit / scale
//  0   1    version     FT_VERSION
//  1   2    device_id   arbitrary id of the falcon tag
//  3   2    seq         packet counter, wraps at 65535
//  5   4    time        GPS UTC, seconds since 1970-01-01 (0 = unknown)
//  9   4    lat         degrees * 1e7 (signed)
//  13  4    lon         degrees * 1e7 (signed)
//  17  2    alt         metres above mean sea level (signed)
//  19  2    speed       cm/s
//  21  2    course      degrees * 100
//  23  1    sats        satellites used in fix
//  24  1    hdop        HDOP * 10 (255 = unknown/saturated)
//  25  2    batt_mv     battery voltage in millivolts
//  27  1    flags       FT_FLAG_* bits
//  28  2    crc         CRC-16/CCITT-FALSE over bytes 0..27
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define FT_VERSION 1
#define FT_FRAME_LEN 30

#define FT_FLAG_FIX       0x01  // position is from a current, valid fix
#define FT_FLAG_LOW_BATT  0x02  // battery below LOW_BATT_MV
#define FT_FLAG_GPS_OFF   0x04  // GPS was power-cycled this period (power-save mode)

typedef struct {
  uint16_t device_id;
  uint16_t seq;
  uint32_t time;
  int32_t lat_e7;
  int32_t lon_e7;
  int16_t alt_m;
  uint16_t speed_cms;
  uint16_t course_cdeg;
  uint8_t sats;
  uint8_t hdop_x10;
  uint16_t batt_mv;
  uint8_t flags;
} ft_fix_t;

typedef enum {
  FT_OK = 0,
  FT_ERR_LEN,
  FT_ERR_VERSION,
  FT_ERR_CRC,
} ft_status_t;

uint16_t ft_crc16(const uint8_t *data, size_t len);

// Writes exactly FT_FRAME_LEN bytes into out.
void ft_encode(const ft_fix_t *fix, uint8_t out[FT_FRAME_LEN]);

// Validates length, version and CRC, then fills fix.
ft_status_t ft_decode(const uint8_t *buf, size_t len, ft_fix_t *fix);

#ifdef __cplusplus
}
#endif
