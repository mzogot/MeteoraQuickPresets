# Contributing

Thanks for helping improve Meteora Quick Presets.

## Reporting bugs and ideas

Open an [issue](https://github.com/mzogot/MeteoraQuickPresets/issues/new/choose). For bugs, include the extension version (shown on `chrome://extensions`), your browser version, a link to the pool and the message shown in the bar.

Never post a seed phrase or private key. Security problems go through the [security policy](SECURITY.md), not a public issue.

## Code changes

1. Fork the repository and create a branch.
2. Run `npm ci`, then `npm run watch`, and load the `dist` folder from `chrome://extensions` with **Load unpacked**.
3. Keep the safety limits. The extension must never submit the form or touch a wallet. A change that adds a permission, a network request or a new site needs a clear reason in the pull request, and may be declined.
4. For a user-facing change, bump the version and add an entry at the top of [CHANGELOG.md](CHANGELOG.md). Use `npm version minor --no-git-tag-version` for a feature, `patch` for a fix, or `major` for a breaking change. The build fails if the current version has no changelog entry.
5. Make sure `npm test` and `npm run typecheck` pass, then open a pull request. Say how you tested it on a real Meteora pool.

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
