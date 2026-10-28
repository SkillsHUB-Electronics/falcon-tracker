"""Tiny web server: static map page, a JSON snapshot, GPX export and a
Server-Sent Events stream that pushes every new report to the browser.
Standard library only."""

import json
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

STATIC = Path(__file__).parent / "static"
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css"}


class Hub:
    """Fan-out of new reports to every connected browser."""

    def __init__(self):
        self._lock = threading.Lock()
        self._clients = set()

    def subscribe(self):
        q = queue.Queue(maxsize=1000)
        with self._lock:
            self._clients.add(q)
        return q

    def unsubscribe(self, q):
        with self._lock:
            self._clients.discard(q)

    def publish(self, msg):
        with self._lock:
            for q in self._clients:
                try:
                    q.put_nowait(msg)
                except queue.Full:
                    pass  # slow client; it will resync from /api/state on reconnect


def make_handler(tracks, hub, config):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # keep the console for radio traffic

        def _send(self, body, ctype, status=200, extra=()):
            data = body.encode() if isinstance(body, str) else body
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            for k, v in extra:
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            url = urlparse(self.path)
            if url.path == "/api/state":
                state = dict(tracks.snapshot(), config=config)
                return self._send(json.dumps(state), "application/json")
            if url.path == "/api/track.gpx":
                fid = parse_qs(url.query).get("id", [None])[0]
                gpx = tracks.gpx(int(fid) if fid else None)
                name = f"falcon-{fid or 'all'}.gpx"
                return self._send(gpx, "application/gpx+xml",
                                  extra=[("Content-Disposition", f'attachment; filename="{name}"')])
            if url.path == "/events":
                return self._stream()
            return self._static(url.path)

        def _static(self, path):
            name = "index.html" if path in ("", "/") else path.lstrip("/")
            f = (STATIC / name).resolve()
            if STATIC.resolve() not in f.parents or not f.is_file():
                return self._send("not found", "text/plain", 404)
            self._send(f.read_bytes(), TYPES.get(f.suffix, "application/octet-stream"))

        def _stream(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            q = hub.subscribe()
            try:
                while True:
                    try:
                        msg = q.get(timeout=15)
                        chunk = f"data: {json.dumps(msg)}\n\n"
                    except queue.Empty:
                        chunk = ": keep-alive\n\n"
                    self.wfile.write(chunk.encode())
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                hub.unsubscribe(q)

    return Handler


def serve(tracks, hub, config, host="127.0.0.1", port=8000):
    httpd = ThreadingHTTPServer((host, port), make_handler(tracks, hub, config))
    httpd.daemon_threads = True
    return httpd
