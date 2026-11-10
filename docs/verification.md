# Verification and source attribution

The target is the original AstrofluxClient, repository revision `b7a4f5cba87c8af9c484339de4ecf0dec0d4d890`. The full port is still in progress on `port/full-client`. See `port-audit/README.md` for the baseline and remaining systems.

The earlier DOM-panel implementation has been replaced on this branch with native Starling display objects. Login panels, settings classes, progress bars and target presentation use the original AS3 source as their reference. Haxe property adapters and Feathers-to-native control adapters bridge runtime differences. The obsolete corrosive-percent/all-damage workaround is explicitly excluded.

Current checks:

- `npm run format:check`: consistent formatting across all TypeScript source and tests.
- `npm run check`: strict TypeScript checking.
- `npm test`: builds the self-contained ESM bundle, then tests logic and native integration. Integration loads the emitted module through the host's actual plugin loader fixture.
- The real upstream Starling event invocation method tests callback arity; an extracted upstream Slider tests drag/step behavior with the port's original-theme skin.
- Settings tests cover original defaults/ranges, account separation, one-time migration from the earlier subset, live HUD/page preferences, and Aim Assist page listener cleanup.
- Session tests cover HUD ownership, frame delivery, native boss-bar visibility restoration, unit touch handlers, exit and reconnect cleanup.

Display-list fixtures are test doubles, not a browser/WebGL renderer. These checks do not establish visual parity or authenticated gameplay. The user confirmed that the deployed host's frame-event fix restored game rendering. The new native client branch still needs live visual/authentication checks and completion of the remaining integrations before being described as a full port.

`src/Ported` preserves original source class boundaries. `src/Settings/RuntimeSettings.ts` adapts original SharedObject persistence to plugin-scoped storage; it does not upload settings. `src/Runtime/GameSession.ts` owns per-game hooks and native HUD objects. The host's upstream snapshot/update workflow remains separate from this client module.
