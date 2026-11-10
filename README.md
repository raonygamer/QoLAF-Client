# QoLAF Client

A work-in-progress TypeScript port of [AstrofluxClient](https://github.com/raonygamer/AstrofluxClient), packaged as one ES module for the [QoLAF host](https://raonygamer.github.io/QoLAF/). The target is the original client's features and native login/in-game appearance. This development branch is not yet a complete port.

## Status

`port/full-client` replaces the earlier DOM-panel approximation with game-native Starling components. It includes source-based login profile panels, target information and progress bars, nearby targets, telemetry, artifact tooltip/sorting integration, and the original settings model. The settings pages and native-control adapters are still being integrated; additional original systems remain pending. See the [port audit](docs/port-audit/README.md) for scope and exclusions.

The obsolete corrosive-percent/all-damage workaround is excluded because that game bug has been fixed. No AFPUBLIC module is bundled here.

## Install

The published plugin URL is:

```text
https://raonygamer.github.io/QoLAF-Client/qolaf-client.js
```

The published module follows `main`, not this development branch. Add or enable it in the host's **Plugins** menu and reload. Disable it and reload to return to vanilla; `https://raonygamer.github.io/QoLAF/?safe=1` skips external plugins for recovery.

## Develop

Node 22 or newer:

```sh
npm ci
npm run format:check
npm run check
npm test
npm run build
```

Use `npm run format` after editing. TypeScript filenames, classes, and our own namespace/module groupings use PascalCase; methods and functions use camelCase. Preserve original game namespace chains (`qolaf.*`, `core.*`, etc.) and runtime boundary identifiers such as `get_width` and `set_visible`. Keep readable source with descriptive names and separate statements; the one-file distribution does not require compressed source files.

`src/Index.ts` registers the plugin. `src/Runtime/GameSession.ts` owns per-game hooks and native HUD objects. `src/Ported` retains source class boundaries; adapters translate original APIs to the Haxe runtime.

`npm test` builds and exercises the emitted module alongside source-level tests. `dist/qolaf-client.js` is one self-contained ES module with no external imports. The build also emits a download page and SHA-256 metadata. Actions checks formatting, types and tests, uploads the module artifact, and publishes Pages from `main`. The host's separate upstream-update workflow remains responsible for the official game snapshot.

See [verification](docs/verification.md) for test coverage and its limits.
