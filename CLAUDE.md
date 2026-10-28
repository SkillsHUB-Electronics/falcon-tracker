# CLAUDE.md

Guidance for AI coding assistants (Claude Code, Cursor, Copilot, …) and humans
working in this repository.

## Coding principles

Adapted from Andrej Karpathy's observations on how LLM-written code goes wrong
(see the community "andrej-karpathy-skills" guidelines). They bias towards
caution over speed; use judgment for trivial tasks.

1. **Think before coding.** State assumptions. If a request has more than one
   reading, say so instead of picking silently. If something is unclear, stop
   and ask. Push back when a simpler approach exists.
2. **Simplicity first.** The minimum code that solves the problem. No speculative
   features, no abstractions for single-use code, no configurability nobody asked
   for. If 200 lines could be 50, rewrite it.
3. **Surgical changes.** Touch only what the task needs. Match the existing style.
   Do not "improve" adjacent code, comments or formatting. Remove only the dead
   code your own change created.
4. **Goal-driven execution.** Turn the task into a check you can verify
   ("add a test that fails, then make it pass"). Loop until it is verified.

## Project map

Read [`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md) for a
knowledge-graph overview before searching files. Rebuild it with
`graphify update .` after structural changes.

| Path | What |
|---|---|
| `firmware/include/config.h` | Pins, radio, timing. Single source of truth for both boards. |
| `firmware/lib/protocol/` | Radio frame codec. **Change together with** `docs/protocol.md` and the RX JSON printer. |
| `firmware/src/tx`, `src/rx` | Tag and base station `main.cpp`. |
| `app/falcon_tracker/` | Python app; stdlib + pyserial only. |
| `hardware/` | Wiring SVGs; keep in sync with `config.h` and `docs/hardware.md`. |

## Commands

```bash
cd firmware && pio run && pio test -e native   # build both boards, run C tests
cd app && python -m pytest                     # app tests
cd app && python -m falcon_tracker --demo      # run the app without hardware
```

## Rules for this repo

- Keep the radio frame fixed-size and versioned. A breaking change bumps
  `FT_VERSION` and documents the new layout.
- Do not add dependencies to the app beyond `pyserial` without a strong reason.
- Avoid ESP32-C3 strapping pins (GPIO2, 8, 9) for inputs that may be low at boot.
- Power matters: anything that keeps the tag awake longer needs a reason.
