# Graph Report - falcon-tracker  (2026-10-28)

## Corpus Check
- 32 files · ~16,051 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .bat 2, .css 1)

## Summary
- 324 nodes · 518 edges · 17 communities (15 shown, 2 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f6f21850`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- test_app.py
- tx/main.cpp
- README.md
- test_main.c
- steps
- Contributing
- app.js
- body
- body
- Falcon Tracker
- Hardware
- make_handler
- [1.0.0] - 2026-10-28
- pull_request_template.md
- __main__.py
- SECURITY.md
- falcon-tracker

## God Nodes (most connected - your core abstractions)
1. `Link` - 14 edges
2. `Tracks` - 13 edges
3. `main()` - 12 edges
4. `renderSelected()` - 12 edges
5. `Hub` - 11 edges
6. `ft_encode()` - 11 edges
7. `ft_decode()` - 11 edges
8. `make_handler()` - 10 edges
9. `parse_line()` - 10 edges
10. `demo_reports()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Code tour` --references--> `Link`  [INFERRED]
  docs/app.md → app/falcon_tracker/link.py
- `Code tour` --references--> `Hub`  [INFERRED]
  docs/app.md → app/falcon_tracker/server.py
- `How the tag works` --references--> `ft_encode()`  [INFERRED]
  docs/firmware.md → firmware/lib/protocol/protocol.c
- `How the base works` --references--> `ft_decode()`  [INFERRED]
  docs/firmware.md → firmware/lib/protocol/protocol.c
- `Code tour` --references--> `serial_reports()`  [INFERRED]
  docs/app.md → app/falcon_tracker/sources.py

## Import Cycles
- None detected.

## Communities (17 total, 2 thin omitted)

### Community 0 - "test_app.py"
Cohesion: 0.09
Nodes (17): demo_reports(), parse_line(), serial_reports(), _iso(), to_gpx(), Tracks, _post(), _server() (+9 more)

### Community 1 - "tx/main.cpp"
Cohesion: 0.14
Nodes (15): led(), loop(), printFix(), setup(), buildFrame(), daysFromCivil(), gpsPower(), gpsUnixTime() (+7 more)

### Community 2 - "README.md"
Cohesion: 0.07
Nodes (23): Files, HTTP API, Install, Laptop app, Offline use, Run, Using the dashboard, Protocol (+15 more)

### Community 3 - "test_main.c"
Cohesion: 0.11
Nodes (21): Build and flash, Configuration, Firmware, How the base works, How the tag works, LED codes, ft_crc16(), ft_decode() (+13 more)

### Community 4 - "steps"
Cohesion: 0.09
Nodes (25): runs-on, steps, strategy, runs-on, steps, jobs, app, firmware (+17 more)

### Community 5 - "Contributing"
Cohesion: 0.10
Nodes (16): Coding principles, Commands, Project map, Rules for this repo, Code of Conduct, Contributing, Development setup, Ground rules (+8 more)

### Community 6 - "app.js"
Cohesion: 0.10
Nodes (37): act(), addLog(), addReport(), api(), applyStatus(), base, baseLayers, bearingDeg() (+29 more)

### Community 7 - "body"
Cohesion: 0.14
Nodes (13): description, label, options, render, body, attributes, id, type (+5 more)

### Community 8 - "body"
Cohesion: 0.17
Nodes (11): description, label, body, attributes, id, type, validations, description (+3 more)

### Community 9 - "Falcon Tracker"
Cohesion: 0.17
Nodes (12): 1. Try the app with no hardware, 2. Flash the boards, 3. Track, Animal welfare, Contributing, Falcon Tracker, Features, Hardware at a glance (+4 more)

### Community 10 - "Hardware"
Cohesion: 0.20
Nodes (10): Antennas, Base station (RX), Bill of materials, Falcon tag (TX), Hardware, Mounting on the bird, Optional: switching the GPS off, Pin map (+2 more)

### Community 11 - "make_handler"
Cohesion: 0.35
Nodes (10): make_handler(), _connect(), do_GET(), do_POST(), _json(), _send(), _static(), _stream() (+2 more)

### Community 12 - "[1.0.0] - 2026-10-28"
Cohesion: 0.29
Nodes (6): [1.0.0] - 2026-10-28, [1.1.0] - 2026-10-28, Added, Added, Changed, Changelog

### Community 13 - "pull_request_template.md"
Cohesion: 0.50
Nodes (3): Checklist, How it was tested, What and why

### Community 14 - "__main__.py"
Cohesion: 0.11
Nodes (5): Link, main(), parse_base(), Hub, serve()

## Knowledge Gaps
- **1 isolated node(s):** `falcon-tracker`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 141 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Laptop app` connect `README.md` to `test_app.py`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `main()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`main()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `falcon-tracker` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_app.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08888888888888889 - nodes in this community are weakly interconnected._
- **Why does `Code tour` connect `test_app.py` to `README.md`, `__main__.py`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Should `tx/main.cpp` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Why does `Firmware` connect `test_main.c` to `README.md`?**
  _High betweenness centrality (0.177) - this node is a cross-community bridge._