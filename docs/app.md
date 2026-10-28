# Laptop app

A small Python program that reads the base station over USB and serves a web
dashboard in your browser. It needs Python 3.9+ and one package (`pyserial`); the web server
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
START_DASHBOARD.bat                          # Windows: installs pyserial if needed, then starts
START_DEMO.bat                               # Windows: simulated falcons
python -m falcon_tracker --port COM5         # Windows
python -m falcon_tracker --port /dev/ttyACM0 # Linux
python -m falcon_tracker --demo              # simulated falcons, no hardware
```

| Option | Default | Meaning |
|---|---|---|
| `--port` | auto | Serial port of the base station. Auto-detect looks for Espressif's USB id. |
| `--baud` | 115200 | |
| `--base LAT,LON` | none | Your position, for distance and bearing. Can also be set in Settings. |
| `--http-port` | 8000 | |
| `--host` | 127.0.0.1 | Use `0.0.0.0` to let a phone on the same Wi-Fi/hotspot open the map. |
| `--log-dir` | `logs` | One CSV per session. `--log-dir ""` disables logging. |
| `--demo` | off | Two simulated falcons circling the base. |
| `--no-browser` | off | Do not open a browser tab. |

## Using the dashboard

| Page | What it does |
|---|---|
| **Dashboard** | Status card for the selected falcon, map, six live tiles, history charts, table of all falcons. |
| **Tracks** | Last 200 positions, GPX download (selected or all), clear. |
| **Serial Monitor** | Every line from the base station (data, logs, bad-CRC reports). Pause and clear. |
| **Settings** | Pick the serial port, start the demo, set the base position, lost-signal time and alarm. |
| **Guide / About / Author** | Short how-to, project info, credits. |

Status card colours: **green TRACKING** (fresh fix), **amber** (no GPS fix or low
battery), **red SIGNAL LOST** (no packet for longer than the lost-signal time, 30 s by
default), grey when disconnected.

- **Connect USB / Disconnect** (top right) starts or stops the link. The app
  connects by itself at start if it finds the ESP32-C3.
- Click a row in *All falcons* or use the top selector to choose a falcon. **Follow**
  keeps the map on it; dragging the map turns Follow off; **Fit all** shows everything.
- **Base position**: Settings → type it, use the laptop's location, or **Pick on map**.
  It is remembered in the browser. **Navigate** opens Google Maps directions to the bird.
- **Beep while the signal is lost** needs one click on the checkbox (browsers only allow
  sound after a click) and the page must stay open.
- Light/dark theme with the sun button.

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
| `GET /` | the dashboard |
| `GET /api/state` | `{"latest": [...], "tracks": {"1": [...]}, "config": {...}}` |
| `GET /events` | Server-Sent Events: `report` (one packet), `log` (one serial line), `status` (connection) |
| `GET /api/ports`, `GET /api/log` | Serial ports found; last 500 monitor lines |
| `POST /api/connect` `{"port":"COM5"}` or `{"demo":true}` or `{}` (auto) | Start the link |
| `POST /api/disconnect`, `POST /api/clear` | Stop the link; clear recorded positions |
| `GET /api/track.gpx[?id=N]` | GPX file |

## Code tour

| Module | Job |
|---|---|
| `sources.py` | `serial_reports()` reads the base station, `demo_reports()` simulates. Both yield the same dicts. |
| `link.py` | `Link` runs one source in a background thread, keeps the monitor log and packet counters. |
| `track.py` | `Tracks` keeps history per falcon, writes CSV, exports GPX. |
| `server.py` | Static files, JSON API, SSE fan-out (`Hub`). POSTs must be `application/json`, so other web pages cannot drive it. |
| `__main__.py` | CLI: wires a source → `Tracks` → `Hub`, starts the server. |
| `static/` | `index.html`, `app.js` (pages, Leaflet map, charts), `style.css`. |

Tests: `python -m pytest` in `app/`.
