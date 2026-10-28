# Architecture

## Data flow

```mermaid
sequenceDiagram
  autonumber
  participant GPS as ATGM336H
  participant TX as Tag ESP32-C3
  participant RF as LoRa 433 MHz
  participant RX as Base ESP32-C3
  participant APP as Laptop app
  participant WEB as Browser
  loop every TX_INTERVAL_MS
    GPS->>TX: NMEA sentences (UART, 1 Hz)
    TX->>TX: TinyGPSPlus parse, ft_encode() → 30 bytes + CRC
    TX->>RF: radio.transmit()
    TX->>TX: radio.sleep(), light sleep
    RF->>RX: packet (DIO0 interrupt)
    RX->>RX: ft_decode() checks length, version, CRC
    RX->>APP: JSON line over USB serial (+RSSI, SNR)
    APP->>APP: Tracks.add() → memory + CSV
    APP->>WEB: Server-Sent Event
    WEB->>WEB: move marker, extend track, update card
  end
```

## Components

```mermaid
flowchart TB
  subgraph firmware
    config["include/config.h<br/>pins · radio · timing"]
    proto["lib/protocol<br/>ft_encode · ft_decode · ft_crc16"]
    tx["src/tx/main.cpp"]
    rx["src/rx/main.cpp"]
    test["test/test_protocol"]
    config --> tx & rx
    proto --> tx & rx
    test --> proto
  end
  subgraph app["app/falcon_tracker"]
    sources["sources.py<br/>serial_reports · demo_reports · parse_line"]
    track["track.py<br/>Tracks · to_gpx"]
    server["server.py<br/>Hub · HTTP · SSE"]
    main["__main__.py<br/>CLI"]
    static["static/<br/>index.html · app.js · style.css"]
    main --> sources & track & server
    server --> static
  end
  rx -- "JSON lines (docs/protocol.md)" --> sources
```

## Design decisions

| Decision | Why | Alternative considered |
|---|---|---|
| One PlatformIO project, two envs | Shared pins, radio settings and codec cannot drift | Two separate projects |
| Fixed 30-byte binary frame | Short airtime = battery + duty cycle + range | JSON/CSV text over LoRa (~6× longer) |
| Base station decodes and prints JSON | Any tool can consume it; app has no binary parsing | Base forwards raw bytes |
| RadioLib | Mature, supports SX127x well, interrupt RX | sandeepmistry/LoRa (unmaintained) |
| Light sleep, not deep sleep | Keeps RAM and the UART; simple loop | Deep sleep (lower µA, but re-init every cycle) |
| Python stdlib server + SSE | One dependency (pyserial), works offline, easy to read | Flask/FastAPI + WebSocket |
| Leaflet + OSM/Esri tiles | Free, no API key | Google Maps (key, billing) |

## Knowledge graph (graphify)

`graphify-out/` holds a knowledge graph of this repository built with
[graphify](https://pypi.org/project/graphifyy/): every module, function and
document becomes a node, and calls/imports/references become edges.

| File | Use |
|---|---|
| `graphify-out/graph.html` | Open in a browser: interactive, searchable graph |
| `graphify-out/GRAPH_REPORT.md` | Communities, central nodes ("god nodes"), surprising links |
| `graphify-out/graph.json` | Raw graph for tools and AI assistants |

Rebuild it after changing code:

```bash
pip install graphifyy
graphify update .
```

AI coding assistants (Claude Code, Cursor, …) can read `GRAPH_REPORT.md` to find
their way around the codebase quickly instead of reading every file. See also
[CLAUDE.md](../CLAUDE.md).
