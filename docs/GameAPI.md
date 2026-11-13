# Game reflection API

`src/game/Game.d.ts` describes the current Haxe game. It is generated from the
JavaScript AST without executing the game. The header records the input SHA-256.
Regenerate after updating the upstream client:

```sh
npm run types:game -- /path/to/astroflux.js
```

Use the reflection wrapper after `classesReady`:

```ts
import { GameReflection } from '../api/GameReflection';
import type { Game } from '../game/Game';

const reflection = new GameReflection(api);
api.on('classesReady', () => {
  const PlayerShip = reflection.require('core.ship.PlayerShip');
  const off = reflection.after(PlayerShip.prototype, 'draw', function (result) {
    const ship: Game.core.ship.PlayerShip = this;
    // Native getter methods and inherited members are available in autocomplete.
    const position = ship.get_pos();
  });
  api.defer(off);
});
```

- `find(name)` returns the typed class or undefined; `require(name)` throws if absent.
- `is(value, name)` narrows an instance, following Haxe classes and interfaces.
- `cast(value, name)` checks at runtime and returns the typed instance.
- `before`, `after`, and `around` retain native hook cleanup and typed `this`.
  `after` receives the result **first**, then the original arguments. `around`
  receives `next`, then the original arguments. Missing or incompatible hook registrations
  are recorded in diagnostics and return a no-op cleanup so other hooks can install.
  An around-hook exception falls back to native execution only if `next` was not
  called; otherwise it preserves the completed result. Downstream game errors
  still propagate, and later calls can retry a hook after a transient failure.
- `dynamic(name)` is the explicit escape hatch for classes absent from the snapshot.

The generated namespaces preserve game names (`Game.core.ship.PlayerShip`). These
are type-only declarations: they create no runtime namespace and do not pretend
that the game exports ES modules. Use native `get_*`/`set_*` methods for Haxe
properties; assigning an invented JS property would bypass their behavior.

Compiled JavaScript preserves members, static members and inheritance, but erases
most Haxe types and renames parameters. Those types remain `any`, with optional
`arg0`, `arg1`, etc.; they are not recovered source signatures. The API currently
provides member/class autocomplete and checked member spelling, not complete
argument validation. Regeneration overwrites the generated file. Precise manual
contracts should live separately and be based on inspected game behavior.

Existing `api.cls(string)` remains available so the migration can be incremental.
NativeBeamResources uses the typed wrapper as an integrated example. No gameplay
behavior changes are required to adopt it.

## Cached event listeners

Haxe caches bound callbacks in `hx__closures__`. Patching a prototype method does
not change an already registered callback. Capture the original method before
hooking it, then replace the listener explicitly:

```ts
const original = login.onConnectStatus;
const off = reflection.replaceListener(
  login.registerDialog,
  'connectStatus',
  login,
  original,
  function (event) {
    this.connectStatus.update(event);
  },
);
api.defer(off);
```

The dispatcher must already contain that listener. The wrapper binds `this` to
its owner and restores the original callback exactly once on cleanup. An optional
final `restore` predicate can suppress restoration when the owner has completed
its lifecycle. Release stacked replacements in reverse installation order.
`bound(owner, original)` also exposes the cached callback identity when you need
to manage dispatch directly. Pass the original function reference, not a method
that has already been replaced by a hook.

`src/runtime/HaxeInterop.ts` contains property-accessor bridging and the `bound`
decorator used by ported classes; these are separate from runtime method hooks.

## Shared class bindings

`src/game/Bindings.ts` exports a value and instance type under each registered
class name. For example, import `JoinRoomManager` normally: `JoinRoomManager` in
a type annotation denotes an instance, while `typeof JoinRoomManager` denotes
the constructor and static members. The value can be used with `new`.

`bindGameClasses(api)` runs first at `classesReady`. Values are ES module live
bindings because the game classes do not exist when the plugin module initially
loads. Consumers must use them after that event. All required classes are
resolved before publishing any binding. No proxy constructors are introduced.

Login loading/status/startup service join now consume these imports. Existing
features still need migration; generated erased member types still need real
signatures. This centralization alone is not full type safety.
