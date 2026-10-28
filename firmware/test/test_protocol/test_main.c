#include <string.h>
#include <unity.h>

#include "protocol.h"

static ft_fix_t sample(void) {
  ft_fix_t f = {
      .device_id = 7,
      .seq = 65535,
      .time = 1793145600,  // 2026-10-28 00:00:00 UTC
      .lat_e7 = -62088000,  // -6.2088
      .lon_e7 = 1068456000, // 106.8456
      .alt_m = -12,
      .speed_cms = 2345,
      .course_cdeg = 35999,
      .sats = 11,
      .hdop_x10 = 9,
      .batt_mv = 3912,
      .flags = FT_FLAG_FIX | FT_FLAG_LOW_BATT,
  };
  return f;
}

void setUp(void) {}
void tearDown(void) {}

static void test_crc_known_vector(void) {
  // CRC-16/CCITT-FALSE check value for "123456789".
  TEST_ASSERT_EQUAL_HEX16(0x29B1, ft_crc16((const uint8_t *)"123456789", 9));
}

static void test_roundtrip(void) {
  ft_fix_t in = sample(), out;
  uint8_t buf[FT_FRAME_LEN];
  ft_encode(&in, buf);
  TEST_ASSERT_EQUAL(FT_OK, ft_decode(buf, sizeof(buf), &out));
  TEST_ASSERT_EQUAL(in.device_id, out.device_id);
  TEST_ASSERT_EQUAL(in.seq, out.seq);
  TEST_ASSERT_EQUAL(in.time, out.time);
  TEST_ASSERT_EQUAL(in.lat_e7, out.lat_e7);
  TEST_ASSERT_EQUAL(in.lon_e7, out.lon_e7);
  TEST_ASSERT_EQUAL(in.alt_m, out.alt_m);
  TEST_ASSERT_EQUAL(in.speed_cms, out.speed_cms);
  TEST_ASSERT_EQUAL(in.course_cdeg, out.course_cdeg);
  TEST_ASSERT_EQUAL(in.sats, out.sats);
  TEST_ASSERT_EQUAL(in.hdop_x10, out.hdop_x10);
  TEST_ASSERT_EQUAL(in.batt_mv, out.batt_mv);
  TEST_ASSERT_EQUAL(in.flags, out.flags);
}

static void test_layout_is_little_endian(void) {
  ft_fix_t in = sample();
  uint8_t buf[FT_FRAME_LEN];
  ft_encode(&in, buf);
  TEST_ASSERT_EQUAL_HEX8(FT_VERSION, buf[0]);
  TEST_ASSERT_EQUAL_HEX8(0x07, buf[1]);  // device_id low byte
  TEST_ASSERT_EQUAL_HEX8(0x00, buf[2]);
  TEST_ASSERT_EQUAL_HEX8(0xFF, buf[3]);  // seq
  TEST_ASSERT_EQUAL_HEX8(0xFF, buf[4]);
}

static void test_rejects_corruption(void) {
  ft_fix_t in = sample(), out;
  uint8_t buf[FT_FRAME_LEN];
  ft_encode(&in, buf);
  for (int i = 0; i < FT_FRAME_LEN; i++) {
    uint8_t copy[FT_FRAME_LEN];
    memcpy(copy, buf, sizeof(copy));
    copy[i] ^= 0x10;
    TEST_ASSERT_NOT_EQUAL(FT_OK, ft_decode(copy, sizeof(copy), &out));
  }
}

static void test_rejects_wrong_length_and_version(void) {
  ft_fix_t in = sample(), out;
  uint8_t buf[FT_FRAME_LEN];
  ft_encode(&in, buf);
  TEST_ASSERT_EQUAL(FT_ERR_LEN, ft_decode(buf, FT_FRAME_LEN - 1, &out));
  buf[0] = FT_VERSION + 1;
  TEST_ASSERT_EQUAL(FT_ERR_VERSION, ft_decode(buf, sizeof(buf), &out));
}

int main(void) {
  UNITY_BEGIN();
  RUN_TEST(test_crc_known_vector);
  RUN_TEST(test_roundtrip);
  RUN_TEST(test_layout_is_little_endian);
  RUN_TEST(test_rejects_corruption);
  RUN_TEST(test_rejects_wrong_length_and_version);
  return UNITY_END();
}
