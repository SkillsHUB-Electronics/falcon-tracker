# Hardware

Two boards built from the same parts, plus a GPS on the falcon tag.

- [Bill of materials](#bill-of-materials)
- [Pin map](#pin-map)
- [Falcon tag (TX) wiring](#falcon-tag-tx)
- [Base station (RX) wiring](#base-station-rx)
- [Power](#power)
- [Antennas](#antennas)
- [Optional: switching the GPS off](#optional-switching-the-gps-off)
- [Mounting on the bird](#mounting-on-the-bird)

## Bill of materials

| Qty | Part | Notes |
|---|---|---|
| 2 | ESP32-C3 Super Mini | One per board. Native USB, so no USB-UART chip needed. |
| 2 | ESP32-C3 Super Mini expansion board | Handy for prototyping. Leave it out of the final falcon tag to save weight. |
| 2 | XL1278-SMT LoRa module (SX1278, 433 MHz) | 3.3 V only. Ra-02 and other SX1276/77/78 modules wire the same way. |
| 2 | 433 MHz antenna | The spring antenna in the kit, or a 17 cm wire (see [Antennas](#antennas)). |
| 1 | ATGM336H GPS+BDS module | Sold as a NEO-6M/NEO-M8N replacement. Has a backup cell for fast hot starts. |
| 1 | Active GPS patch antenna, U.FL/IPEX | The module has no on-board antenna. Pick the smallest one that works for you (e.g. 18×18 mm). |
| 1–2 | 1S LiPo, 300–500 mAh, with protection circuit | One for the tag; one optional for the base. |
| 1–2 | Slide switch | Power switch. |
| 1–2 | SS14 Schottky diode (or 1N5817) | Stops USB 5 V from back-feeding the battery. |
| 2 | 100 kΩ resistor | Battery voltage divider (tag). |
| 1 | 100 nF capacitor | Across the lower divider resistor; steadies the ADC reading. |
| 1 | TP4056 LiPo charger board | The Super Mini cannot charge a battery by itself. |
| – | Thin silicone wire, heat shrink, Kapton tape | |
| *opt.* | AO3401 P-MOSFET + 100 kΩ | GPS power switch, see [below](#optional-switching-the-gps-off). |

## Pin map

The same pins are used on both boards, so one wiring jig serves both. They are
defined once in [`firmware/include/config.h`](../firmware/include/config.h).

| Signal | ESP32-C3 Super Mini | XL1278-SMT | ATGM336H (TX only) | Why this pin |
|---|---|---|---|---|
| 3.3 V | 3V3 | 3.3V / VCC | VCC | LoRa module is 3.3 V only |
| GND | GND | GND (all) | GND | |
| SCK | GPIO4 | SCK | | Board's default SPI pins |
| MISO | GPIO5 | MISO | | |
| MOSI | GPIO6 | MOSI | | |
| NSS / CS | GPIO7 | NSS | | |
| RESET | GPIO10 | RESET (NRESET) | | Not a strapping pin |
| DIO0 | GPIO3 | DIO0 | | TxDone/RxDone interrupt; avoids strapping pins 2, 8, 9 |
| GPS TX → ESP RX | GPIO20 | | TX | UART1, 9600 baud |
| ESP TX → GPS RX | GPIO21 | | RX | Only needed to configure the GPS |
| Battery sense | GPIO0 (ADC1_CH0) | | | Through a 100k/100k divider |
| GPS_EN (opt.) | GPIO1 | | | Drives the P-MOSFET gate |
| LED | GPIO8 | | | On-board blue LED, active low |
| PPS | – | | PPS | Not used |

> **Strapping pins.** GPIO2, GPIO8 and GPIO9 decide how the ESP32-C3 boots. Do not
> connect anything that pulls them low at power-up. GPIO9 is the BOOT button.

> **Never transmit without an antenna.** It can destroy the SX1278 power amplifier.

## Falcon tag (TX)

![TX wiring](../hardware/wiring-tx.svg)

1. Wire the LoRa module to the ESP32-C3 as in the pin map.
2. Wire the GPS: VCC → 3V3, GND → GND, GPS **TX** → **GPIO20**, GPS **RX** → **GPIO21**.
   (TX goes to RX. Swapping them is the most common mistake.)
3. Plug the GPS patch antenna into the U.FL socket, ceramic side facing the sky.
4. Battery: `+` → switch → SS14 anode; SS14 cathode → **5V** pin. Battery `−` → **GND**.
5. Divider: battery `+` (after the switch) → 100 kΩ → **GPIO0** → 100 kΩ → GND.
   Put the 100 nF capacitor across the lower resistor.

## Base station (RX)

![RX wiring](../hardware/wiring-rx.svg)

Same LoRa wiring as the tag, no GPS. Powered from the laptop's USB-C cable; use a
**data** cable, not a charge-only one. A LiPo with the same switch and diode circuit
is optional.

## Power

**Supply path.** The Super Mini's 5V pin feeds an on-board 3.3 V LDO with a low
dropout, so a 1S LiPo (3.0–4.2 V) can drive it directly. The SS14 diode costs about
0.3 V but makes it safe to plug in USB while the battery is connected. Everything
else (LoRa, GPS) runs from the 3V3 pin.

**Peak current.** About 120 mA while transmitting at 17 dBm plus 25 mA for the GPS.
Use a battery with a protection circuit that can supply at least 0.5 A.

**Remove the red power LED** on the Super Mini of the falcon tag (a dab of solder
iron on the LED or its resistor). It burns 1–3 mA all the time for nothing.

### Power budget (estimates)

| Mode | GPS | MCU awake | Radio TX (17 dBm, 284 ms) | Average | 500 mAh lasts |
|---|---|---|---|---|---|
| Every 5 s, GPS always on (default) | 25 mA | ~2.4 mA | ~5 mA | **~33 mA** | **~12–15 h** |
| Every 15 s, GPS always on | 25 mA | ~1 mA | ~1.7 mA | ~28 mA | ~15–17 h |
| Every 60 s, GPS switched off (needs MOSFET) | ~2 mA | ~1.7 mA | ~0.4 mA | ~4.5 mA | ~3–4 days |

These come from datasheet numbers, not measurements. Please measure your own build
with a USB power meter or a uCurrent and open a PR with the results.

## Antennas

- **LoRa, 433 MHz.** A quarter-wave wire is 17.3 cm. On the bird, a thin flexible
  wire (e.g. 0.2 mm² silicone wire or nylon-coated steel) along a tail feather works
  well and is lighter than the spring. At the base, a proper 433 MHz whip or a
  Yagi pointed at the hunting area gives the longest range.
- **GPS.** The patch must see the sky. Mount it on the back, ceramic side up, and
  keep it away from the LoRa antenna and the battery.

Range depends mostly on height: a bird at 100 m altitude is typically received
several kilometres away with the default SF9 settings. If you need more, raise
`LORA_SF` to 10–11 on **both** boards (longer airtime, more range).

## Optional: switching the GPS off

For long report intervals the GPS is the biggest consumer. A P-MOSFET high-side
switch lets the tag turn it off between fixes; the module's backup cell keeps the
almanac so it re-acquires in a few seconds (hot start).

```
               AO3401 (P-MOSFET)
 3V3 ───┬───── S            D ───── GPS VCC
        │            G
      100k           │
        │            │
        └────────────┴───────────── GPIO1  (GPS_EN: LOW = GPS on)
```

The 100 kΩ pull-up keeps the GPS off while the ESP32 boots; the firmware then
drives GPIO1 low to turn it on.

Then set `-D GPS_EN_PIN=1` and e.g. `-D TX_INTERVAL_MS=60000` for the `tx`
environment in `platformio.ini`. The firmware only switches the GPS off when the
interval is at least `GPS_POWER_SAVE_MIN_INTERVAL_MS` (30 s).

## Mounting on the bird

- Weigh the finished tag. Keep it well under 3–5 % of the bird's body weight
  (e.g. under 20–30 g for a 700 g peregrine tiercel).
- For a light tag: drop the expansion board, solder wires directly, use a 300 mAh
  cell, and coat the boards with conformal coating or wrap them in Kapton and
  heat shrink.
- Use a proper falconry tail-mount clip or a backpack mount; never glue anything
  to feathers or skin.
- Keep the antenna free to flex and away from the talons and beak.
- Test on the glove, then on a creance, before the first free flight.
