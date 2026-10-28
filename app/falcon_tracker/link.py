"""The live connection: one background thread that feeds a source (serial port
or simulator) into the track store and out to every browser."""

import collections
import json
import threading
import time

from . import sources

DEMO_BASE = (-6.2088, 106.8456)


class Link:
    def __init__(self, tracks, hub, base=None, echo=None):
        self.tracks, self.hub, self.base, self.echo = tracks, hub, base, echo
        self.log = collections.deque(maxlen=500)
        self._lock = threading.Lock()
        self._thread = self._stop = None
        self.mode, self.port = "idle", None
        self.packets = self.errors = 0
        self.last_rx = None

    def status(self):
        return {"mode": self.mode, "port": self.port, "packets": self.packets,
                "errors": self.errors, "last_rx": self.last_rx}

    def start(self, port=None, demo=False, baud=115200):
        with self._lock:
            self._stop_locked()
            self._stop = stop = threading.Event()
            if demo:
                reports = sources.demo_reports(*(self.base or DEMO_BASE), stop=stop)
                self.mode, self.port = "demo", None
            else:
                reports = sources.serial_reports(port, baud, stop, self._on_line)
                self.mode, self.port = "serial", port
            self._thread = threading.Thread(target=self._run, args=(reports, stop), daemon=True)
            self._thread.start()
        self._publish_status()

    def stop(self):
        with self._lock:
            self._stop_locked()
        self._publish_status()

    def _stop_locked(self):
        if self._stop:
            self._stop.set()
            self._thread.join(timeout=3)
        self._stop = self._thread = None
        self.mode, self.port = "idle", None

    def _publish_status(self):
        self.hub.publish("status", self.status())

    def _on_line(self, line):
        if line.startswith('{"err"'):
            self.errors += 1
        entry = {"t": round(time.time(), 3), "line": line}
        self.log.append(entry)
        self.hub.publish("log", entry)
        if self.echo and not line.startswith("{"):
            self.echo(line)

    def _run(self, reports, stop):
        for msg in reports:
            if stop.is_set():
                break
            report = self.tracks.add(msg)
            self.packets += 1
            self.last_rx = report["rx_time"]
            self.hub.publish("report", report)
            if self.mode == "demo":
                self._on_line(json.dumps(msg, separators=(",", ":")))  # what the RX would print
            if self.echo:
                self.echo(f"falcon {msg['id']} seq {msg['seq']} {msg['lat']:.6f},{msg['lon']:.6f} "
                          f"alt {msg['alt']} m rssi {msg.get('rssi')} fix {msg.get('fix')}")
