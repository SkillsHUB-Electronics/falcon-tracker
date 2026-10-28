# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-28

### Added
- TX firmware for the falcon tag: ESP32-C3 + SX1278 + ATGM336H, light sleep,
  optional GPS power switch, battery monitoring.
- RX firmware for the base station: interrupt-driven receive, JSON lines over USB.
- Versioned 30-byte radio frame with CRC-16, with unit tests.
- Laptop app: live Leaflet map, multiple falcons, distance/bearing, CSV logs,
  GPX export, demo mode.
- Wiring diagrams, hardware/firmware/app/protocol docs, CI.
