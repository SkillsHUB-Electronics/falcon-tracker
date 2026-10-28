# Graph Report - falcon-tracker  (2026-10-28)

## Corpus Check
- 31 files · ~12,347 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .css 1, .ini 1)

## Summary
- 279 nodes · 404 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

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
- SECURITY.md
- falcon-tracker

## God Nodes (most connected - your core abstractions)
1. `main()` - 12 edges
2. `Tracks` - 12 edges
3. `Hub` - 11 edges
4. `ft_encode()` - 11 edges
5. `ft_decode()` - 11 edges
6. `parse_line()` - 10 edges
7. `demo_reports()` - 9 edges
8. `render()` - 9 edges
9. `Falcon Tracker` - 9 edges
10. `Hardware` - 9 edges

## Surprising Connections (you probably didn't know these)
- `How the tag works` --references--> `ft_encode()`  [INFERRED]
  docs/firmware.md → firmware/lib/protocol/protocol.c
- `How the base works` --references--> `ft_decode()`  [INFERRED]
  docs/firmware.md → firmware/lib/protocol/protocol.c
- `Code tour` --references--> `Hub`  [INFERRED]
  docs/app.md → app/falcon_tracker/server.py
- `Code tour` --references--> `serial_reports()`  [INFERRED]
  docs/app.md → app/falcon_tracker/sources.py
- `Code tour` --references--> `demo_reports()`  [INFERRED]
  docs/app.md → app/falcon_tracker/sources.py

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 0 - "test_app.py"
Cohesion: 0.07
Nodes (18): main(), parse_base(), Hub, serve(), demo_reports(), find_serial_port(), parse_line(), serial_reports() (+10 more)

### Community 1 - "tx/main.cpp"
Cohesion: 0.11
Nodes (17): ft_fix_t, ft_status_t, led(), loop(), printFix(), setup(), buildFrame(), daysFromCivil() (+9 more)

### Community 2 - "README.md"
Cohesion: 0.07
Nodes (23): Files, HTTP API, Install, Laptop app, Offline use, Run, Using the map, Protocol (+15 more)

### Community 3 - "test_main.c"
Cohesion: 0.14
Nodes (19): Build and flash, Configuration, Firmware, How the base works, How the tag works, LED codes, ft_crc16(), ft_decode() (+11 more)

### Community 4 - "steps"
Cohesion: 0.09
Nodes (25): runs-on, steps, strategy, runs-on, steps, jobs, app, firmware (+17 more)

### Community 5 - "Contributing"
Cohesion: 0.10
Nodes (16): Coding principles, Commands, Project map, Rules for this repo, Code of Conduct, Contributing, Development setup, Ground rules (+8 more)

### Community 6 - "app.js"
Cohesion: 0.19
Nodes (18): addPoint(), base, bearingDeg(), COLORS, compass(), distanceM(), falconIcon(), falcons (+10 more)

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
Cohesion: 0.60
Nodes (5): make_handler(), do_GET(), _send(), _static(), _stream()

### Community 12 - "[1.0.0] - 2026-10-28"
Cohesion: 0.50
Nodes (3): [1.0.0] - 2026-10-28, Added, Changelog

### Community 13 - "pull_request_template.md"
Cohesion: 0.50
Nodes (3): Checklist, How it was tested, What and why

## Knowledge Gaps
- **1 isolated node(s):** `falcon-tracker`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 135 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Laptop app` connect `README.md` to `test_app.py`?**
  _High betweenness centrality (0.234) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `ft_encode()` (e.g. with `How the tag works` and `loop()`) actually correct?**
  _`ft_encode()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `falcon-tracker` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_app.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Why does `Code tour` connect `test_app.py` to `README.md`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `ft_decode()` (e.g. with `How the base works` and `loop()`) actually correct?**
  _`ft_decode()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `tx/main.cpp` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._