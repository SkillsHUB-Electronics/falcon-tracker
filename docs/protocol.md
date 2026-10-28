# Protocol

There are two formats: the **radio frame** sent from tag to base, and the **JSON
line** the base station prints on USB for the laptop app.

## Radio frame (LoRa payload)

Fixed size, 30 bytes, little-endian. Defined in
[`firmware/lib/protocol/protocol.h`](../firmware/lib/protocol/protocol.h).

| Offset | Size | Field | Type | Unit / scale |
|---|---|---|---|---|
| 0 | 1 | `version` | u8 | `1` |
| 1 | 2 | `device_id` | u16 | tag id (`DEVICE_ID`) |
| 3 | 2 | `seq` | u16 | counter, wraps at 65535 |
| 5 | 4 | `time` | u32 | GPS UTC, Unix seconds (0 = unknown) |
| 9 | 4 | `lat` | i32 | degrees × 10⁷ |
| 13 | 4 | `lon` | i32 | degrees × 10⁷ |
| 17 | 2 | `alt` | i16 | metres above mean sea level |
| 19 | 2 | `speed` | u16 | cm/s |
| 21 | 2 | `course` | u16 | degrees × 100 |
| 23 | 1 | `sats` | u8 | satellites used |
| 24 | 1 | `hdop` | u8 | HDOP × 10 (255 = unknown) |
| 25 | 2 | `batt_mv` | u16 | millivolts (0 = not measured) |
| 27 | 1 | `flags` | u8 | bit 0 `FIX`, bit 1 `LOW_BATT`, bit 2 `GPS_OFF` |
| 28 | 2 | `crc` | u16 | CRC-16/CCITT-FALSE over bytes 0–27 |

**Why these choices**

- *Fixed binary frame*: 30 bytes instead of ~200 bytes of text keeps airtime at
  ~284 ms (SF9/BW125/CR4-7), which saves battery and keeps duty cycle low.
- *1e-7 degree integers*: ~1 cm resolution, same as u-blox UBX, no floats on air.
- *Our own CRC on top of LoRa's*: the LoRa CRC catches radio errors; ours also
  rejects frames from other LoRa devices on the same frequency and sync word.
- *`version` byte*: lets a future v2 frame coexist with old tags.
- *No fix?* The tag still transmits, with `FIX` cleared and the last known
  position, so you keep getting battery level and a last-seen location.

**Test vector.** This is the frame from the unit test (`device_id=7, seq=65535,
time=1793145600, lat=-6.2088, lon=106.8456, alt=-12, speed=2345, course=35999,
sats=11, hdop=9, batt=3912, flags=FIX|LOW_BATT`):

```
01 07 00 FF FF 00 3B E1 6A C0 9C 4C FC 40 58 AF 3F F4 FF 29 09 9F 8C 0B 09 48 0F 03 82 D7
```

## Radio settings

Both boards must match. Set in [`firmware/include/config.h`](../firmware/include/config.h).

| Setting | Default |
|---|---|
| Frequency | 433.775 MHz |
| Bandwidth | 125 kHz |
| Spreading factor | 9 |
| Coding rate | 4/7 |
| Sync word | 0x12 (private) |
| Preamble | 8 symbols |
| TX power | 17 dBm |
| LoRa CRC | on |

## USB serial (base station → laptop)

115200 baud. One line per event. Lines that start with `{` are JSON; everything else
is a human-readable log line (the app prints them prefixed with `[rx]`).

A good packet:

```json
{"id":1,"seq":42,"time":1793145600,"lat":-6.2088000,"lon":106.8456000,"alt":120,
 "speed":12.50,"course":90.00,"sats":9,"hdop":0.9,"batt":3.912,"fix":true,
 "low_batt":false,"rssi":-87.5,"snr":9.25}
```

(on one line in reality). Units: `speed` m/s, `course` degrees, `batt` volts,
`rssi` dBm, `snr` dB.

A rejected packet (bad length, version or CRC):

```json
{"err":3,"radio":0,"len":30,"rssi":-118.0,"snr":-6.50}
```

`err` is `ft_status_t`: 1 = length, 2 = version, 3 = CRC.

Because the base speaks plain JSON lines, you can feed it to any other tool
(Node-RED, a logger script, ATAK bridge, …) without touching the firmware.
