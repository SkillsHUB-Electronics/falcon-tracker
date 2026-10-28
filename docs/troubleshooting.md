# Troubleshooting

## Radio

| Symptom | Likely cause | Fix |
|---|---|---|
| Log says `radio init failed: -2`, LED blinks fast | SX1278 not answering on SPI | Check 3V3 and GND, NSS→GPIO7, SCK→GPIO4, MISO→GPIO5, MOSI→GPIO6, RESET→GPIO10. Reflow the castellated pads of the module. |
| Base gets nothing | Settings differ | Frequency, SF, BW, CR and sync word in `config.h` must be identical; reflash both. |
| Base prints `{"err":3,...}` | CRC fails | Weak signal or another device on the same frequency. Check antennas; try another frequency. |
| Range is only a few hundred metres | Antenna | Both antennas fitted, vertical, 17 cm for 433 MHz. Raise the base antenna. Try `LORA_SF 10`. |

## GPS

| Symptom | Likely cause | Fix |
|---|---|---|
| `fix=0`, `sats=0` forever | No NMEA arriving | GPS TX must go to GPIO20 (cross-over). Check 9600 baud. |
| `fix=0`, sats > 0 | Still acquiring | Outdoors, open sky, wait 30–60 s on a cold start. The patch antenna must face up. |
| Position jumps | Poor HDOP | Check `hdop` in the card; > 2.5 means poor geometry or a blocked antenna. |

## USB / app

| Symptom | Likely cause | Fix |
|---|---|---|
| `no RX board found` | Port not detected | Pass `--port COM5` (Device Manager → Ports) or `/dev/ttyACM0`. Use a data cable. |
| Port busy / access denied | Another program has it open | Close the PlatformIO/Arduino serial monitor. |
| Upload fails on the tag | ESP32 is light-sleeping (USB off) | Hold BOOT, tap RESET, release BOOT, then upload. |
| Map is grey but cards update | No internet for tiles | Use a hotspot, or pre-load the area. Tracking still works. |
| Distance says "set base" | Base not set | Click *Set base on map* or *Base = my location*. |

## Battery

| Symptom | Likely cause | Fix |
|---|---|---|
| Battery shows `n/a` | Divider missing | Fit the 100k/100k divider to GPIO0, or set `BATT_ADC_PIN -1` to silence it. |
| Voltage reads ~0.3 V low | You measured after the diode | Measure before the diode, as in the wiring diagram. |
| Tag resets when transmitting | Weak cell or thin wires | Use a cell that can give 0.5 A; shorter/thicker power wires; 100 µF across 3V3/GND. |
