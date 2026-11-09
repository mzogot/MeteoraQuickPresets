# Meteora Quick Presets

## Versioning and changelog

Every user-facing change gets a version bump and a `CHANGELOG.md` entry, in the same piece of work as the change.

| Change | Command |
| --- | --- |
| New feature | `npm version minor --no-git-tag-version` |
| Bug fix or small tweak | `npm version patch --no-git-tag-version` |
| Breaking change, such as saved presets no longer loading | `npm version major --no-git-tag-version` |

Internal changes with no effect on users (refactors, tests, tooling) need neither.

- `package.json` is the only place the version is set. `build.mjs` writes it into `dist/manifest.json`, so don't add a `version` to the root `manifest.json`.
- Add the new entry at the top of `CHANGELOG.md` as `## [x.y.z] - YYYY-MM-DD`, with `### Added`, `### Changed` or `### Fixed` sections written for users.
- The build fails if the current version has no changelog entry.

## Releases

Pushing a new `package.json` version to `main` publishes it. `.github/workflows/release.yml` runs the checks, builds the zip and checksum, and creates the `vX.Y.Z` GitHub release with that version's changelog entry as its notes. Don't create releases by hand, and test on a real Meteora pool before pushing a version bump.
