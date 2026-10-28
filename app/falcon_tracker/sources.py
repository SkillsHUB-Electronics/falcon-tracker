"""Where reports come from: the RX board on a serial port, or a simulator.

Every source is a generator of dicts shaped exactly like the JSON lines the RX
firmware prints (see firmware/src/rx/main.cpp and docs/protocol.md).
"""

import json
import math
import time

ESPRESSIF_USB_VID = 0x303A  # ESP32-C3 built-in USB-Serial/JTAG


def parse_line(line):
    """Return a report dict for a data line, or None for logs/garbage/errors."""
    line = line.strip()
    if not line.startswith("{"):
        return None
    try:
        msg = json.loads(line)
    except ValueError:
        return None
    if "id" not in msg or "lat" not in msg:  # e.g. {"err":3,...} for bad CRC
        return None
    return msg


def find_serial_port():
    """Best guess at the RX board's port, or None."""
    from serial.tools import list_ports

    ports = list(list_ports.comports())
    for p in ports:
        if p.vid == ESPRESSIF_USB_VID:
            return p.device
    return ports[0].device if len(ports) == 1 else None


def serial_reports(port, baud=115200):
    """Yield reports from the RX board forever, reconnecting if unplugged."""
    import serial

    while True:
        try:
            with serial.Serial(port, baud, timeout=1) as ser:
                print(f"connected to {port}")
                while True:
                    raw = ser.readline()
                    if not raw:
                        continue
                    line = raw.decode("utf-8", errors="replace")
                    msg = parse_line(line)
                    if msg is None:
                        if line.strip():
                            print(f"[rx] {line.strip()}")
                        continue
                    yield msg
        except serial.SerialException as e:
            print(f"serial error on {port}: {e}; retrying in 2 s")
            time.sleep(2)


def demo_reports(base_lat, base_lon, interval=1.0, falcons=2):
    """Simulated falcons circling and diving around the base station."""
    seq = 0
    t0 = time.time()
    while True:
        t = time.time() - t0
        for i in range(falcons):
            fid = i + 1
            radius_m = 400 + 250 * i + 150 * math.sin(t / 23)
            ang = t / (20 + 7 * i) + i * 2.1
            dlat = radius_m * math.cos(ang) / 111_320
            dlon = radius_m * math.sin(ang) / (111_320 * math.cos(math.radians(base_lat)))
            alt = 80 + 60 * math.sin(t / 9 + i)
            yield {
                "id": fid,
                "seq": seq & 0xFFFF,
                "time": int(time.time()),
                "lat": round(base_lat + dlat, 7),
                "lon": round(base_lon + dlon, 7),
                "alt": round(alt),
                "speed": round(abs(radius_m / (20 + 7 * i)) + 3 * math.sin(t), 2),
                "course": round(math.degrees(ang + math.pi / 2) % 360, 2),
                "sats": 9 + i,
                "hdop": 0.9,
                "batt": round(4.15 - 0.002 * t / 10 - 0.1 * i, 3),
                "fix": True,
                "low_batt": False,
                "rssi": round(-70 - radius_m / 40, 1),
                "snr": round(9 - radius_m / 200, 2),
            }
        seq += 1
        time.sleep(interval)
