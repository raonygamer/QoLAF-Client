# Live comparison ledger

Reference: original AstrofluxClient revision `b7a4f5cba87c8af9c484339de4ecf0dec0d4d890`, open SWF client. Port: local preview on `127.0.0.1:8087`, separate account. Different accounts/ships/levels must not be mistaken for client differences. Screenshots remain in the local audit directory outside this public repository.

## Observed fixes

- Reload displays auto-login countdown without profile/add-account controls overlaying it; countdown successfully enters the game.
- Plugins appears at login, disappears from play, and can be opened within Settings.
- Rebuilt interpolation module loads and the game still renders after authentication. Remote player rotation has its own source-ported history buffer.

## Open differences — not signed off

- **Settings:** live window is still upstream's General/Key bindings/Chat tabs, not the original 930×580 sidebar window. Source factories exist for the window, General, Aim Assist, Chat, Bindings and binding rows; their full runtime dependency chain is not installed. Automation pages and their runtime remain missing.
- **Text:** offer/dialog descriptions fall back to a serif system font; original uses its bitmap/rich-text stack. Font atlases alone do not port that renderer. Alignment/wrapping must be compared after its integration.
- **Rendering:** backgrounds are brighter than original; original separates star brightness and background opacity. DPI/frame-rate controls and all render-layer changes remain pending.
- **Movement:** remote rotation arithmetic is verified, but remote thrust/brake playback, local authoritative replay/correction, projectiles, combat text following, emitter timing and cinematic transitions still require their source ports and visual checks.
- **Settings behavior:** original device settings, keybind extensions, rich-chat settings and automation dependencies must work before opening their source pages in the live game. Source-translated factories alone are not completed screens.
- **Plugins manager:** blank URL entry needs an explicit native input outline/label. Its settings placement must survive replacement of the upstream Settings class.
- **Login:** provider/profile screens need full side-by-side alignment and interaction comparison; only the countdown/autologin path is live-verified here.
- **Remaining systems:** rich chat/composer, commands, aim assist behavior, artifacts/sharing/overview, debuffs, boss/map/timers, native/private functionality, loading/reconnect and Steam packaging are still open.

The 722-file source inventory is the exhaustive review input; this ledger lists live observations and does not replace reviewing changes outside named QoLAF namespaces. The patched corrosive-percent/all-percent workaround is intentionally excluded per the user's instruction.
