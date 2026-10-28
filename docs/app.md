# Laptop app

A small Python program that reads the base station over USB and serves a live map
in your browser. It needs Python 3.9+ and one package (`pyserial`); the web server
is the standard library.

## Install

```bash
cd app
python -m pip install -e .          # or: pip install pyserial
```

Windows: install Python from python.org and tick *Add python.exe to PATH*. The
ESP32-C3 uses the built-in USB-Serial/JTAG, so Windows 10/11 needs no extra driver.

## Run

```bash
python -m falcon_tracker                     # auto-detect the base station
python -m falcon_tracker --port COM5         # Windows
python -m falcon_tracker --port /dev/ttyACM0 # Linux
python -m falcon_tracker --demo              # simulated falcons, no hardware
```

| Option | Default | Meaning |
|---|---|---|
| `--port` | auto | Serial port of the base station. Auto-detect looks for Espressif's USB id. |
| `--baud` | 115200 | |
| `--base LAT,LON` | none | Your position, for distance and bearing. Can also be set on the map. |
| `--http-port` | 8000 | |
| `--host` | 127.0.0.1 | Use `0.0.0.0` to let a phone on the same Wi-Fi/hotspot open the map. |
| `--log-dir` | `logs` | One CSV per session. `--log-dir ""` disables logging. |
| `--demo` | off | Two simulated falcons circling the base. |
| `--no-browser` | off | Do not open a browser tab. |

## Using the map

- **Falcon cards** (left): position, altitude, speed and heading, distance and
  bearing from base, satellites/HDOP, battery voltage and %, RSSI/SNR. The dot is
  green when heard in the last 15 s, amber up to 60 s, red after that.
- Click a card to select that falcon. With **Follow selected** ticked, the map
  keeps it centred.
- **Set base on map** then click the map, or **Base = my location** to use the
  laptop's location. The base is remembered in the browser.
- **Navigate** opens Google Maps directions to the bird (useful on a phone).
- **GPX** downloads the track of one falcon; the footer link downloads all.
- Layers (top right): satellite or street map.

## Offline use

The map tiles and Leaflet are loaded from the internet. In the field, either use a
phone hotspot, or open the hunting area on the map at home first so the browser
caches the tiles. The tracking itself (radio, app, logging) works fully offline;
positions keep arriving and are logged even if the map background is blank.

## Files

| File | Content |
|---|---|
| `logs/falcon-YYYYMMDD-HHMMSS.csv` | Every packet: receive time, all fields, RSSI, SNR |
| `/api/track.gpx?id=N` | GPX 1.1 track of falcon N (download from the map) |

## HTTP API

| Endpoint | Returns |
|---|---|
| `GET /` | the map |
| `GET /api/state` | `{"latest": [...], "tracks": {"1": [...]}, "config": {...}}` |
| `GET /events` | Server-Sent Events, one `data:` JSON report per packet |
| `GET /api/track.gpx[?id=N]` | GPX file |

## Code tour

| Module | Job |
|---|---|
| `sources.py` | `serial_reports()` reads the base station, `demo_reports()` simulates. Both yield the same dicts. |
| `track.py` | `Tracks` keeps history per falcon, writes CSV, exports GPX. |
| `server.py` | Static files, JSON API, SSE fan-out (`Hub`). |
| `__main__.py` | CLI: wires a source → `Tracks` → `Hub`, starts the server. |
| `static/` | `index.html`, `app.js` (Leaflet map, geometry), `style.css`. |

Tests: `python -m pytest` in `app/`.
