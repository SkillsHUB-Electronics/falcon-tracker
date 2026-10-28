# Security

The radio link is **not encrypted or authenticated**: anyone with a 433 MHz LoRa
receiver and the published settings can read the falcon's position, and could
send fake frames. If that matters to you (e.g. valuable birds), change the
frequency and sync word. AES-128 frame encryption is on the roadmap;
contributions are welcome.

The laptop app listens on `127.0.0.1` by default. Using `--host 0.0.0.0` exposes
the map and the falcon positions to everyone on your network.

Please report security problems privately through GitHub's
"Report a vulnerability" button on the repository's Security tab.
