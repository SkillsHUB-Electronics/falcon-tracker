"""In-memory track store plus CSV logging and GPX export."""

import csv
import threading
import time
from datetime import datetime, timezone
from xml.sax.saxutils import escape

CSV_FIELDS = ["rx_time", "id", "seq", "time", "lat", "lon", "alt", "speed", "course",
              "sats", "hdop", "batt", "fix", "low_batt", "rssi", "snr"]


class Tracks:
    """Thread-safe history of reports, grouped by falcon id."""

    def __init__(self, log_path=None, max_points=20_000):
        self._lock = threading.Lock()
        self._points = {}  # id -> list of reports (only reports with a GPS fix)
        self._latest = {}  # id -> last report, fix or not
        self._max = max_points
        self._log = None
        if log_path:
            f = open(log_path, "w", newline="", encoding="utf-8")
            self._log = (f, csv.DictWriter(f, CSV_FIELDS, extrasaction="ignore"))
            self._log[1].writeheader()

    def add(self, msg):
        msg = dict(msg, rx_time=round(time.time(), 3))
        with self._lock:
            self._latest[msg["id"]] = msg
            if msg.get("fix"):
                pts = self._points.setdefault(msg["id"], [])
                pts.append(msg)
                del pts[: max(0, len(pts) - self._max)]
            if self._log:
                self._log[1].writerow(msg)
                self._log[0].flush()
        return msg

    def snapshot(self):
        with self._lock:
            return {"latest": list(self._latest.values()),
                    "tracks": {str(k): list(v) for k, v in self._points.items()}}

    def gpx(self, falcon_id=None):
        with self._lock:
            ids = [falcon_id] if falcon_id is not None else sorted(self._points)
            segs = [(i, list(self._points.get(i, []))) for i in ids]
        return to_gpx(segs)


def _iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def to_gpx(segments):
    """segments: iterable of (falcon_id, [report, ...]) -> GPX 1.1 string."""
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<gpx version="1.1" creator="falcon-tracker" xmlns="http://www.topografix.com/GPX/1/1">']
    for fid, pts in segments:
        out.append(f"  <trk><name>{escape(f'Falcon {fid}')}</name><trkseg>")
        for p in pts:
            ts = p.get("time") or p.get("rx_time")
            out.append(f'    <trkpt lat="{p["lat"]:.7f}" lon="{p["lon"]:.7f}">'
                       f'<ele>{p.get("alt", 0)}</ele><time>{_iso(ts)}</time></trkpt>')
        out.append("  </trkseg></trk>")
    out.append("</gpx>")
    return "\n".join(out) + "\n"
