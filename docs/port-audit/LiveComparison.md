# Live comparison ledger

Reference: original AstrofluxClient revision `b7a4f5cba87c8af9c484339de4ecf0dec0d4d890`, open SWF client. Port: local preview on `127.0.0.1:8087`, separate account. Different accounts/ships/levels must not be mistaken for client differences. Screenshots remain in the local audit directory outside this public repository.

## Observed fixes

- Reload displays auto-login countdown without profile/add-account controls overlaying it; countdown successfully enters the game.
- Plugins appears at login, disappears from play, and can be opened within Settings.
- Camera follow regression fixed: the cached Haxe enterFrame callback bypassed an instance timing hook, leaving the camera delta at zero. Timing now comes directly from the parallax render call. A short local flight confirms the ship stays centered while the gate moves; a cached-listener regression test covers this path. Original empty shake() is now hooked too. Remote player rotation has its own source-ported history buffer.

## Open differences — not signed off

- **Settings:** the original 930×580 sidebar window is now installed on the native SettingsState identity. General, Graphics, Cosmetics, HUD, Combat, Chat, Key bindings and Aim Assist can be opened locally. Plugins mounts in the sidebar. Source category switching, preference resume, page disposal and idempotent close/save have regression coverage. The original Button height and sized-font selection now adapt to native pointer handling. Automation pages/runtime and remaining feature backends are still missing; opening a page does not prove every toggle has its runtime effect.
- **Text:** native Haxe Text now routes to the source bitmap renderer, including htmlText colors. Reload/login/play succeeded locally. The same Nexar Shadow offer was opened on both clients: description wrapping and section spacing match after porting Feathers layout-box bounds (ink bounds initially made Special Weapon 11px too high). Different specialty ordering and dialog placement remain to review, and other screens are not signed off. Native identity and unload restoration have regression coverage.
- **Rendering:** separate `canvasStars` and background opacity are now installed with the original 30% defaults; the darker result is live-verified after reload. Independent brightness values persist locally, and real upstream refresh is tested twice. DPI/frame-rate controls, intro transitions, background-loading/cache behavior and remaining render-layer changes are still pending.
- **Movement:** remote rotation arithmetic is verified, but remote thrust/brake playback, local authoritative replay/correction, projectiles, combat text following, emitter timing and cinematic transitions still require their source ports and visual checks.
- **Settings behavior:** device preferences now back the source pages and save through the shared device store; the frame-rate slider applies to the native stage. DPI rendering, extra keybind commands, rich-chat behavior, automation and other source-only feature effects still need their runtime ports. Existing native audio/rotation/channel controls retain their upstream backends.
- **Plugins manager:** blank URL entry needs an explicit native input outline/label. Its settings placement must survive replacement of the upstream Settings class.
- **Login:** provider/profile screens need full side-by-side alignment and interaction comparison; only the countdown/autologin path is live-verified here.
- **Rich text:** renderer dependencies now include the four source pulse-color helpers (original-AS3 arithmetic parity over 10,000 timestamps each), role-tag presentation, and the Japanese glyph cache. Nine original SWF font subsets were exported to WOFF and loaded successfully in isolated headless Firefox. Cache tests cover reference protection, LRU reuse, overflow pages and batched uploads. The native Text bridge is installed and its offer-dialog screenshot has been compared. Global Starling bitmap compositor is implemented but NOT signed off: a live HTML TextField probe renders red/green glyph colors yet can leave nearby cached labels or icons missing. Explicit precomposition plus batching passed one probe, but the automatic composition queue still reproduced the failure. The live debug counter confirmed composition ran once, dirty=false and batchable=true, so missing composition alone does not explain it. The temporary probe and debug UI were removed after this check. Chat/editor integration remains pending. Original Text and bitmap renderer source factories now pass layout, alignment, and Text.htmlText-to-glyph color tests. These factories now back native Haxe Text calls; full-screen visual parity is still unproven. All thirteen original bitmap atlases load, and plugin disposal restores upstream font aliases. Markup parser/serializer, atomic artifact/image labels, typed-markup promotion, emoji lookup and UTF-16 navigation are source-ported and tested. The bitmap renderer now backs native Text; rich chat/editor integration still needs its source port and live verification.
- **Remaining systems:** rich chat/composer integration, commands, aim assist behavior, artifacts/sharing/overview, debuffs, boss/map/timers, native/private functionality, loading/reconnect and Steam packaging are still open.

