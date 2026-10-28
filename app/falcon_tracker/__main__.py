"""Falcon Tracker base-station app.

    python -m falcon_tracker                  # dashboard; auto-connects to the RX board
    python -m falcon_tracker --port COM5      # Windows, pick the port yourself
    python -m falcon_tracker --demo           # no hardware, simulated falcons
"""

import argparse
import time
import webbrowser
from pathlib import Path

from .link import DEMO_BASE, Link
from .server import Hub, serve
from .sources import find_serial_port
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
                    help="base station position 'lat,lon' (else set it in Settings)")
    ap.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 to share on the LAN")
    ap.add_argument("--http-port", type=int, default=8000)
    ap.add_argument("--log-dir", default="logs", help="CSV logs go here ('' to disable)")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args(argv)

    log_path = None
    if args.log_dir:
        Path(args.log_dir).mkdir(parents=True, exist_ok=True)
        log_path = Path(args.log_dir) / time.strftime("falcon-%Y%m%d-%H%M%S.csv")

    tracks, hub = Tracks(log_path), Hub()
    link = Link(tracks, hub, base=args.base, echo=print)
    base = args.base or (DEMO_BASE if args.demo else None)
    httpd = serve(tracks, hub, link, {"base": base, "baud": args.baud},
                  args.host, args.http_port)

    port = None if args.demo else args.port or find_serial_port()
    if args.demo:
        link.start(demo=True)
    elif port:
        link.start(port=port, baud=args.baud)
    else:
        print("no RX board found; plug it in and press Connect USB on the page")

    url = f"http://localhost:{args.http_port}/"
    print(f"dashboard: {url}" + (f"   log: {log_path}" if log_path else ""))
    if not args.no_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("bye")
    finally:
        link.stop()
        httpd.server_close()


if __name__ == "__main__":
    main()
