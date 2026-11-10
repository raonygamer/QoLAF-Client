# QoLAF Client

A TypeScript browser port of selected features from [AstrofluxClient](https://github.com/raonygamer/AstrofluxClient), packaged as one ES module for the [QoLAF host](https://raonygamer.github.io/QoLAF/). No AFPUBLIC code or unsupported-feature placeholders are included.

## Install

Open the host's **Plugins** menu and add:

```text
https://raonygamer.github.io/QoLAF-Client/qolaf-client.js
```

Enable it and reload. Plugins run with access to the game session; install URLs you trust. The host stays vanilla unless you enable a plugin. Remove or disable this URL and reload to return to vanilla; `https://raonygamer.github.io/QoLAF/?safe=1` skips external plugins for recovery.

## Included

- Target selection by clicking ships or the nearby-target list, range and cooldown checks, lock/unlock, AF faction exclusion, automatic selection and player/group priority. Target details show live health, shield and distance. Selection is for the information panel; it does not aim or fire weapons.
- FPS, clock latency, connection status and smoothed speed. Speed uses the original client's cosmetic world-speed × 36 km/h convention.
- Chronological chat history with a restorable draft and 100-entry limit. History is kept in memory. `/qolaf` opens settings locally; ordinary chat keeps the game's native routing.
- Revealed artifact fitness scores, sorted highest first, using the AS3 formula table. This view does not alter or recycle artifacts.
- Validated per-player settings saved in the host's local storage.

Use **QoLAF** for settings and artifact fitness; **Targets** toggles target details. The source is split into modules under `src/`; no unsupported native features are exposed. This is the initial browser feature set, not complete AS3 client parity.

## Develop

Node 22 or newer:

```sh
npm ci
npm run check
npm test
npm run build
BUNDLE_TEST=1 npm test
```

`dist/qolaf-client.js` is the only executable output, with no external imports or runtime packages. The build also emits a small download page and SHA-256 metadata. Actions tests source and compiled-module integration, uploads the module artifact and publishes Pages on every push to `main`. The host's separate upstream-update action remains responsible for the official game snapshot.

Haxe classes are obtained through the host's API v1 registry. Hooks are installed before game initialization. Session timers, listeners, DOM and touchability changes are cleaned up on game exit. The hook manager restores native chat methods when the plugin is unloaded. Unsupported Haxe layouts disable the affected entry point and log an error; upstream changes can still require a compatibility update.

See [verification](docs/verification.md) for test coverage and source attribution.