The 722-file source inventory is the exhaustive review input; this ledger lists live observations and does not replace reviewing changes outside named QoLAF namespaces. The patched corrosive-percent/all-percent workaround is intentionally excluded per the user's instruction.

Latest verification: TypeScript check and all 58 tests pass. These tests do not reproduce the live Starling cache corruption and are not evidence that it is fixed.

## Bitmap cache investigation — repeated updates

The earlier single screenshots were insufficient: surrounding labels can remain intact initially and disappear later. `scripts/ProbeBitmapText.js` now preserves the local stress probe (native TextField insertion, five text changes/second, removal after 45 seconds). It is not shipped or automatically loaded.

- HTML glyph colors remain correct, but nearby static labels/buttons can disappear after subsequent updates or removal. Screenshots: `/tmp/QoLAF-HtmlRepeated2.png` initially intact, `/tmp/QoLAF-HtmlRepeated3.png` broken.
- Plain native TextField text also reproduces it (`/tmp/QoLAF-PlainRepeated.png`). Explicit batching does not reliably fix it; `/tmp/QoLAF-HtmlBatchableRemoved.png` is broken after removal.
- Temporarily disabling the new Text bridge and then disabling interpolation, background layers, artifact UI and game-session installation still reproduced missing native buttons. The full development bundle was rebuilt afterward; these isolation changes were never retained in source.
- Instrumented cached vertex ranges stayed within batch bounds. Sampled IndexData.copyTo outputs matched source indices plus the requested offset even while labels disappeared (`/tmp/QoLAF-IndexCopiesLater.png`). This rules out those sampled range/copy failures, not every GPU/cache fault.
- Marking the parent dirty after each change keeps the tested labels visible while updates run, but they disappear after removal. This is not a fix and was not added to production code.
- Next investigation: compare cached versus uncached GPU submissions, including clip/stencil state and actual buffer contents. Do not describe the HTML path as finished based on the unit tests or an initial intact screenshot.

User deferred further bitmap stress-test investigation to prioritize the important port work. No cache workaround was added. Live Settings screenshots: `/tmp/QoLAF-SettingsVisible.png`, `/tmp/QoLAF-SettingsGraphics.png`, `/tmp/QoLAF-SettingsBindingsLive.png`, `/tmp/QoLAF-SettingsAimLive.png`, `/tmp/QoLAF-SettingsChatLive.png`. Runtime diagnostics remained at zero uncaught errors through the page switches. General content placement was compared with `/tmp/QoLAF-OriginalNow.png`; viewport offsets and differing account preferences were excluded from that comparison.

### Gameplay presentation/settings follow-up

Compatibility rule clarified by the user: current Haxe gameplay and calculations
are authoritative. Port original client presentation and optional features around
those mechanics; do not restore old shield/regen or corrosive-as-all formulas.

- Added original health/shield display easing (12/sec exponential, 100ms frame
  clamp, 0.05 snap), 120px bar clamping, integer display and compact amount
  thresholds. Uses native HUD objects and leaves upstream warnings/tooltips intact.
- Connected damage formatting to the current game's final damage/healing totals.
  Retains its particle ownership, baseScale, timing, pooling and movement.
- Connected optional automatic respawn and survival leaving prompt, retaining
  readiness checks, manual Space when disabled, and PvP editor prompt exclusion.
- Audited against original HealthAndShield.as, Util.as, RoamingState.as,
  Killed.as and TextManager.as, then against current Haxe methods. Removed a
  proposed historical shield-regeneration formula change per user instruction.
- Automated coverage checks smoothing, compact rollover boundaries, settings
  changes, unchanged text writes, readiness/manual respawn, survival/PvP prompts,
  and preservation of damage totals/particle properties. Live visual matching of
  these new changes is still pending; these checks do not certify full parity.
