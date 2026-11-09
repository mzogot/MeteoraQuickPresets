# Security policy

Meteora Quick Presets fills in a form that controls real funds, so security reports are taken seriously.

Please **don't** open a public issue for a vulnerability. Report it privately through
[GitHub's security advisories](https://github.com/mzogot/MeteoraQuickPresets/security/advisories/new).
You'll get a reply within a few days.

Only the latest release receives fixes.

## What the extension should never do

Please report anything that makes it possible for the extension to:

- Submit the Create Position form or trigger a wallet signature.
- Read wallet keys, seed phrases or balances.
- Send data anywhere, or load code from a remote source.
- Run on any site other than `https://app.meteora.ag`, `https://www.meteora.ag`, `https://meteora.ag` or `https://edge.meteora.ag`.
- Report a preset as ready when the panel holds a different amount, strategy, Auto-Fill setting or price range.

The real-SOL check reads the token logo Meteora shows, because the extension makes no network requests. A fake
token could pass it by using SOL's exact logo address, so always check the pool before you deposit.

## Check your download

Fake copies of crypto extensions are a common way to steal funds. Only install from this repository's
[releases](https://github.com/mzogot/MeteoraQuickPresets/releases) page, or build from source.

Each release has a `.sha256` file next to the `.zip`. Download both into the same folder and run:

```sh
shasum -a 256 -c meteora-quick-presets-*.zip.sha256
```

It should print `OK`. You can also read the loaded extension's `manifest.json`. It should list `storage`
as its only permission, and only these four sites: `https://app.meteora.ag/*`, `https://www.meteora.ag/*`,
`https://meteora.ag/*` and `https://edge.meteora.ag/*`.
