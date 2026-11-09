# Changelog

Notable changes to Meteora Quick Presets. Versions follow [Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-11-09

### Added

- Ratio presets. A new Ratio tab in the preset editor opens a position holding both tokens at a split you choose by value, such as 50/50, 60/40 or 80/20. Enter the total position in SOL and the SOL share, and the extension works out the token amount from the current pool price.
- Ratio presets set the range by Min % and Max %, or by total bins shared out using the same ratio.
- A ratio preset stops before changing the panel if your wallet can't cover either amount, and asks you to run it again if the price moves about 1% or more while it fills.

## [0.3.0] - 2026-11-09

### Added

- Token-sided presets. A new SOL / Token switcher in the preset editor lets you deposit a percentage of your token balance instead of a SOL amount, using the 25%, 50% and 100% shortcuts or any value you type.
- Token-sided presets set the range above the current price, by Max % or by total bins.

## [0.2.0] - 2026-11-09

### Added

- Quick Presets now works on every Meteora app address: `www.meteora.ag`, `meteora.ag` and `edge.meteora.ag`, as well as `app.meteora.ag`. Your presets are shared across all of them.

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
