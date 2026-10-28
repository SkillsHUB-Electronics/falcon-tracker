# Contributing

Thanks for helping! Bug reports, field test results, range measurements, power
measurements, photos of your build and code are all welcome.

## Ground rules

- Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Animal welfare first. Changes that make the tag heavier or riskier for the bird
  need a very good reason.
- Follow the coding principles in [CLAUDE.md](CLAUDE.md): simple, minimal,
  readable code; surgical changes; a test or a measurement that proves it works.

## Development setup

```bash
git clone https://github.com/<you>/falcon-tracker.git
cd falcon-tracker

# firmware
pip install platformio
cd firmware && pio run && pio test -e native && cd ..

# app
cd app && python -m pip install -e ".[dev]" && python -m pytest
```

## Making a change

1. Open an issue first for anything bigger than a small fix, so we can agree on
   the approach.
2. Create a branch: `git checkout -b fix/short-description`.
3. Keep the change focused. One topic per pull request.
4. Add or update tests (`firmware/test/`, `app/tests/`) and docs (`docs/`).
5. If you change the radio frame, update `protocol.h`, `docs/protocol.md`, the RX
   JSON printer and bump `FT_VERSION`.
6. If you change pins, update `config.h`, `docs/hardware.md` and the wiring SVGs.
7. Run the tests, then open a pull request using the template.

## Style

- C/C++: 2-space indent, 100 columns, `snake_case` for the C protocol library,
  Arduino style (`camelCase`) in `main.cpp` files. Comments say *why*, not *what*.
- Python: PEP 8, 100 columns, standard library first.
- Commit messages: imperative mood, e.g. `Add GPS power-save mode`.

## Reporting a field test

Please include: firmware version/commit, `config.h` radio settings, antennas used,
base antenna height, max range achieved with RSSI/SNR, terrain, and the CSV log if
you can share it.
