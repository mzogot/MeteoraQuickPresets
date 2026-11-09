# Changelog

Notable changes to Meteora Quick Presets. Versions follow [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-09

### Fixed

- The Ready message now appears only after the panel is checked for the right SOL amount, strategy, Auto-Fill setting and price range.
- Presets now refuse pools where the token is only named SOL.
- If a preset stops partway, the message now warns that the panel may be only partly filled.
- Other scripts on the page can no longer read or click the Quick Presets bar.

## [0.1.0] - 2026-11-09

### Added

- Quick Presets bar above Meteora's DLMM Create Position panel.
- One-click presets that set the SOL amount, strategy (Spot, Curve or Bid Ask) and price range. The extension never submits a transaction.
- Price range by Min % or by total bins.
- Per-preset Auto-Fill option. With it off, the position is single-sided SOL.
- Add, edit and delete presets, with optional names.
- Progress and error messages in the bar. A running preset stops if you use the panel or the page changes.
