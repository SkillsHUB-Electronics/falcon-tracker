"""Tiny web server: the dashboard page, a JSON API, GPX export and a
Server-Sent Events stream that pushes reports, log lines and status changes to
the browser. Standard library only."""

import json
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import sources

STATIC = Path(__file__).parent / "static"
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml"}


class Hub:
    """Fan-out of events (report, log, status) to every connected browser."""

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

    def publish(self, kind, payload):
        with self._lock:
            for q in self._clients:
                try:
                    q.put_nowait((kind, payload))
                except queue.Full:
                    pass  # slow client; it will resync from /api/state on reconnect


def make_handler(tracks, hub, link, config):
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

        def _json(self, obj, status=200):
            self._send(json.dumps(obj), "application/json", status)

        def do_GET(self):
            url = urlparse(self.path)
            if url.path == "/api/state":
                return self._json(dict(tracks.snapshot(), config=config, status=link.status()))
            if url.path == "/api/ports":
                try:
                    return self._json({"ports": sources.list_serial_ports(),
                                       "auto": sources.find_serial_port()})
                except ImportError:
                    return self._json({"error": "pyserial is not installed"}, 500)
            if url.path == "/api/log":
                return self._json(list(link.log))
            if url.path == "/api/track.gpx":
                fid = parse_qs(url.query).get("id", [None])[0]
                gpx = tracks.gpx(int(fid) if fid else None)
                name = f"falcon-{fid or 'all'}.gpx"
                return self._send(gpx, "application/gpx+xml",
                                  extra=[("Content-Disposition", f'attachment; filename="{name}"')])
            if url.path == "/events":
                return self._stream()
            return self._static(url.path)

        def do_POST(self):
            # Only JSON is accepted: a web page on another site cannot send that
            # without a CORS preflight, which this server never grants.
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self._json({"error": "expected application/json"}, 415)
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            except ValueError:
                return self._json({"error": "bad JSON"}, 400)
            path = urlparse(self.path).path
            if path == "/api/connect":
                return self._connect(body)
            if path == "/api/disconnect":
                link.stop()
                return self._json(link.status())
            if path == "/api/clear":
                tracks.clear()
                return self._json({"ok": True})
            self._json({"error": "not found"}, 404)

        def _connect(self, body):
            if body.get("demo"):
                link.start(demo=True)
                return self._json(link.status())
            try:
                known = [p["device"] for p in sources.list_serial_ports()]
            except ImportError:
                return self._json({"error": "pyserial is not installed"}, 500)
            port = body.get("port") or sources.find_serial_port()
            if port not in known:
                return self._json({"error": "no matching serial port; plug in the base station"}, 404)
            link.start(port=port)
            self._json(link.status())

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
                        kind, payload = q.get(timeout=15)
                        chunk = f"event: {kind}\ndata: {json.dumps(payload)}\n\n"
                    except queue.Empty:
                        chunk = ": keep-alive\n\n"
                    self.wfile.write(chunk.encode())
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            finally:
                hub.unsubscribe(q)

    return Handler


def serve(tracks, hub, link, config, host="127.0.0.1", port=8000):
    httpd = ThreadingHTTPServer((host, port), make_handler(tracks, hub, link, config))
    httpd.daemon_threads = True
    return httpd
