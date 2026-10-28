"""Falcon Tracker base-station app.

    python -m falcon_tracker                  # auto-detect the RX board
    python -m falcon_tracker --port COM5      # Windows
    python -m falcon_tracker --demo           # no hardware, simulated falcons
"""

import argparse
import threading
import time
import webbrowser
from pathlib import Path

from .server import Hub, serve
from .sources import demo_reports, find_serial_port, serial_reports
from .track import Tracks


def parse_base(text):
    lat, lon = (float(x) for x in text.split(","))
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise argparse.ArgumentTypeError("base must be 'lat,lon' in degrees")
    return lat, lon


def main(argv=None):
    ap = argparse.ArgumentParser(prog="falcon-tracker", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", help="serial port of the RX board (default: auto-detect)")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--demo", action="store_true", help="simulate falcons, no hardware needed")
    ap.add_argument("--base", type=parse_base, default=None,
                    help="base station position 'lat,lon' (else set it on the map)")
    ap.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 to share on the LAN")
    ap.add_argument("--http-port", type=int, default=8000)
    ap.add_argument("--log-dir", default="logs", help="CSV logs go here ('' to disable)")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args(argv)

    if args.demo:
        base = args.base or (-6.2088, 106.8456)
        reports = demo_reports(*base)
    else:
        port = args.port or find_serial_port()
        if not port:
            ap.error("no RX board found; plug it in or pass --port (or try --demo)")
        reports = serial_reports(port, args.baud)
        base = args.base

    log_path = None
    if args.log_dir:
        Path(args.log_dir).mkdir(parents=True, exist_ok=True)
        log_path = Path(args.log_dir) / time.strftime("falcon-%Y%m%d-%H%M%S.csv")

    tracks, hub = Tracks(log_path), Hub()
    config = {"base": base, "demo": args.demo}
    httpd = serve(tracks, hub, config, args.host, args.http_port)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    url = f"http://localhost:{args.http_port}/"
    print(f"map: {url}" + (f"   log: {log_path}" if log_path else ""))
    if not args.no_browser:
        webbrowser.open(url)

    try:
        for msg in reports:
            hub.publish(tracks.add(msg))
            print(f"falcon {msg['id']} seq {msg['seq']} "
                  f"{msg['lat']:.6f},{msg['lon']:.6f} alt {msg['alt']} m "
                  f"rssi {msg.get('rssi')} fix {msg.get('fix')}")
    except KeyboardInterrupt:
        print("bye")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
