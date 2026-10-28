import itertools
import json
import threading
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

from falcon_tracker.link import Link
from falcon_tracker.server import Hub, serve
from falcon_tracker.sources import demo_reports, parse_line
from falcon_tracker.track import Tracks, to_gpx

RX_LINE = ('{"id":1,"seq":42,"time":1793145600,"lat":-6.2088000,"lon":106.8456000,"alt":120,'
           '"speed":12.50,"course":90.00,"sats":9,"hdop":0.9,"batt":3.912,"fix":true,'
           '"low_batt":false,"rssi":-87.5,"snr":9.25}')


def test_parse_line_accepts_rx_json():
    msg = parse_line(RX_LINE + "\r\n")
    assert msg["id"] == 1 and msg["lat"] == -6.2088 and msg["fix"] is True


def test_parse_line_ignores_logs_errors_and_garbage():
    assert parse_line("# falcon base ready") is None
    assert parse_line('{"err":3,"radio":0,"len":30,"rssi":-120.0,"snr":-5.00}') is None
    assert parse_line('{"id":1,"lat":') is None
    assert parse_line("") is None


def test_tracks_keep_only_fixes_but_remember_latest(tmp_path):
    log = tmp_path / "log.csv"
    t = Tracks(log)
    t.add(parse_line(RX_LINE))
    t.add(dict(parse_line(RX_LINE), seq=43, fix=False))
    snap = t.snapshot()
    assert len(snap["tracks"]["1"]) == 1
    assert snap["latest"][0]["seq"] == 43
    assert len(log.read_text().strip().splitlines()) == 3  # header + 2 rows


def test_gpx_is_valid_xml():
    pts = [parse_line(RX_LINE)]
    root = ET.fromstring(to_gpx([(1, pts)]))
    ns = {"g": "http://www.topografix.com/GPX/1/1"}
    trkpt = root.find(".//g:trkpt", ns)
    assert trkpt.get("lat") == "-6.2088000"
    assert root.find(".//g:time", ns).text == "2026-10-28T00:00:00Z"


def test_demo_reports_look_like_rx_output():
    keys = set(json.loads(RX_LINE))
    for msg in itertools.islice(demo_reports(-6.2, 106.8, interval=0), 6):
        assert set(msg) == keys


def _server():
    tracks, hub = Tracks(), Hub()
    link = Link(tracks, hub)
    httpd = serve(tracks, hub, link, {"base": None}, port=0)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return tracks, link, httpd, f"http://127.0.0.1:{httpd.server_address[1]}"


def _post(url, body, ctype="application/json"):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": ctype})
    try:
        return urllib.request.urlopen(req).status, None
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def test_http_api_end_to_end():
    tracks, link, httpd, url = _server()
    try:
        tracks.add(parse_line(RX_LINE))
        state = json.load(urllib.request.urlopen(url + "/api/state"))
        assert state["tracks"]["1"][0]["seq"] == 42
        assert state["status"]["mode"] == "idle"
        assert b"<trkpt" in urllib.request.urlopen(url + "/api/track.gpx?id=1").read()
        assert b"Falcon Tracker" in urllib.request.urlopen(url + "/").read()
        try:
            urllib.request.urlopen(url + "/../server.py")
            assert False, "path traversal must be refused"
        except urllib.error.HTTPError as e:
            assert e.code == 404
    finally:
        httpd.shutdown()


def test_demo_connection_feeds_tracks_and_log():
    tracks, link, httpd, url = _server()
    try:
        assert _post(url + "/api/connect", {"demo": True})[0] == 200
        deadline = time.time() + 5
        while len(tracks.snapshot()["latest"]) < 2 and time.time() < deadline:
            time.sleep(0.05)
        assert len(tracks.snapshot()["latest"]) == 2
        assert link.status()["mode"] == "demo" and link.status()["packets"] >= 2
        assert json.loads(link.log[-1]["line"])["id"] in (1, 2)
        assert _post(url + "/api/disconnect", {})[0] == 200
        assert link.status()["mode"] == "idle"
        assert _post(url + "/api/clear", {})[0] == 200
        assert tracks.snapshot()["latest"] == []
    finally:
        link.stop()
        httpd.shutdown()


def test_post_requires_json_and_known_port():
    tracks, link, httpd, url = _server()
    try:
        assert _post(url + "/api/connect", {"demo": True}, "text/plain")[0] == 415
        assert _post(url + "/api/connect", {"port": "/dev/not-a-port"})[0] == 404
    finally:
        httpd.shutdown()
