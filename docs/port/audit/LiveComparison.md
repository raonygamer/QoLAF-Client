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

### Radar source audit and two live reloads

- Reloaded the local port twice. Both reached gameplay; first capture
  `/tmp/QoLAF-GameplayReady.png` confirms compact native HUD health/shield values.
- Compared RadarTelemetry.as and RadarTelemetryMetrics.as with the port:
  corrected `Frames/sec:` and `Current speed:`, unavailable marker `--`, 18px
  radar gap, 100ms refresh with retained remainder, and actual service room ID.
  Ship/lifecycle changes now reset the speed average. Unchanged labels no longer
  rewrite text on every refresh.
- Second capture `/tmp/QoLAF-RadarReady.png` shows corrected radar text/placement
  and `Service: Service-1409_0`. Some sale-dialog labels are missing in this
  capture; this is not a claim of complete visual parity. The previously deferred
  bitmap/cache issue was not investigated in this pass.
- Added focused radar regression coverage for wording, layout, lifecycle reset,
  toggle reflow and visibility. TypeScript, build and 63 tests pass.
- Fixed frame-rate preference cleanup to restore the previous native stage rate
  and skipUnchangedFrames value on plugin unload.
- Remaining radar gaps explicitly include DPS observation, emperor coordination,
  boss timers, service pooling/IPC and desktop radio integration.

### DPI scale wiring

- Ported RymdenRunt's even-sized logical stage calculation: even physical viewport
  divided by DPI, truncated to an even logical size with a minimum of two.
  Physical browser viewport remains native; Starling retains pointer conversion.
- Hooked the current Starling stage setters so existing cached resize callbacks
  cannot overwrite the scale. Other Starling stages remain untouched. Applied at
  login initialization, game creation, and preference changes; restored on unload.
- Live Settings -> Graphics -> DPI slider changed 100% to 125%. Capture
  `/tmp/QoLAF-DpiChanged.png` shows the scaled 930x580 source Settings window,
  HUD and radar; clicking Close at its new position worked.
- Automated coverage checks odd dimensions, scale limits, cached resize callbacks,
  repeated values/no double scaling, unrelated stages, and unload cleanup.
- Reload persistence verified at 125% in `/tmp/QoLAF-DpiPersist.png`; reopened
  Settings using its scaled HUD button, restored 100% through the slider, and
  saved by closing. `/tmp/QoLAF-DpiRestored.png` shows the restored geometry.
  Preview diagnostic reported zero uncaught runtime errors after reload.
- TypeScript check, build, and all 65 tests pass. This verifies DPI behavior,
  not overall completion of the client port.

### Clan identity and target-bar formatting

- Connected the existing formatTargetBarValues preference to CustomProgressBar's
  source floor/clamp + Util.formatAmount behavior. Hidden targets retain ???.
  Unchanged value/multiplier strings no longer rebuild their text fields.
- Ported PlayerShip clan name/rank/icon layout above the native name: source
  13px/11px combat bitmap fonts, 20% logo scale, clan color and role offset.
  Uses native ClanState.getMemberRankName and DataLocator Clans lookup.
- Bounded 10/20/40/60 second retries and request/player/clan/lifecycle guards
  reject late responses. Removal, reset, destruction and plugin cleanup dispose
  labels. Native name visibility and the Settings checkbox gate display.
- Haxe TextBitmap has no font constructor argument; explicitly apply the registered
  DAIDRR_COMBAT alias, retaining native auto-width behavior.
- Tests cover stale responses, retry, clan changes, missing logo, visibility,
  layout, disposal and target formatting toggles/hidden values. Check/build and
  67 tests pass. Local reload reached gameplay with zero uncaught runtime errors.
- No visible remote clan-bearing player was captured in the live reload screenshot
  `/tmp/QoLAF-ClanReload.png`; real clan-label visual parity is still pending.
  Identity caching in upstream Player objects and live clan changes also remain
  to be compared with the original beyond the callback/lifecycle unit coverage.

### Compact warp-gate map

- Connected compactWarpGateUI at native map creation, following the original
  construction-time preference semantics. Native route data, selection, transit
  events, licenses and purchase handlers remain upstream-owned.
- Ported the 20 named system positions/branch lanes, 8px node radius, label
  backgrounds/anchors, 2px routes and vertical quads, faction texture regions,
  per-node nebulas, background dimming and stationary compact viewport.
- Added restoration of node geometry/fonts, route drawing and background on
  plugin unload; normal map cleanup releases added display resources and texture
  views without creating a new recenter animation during disposal.
- Live temporary native StarMap preview used allowBuy=false. First capture
  `/tmp/QoLAF-CompactMap.png` shows the compact graph and regions. Selecting
  Mitrilion updated the native galaxy title, selected ring and unavailable-warp
  notice without panning (`/tmp/QoLAF-CompactMapSelected.png`).
- That selection capture also contains missing cached labels, consistent with
  the previously deferred bitmap issue; this pass does not claim to fix it.
- Audited against original StarMap, SolarSystem and WarpPath, then current Haxe
  methods. Source layout regression covers named lanes, diamond branches, label
  anchors and resizing. TypeScript, build and 68 tests pass.
- Full original-SWF visual comparison and actual landed warp-gate integration
  remain to be verified; a native no-purchase preview is narrower evidence.
- A second font audit/render exposed native TextBitmap auto-width measurement
  under an existing scale, creating excessive name/percentage gaps. Measuring at
  scale 1 before applying the source 10/16 label scale fixed it; verified in
  `/tmp/QoLAF-CompactMapFinal.png`. Native labels now use the original Russo24 atlas.
- Closed the temporary map preview and removed its script/HTML injection. It is
  not part of the bundle or published host.

### Legacy chat input preferences

- BodyManager's original DISTORTION_EFFECTS_AVAILABLE is explicitly false; body
  black-hole distortion remains disabled as in the source rather than inventing
  an effect behind its unavailable control.
- Connected legacyChatFontSize to the current native TextEntry composer. Uses
  the game's DOM overlay coordinate conversion for font size under DPI/browser
  zoom, fits legacy input/tabs to narrow stages, and applies original legacy
  bottom/center placement and bounds clamping.
- Keeps current input text, selection, focus ownership, restrictions and message
  sending unchanged. Restores previous formatting/layout and removes listeners
  on session disposal. Rich bitmap editor/integrated chat remains unported.
- Automated checks cover default/changed font size, DPI conversion, narrow-stage
  layout, unchanged drafts/selections and cleanup. All 69 tests pass.
- Live reload reached gameplay; opened the empty native composer and verified
  its centered placement in `/tmp/QoLAF-ChatOpen.png`, then closed it with Escape.
  No message was entered or sent. Numeric font/DPI behavior is covered by tests;
  an empty input alone is not visual proof of glyph sizing or rich-editor parity.
- The same capture now provides live evidence of the earlier clan-label port:
  a nearby remote player displays clan name, rank and logo above the native name.
  Original-SWF pixel comparison of that label is still pending.
- TypeScript check and build pass after correcting a missing type import.

### Selected-target marker and target validity

- Ported TargetAimIndicator with the byte-identical original 29x29 target_icon.png,
  three white inward-pointing markers, original 32 degree/sec rotation, 6 rad/sec
  radius pulse and unit-size radius. Uses native clip render coordinates where
  Haxe lacks source renderX/renderY, preserving interpolated placement.
- Added it to the world canvas and connected disableSelectedTargetIcon. The
  source default is disabled; preserved that default. Texture loading handles
  session exit before completion and owns indicator/texture cleanup.
- Fixed target validity to read Haxe's landed getter; the lock setter now refuses
  invalid targets like the original. No movement or combat calculations changed.
- Live Settings HUD -> target display: enabled the marker, clicked a nearby target
  row to lock, and observed all three markers around that ship in
  `/tmp/QoLAF-TargetMarkerLocked.png`. Unlocked and restored the original disabled
  preference (`/tmp/QoLAF-TargetRestored.png`), then closed Settings.
- Tests cover exact arrow geometry/animation, rendered-vs-simulation coordinates,
  visibility, stale texture completion, native landed access and locking. Expanded
  the Image fixture with real pivot/rotation semantics needed by the new feature.
  TypeScript/build pass and all 72 tests pass. Full original-SWF parity remains open.


### Target debuff observations and native gameplay boundary

- Added original debuff metadata, stacking/expiry observations, 21px icon grid,
  countdown text and pooled native tooltips to the target HUD. Protected target
  stats also suppress debuff icons. Reset/destroy clears observations.
- The hook observes native doDOTEffect calls only. It does not replace the native
  method, alter its arguments, or write shield/healing state. Current Haxe shield
  behavior and gameplay calculations remain authoritative, as requested.
- Original metadata has no icon for every native effect type; those types are not
  given invented icons. Native ToolTip supplies its current tooltip style because
  its constructor lacks the original seventh style argument. White text and
  260px width are preserved; exact tooltip typography remains to be compared.
- Audited native doDOTEffect, reset/destroy and ToolTip methods against the source.
  Added tests for unchanged native state/arguments, stacking, refresh, expiry,
  protected stats, icon geometry/reuse and tooltip cleanup. Extended the fixture
  with native tooltip ownership APIs; TypeScript, bundle build and all 75 tests
  pass. Live combat/debuff rendering and original-SWF visual parity are pending.

### Rare-aura information and target header alignment

- Restored the original 20x20 rare-aura question-mark button, aura-specific color,
  descriptions and 260px native tooltip. Descriptions are copied from
  RareAuraStyle; they are presentation only, never enemy stat calculations.
  Current server multipliers have not independently been measured in combat.
- Button appears only for the five source aura types on EnemyShip, reserves the
  original 26px (button plus gap), and releases tooltips on target/type changes
  and session exit. Native constants determine type mapping.
- Header children now center vertically in the original 25px row. Name width and
  following button positions use the original minimum width and six-pixel gaps,
  including when the minimum name width makes the row exceed its nominal width.
- TypeScript/build and all 77 tests pass. Tests cover all five descriptions,
  native constant mapping, tooltip reuse/disposal and unchanged enemy fields.
- Reloaded local preview through auto-login into gameplay. Capture
  /tmp/QoLAF-AuraHudLoaded.png shows the rendered target header behind the native
  sale dialog; closed that dialog afterwards. No rare target was present in this
  check, so live aura hover and original-SWF visual comparison remain pending.
  Native ToolTip's current style remains the same known typography limitation as
  the debuff tooltip; this is not a complete target-HUD parity sign-off.

### Radar direct-hit DPS estimate

- Ported RollingDamageEstimate's fixed 100 buckets, 50ms granularity, full
  five-second denominator, clock rollback reset and five-second partial flag.
  Connected showRadarDPS to the runtime settings and original third radar row,
  retaining the `Current DPS: ~N (partial)` wording and 15px line placement.
- Uses current native Damage.dmg() and HEAL constant (6), not historical damage,
  shield or corrosive formulas. Beam adapter counts successful existing heat
  checks inside native shoot, including Haxe's eight-tick catch-up loop. It never
  calls canFire again or changes the native method's arguments/result. Pet beams
  without heat infer the native timer progression.
- Added source instant-ray and homing swept-contact observers, bounded 512-unit
  instant scan, nearest mine blast contact, and native MissileStuck entry hook.
  Observations do not change projectiles, select targets or send damage. Unit
  reset generations supplement the Haxe runtime's missing source lifecycle ID;
  stale homing targets are rejected, and duplicate hits are suppressed.
- Coverage is still incomplete: ProjectileBullet/Bouncing contact callbacks have
  not yet been adapted, and those projectile families explicitly mark partial.
  Source omissions (blastwave, splitting, splash and extra hits) remain partial.
  Server-only modifiers, DOT and actual attacker attribution are not inferred.
- TypeScript/build and all 84 tests pass. Tests cover rolling expiry, geometry,
  native-field preservation, healing/foreign-weapon rejection, pooled targets,
  duplicate contacts, beam heat/return preservation and DPS setting/row layout.
- Live reload reached gameplay and rendered `Current DPS: ~0` above the radar in
  /tmp/QoLAF-DpsRadar.png. Closed the sale dialog afterward. This verifies idle
  rendering only; live hit estimates, pet beam timing and SWF combat comparison
  remain pending. No combat input or purchase was performed for this check.

### Native bullet/bouncing contact attribution

- Adapted original registerSimulatedHit observation to the current Haxe collision
  methods without replacing them. While native ProjectileBullet/Bouncing execute
  scans candidates, track its canBeDamage result; record only when that same
  native branch destroys/explodes the projectile or enters ProjectileStuck.
  Eligibility alone and subsequent lifetime/server removal are not hits.
- Candidate consumption prevents destroy -> explode from counting twice, while
  distinct piercing contacts still count separately. Context restores on native
  exceptions and nested calls. Bombs count when they stick, not again on expiry.
- Contact-family coverage is enabled only when the necessary native methods are
  present. The branch that skips canBeDamage remains explicitly partial. Kept the
  current unusual Bouncing aiTargetSelf/own-unit condition intact; it also exists
  in the original source and this port does not change simulation to bypass it.
- Regression fixture contains the exact current Haxe execute bodies. Tests run
  those bodies with and without observation, comparing position, alive state,
  removal/explosion counts, target and next-scan timing. Cover ordinary, piercing,
  bomb, rejected/missed contacts, removal outside the scan, exception cleanup and
  hook disposal. A separate check prevents the mine blast estimator from also
  counting covered bullet explosions (caught and fixed during diff review).
- TypeScript, single-module build and all 91 tests pass. Live combat remains to
  be compared against the original SWF; these native-method tests establish
  collision behavior preservation, not server damage accuracy or visual parity.
  Splash, splitting, blastwave and other unobservable effects remain partial.

### Hit-based automatic targeting

- Restored the local-personal-contact path from Weapon.registerSimulatedHit into
  the port's TargetSystem.auto. Native beam, bullet/bouncing, sticking missile
  and nearest mine-blast contacts now offer targets even with showRadarDPS off.
  Owner/pet checks exclude foreign weapons and healing; source target locks,
  cooldown, priority, range, AF exclusion and autoTarget preference still decide
  whether a candidate is selected.
- Kept recordEstimatedHit separate: inferred instant-ray/homing geometry does
  not select a target or update last-contact history. Native sticking after an
  already estimated homing hit offers the target without duplicating damage.
- Added per-weapon last-contact unit/time observations in a WeakMap and clear them
  on native Weapon.reset, matching pooled source weapon reset. No fields are
  written onto native weapon/projectile objects. Incoming NPC hit history used
  by other original client features is not included in this change.
- All 97 tests, TypeScript and bundle build pass. Tests include actual native
  bullet execution with DPS disabled, beam heat checks with DPS toggled, target
  locks/cooldown/settings, pets/healing/foreign ownership, display-only geometry,
  sticking after an estimate, duplicate mine explosions and weapon history reset.
  Live combat auto-selection and original-SWF comparison remain pending.

### Direct Settings comparison and Plugins styling

- Opened the original SWF's General Settings and the port's General Settings on
  the two monitors. Captures /tmp/QoLAF-OriginalSettingsNow.png and
  /tmp/QoLAF-PortSettingsNow.png show matching 930x580 panel geometry, headings,
  sidebar controls and General rows after accounting for viewport position.
  Account preferences differ; they were not changed to manufacture a match.
- The comparison exposed the host Plugins button still using the uppercase,
  outlined login control in Settings. Fixed the host on port/native-manager
  (30667b9) to use native normal Button controls: original 13px Verdana atlas,
  130x32 sidebar size and unscaled text. Vanilla host falls back to font13;
  login retains LoginButton. Dialog buttons also use the current context's style.
- Reloaded the local preview with the updated host module, opened Settings and
  Plugins, then closed both. /tmp/QoLAF-PluginsStyled.png and
  /tmp/QoLAF-PluginsDialogStyled.png show the corrected controls. Native display
  ownership and game hotkey restoration are tested. Host tests: 17 pass, 1 skip.
  Upstream snapshot was preserved by copying only the changed host module into
  the local preview, not running the snapshot-destroying host build.
- Original Automations navigation is visibly present and remains absent from the
  port pending its real runtime/page implementation. This comparison does not
  establish complete Settings functionality or all-screen parity.

### Automation runtime contract (integration in progress)

- Inspected current original SettingsAutomations and af.AutomationManager,
  AutomationModule, AutomationEvent, AutomationInfo and EventBus. This feature
  uses AIR filesystem and SWF/ApplicationDomain loading; it requires an actual
  browser module/storage adapter, not just enabling the missing category.
- Ported metadata/event objects, defensive argument/author copies, command-only
  handled flag, EventBus snapshot/arity dispatch, subscription ownership, command
  namespace validation and disposal. Command parsing/registry is an explicit
  injected dependency, not an inert placeholder implementation.
- Added the source module lifecycle: initialize/start/stop/update/render/command,
  stopped rendering/commands, fresh runtime after room suspension, original error
  STOP path, initialize-failure cleanup and preservation of the original error.
  Cleanup remains possible after the game detaches, and cleanup errors cannot
  prevent room control release. Native game objects are passed through unchanged.
- TypeScript/build and all 103 tests pass, including lifecycle ordering and
  delta dispatch, callback mutation, namespace ownership,
  room handoff/restart and constructor/event cleanup paths.
- These classes are not yet wired into the active game or Settings category.
  Browser import/persistence, full command registry integration, manager-level
  ownership and the original UI remain pending. Existing SWF automation binaries
  cannot execute directly in the browser runtime; modules need a JS/TS port.
- Original repository has ongoing modified/untracked files; none were edited or
  reset. Source reads in this pass used the current worktree as authoritative.

### Automation manager and browser I/O adapter (integration in progress)

- Added installed-module manager with source SCRIPT_ID/getInfo contract, metadata
  validation, duplicate/version rejection, initial script instance reuse,
  start/stop/remove, control ownership, transient inactivity ownership and room
  handoff. Imports/restores initialize when attached but never auto-start scripts.
  Room changes construct fresh runtime instances while retaining installed code.
- Added browser storage adapter for installed code snapshots (matching AIR's
  persisted module bytes rather than silently refetching changed code on reload),
  HTTPS/local-preview fetch and Blob-module compilation with URL cleanup. Modules
  are bundled ES modules exporting a script class; plain metadata objects avoid
  requiring an import of the client bundle. Relative module imports are not
  supported by the Blob-based bundled-module contract.
- Failed metadata validation/storage writes dispose pending module resources;
  deletion failure leaves the stopped module recoverable. Imports completing
  after disposal cannot install or persist. Settings listener errors are isolated
  as in the original dispatchChanged path.
- TypeScript/build and all 111 tests pass. Tests cover installed bytes, restore,
  no auto-start, source lifecycle instance counts, control ownership, error/room
  cleanup, storage failure, disposal races, plain module metadata and defensive
  storage snapshots. Browser Blob execution itself still needs a live integration
  check; loader tests currently inject compiled script classes.
- The manager is not yet attached to the live game. Full command-registry adapter,
  game tick/render wiring, import callback ownership and SettingsAutomations UI
  remain next steps; the category stays absent until that integration works.

### Structured automation commands

- Ported af.ChatCommandRegistry dispatch, descriptor validation, namespaced and
  bare-name resolution, oldest-surviving registration precedence, built-in bare
  name reservations, help snapshots and owner/namespace cleanup. Uses the already
  ported quoted/escaped argument parser and source error/usage wording.
- Added defensive invocation argument/named/default/extra data and dispatch result
  objects. AutomationStopError routes expected stops through manager STOP cleanup;
  ordinary callback exceptions remain handler_error results as in the source.
- Connected current-game/current-EventBus ownership checks to AutomationManager.
  A known command outside its initialized module session is consumed before
  exposing parse details or running callbacks. Stopped-module commands remain
  available, but buses from a previous room cannot execute in the new room.
- TypeScript/build and all 115 tests pass. Audited against original registry,
  invocation/result/help definitions and original test categories; regression
  coverage includes collisions/promotion, built-in reservations, structured args,
  parse/arity/handler errors, defensive help data, namespace disposal, room handoff
  and expected-stop control release.
- Native chat routing, built-in command inventory registration, live automation
  import/execution, game tick/render wiring and SettingsAutomations remain pending.
  No command was sent through a live account during these tests.

### Native automation integration and live execution

- Attached the shared manager to native game sessions, with per-session tick,
  render, chat and cleanup integration. Existing native chat commands are reserved
  using the current handler cases plus a fallback inventory; unmatched commands
  and ordinary messages continue through the original handler unchanged.
- Corrected the earlier render-unit interpretation: original Game.as passes
  passedTime * 1000. UPDATE and RENDER both deliver milliseconds. The earlier
  runtime test's seconds expectation was wrong and has been corrected.
- Exposed original af automation API names through QoLAF.cls. Stored modules
  restore only after a game exists and do not auto-start. Inactivity ownership
  refreshes native player activity only while explicitly claimed.
- TypeScript checking, bundle build and all 117 tests pass. A real browser Blob
  module imported, initialized and started, received 55 updates (33 ms each) and
  319 renders (last delta 6 ms) during a 1.8-second observation, then removed
  successfully. Screenshot: /tmp/QoLAF-AutomationProbe.png. Temporary module,
  probe script and HTML injection were removed afterward. No chat was sent.
- SettingsAutomations UI, browser file picker and command help/completion remain
  pending. The category stays hidden until its actual page is available.
- Current Haxe gameplay stays authoritative, including shields and corrected
  corrosive calculations. Automation wiring does not replace game simulation.

### Automation Settings page and browser import controls

- Ported SettingsAutomations from the current original worktree: original viewport,
  spacing, two-column list/details layout, metadata colors, start/stop states,
  native removal confirmation, empty state and selection preservation. Registered
  the real page and enabled its Settings category. Browser wording uses modules
  and browser storage instead of SWFs and AIR's filesystem folder.
- Adapted original AstroTheme automation rows onto native ItemList: 64px rows,
  centered wrapped Russo 14px labels, original shop skins/colors and 10px padding.
  Replaced rows dispose attached and inactive skins. URL entry uses the native
  input with a sans-serif fallback; its underlying browser input remains a single
  line (original Feathers text editor enabled word wrapping).
- Added JS/MJS file selection with cancel/disposal cleanup. URL/file completion and
  removal confirmation cannot operate on a disposed page. The original manager's
  installed-module lifecycle remains authoritative; imports never auto-start.
- Compared the empty page on the running original SWF and browser port. Relative
  title, input, buttons, storage, section and empty-state positions agree. Captures:
  /tmp/QoLAF-OriginalAutomationSettings.png and /tmp/QoLAF-AutomationSettings.png.
  Populated original SWF visual comparison remains unverified; row styling was
  checked against AstroTheme source instead.
- Live native UI checks: Add File imported a passive module, Start/Stop updated
  controls/status, reload restored the installed module stopped, Add URL rejected
  its duplicate, Remove required confirmation and restored the empty state, then
  Add URL successfully imported it after removal. Removed the probe again and
  deleted its temporary preview endpoint. No gameplay actions or chat were sent.
  Evidence: /tmp/QoLAF-AutomationRunning.png, AutomationStopped.png,
  AutomationRestored.png, AutomationDuplicate.png, AutomationUrlImported.png and
  AutomationCleaned.png (all with the same QoLAF- prefix).
- TypeScript/build and all 119 tests pass. Added page selection/lifecycle/stale
  callback tests and file picker selection, cancellation and abort cleanup tests.
  Full automation control arbitration against native input, command help and
  completion, and the remaining full-client port still need work.

### Automation input ownership and native steering boundary

- Connected manager control ownership to PlayState.updateCommands and
  checkAccelerate. Unowned physical input calls the current Haxe methods unchanged;
  owned input uses the original automation steering loop. The native roaming chat
  branch retains automation steering without enabling physical acceleration.
- Ported setAutomationAimAngle/clearAutomationAimAngle, owner/finite-angle checks,
  native angle normalization, source 0.6-step threshold and serialized-course
  throttling. Channeling/teleport/boost/no-angle states release turns through the
  native command method. No rotation, shield, damage or simulation state is written.
  Added original control-mode constants and readable aim/mode getters. Ordinary
  aim getter reflects native mouse/keyboard aim; full aim-assist logic is still pending.
- Fixed plugin teardown ordering: modules receive STOP/DISPOSE while exported
  APIs and control methods still exist. Session transitions and unload restore
  installed methods/properties; module aim cannot cross state exit or another owner.
- TypeScript/build and all 120 tests pass. Tests cover native passthrough, ownership,
  invalid angles, tick throttling, opposite-turn release, settled aim, teleport,
  chat vs Settings behavior, transfer, normalization and cleanup. Corrected the
  test double to native Util.angleDifference's rotation-minus-target convention;
  production already calls that actual native utility.
- Live browser probe claimed controls, rejected another ID, accepted an owned aim,
  generated native turn command [2,true], cleared aim and returned to
  PlayerControlled. Commands were captured locally instead of sent to the server;
  this verifies the live adapter path, not in-flight steering accuracy. Probe
  module and temporary HTML/script were removed; clean preview reloaded.
  Screenshot: /tmp/QoLAF-ControlProbe.png.
- Full-client command help/completion, aim-assist behavior, richer chat integration,
  remaining rendering/UI differences and comprehensive in-game parity remain open.

### Legacy automation chat commands and persistent inactivity setting

- Ported /script and /automation status and legacy command dispatch from the
  current ChatInputText/MessageLog source. Kept original whitespace splitting
  (separate from structured commands), usage/missing-module/unhandled errors,
  escaped status names and singular/plural wording. The browser availability
  message says runtime instead of Flash runtime. Commands clear native input and
  update its tab without sending an account chat message.
- Added /dontkick and reserved these client aliases against custom bare-name
  registrations. Native help remains intact with the three original relevant
  help lines appended. Full client help popup and autocomplete remain pending.
- Fixed a verified Settings gap: onDontKickChanged called an absent game method.
  Added the original setter/toggler and persistent/combined activity getters.
  The per-account ClientSettings setter saves the preference, explicit toggles
  refresh activity, and native inactivity handling runs unchanged when protection
  is off. Temporary module ownership does not modify the saved setting.
- TypeScript/build and all 122 tests pass, covering legacy parsing/status/errors,
  local command consumption, native help preservation, saved vs transient
  protection, room isolation and cleanup. No 30-minute live timeout was attempted;
  gating of the native method is covered by the real host-hook fixture.
- Live checkbox validation: initially off, enabled, closed/reopened Settings and
  confirmed checked, restored off, reloaded the preview and confirmed unchecked.
  Captures /tmp/QoLAF-InactivityBefore.png, InactivityEnabled.png and
  InactivityRestored.png (each with QoLAF- prefix). No chat was sent in this pass.

### Xhersix torpedo visual rhythm and Settings callback

- Fixed the missing setTorpedoCueEnabled method used by the Combat settings page.
  Ported the original visual-only controller, 2500ms clock, 50ms realignment,
  strict >3000ms silence expiry, monotonic pulse age and unsigned timer wrapping.
  The source's complete behavioral clock cases run against the TypeScript port;
  AS3 syntax-inspection assertions are intentionally excluded from those fixtures.
- Ported all three native Mesh rings: original 64 segments, colors/alpha, fixed and
  shrinking red radii, expanding/fading yellow pulse, and zoom-compensated 2px
  strokes. Uses the current rendered ship pose in canvasTexts, not simulation pose.
- Observe original weapon key and raw spawn time before native factory culling or
  catch-up. Install packet hooks at classesReady, before Haxe caches bound message
  handlers. Incoming packets, factory calls, headings and projectile physics stay
  unchanged. No predicted shots or historical positioning corrections are added.
- Added sidecar pooled-life and raw server-target revisions, including A->B->A,
  stopped-weapon aggro preservation, encoded target clears and pre-session initial
  sync. Read existing native packet formats without changing target assignments.
  Menus/landing/death/target changes invalidate the clock; duplicates cannot rearm
  an expired volley. This is a rhythm reminder, not a collision warning.
- TypeScript/build and all 127 tests pass. Coverage includes original clock cases,
  controller invalidation, geometry/fade/zoom, cached-handler observation, native
  factory passthrough and actual Haxe readEnemyEntry parsing. Updated the general
  integration fixture with the native game's projectileManager field.
- Live synthetic browser view rendered three native meshes for 3589 frames and
  disposed them cleanly. Captures: /tmp/QoLAF-TorpedoRings.png and
  /tmp/QoLAF-TorpedoDisposed.png. Temporary script/HTML injection removed and clean
  preview reloaded; no saved setting or gameplay state changed by the probe.
- Full live Xhersix encounter comparison remains unverified. Collision-circle
  visuals and other still-unported Settings behavior remain separate open work;
  current Haxe gameplay/shield/corrosive calculations remain authoritative.

### Xhersix torpedo collision circles

- Ported the original shared native MeshBatch geometry: 64 segments, faint red
  disk and separate stronger border. Circle scale reads the current Haxe
  projectile collisionRadius; weapon explosion radius is not substituted.
- Observe native projectile drawing during the current game's manager update,
  after it assigns rendered coordinates. Native simulation and drawing still
  execute unchanged. Clear the batch each update, respect the saved Combat
  setting, bound mesh capacity, and dispose geometry with the session.
- TypeScript checking and all 129 tests pass, including the single-file build.
  Tests cover geometry, alpha, live collision radius, eligibility, batching,
  setting toggles, native draw passthrough, current-game scope and cleanup.
- Live encounter/visual comparison of collision circles remains unverified;
  the preceding rhythm-ring visual probe does not establish this feature's
  browser parity. Current Haxe shields and all other gameplay mechanics remain
  authoritative, as reiterated by the user.

### Collision-circle renderer check and Nether Blob beam estimate

- Live synthetic collision probe rendered three original warning meshes (588
  vertices total) in canvasProjectiles. Screenshot /tmp/QoLAF-CollisionVisible.png
  shows the faint disks and stronger borders at runtime radius 25. Reached 8109
  rendered frames before the preview was reloaded; temporary injection removed.
  This establishes native mesh rendering, not a real Xhersix encounter.
- Ported NetherBlobBeamCountdown from the original EnemyShip/ProjectileManager
  integration: only observed shots of the exact weapon from unowned Nether
  enemies, before native factory catch-up/culling. Runtime reloadTime wins over
  the cached weapon definition, re-read per fresh shot. Duplicate/older shots
  are ignored; expiry stays at “Beam ready (est.)” without invented attacks.
- Native 180x24 combat bitmap text uses the source font, color, pivot and ship
  offset. It follows the drawn movieClip and uses the port's existing fractional
  fixed-step clock. Hidden/off-canvas enemies detach the label; pooled resets,
  destruction and session disposal remove it. Early packets retain observations
  while label allocation waits for the session's font initialization.
- TypeScript, formatting and all 131 tests pass. Added packet-hook, source timing,
  fresh runtime/cached reload, render eligibility, no repeated text updates,
  lifecycle and cleanup cases. Corrected the shared Display fixture to match
  actual Starling removeFromParent(true), which disposes detached objects too.
- Live synthetic label check displayed the original combat bitmap styling and
  ready wording: /tmp/QoLAF-BeamVisible.png. Disposed cleanly after 3594 frames
  (/tmp/QoLAF-BeamDisposed.png); removed the temporary injection and reloaded.
  Actual Nether Blob encounter timing
  and full screen-by-screen original-client parity remain unverified.

### Configured boss spawn markers and physical-spawner heatmap

- Ported BossSpawnCatalog, BossSpawnLocation, BossSpawnAreaRing, BossSpawnMarker,
  MinibossSpawnHeat and the world/system-map manager adapters. Hidden anchors
  receive named diamonds; physical spawners contribute unlabeled configured heat
  areas. Primary/secondary option identities, deduplication, finite radii and
  the 512-entry metadata bound follow the source. No live enemy population or
  chance values are treated as a heat prediction.
- Original 96-segment dashed rings and 32-segment/five-band heat geometry retain
  source colors, alpha, annulus holes and the narrow equal-radius falloff. Badges
  counter-scale with world zoom. The Nether Blob gravity boundary follows the
  exact parent black hole and reads its native squared physics cutoff.
- Locations track native body/spawner orbits. Sidecar GameObject.reset counters
  invalidate pooled anchors without adding fields to native gameplay objects.
  An alive, activated boss suppresses only its own parent body's spawn marker.
- Separate world/map display ownership, saved setting toggles, viewport culling
  and session/map cleanup are wired. Native map scale is captured per map;
  markers/heat sit below native map icons, as in the original source.
- TypeScript, formatting and all 136 tests pass, including the final layer-order
  adjustment. New checks cover catalog eligibility, options/radii,
  exact polygon areas and alpha edges, cached geometry, native orbit/lifecycle,
  boss identity, settings and separate world/map cleanup via actual host hooks.
- Live Fulzar map captures: /tmp/QoLAF-SpawnMap.png and
  /tmp/QoLAF-OriginalSpawnMap.png. Configured overlays and legend render in the
  port; original SWF comparison is available in the same system.
- Comparison contradicts full map parity: native viewport positioning shifts
  content by roughly half the map padding and clips a top-edge marker name;
  original Center/pan/zoom and dynamic miniboss icons remain unported. Orbit and
  native area presentation also differ. These are open map-port tasks, not
  accepted substitutions. World encounter/gravity-boundary visual checks remain
  unverified away from the current safe-zone viewport.

### Original system-map navigation and viewport

- Ported Map.as Center, following-player state, 4px pan threshold, cancelled-touch
  suppression, blank-area double-tap recentering and cursor-anchored 1.15x wheel
  zoom clamped to 0.25–4. Center preserves zoom. Native planet clicks still run
  for ordinary clicks, but a drag ending over a planet does not select it.
- Wrapped native map content in the original padded viewport with its own
  touchable mask/hit area. This fixes the former half-padding content offset
  and the clipped Executor label at default zoom. Per-map geometry is restored
  before native marker updates; mouse aiming yields while a map drag owns the
  pointer. No shield, movement integration or damage calculation was replaced.
- Wheel coordinates use the native Starling viewport and stage hit testing.
  Outside hits fall through; handled wheel events do not reach game zoom.
  Detachment, deactivation and disposal cancel gestures and remove listeners.
  The native content/mask is restored when the adapter releases a map.
- Heatmap culling now uses the zoomed viewport in map-local coordinates.
- TypeScript and all 138 tests pass. Integration uses actual host hooks and
  covers map padding/mask, click suppression before touch-end bubbling, normal
  clicks, aim ownership, wheel hit testing/anchoring, independent map scales,
  reattachment, mask cleanup and native passthrough for unrelated games.
- Live port captures: /tmp/QoLAF-MapCentered.png, MapPanned.png, MapZoomed.png,
  MapRecentered.png and MapReopened.png (all with QoLAF- prefix). Dragging, wheel
  zoom, Center preserving zoom, close/reopen reset and the default-zoom Executor
  label were observed. Initial Center testing caught the native button's
  one-shot disable; added the source's explicit re-enable plus a regression.
  Reloaded and completed two successive pan/Center cycles; the button remains
  enabled (/tmp/QoLAF-MapCenterRepeat.png).
- Original reference remains /tmp/QoLAF-OriginalSpawnMap.png. Dynamic miniboss
  icons, live boss synchronization and orbit/area appearance still differ;
  this is not full map or full-client parity.

### Live map miniatures and cache-key source alignment

- Ported MapLiveMiniature and its part renderer: live hull textures, frame changes,
  pivot, tint, alpha, mirrored scales and rotation; multipart component offsets;
  source 0.25 miniboss, 0.1 boss and 0.075 Advectorian scales. Reuses game textures
  without taking ownership. The source one-filter FilterChain is represented by
  Haxe's native GlowFilter (FilterChain is absent), with the same parameters,
  resolution 2 and bilinear sampling. Visual filter equivalence is not yet proven
  pixel-for-pixel across Flash/Haxe renderers.
- Ported exact Nexar miniboss classification, including the three named Emperor
  ships with miniBoss=false. Reconcile live boss activation/death and miniboss
  id-map/list membership each frame. Sidecar reset counters invalidate pooled
  identities; component death can retain new explosion frames while stale hull
  frames hide. Current rendered clip coordinates are used when drawn; off-screen
  units use native positions rather than stale clips.
- Native skull layers are hidden only for managed maps and restored when released.
  Added displays/filters are disposed separately; source gameplay objects and
  textures remain untouched.
- Added the original map-orbits:<body>:<scale> and map-elite:<body>:<scale> cache
  key separation, scoped to those native drawing calls. Initial attribution of
  yellow orbit lines to cache collision was incomplete: live recheck still shows
  yellow rather than original blue. The separate color/rendering discrepancy is
  unresolved, and the deferred bitmap-label investigation was not reopened.
- TypeScript, formatting and all 144 tests pass. Checks cover exact classification,
  live texture updates, render pose, tint/pivot/mirror, multipart offsets, explosion
  visibility, pooled lifetimes, reconciliation, native layer restoration, texture
  ownership and scoped cache keys across map scales.
- Live Fulzar screenshots: /tmp/QoLAF-LiveMiniatures.png and
  /tmp/QoLAF-MapTextureKeys.png. Boss/miniboss hull icons and multipart Executor
  render; /tmp/QoLAF-MiniaturesReopened.png records close/reopen. Original reference
  remains /tmp/QoLAF-OriginalSpawnMap.png. Real death/reuse timing and exact
  cross-renderer glow parity remain unverified; full-client parity is incomplete.

### Important Nexar world labels

- Ported NexarWorldLabel's original faction diamond/inset, bitmap name, native
  shield/health quads and numeric values. All four existing Cosmetics/HUD
  preferences now control their original display pieces. Fixed text viewports,
  source font sizes/colors, bar dimensions and all 16 option layouts are retained.
- Eligible unowned Nexar ships use the original exact-name rules, excluding the
  ordinary elite families. Eligibility is cached per pooled life and cleared on
  reset/destruction. Labels hide when removed from canvas, invisible, transparent
  or disabled, and are disposed with their session.
- Labels follow the drawn hull and counter-scale against the current canvas zoom.
  Headroom reads collision radius and transformed pivots. Bars read the current
  Haxe hp/shield fields directly; values update at most every 100ms and only
  rewrite changed text. Empty bars hide without setting zero width. No shield
  calculation or native ship state is changed.
- TypeScript, formatting and 146 tests pass. Added all-option layouts, unchanged
  native state, fill/clamping, throttle, zoom/headroom, visibility, cached
  eligibility, settings reuse and pooled/session cleanup coverage.
- Live synthetic native label: /tmp/QoLAF-NexarLabelVisible.png. The faction badge,
  name, changing shield value/fill and health value/fill rendered in the browser.
  This is a display probe, not a real Emperor encounter or complete parity proof.
- Probe disposed cleanly after 5389 frames
  (/tmp/QoLAF-NexarLabelDisposed.png). Temporary HTML/script injection removed
  and clean local preview reloaded.

## Boss spawn timers — 2026-11-10

Ported the original `BossSpawnTimerCatalog`, `BossSpawnTimers`, and
`BossTimerRadarTelemetry` into readable TypeScript. The catalog preserves the
anchor's zero timing, weighted/batched alternatives, secondary slots, event and
mission gating, ordinary special-spawner slots, and source-specific estimates.
The model uses the native clock's read-only `getServerTime()` rather than setting
simulation time. Boss global boundaries retain the 1.5-second grace and minimum
one-minute post-kill eligibility; miniboss timers require an observed kill and
stay due rather than inventing repeated countdowns.

Early native hooks retain definition/spawner identities in WeakMaps because the
Haxe factory does not retain them on all enemy types. Kill observations copy
identity before native destruction/pooling; the original handlers still execute
with their original arguments/results. Current gameplay, shields, and corrected
corrosive calculations remain native.

Verification: typecheck and 153 tests pass, including timing boundary cases,
ambiguous sources, seasonal sources, missing clocks, survival schedules,
non-orbit enemy pooling, cached handlers, and wrapped/color-changing HUD rows.
Reloaded the local browser preview and confirmed automatic login and live
`Executor is alive.` text above the radar. Compared against the running original
SWF: matching wording, green color, and position below the telemetry rows.
Screenshots: `/tmp/QoLAF-BossTimersVisible.png` and
`/tmp/QoLAF-OriginalBossTimers.png`. Preview diagnostics report connected,
canvas/bridge present, zero uncaught runtime errors. This does not prove absence
of caught hook errors. Actual kill-to-respawn encounter transitions and narrow
viewport wrapping remain unverified in the live game; automated tests cover their
model/layout contracts. Full client parity is still incomplete.

## Local chat commands — 2026-11-10

Ported `/timers`, `/clearchat`, `/echo`, and the original custom-command help
format. `/timers` uses the existing persisted per-account setting and original
argument/error/status wording. `/clearchat` empties the shared received queue in
place and clears both native projections, their timeouts, scroll position, and
open player menu; sent-input history and settings remain intact. The current
Haxe Advanced chat has immediate row insertion, unlike the source's batched
renderer, so its delayed scroll callbacks cannot reinsert cleared messages.
`/echo` retains the source purple local presentation while explicitly identifying
the TypeScript port version rather than falsely claiming completed AS3 parity.
Registered automation help uses the live ownership snapshot, qualified fallback
names, source usage strings, and HTML escaping. These built-in names are reserved
from automation bare-name dispatch; ordinary native commands still pass through.

Verification: typecheck and 156 tests pass. Tests cover native fall-through,
argument validation, missing settings, hook removal, queue identity, both views,
repeated clearing, preserved sent history, registry ownership, and escaped help.
Live browser reload/autologin succeeded. Entered only local commands through the
actual chat input: `/timers` displayed six additional Fulzar entries, `/echo`
rendered the purple port version, `/clearchat` removed received rows in Advanced
and Simple, and `/timers` restored the original primary-only radar setting.
Screenshots: `/tmp/QoLAF-SecondaryTimers.png`, `/tmp/QoLAF-Echo.png`,
`/tmp/QoLAF-ChatCleared.png`, `/tmp/QoLAF-ChatSimpleCleared.png`, and
`/tmp/QoLAF-TimersRestored.png`. Diagnostics remain connected with zero uncaught
errors. Custom help rendering is covered by tests, not a live automation demo.

The original rich composer, autocomplete popup, expanded chat rendering, and
remaining commands still require porting. `/resync` needs a dedicated adaptation:
the newer native clock lacks the source's parallel-resync API and lifecycle
tracking. No substitute clock behavior was installed here.

## Reported target switching and HTML wrapping — 2026-11-10

Removed the erroneous GameSession radar-update auto-target scan. Auditing the
current AS3 tree finds `tryAutoTarget` called only by
`Weapon.registerSimulatedHit`, not by radar membership. The extra port hook
could replace an unlocked target every 0.5 seconds and consequently move that
unit between the main and nearby bars. Personal weapon/pet contact targeting,
manual selection, locks, and the source nearby-row comparator remain in place.
The compiled integration test now runs 90 radar updates with a nearby hostile
and asserts the main display stays `No active target`; existing hit-targeting
tests verify real contact selection.

Corrected the HTML bitmap compositor's horizontal autosizing constraint. Native
Haxe `TextField.updateText` deliberately skips the unconstrained 100000px width
for HTML, unlike plain text. Passing its stale hit-area width to our custom
compositor could wrap an autosized field one glyph per line after empty/short
content. The custom compositor now uses the same unconstrained width for
`horizontal` and `bothDirections`; vertical-only/fixed-width wrapping remains
constrained. Added regression coverage for a one-pixel stale width and verified
vertical-only wrapping still produces multiple lines. Typecheck and all 156
tests pass. The exact user-reported inventory/player tooltip and mission screens
still need live re-verification; passing renderer tests do not establish that
all text-layout issues are resolved.

Additional reported work remains: full chat renderer/composer; slash-command
popup (three source-model/metadata files are in progress but not integrated);
world text motion; and general emitter frame-rate animation. Native inspection
confirms EmitterManager is called from Game.tickUpdate and Emitter uses fixed
33ms lifetime, emission and motion increments. Native TextManager already
receives frame seconds from Game.update, so its motion issue needs separate
rounding/attachment analysis. Do not accelerate the native simulation to fix
presentation cadence.


## Render attachments and frame timing — 2026-11-10

- AF/pet names previously read physics coordinates before Ship.draw. They now
  copy the rendered clip after drawing, matching original EnemyShip.as ordering.
- Emitters moved from tick updates to the render path. Elapsed emission, particle
  lifetime and movement retain fractional time; engine mounts use rendered poses.
  Native rainbow creation remains supported.
- Read-only live probe: 1,950 frames, 1,618 without a simulation tick, 195,100
  particle advances on those frames; 10,147 AF/pet label checks, zero mismatches.
  Evidence: `/tmp/QoLAF-EmitterProbe.png`. Temporary probe removed afterward.
- Further source audit found combat text missing original rendered-owner
  attachment. Native turret/spawner ticks also overwrite text coordinates, while
  TextHandler scales seconds by 1,980 and TextParticle rounds milliseconds.
  CombatTextFrames now uses seconds × 1,000, saved rendered attachment positions,
  independent rise, fractional lifetime and pooled-owner generation guards.
  Newer native zoom scaling is retained. Live combat verification remains pending.
- Validation: TypeScript check and 167 tests pass, including timing comparisons
  at 30/60/120/180 FPS, intervening tick writes, pooling and cleanup.
- Remaining parity work includes combat-text anchor offsets/rise limits, other
  world attachments, emitter visual limits and the existing open-issue ledger.


## Combat-text follow-up and reported text screens — 2026-11-10

- Added original Ship (-15/-15), Turret (-20/-5), Spawner (-25/-10)
  damage/healing offsets, including subclasses. Added the original 120-unit
  rise limit, whose origin follows the rendered owner. Sustained-hit regression
  verifies the limit while the owner moves; total 168 tests pass and typecheck passes.
- Synthetic live native-particle probe passed 360 frames, including 298 without
  simulation ticks: zero position mismatches, maximum floating-point error
  5.003e-12. This checks the actual native TextManager/TextHandler/TextParticle
  path using a temporary fake visual owner and intentional tick-coordinate
  overwrites. No real unit, combat action or network message was used. Native
  update restored and temporary particle returned to its pool afterward.
  Evidence: `/tmp/QoLAF-CombatTextProbe.png`. Real combat comparison remains open.
- Players tooltip checked after reload: text is `Players P` (green P shortcut),
  not a truncated word. Measured and rendered text width both 49.124; container
  width 62.124, positioned within the right screen edge. Evidence:
  `/tmp/QoLAF-TextProbe3.png`. Multiline artifact tooltip remains to verify.
- Reopened the exact reported timed mission, Pickup 10 Polyhedric Fabric.
  XP 2093 (+628) and boost icon now render on one horizontal line. Evidence:
  `/tmp/QoLAF-TimedText.png`. Daily mission XP rows also render horizontally:
  `/tmp/QoLAF-MissionText.png`. No mission was skipped or claimed.
- Temporary probe file removed, local game HTML restored, clean reload requested.


## Replacement combat numbers and multiline tooltips — 2026-11-10

- Unit.followAttachedCombatTextAt only updates lastDmgText/lastHealText.
  CombatTextFrames now observes those independent slots: a replaced number
  stops following the owner, keeps rising independently and retains its rise
  cap. Losing an owner no longer drops the cap; pooled lifecycle protection
  remains. Added regression with replacement damage and concurrent healing.
- TypeScript check and all 169 tests pass.
- Opened Artifacts without revealing, equipping, upgrading or recycling any
  artifact. Armorlock Protocol tooltip displays full stats, wrapped orange
  damage-reduction effect and Fitness; Recycle Generator displays its two-line
  recycling effect and Fitness without clipping. Screenshots:
  `/tmp/QoLAF-ArtifactTooltip2.png`, `/tmp/QoLAF-ArtifactTooltip3.png`.
  Exact Phase Nullifier tooltip and broader DPI/image cases remain unverified.


## Native command autocomplete — 2026-11-10

- Ported source ChatCommandAutocompleteModel and command metadata for commands
  implemented by this runtime, with live registry suggestions and preserved
  native getId/warpToId completion casing. Unsupported commands remain absent.
- Added native Starling popup with original 34px rows, 18px command and 16px
  description fields, Verdana 12/10, source colors/padding, maximum eight visible
  rows, selection, ellipsis measurement, scroll track/thumb and click completion.
- Connected native editor changes and keyboard capture: Tab completes, arrows
  select, Escape dismisses; argument help is passive and Enter remains native.
  IME and modified shortcuts fall through. Session cleanup removes listeners.
- Live prefix /ec displayed /echo and its description, and Tab completed /echo
  while leaving the editor open. No command/message was sent. Screenshots:
  `/tmp/QoLAF-AutocompletePrefix.png`, `/tmp/QoLAF-AutocompleteTab.png`.
- Live check caught pooled invisible rows inflating bounds and lifting a
  one-row popup; now anchor to background height. Regression added. A second
  check found native toggleChatMode adds tabs above the popup; now restore
  source child order. Corrected anchor observed in
  `/tmp/QoLAF-AutocompleteAnchor.png`. Final drawing-order check passed:
  `/tmp/QoLAF-AutocompleteFinal.png` shows both command and description
  immediately above the input after a clean reload.
- TypeScript, formatting, and 173 tests pass. Full chat remains incomplete:
  emoji/friend autocomplete, rich composer/views and source command inventory
  still require implementation. Wheel/drag/click and resize need live checks.


## Native editor history and pointer checks — 2026-11-10

- Connected existing ChatHistory model to native ChatInputText. Complete
  submitted lines, including commands/channel prefixes, are recorded before
  dispatch; adjacent duplicates collapse, history caps at 100, and the in-memory
  session survives replacement Game instances. No persistent storage is used.
- Native previous/next now use chronological history with a restorable draft.
  Reopening starts from the newest entry; editing recalled text does not destroy
  the original draft. Caret moves to the end. History traversal dismisses command
  suggestions and avoids reopening them on the next frame; suggestions otherwise
  retain first priority over arrow-key history. Cleanup restores native hooks.
- Live check submitted only the local /echo command, entered an unsent draft,
  pressed Up to recall /echo, then Down to restore `Draft stays here`. Evidence:
  `/tmp/QoLAF-HistoryPrevious.png`, `/tmp/QoLAF-HistoryDraft.png`.
- Live slash list displayed eight rows and scrollbar. Wheel moved the list;
  clicking /echo completed it with focus/caret retained and passive help. No
  command was submitted by the click. Evidence: `/tmp/QoLAF-CommandList.png`,
  `/tmp/QoLAF-CommandScroll.png`, `/tmp/QoLAF-CommandClick.png`. Input cleared
  afterward. Dragging, resizing and dynamic registry changes remain live checks.
- Native text input appeared serif on this machine; Verdana is not installed
  (`fc-match Verdana` resolves Noto Sans). Added explicit Verdana/Arial/sans-serif
  fallback while preserving configured size/DPI scaling and cleanup. This is an
  interim native adapter; the original bitmap/rich composer still needs porting.
  Fallback visual verification is pending next reload.
- TypeScript check and 176 tests pass, including real host-hook lifecycle tests
  for commands, drafts, bounded traversal and replacement game instances.


## Rich editor document core — 2026-11-10

- Added RichBitmapEditorModel, extracting the document/selection behavior from
  original RichBitmapFontTextEditor.as rather than substituting browser HTML
  editing. It reuses the already ported parser, serializer, typed-markup promoter
  and UTF-16/emoji navigation.
- Ported visible/source selection mapping, forward/backward atomic snapping,
  copied artifact wire tokens, selected markup/color/size, source 12–48 size
  clamp, style-preserving replacement, literal insertion, completed-fragment
  promotion, continuation style, newline/restrict handling and serialized
  maxChars behavior (including shortening an already over-limit value).
- Preserved the source sameCommandPrefix check: promoting inert tags must not
  turn a displayed example into an executable slash command. Global/restrict
  paths still prohibit promotion. Artifact label refresh preserves source-range
  selection even when the displayed label changes length.
- Validation: typecheck, formatting and all 182 tests pass. New cases cover
  selection formatting, typed closing fragments/continuation, command guarding,
  Global/restrict paths, artifact copy/refresh/deletion, five emoji cluster forms,
  serialized limits, disabled editing and newline removal. One initial expected
  color string used uppercase; corrected to the existing source serializer's
  lowercase hexadecimal output.
- This is document-core work, not a completed live composer: native input events,
  bitmap selection/caret rendering, IME, clipboard interactions and formatting
  controls still need integration and original-vs-port visual verification.


## Rich editor composition sessions — 2026-11-10

- Ported provisional IME revisions into RichBitmapComposition, preserving the
  source snapshot, reversed selection, formatting, atomic boundaries and the
  accepted revision range when restrictions or serialized limits reject input.
- Confirmation restores the original range before one final literal insertion.
  Browser compositionend will own that insertion (unlike AIR, whose subsequent
  TEXT_INPUT owns it). Session invalidation rejects late updates, duplicate
  confirmation and cancellation after external text assignment or disposal.
- Read source channel rules: only the global channel excludes <>=&#[]{}; the
  eventual browser binding must preserve those rules rather than removing the
  native restriction globally.
- Validation: typecheck, formatting and all 187 tests pass. Five new tests cover
  Japanese revisions with styled suffixes, rejected/filtered revisions, exact
  cancellation with backward selection, literal markup/emoji replacement and
  stale sessions after external assignment.
- This is not yet connected to browser events or the bitmap composer, so no
  visible input parity or real IME behavior is claimed. Browser event ordering,
  clipboard, bitmap selection/caret and formatting controls remain open.


## Rich editor browser transport — 2026-11-10

- Added RichBitmapInputBinding: visible browser buffer with markup-owned document,
  cancellable typing/deletion, plain clipboard transport with artifact wire
  tokens, atomic selection, provisional composition and external assignment.
- Composition revisions do not rewrite the platform's active IME buffer. Final
  confirmation publishes once; its subsequent input notification is ignored.
  Composition keys retain browser defaults but cannot reach the native submit
  listener. Source-disabled/password copy rules are preserved.
- Non-cancelable edits reconcile against the source model and restore rejected
  values. Regression exposed common emoji-prefix diff boundaries; replacement
  now includes whole emoji/artifact ranges rather than isolated surrogate units.
- Seven transport tests cover formatted typing/continuation, composition event
  ordering, artifact copy/cut/paste, fallback edits/limits, external assignment,
  disposal, emoji/artifact diffs, password copy and read-only paste.
- The binding is not activated in GameSession yet: native get/set/select hooks,
  bitmap rendering/caret/hit testing and channel restrictions must be connected
  together. Browser event tests do not prove live IME or visual parity.


## Rich editor bitmap view — 2026-11-10

- Added RichBitmapEditorView using the ported Starling rich renderer and source
  RichBitmapTextMetrics. Ported blue selection skin (0x3b78c8, alpha 0.65), white
  cursor, independent clipping mask, vertical centering, two-pixel caret margin,
  bounded horizontal scroll and focus-dependent selection/cursor visibility.
- Click/drag selection uses the same atlas metrics as cursor placement and adds
  the current scroll offset; the document model then applies atomic snapping.
  Password display masks clusters, not UTF-16 code units. The separate mask is
  explicitly disposed without touching the registry-owned font texture.
- Three tests use the actual Verdana 16 bitmap atlas: colored glyph rendering,
  hit positions, selection/caret placement, scrolling, resize reset, focus,
  emoji masking and mask/renderer disposal. Full suite passed 197 tests before
  switching these three from Russo to the more relevant Verdana atlas; all three
  passed again with Verdana. Typecheck and formatting passed.
- Not yet activated on the live chat input. Native source-offset field hooks,
  pointer transport, channel restrictions and preference changes still need
  integration before browser comparison; this does not close CHAT-01.


## Native bitmap composer activation — 2026-11-10

- Activated NativeRichChatInput in GameSession after native chat preferences and
  before history/autocomplete. Native TextEntry identity and events are retained;
  get_text/get_length use serialized markup, set_text uses the document model,
  and selectRange maps original source offsets to visible atomic boundaries.
- DOM input remains the focus/clipboard/IME transport with transparent drawing.
  Starling draws the original Verdana bitmap text, selection and caret. Pointer
  capture converts CSS coordinates to the bitmap viewport for click/drag.
- Preserved source global-only restriction, serialized maxChars and per-session
  hook cleanup. Preference font size/color changes update metrics and renderer.
  Added whole-atom/emoji arrow navigation so left-arrow cannot become stuck
  inside an artifact label. Original word-navigation and multi-click behavior
  still need porting; live IME/candidate placement remains unverified.
- One explicit F5 down/up reload reconnected with zero diagnostic runtime errors.
  Live unsent draft `Bitmap <font color="#ff6600">orange</font> draft` painted
  orange text correctly; Ctrl+A drew the source blue selection highlight.
  Replacing it with /ec and pressing Tab produced /echo with passive help.
  Mouse drag selected the displayed command using bitmap geometry. Cleared the
  draft with Ctrl+A/Backspace; no player-facing chat message was sent.
- Screenshots: /tmp/QoLAF-RichInputDraft.png,
  /tmp/QoLAF-RichInputSelection.png, /tmp/QoLAF-RichInputAutocomplete.png,
  /tmp/QoLAF-RichInputDrag.png. Original comparison captured in
  /tmp/QoLAF-OriginalChatState.png: original has a left integrated chat panel,
  broader channel row and Color/Size/Img/emoji controls absent from this port.
  This is a working native bitmap input, not full chat parity.
- Added real-host-hook tests for markup/visible separation, source selection,
  exactly one change event, channel restrictions, serialized limits, font changes
  and unload restoration, plus model atomic navigation/source selection tests.
- Validation: TypeScript and all 201 tests pass. Formatting corrected and rechecked.


## Source formatting controls — 2026-11-10

- Ported ChatComposerFormatButton, ChatSelectionValueSlider and the complete
  ChatSelectionFormatPopup from original AS3. Preserved charcoal colors, touch
  isolation, 286x138 context menu, 336x228 color panel, 336x166 size panel, RGB
  channels, six-digit hex contract, 12–48 size range, mixed-style preview,
  stage-clamped below/above positioning and outside-listener/mask cleanup.
- Corrected mechanical conversion errors before use: vector literal construction
  must yield flat arrays; regexp flags must not duplicate; menu index must
  truncate like AS3 int. Public size inputs retain AS3 int coercion. Preview
  sizing uses the existing bitmap adapter's width/height setters.
- Component tests exercise real ported controls and bitmap preview rendering,
  with a temporary hex-field contract double. They cover touch colors/disabled
  buttons, full-height slider hit area, snapping, silent setter changes, mixed
  preview styles, partial hex normalization, detail positioning and listener
  removal. These are not screenshots or proof of live popup parity.
- Native hex-field integration and toolbar wiring remain next. The new controls
  are not registered or activated in the live composer yet; CHAT-01 stays open.
- Validation: TypeScript, formatting and all 205 tests pass.


## Live Color/Size formatting — 2026-11-10

- Extracted NativeBitmapInput as a per-field document/view/browser binding with
  explicit disposal. Added BitmapInputAdapter for the source Feathers input
  contract: native focus/keyboard bridge, bitmap drawing, six-character hex
  restriction, source padding, 0x191919/0x292929 backgrounds and alpha 0.86.
- Activated source Color/Size buttons and selection popup. Toolbar selects the
  whole draft when no range is selected; format events restore/save the range,
  update preview and publish change. Popup shifts the composer upward to leave
  room below, restores position on close, disables Global formatting and hides
  autocomplete while open. Clipboard paste rejects a changed draft/selection
  while awaiting browser clipboard permission/results.
- First live reload exposed frozen host API inheritance: assigning scoped hooks
  over Object.create(owner) failed, interrupting later HUD initialization. Fixed
  with own properties on a fresh wrapper and changed hook tests to freeze their
  host API. A subsequent reload restored the HUD and activated the toolbar.
  The preview runtimeErrors counter does not catch this caught initialization
  error; the Firefox console and missing HUD supplied the decisive evidence.
- Verified unsent `Formatting preview`: Color opens the original panel; entering
  FF6600 changes draft, preview, swatch and RGB values; Size opens its panel and
  setting its slider to 24 px enlarges the draft and preview while preserving
  orange. Closing restores the bottom position. Explicitly refocused the main
  field and cleared the draft; no player-facing message was sent.
- Screenshots: /tmp/QoLAF-ColorPanel.png, /tmp/QoLAF-ColorApplied.png,
  /tmp/QoLAF-SizePanel.png, /tmp/QoLAF-SizeApplied.png,
  /tmp/QoLAF-FormattingCleared2.png. Opened original color panel without changing
  its draft: /tmp/QoLAF-OriginalColorPanel.png. Panel dimensions, label/hex/swatch
  and slider layout visually agree. Original left integrated chat still differs
  from this bottom composer; full chat parity remains open.
- Source audit corrected restriction semantics: changing Global must preserve
  an existing rich draft; only new input is filtered. Ported GlobalChatSanitizer
  and wrapped sendGlobal so plain-text conversion happens at the outbound
  boundary, retaining native ban/mute/rate-limit behavior. Verified via hook
  tests only, without sending an actual Global message.
- Validation: TypeScript, formatting and all 206 tests pass. Live IME, clipboard
  menu, resize while open, right-click menu and remaining integrated controls
  require additional work/verification.

### Integrated panel placement and ownership

Ported source ChatLayout fit (680×500 at stage x20/y70), composer at y590,
Simple clipping, Advanced viewport and row reflow, and temporary Advanced opening
for the composer. First live check found the existing preference hook recentered
the composer; corrected both paths and added a combined-hook regression.

After reload, `/tmp/QoLAF-IntegratedLayoutFixed.png` shows the panel at viewport
x20/y90 and the composer directly below at y590 (browser viewport origin x41/y85).
`/tmp/QoLAF-IntegratedClosed.png` confirms empty-composer close restores Simple.
`/tmp/QoLAF-AdvancedRetained.png` confirms manually opened Advanced remains after
opening/closing the composer. Returned to Simple afterward. No player messages
were sent. Reloads used separate F5 down/up calls with release in finally.

All 210 tests, typecheck and formatting pass. This verifies panel placement and
view ownership, not full chat appearance: original tab skin, rich message rows,
virtualization, emoji/image controls and contextual interactions remain open.

### Received rich bitmap text

After loading NativeChatMessages, executed the local-only `/echo` command and
checked its rendered output in Simple (`/tmp/QoLAF-BitmapMessageSimple.png`) and
Advanced (`/tmp/QoLAF-BitmapMessageAdvanced.png`). White text and violet inline
formatting render through the source bitmap renderer at the original base size.
Advanced also received and displayed a live red game death notice. Opening
Advanced rebuilt its rows successfully. The game and target HUD remained active.
No player-facing message was sent. All 211 tests, typecheck and formatting pass.

The adapter does not yet supply the artifact resolver, image overlays, original
context interactions or Advanced virtualization; these remain tracked in CHAT-01.

### Chat control skins

Reloaded the local client with NativeChatTheme. `/tmp/QoLAF-ChatTheme.png`
shows source charcoal skins, muted inactive labels, white selected Local label,
Russo font, 12px tab padding and the focused input background.
`/tmp/QoLAF-ChatThemeGlobal.png` verifies selection moves to Global and formatting
controls disable there. Returned to Local with an empty composer; no messages
sent. Tests cover hover/down/disabled/focus colors, preference restoration and
cleanup. All 212 tests, typecheck and format checks pass. Source prompt and
emoji/image controls are still missing; full chat parity remains open.

### Message right-click and copy

`/tmp/QoLAF-MessageContext.png` shows the source one-row context menu on a local
/echo line. Clicking Copy closed the menu; pasting into an unsent composer
produced plain text without markup (`/tmp/QoLAF-ContextCopied.png`). Cleared that
draft with Ctrl+A/Backspace and verified empty (`/tmp/QoLAF-ContextCleared.png`).
No player-facing message or ignore request was sent. Player metadata and block
flows are implemented but not live-verified. Popup tests cover edge positioning,
metadata-driven rows and action dispatch; 214 tests pass.

### Emoji picker and composer atlas

Ported the full source picker/catalog/model. Initial live checks found two
integration defects: wheel handling lacked the Starling Haxe property aliases,
and the rich composer selected a smaller Verdana atlas without emoji. Restored
the bridge resolution and the source Verdana48 chat format. A native-input
regression now checks the exact emoji texture and atomic Backspace behavior.

Verified wheel movement (`/tmp/QoLAF-EmojiWheelRetest.png`), Animals category
selection (`/tmp/QoLAF-EmojiAnimals.png`), full-color insertion into an unsent draft
(`/tmp/QoLAF-EmojiInsertedFixed.png`) and one-Backspace clearing
(`/tmp/QoLAF-EmojiCleared.png`). Opened the same source picker in the original
client (`/tmp/QoLAF-OriginalEmojiPanel.png`): panel position, dimensions, category
icons and first grid agree visually. Closed the original picker and returned to
the port. No player-facing messages sent. All 217 tests pass; catalog coverage
checks every source glyph against the actual atlas.

The comparison also shows the original chat tabs have a larger minimum width
than the port's natural text widths. Audit the inherited Feathers minimum before
claiming tab geometry parity. Prompt, image shortcuts and emoji autocomplete
remain open.


Chat tab measurement follow-up: traced the 100px source width to
`starling.display.Image(null)` via `ImageSkin`, and Feathers
`Button.autoSizeIfNeeded` retaining the skin width. The native adapter now uses
max(100, label width + 24) for natural tab widths, while explicit equal-width
layout can shrink below 100. Regression covers short/long labels, background
width and narrow distributed tabs. Typecheck and build pass. This change has
not yet been rechecked in the live browser; prompt and image shortcuts remain
open.


Bitmap composer prompt ported from AstroTheme.bitmapChatInput and
ChatInputText.resize: localized text, source Verdana48 format, alpha 0.55,
no wrapping, truncation to input width, visible only when the source document
is empty, including while focused. Integration preference removes the prompt
in legacy mode. It never enters the editor document or serialized message.

One automatic reload (explicit F5 release) reconnected successfully. Live
`/tmp/QoLAF-PromptLive.png` confirms the 100px tabs and prompt against
`/tmp/QoLAF-OriginalEmojiComposer.png`. Typed one unsent character and deleted
it: `/tmp/QoLAF-PromptDraft.png` and `/tmp/QoLAF-PromptRestored.png` verify
hide/restore behavior. No message sent. All 218 tests, typecheck and build pass.
The missing Img control and QoLAF channel remain visible differences; full
chat parity is not claimed.


Browser image loader and source picker now wired into NativeChatFormatting.
Uses browser fetch with streamed 20 MiB cap, per-candidate 20s timeout,
AbortController cancellation, candidate fallback, createImageBitmap -> native
BitmapData.fromCanvas for static images, source incremental GIF decoding and
one Starling frame per upload. Texture.fromBitmapData retains restoration pixels.
Cache disposal cancels pending loads and rejects late delivery on plugin unload.
The Img control keeps source width/spacing and Clan/private/QoLAF gating.
Opening it closes emoji/format controls and suppresses command autocomplete.

Live: one F5 down/up reload reconnected. /tmp/QoLAF-ImgLocal.png shows disabled
Local Img; /tmp/QoLAF-ImgPickerLive.png shows enabled Clan panel. Compared with
/tmp/QoLAF-OriginalImgPicker.png: identical local panel bounds x232,y384,430x236,
input widths/prompts, Save/status/paging geometry. /tmp/QoLAF-ImgField.png verifies
bitmap input focus and one typed character; cleared it without saving/sending.
Returned both clients to Local. No player message or image request was sent.

NEW rendering issue requiring investigation: after clearing the shortcut field
and closing by selecting Local, the Global tab label, emoji glyph and safe-zone
banner were absent in /tmp/QoLAF-ImgClosed.png and ImgClosedSettled.png. Switching
Global then Local restored them (/tmp/QoLAF-ImgRepaint.png). No window runtime
errors; possible render-cache invalidation, root cause not proven. Do not claim
picker runtime parity until this is fixed and rechecked.

241 tests and typecheck/build pass. Network/decode tests use injected platform
boundaries; actual successful browser texture upload is still unverified. Still
missing: received image thumbnails/viewer, shared cache across message views,
:alias: expansion, save/reload/insertion live checks and runtime cleanup audit.


Live image upload verification (after 29c5a4e): used a temporary local module
bundling the real BrowserImagePlatform/ChatRemoteImageLoader, with a generated
8x8 cyan PNG and the committed four-frame Disposal GIF fixture. Ran inside the
game iframe, uploaded through native Texture.fromBitmapData, and attached native
Starling Images to the stage. The PNG rendered cyan; CPU getPixel32(0,0) returned
-14764836 (0xff1eb4dc), matching the fixture. GIF returned four 8x8 textures and
[100,20,70,100] ms delays; frame 0 rendered red and switching to frame 2 rendered
the expected blue square. Evidence: /tmp/QoLAF-ImageProbeGameRealm.png and
/tmp/QoLAF-ImageProbeGifThird.png. Image assets reported 512 and 2048 bytes,
respectively, including retained CPU pixels.

The first probe was incorrectly imported in the launcher realm; that canvas
failed the game's realm-specific OpenFL HTMLCanvasElement check. The static
image was blank and getPixel32 threw. Running the same module inside the game
iframe fixed it; production plugin imports already run there. Do not cite
ImageProbeConsole/ ImageProbePixels as successful static-upload checks.

Removed probe nodes, disposed assets, removed temporary aliases, deleted probe
globals and temporary ignored dist files, closed the console. Cleanup screenshot:
/tmp/QoLAF-ImageProbeCleaned.png. No player message or external image request.
This verifies real native static/GIF texture upload and manual frame switching,
not the as-yet-unported chat image view, playback clock, or external host CORS.

Redraw issue follow-up: two fresh close cycles did not reproduce the prior
missing labels, including typing then clearing the alias field. Evidence:
/tmp/QoLAF-ImgNoTyping.png and /tmp/QoLAF-ImgTypedRepro.png. Issue remains open;
no speculative renderer invalidation patch applied. Existing 241-test result
still applies; no production code changed during this verification.

## Settings comparison, 2026-11-10

Compared the running original SWF on the second display with the current browser
port. Original client geometry is x=1920,y=28,width=1920,height=1022; its active
window screenshots omit the 28px title bar. Browser game is x=41,y=85,width=1879,
height=965. The centered settings panels therefore differ by approximately
20px horizontally and 56px vertically in their screenshots; that translation is
not a layout defect.

Chat and Combat pages matched their visible source labels, controls, spacing and
panel size after that translation. Evidence pairs:
/tmp/QoLAF-OriginalChatSettings.png / /tmp/QoLAF-PortChatSettings.png;
/tmp/QoLAF-OriginalCombatSettings.png / /tmp/QoLAF-PortCombatSettings.png.
The port includes the requested Plugins navigation entry. These captures do not
prove every setting's behavior, scrolling states, localization or DPI cases.

Aim Assist revealed a real difference: the port still had the newer 6px blue
scroll thumb; source AstroTheme.settingsScrollThumb uses 8px gray fill #505050,
#707070 border, minimum 24px height and 12px minimum touch width. The settings-only
ScrollContainer adapter now supplies that skin and sizing, retaining the native
ScrollBox's wheel/page/drag event path. Source and pre-fix port:
/tmp/QoLAF-OriginalAimSettings.png / /tmp/QoLAF-PortAimSettings.png.
Regression uses the extracted native ScrollBox to check full-range thumb dragging,
page clicks, minimum thumb height, non-scaling borders and hidden no-overflow bar.
Typecheck and 310 tests pass. No gameplay or account settings were toggled.

Live follow-up: /tmp/QoLAF-AimScrollFixed.png shows the gray 8px bordered thumb
aligned with the original after the panel translation. Dragged it from screen
y=380 to y=600 and verified the page scrolled to Stationary tracking controls
(/tmp/QoLAF-AimScrollDragged.png), then dragged it back. Mouse release was sent in
finally after each drag. This closes the observed settings scrollbar skin gap;
it does not establish full Aim Assist behavior parity.

## Native changelog and empty bindings — 2026-11-10

Ported the original 840×540 changelog window, 23-release catalog, two scroll
regions, bitmap HTML chunks and native release buttons. Compared the running SWF
against the local port: header, content offsets, paragraph line breaks, divider
and close-button placement agree at their respective stage sizes. The selected
label uses the source AstroTheme yellow; the running SWF shows gray. That
source/runtime discrepancy remains recorded rather than claiming pixel identity.

Verified with actual pointer input: release selection, scrolling to the oldest
archive, selecting it and scrolling its reading region. Escape initially leaked
to the game and opened its menu; a capture-phase modal handler now consumes the
press, repeats and release. Retested after reload: changelog closed and the
underlying menu stayed closed. Key bindings also now show empty secondary buttons
instead of Haxe's default “Button Text”, matching the original.

Local evidence: `/tmp/QoLAF-OriginalChangelog.png`,
`/tmp/QoLAF-ChangelogRows.png`, `/tmp/QoLAF-ChangelogSelected.png`,
`/tmp/QoLAF-ChangelogArchive.png`, `/tmp/QoLAF-ChangelogArchiveScroll.png`,
`/tmp/QoLAF-ChangelogEscapeFixed.png`, `/tmp/QoLAF-BindingsFixed.png`.
Type checking and all 396 tests pass. Preview reported zero uncaught runtime
errors. Narrow-window fitting and graphics-context restoration remain unverified
live. Other missing screens and complete parity remain open.

## Tabbed client guide — 2026-11-10

Ported ClientHelpPopup and its source content into the native game display tree:
720×500 panel, 24px Russo tabs, Verdana HTML reading area, original blue scroll
thumb and close control. `/clienthelp` was entered through the actual composer
and opened the popup locally. All seven tabs were clicked; the long Commands
page scrolled, and switching to Aim Assist reset to its heading.

Compared Targeting against the running SWF: title, paragraph wrapping, spacing
and panel geometry agree after accounting for the different stage dimensions.
The first build clipped Ship visuals and QoL / settings: native PressButton
wrapped before final sizing. Disabling wrapping fixed the labels. Opening the
browser console resized the viewport and the popup recentered correctly. Escape
closed the guide without opening the underlying game menu.

The Start page identifies the TypeScript build and explicitly notes that the
guide describes the original client, with unfinished port features and original
AS3 automation examples. Those examples still need conversion to the port's
JavaScript module API; a rendered reference guide is not evidence that all its
described features work. This remains a full-port gap.

Evidence: `/tmp/QoLAF-OriginalHelp.png`,
`/tmp/QoLAF-OriginalHelpTargeting.png`, `/tmp/QoLAF-HelpTargetingSettled.png`,
`/tmp/QoLAF-HelpCommandsScroll.png`, `/tmp/QoLAF-HelpAim.png`,
`/tmp/QoLAF-HelpShip.png`, `/tmp/QoLAF-HelpAutomations.png`,
`/tmp/QoLAF-HelpSettings.png`, `/tmp/QoLAF-HelpClosed.png`.
Type checking and 398 tests pass, including long-page markup retention and
escaping custom-command descriptions, aliases, argument labels and defaults.

During the final reload check, upstream transitioned from Service-1409 to
Service-1410. The old sector reported a new version and closing down. Refreshed
only the local preview's upstream snapshot using the host's existing snapshot
script (195 resources, 64,379,619 bytes); preserved the prior snapshot at
`/tmp/QoLAF-Upstream1409-20261110`. New official bundle SHA-256:
`0dd2468978a7ec1c5c889fa8c95e5b82bd09cd092903792f4ecb13fa82677d59`.
All five host bridge tests pass against it. The asset version remained 14298435,
so the bundle hash and server version are required to distinguish this update.

The fresh 1410 preview connected successfully. Opened the guide through the
`/chelp` dispatch path after reload: all labels were complete without a live
patch, and the heading correctly showed server 1410. Evidence:
`/tmp/QoLAF-Help1410.png`. The new official gameplay bundle remained intact.


## Player inspection and popup Close buttons — 2026-11-10

Ported the source PlayerInspectPopup, PlayerInspectCard, projection and detached
view model into `src/inspect`, connected through `/inspect` and the room-owned
chat input. The seven original tabs are Fleet, Weapons, Stats, Artifact sets,
Artifacts, Resources and Overview. The source card geometry, bitmap fonts,
colors, ship previews, paging, selection/back controls and artifact detail
markup use native Haxe display objects. No simulated gameplay ship is created.

Compared the running original inspector (TheException, Service-1409) against
the browser port (TheNull, Service-1410). Different accounts have different
inventories; layout comparisons account for the different viewport dimensions.
Original fleet and artifact-set references: `/tmp/QoLAF-OriginalInspect.png`
and `/tmp/QoLAF-OriginalSets.png`.

The first live pass caught problems that the earlier model-only checks missed:
wrong lazy dependency namespace; PlayerManager getter access; null room fleet
slots; the removed Feathers `invalidate` method; getter-only health maxima and
weapon heat; absent custom artifact fitness property; missing numeric upgrade
defaults; the plain Share-button skin; and AS3 rest arguments crossing the Haxe
RPC array boundary. Corrected each and retested. Cargo now returns actual server
cards. Fleet/weapon snapshots and current shield values remain native gameplay
values, with no old corrosion-as-all-damage behavior introduced.

Switching pages also exposed stale Starling render-cache ranges: unchanged
header/footer controls disappeared while new cards rendered. Invalidating the
popup's display-tree cache when replacing page content fixes this without a
per-frame workaround. Verified Stats after Fleet, artifact pagination to page 2,
ship and artifact drilldowns, tab transitions, Close, and reopening by @name.

Evidence: `/tmp/QoLAF-InspectFull2.png`, `/tmp/QoLAF-InspectWeapons.png`,
`/tmp/QoLAF-InspectShip.png`, `/tmp/QoLAF-InspectFinalStats.png`,
`/tmp/QoLAF-InspectSetsFixed.png`, `/tmp/QoLAF-InspectResourcesFixed.png`,
`/tmp/QoLAF-InspectPageTwo.png`, `/tmp/QoLAF-InspectClosed.png`,
`/tmp/QoLAF-InspectReopened.png`. Earlier files containing NaN, missing headers
or white Share buttons are failure evidence, not final acceptance images.

Fixed Help and Changelog Close callbacks binding to the native Button instead
of the popup. Added a regression for that recursion and clicked Help's Close in
the game: `/tmp/QoLAF-HelpCloseFull.png`, `/tmp/QoLAF-HelpCloseVerified.png`.
Changelog uses the same corrected callback binding; its Close was not separately
clicked in this pass. Help still exceeds the very short viewport with the large
browser console open; narrow/short guide layout remains an open issue.

Validation: type checking and the full 405-test suite passed, followed by eight
focused passing tests after extracting the native cargo bridge and adding its
argument-array regression (406 total test cases now). The native queue handles
ordinary cargo and inspector reads together, with stale-room and duplicate
response checks. No live chat messages, equipment changes or purchases were
performed. The preview remained connected; Firefox logged file-URL source-map
security warnings independently of the repaired inspector exceptions.

Limits: Share inserts drafts only in supported channels; the original automatic
QoLAF destination awaits IPC/chat integration. This pass did not test sending a
share, remote-account authorization outcomes, friend-refresh lookup or every
artifact record. Full-port parity is not complete. Changes are on the port
branch/local preview, not a claim of deployment to the Pages main branch.


## First-time help invitation — 2026-11-10

Ported ClientHelpWelcomePopup and ClientHelpWelcomeState from original source.
The native confirm popup retains the 420px text width, source markup, positive
Open client help button and Later button. Enter uses the native confirm action.
The welcome waits for reconnect recovery, input-blocking dialogs and visible
native popup children (including the sale popup, which does not consistently
set blockHotkeys). Opening help explicitly also dismisses the invitation.
Room teardown disposes listeners without persisting dismissal.

Live checks found two integration issues and corrected both: the invitation
initially stacked over Sale, and the original AS3 sharedObj storage does not
exist on the Haxe game session. Browser persistence now uses plugin-scoped
`client-welcome` storage. Verified waiting behind Sale, appearing after Sale
closes, Open client help opening the guide, Later closing the invitation, and a
fresh page reload followed by closing Sale without the invitation returning.

Evidence: `/tmp/QoLAF-WelcomeModalWait.png`, `/tmp/QoLAF-WelcomeAlone.png`,
`/tmp/QoLAF-WelcomeAccepted.png`, `/tmp/QoLAF-WelcomeLater.png`,
`/tmp/QoLAF-WelcomePersistenceVerified.png`. `WelcomeNotRepeated.png` is an
intermediate failure capture despite its filename. Source geometry/text was
compared directly with the AS3 files; this pass did not force the original
client's already-dismissed welcome state to reopen. Login credits already exist
in LoginIdentity.ts and were not replaced by this work.

Type checking and the full 410-test suite passed before the persistence adapter
correction; all five welcome tests pass afterward, including host-storage reload,
modal/recovery gating, teardown without dismissal, and denied-storage behavior.
The preview process had exited and was confirmed absent before restarting it;
the active replacement is the Preview.mjs tool session 44684 on port 8087.
Remaining screen work includes music/radio and ship-visual dialogs. The automatic
once-per-release changelog sequence also still needs wiring; the source v1.1.0
farewell is historical and not shown by the current v1.1.22 source.


## Music screen and playback — 2026-11-10

Ported the original MusicPlayerPopup, MusicPlayer and cached MusicTrackCatalog
into src/music, with a root-lifetime sound adapter and session-lifetime /music
window. Uses the native PopupMessage, CheckBox, Slider, ScrollBox, Buttons and
bitmap Text, original 600x550 content geometry, source labels and track metadata.
The original SWF music popup was opened for comparison (MusicOriginal.png).
Settings-only skins initially differed: replaced them with native Aeon controls,
restored Russo checkbox labels, left alignment and the 14px check icon. Native
Slider inherited set_height scaled the entire control repeatedly; the adapter now
lays out a 24px logical height without changing scale.

Verified live: /music opens, manual track selection/play, Pause/Resume, Next and
scroll positioning, Stop, return to Automatic, closing/reopening, and playing and
paused account preferences across page reloads. Browser autoplay warnings remain;
restored Playing status does not establish audible playback before a user gesture.
Unit coverage verifies late loads after Stop/replacement cannot start, automatic
requests cannot override manual silence, loop completion, paused restore without
preloading, service replacement and detached catalog validation. Full 416 tests
passed; subsequent targeted music/integration tests and type checking passed.

**Visual parity is not complete.** Repeated interaction still causes unchanged
labels (notably heading and Close) to disappear; sometimes only the first glyph
remains. This can also affect surrounding HUD labels. Earlier images showing a
complete window are not proof this is fixed. Recursive display invalidation,
per-frame invalidation, painter exclusion, separate batch boundaries, temporary
frame-zero traversal and forcing separate text batches/uploads did not reliably
solve it. Removed these unsuccessful render-time workarounds rather than retain
per-frame traversal/upload overhead. The minimal state-change invalidation remains.
Investigate native draw/batch ownership and text geometry with a focused runtime
reproduction before marking music or other modal visual parity complete.

Evidence under /tmp: QoLAF-MusicOriginal.png, QoLAF-MusicRestored.png,
QoLAF-MusicPausedRestored.png, QoLAF-MusicSeparateBatches.png (complete captures),
QoLAF-MusicForceUpload.png (remaining heading/Close failure). Runtime diagnostics
reported zero caught runtime errors. No chat message was sent; only /music was
entered. The latest implementation is on the port branch/local preview, not Pages.

## Release startup and help viewport — 2026-11-10

Built the automatic once-per-port-release sequence and reloaded once with F5
explicitly released. The live game first displayed Sale; the changelog appeared
automatically only after closing Sale. `/tmp/QoLAF-AutomaticRelease.png` records
the result. Escape closed it. `/clienthelp` opened native Help, then opening the
browser console reduced the stage from 1879×965 to 1879×415. All seven tabs and
Close remained inside the viewport (`/tmp/QoLAF-HelpShortViewport.png`); closing
console restored full-size geometry (`/tmp/QoLAF-HelpRestoredViewport.png`).

Welcome now explicitly waits for the release sequence, independently of interval
ordering. That final gate was added after the live reload and covered by the
welcome lifecycle regression; it has not been exercised with a fresh live profile.
Type checking and all 420 tests pass after the final change. Storage/reload and
failed-open cases are regression-tested, not claimed as a second live reload.

### Correction to the previous music rendering diagnosis

The prior inference that the heading disappeared is contradicted by direct PNG
inspection: `/tmp/QoLAF-CleanActive.png` and `QoLAF-CleanActiveChange.png` have
identical RGB data in the heading rectangle (696,304)-(806,328), each with 422
bright pixels. GPU readback also found those pixels through final OpenFL stage
composition. No experimental GL flush, buffer upload, cache-token or render
replacement was retained. This closes that specific evidence trail, not every
visual/lifecycle check for Music. Radio and hull editor remain unimplemented.

## Native developer hull editor — 2026-11-10

Ported ClientDevVisualPopup, its palette/coordinate model, the source AGAL hull
and beam styles, and PhaseBladeBloomFilter. `/sv devvis` opens the native window
with the source developer-ID checks. Draft edits never touch the live ship;
Apply validates state, respects the two-second cooldown and saves per account.
The local hull adapter restores previous styles/filters and limits application
to source-supported Nexar, Crystal and Rapture textures. Gameplay is untouched.

Opened the original SWF editor (`/tmp/QoLAF-OriginalHullEditor.png`) and compared
it with the browser port (`/tmp/QoLAF-HullEditorCorrected.png`). Panel geometry,
control positions, labels and preview structure match the source. Different
accounts have different ships. The first pass exposed a truncated checkbox
label, wrong input styling and ineffective native slider disabling; corrected
all three. Original input background sampled as RGB(52,60,65). The input uses
our bitmap editor at the original 12px with original padding. Disabled sliders
now suppress pointer input and use the source dark thumb, including hover state.

Live verification used the real `/sv devvis` sendMessage command path: it opens
the window and clears the draft without sending chat. Exercised all nine
non-default pattern/palette combinations across rendered frames: every preview
retained the custom native style and valid settings, with zero reported runtime
errors. Ice changes hull/blade preview colors. Invalid hex produces valid=false
and native Apply alpha=0.2 with its touch handler disabled. Cancel disposes the
popup; reopening restores default settings rather than the abandoned Ice draft.
No live Apply or equipment change was performed. The original and port windows
remain open for comparison; neither account's visual settings were changed.

Not finished: live Apply on a supported hull, persistence/respawn/room transition
verification, the actual phase-blade weapon rendering path, visual IPC sharing,
and the broader /sv command family. The popup explicitly says sharing is still
being ported rather than claiming that local Apply broadcasts. Radio remains
unimplemented. The shader and beam preview do not prove live weapon parity.

## Phase-blade rendering adapter — 2026-11-10

Connected the ported hull palette to native Beam/BeamLine/Line rendering. The
adapter retains native weapon updates, endpoints, targeting and damage. It sets
source blade batch blending/bloom, applies thickness before segment overlap,
stops the last segment at the tip, and maps segment vertices into the same
normalized hull coordinates as the preview. Styles and tint on pooled Line
instances are restored immediately after MeshBatch copies their vertices.

Emitter start/twin-start/end tints now use the source color-at-position and
original-brightness fade. Added the source grayscale tint shader. Tinted effects
use a separate native collective batch: upstream's ordinary shared effects batch
cannot safely mix custom styles. Ownership cleanup restores particle styles and
batch membership, handles the manager's remove-before-dispose order, clears empty
batches and removes the owned collective batch on session teardown.

Five regressions exercise extracted official server-1410 beam geometry/draw code
with display/GPU boundary doubles. They cover tip/inner overlap, continuous hull
coordinates, pooled restoration, other-weapon passthrough, injected draw failures,
existing filter ownership, new emitted particles, brightness and isolated-batch
cleanup. The complete suite passed 429 tests; after adding the empty-original-
batch ghost guard, typecheck and all five affected tests passed again.

Live probe: constructed a temporary native Beam and BeamLine, called draw only,
and attached its batch to the overlay. No shoot/fire/game-message action occurred.
It rendered six blue segments with the ported bloom, normal blend mode, and a
50-unit final segment (`/tmp/QoLAF-PhaseBladeProbe.png`). Runtime errors stayed at
zero. Destroying the probe released the filter; its lines were returned to the
pool and the diagnostic display objects detached/disposed. The later emitter
batch-isolation change was tested, not exercised with a live equipped blade.

Full live parity remains open: equipped phase blade on a supported developer hull,
animated movement/twins/targets, actual emitter appearance, graphics-context
restoration and comparison against the SWF in combat. Native beam endpoints still
use the newer game's existing geometry path; the original full render-interpolated
beam geometry is a separate remaining port requirement. Visual IPC is also pending.

## Beam render interpolation — 2026-11-10

Ported source render-only beam coordinates and authored phase-blade mounts.
Beam.drawBeamEffect receives displayed muzzle/target/chain positions; the native
shoot/update methods retain their original endpoints and gameplay. Objects not
currently drawn fall back to simulation coordinates. Phase-blade mounts use the
clip-to-effects-space matrix with the source base-scale/pivot/mirroring handling.
The emitter palette adapter reads the same active render geometry; temporary
context is cleared in finally, without writing render properties onto weapons.

Regression coverage: sample at 60/120/180 FPS with fixed simulation positions;
body radius contact and zero-distance handling; authored single/twin mounts;
extracted native Beam.draw twin/secondary-target ordering; failure cleanup and
other-game passthrough. Typecheck and all 434 tests passed.

Live check after one explicit key-release reload: created an unregistered native
Beam/BeamLine with a temporary displayed pose, rendered it in the overlay and
moved that pose for 120 animation frames. Result: frames=120, mismatches=0,
nativeChanges=0. The native start/end remained at 710/1000 while the displayed
muzzle followed the moving pose plus the 10-unit authored offset. Snapshot:
`/tmp/QoLAF-BeamRenderMotion.png`. Runtime errors remained zero. No shoot/fire or
game message was invoked. Destroyed the probe, returned pooled segments, disposed
the temporary clip/batch, and confirmed filter release plus detached display.

This is a controlled browser rendering check, not real combat parity. Still
compare equipped beams/twins and actual emitters against the SWF; port original
visual target grace/hysteresis and multipart hull mounts. Radio, visual IPC and
the broader ship-visual feature family remain unfinished.

## Radio native screen review — 2026-11-10

Direct source port reviewed inside the running native Haxe canvas, with a
separate temporary harness and explicit screen-review labels. Empty/unavailable
state: /tmp/QoLAF-RadioScreen.png. Populated queue/request pane:
/tmp/QoLAF-RadioPopulatedFixed.png. Selected DJ/peer pane:
/tmp/QoLAF-RadioPeers.png. These are **isolated fixture data**, not connected Radio.

Verified 900×780 layout and shrink-to-fit with the console reducing stage height;
source request/peer switching; pointer selection of a request and DJ; source
permission-dependent controls; and moving clipped glyph batches. Live inspection
observed the 242px hint mask and advancing elapsed time (14.61s), with queue-label
time also advancing. Full runtime Radio backend/chat/lifecycle parity remains open.

Public delivery audit: GitHub Pages still served the initial 77c3c55 client while
133 newer commits existed on port/full-client. The public host's upstream client
SHA matches the locally verified Service-1410 bundle. Publishing 0.3.0-dev makes
already-implemented native Help, Changelog, Music, Inspector, welcome/login and
settings work available publicly; it does not imply full original-client parity.

## Scaled input hit areas and original Music colors — 2026-11-10

With the hull editor fitted to a 415px-high stage, native TextEntry placed each
159×26 input's DOM box at its scaled origin but retained unscaled dimensions.
The actual rendered field was 100.421×16.421; the oversized click boxes overlapped.
NativeInputPlacement now uses the complete rendered stage bounds and the existing
DomOverlay conversion, including font/padding scaling. Bitmap-backed inputs use
it after successful native placement; RadioInput uses the same adapter. Hidden
inputs stay hidden and bitmap input disposal restores the original CSS.

After one browser reload, live measurements were 100.4167×16.4167 versus expected
100.4211×16.4211 (browser pixel rounding). A physical click on the enabled Color B
field reported first=false, second=true. Closing the console restored both inputs
to exactly 159×26. The gradient was a popup draft and was cancelled without Apply.
Evidence: /tmp/QoLAF-ScaledInputFixed.png and /tmp/QoLAF-ScaledInputFull.png.

The dark Music checkbox label is source-correct. Decompiled the local original
AeonDesktopTheme.swc (SHA256 d51d9ffe6d5df3bfd75040c1942120c691b41161592ae3f3b5e5491e05ce6a33):
BaseAeonDesktopTheme uses 734012 (0x0b333c), 11px _sans, and disabled 5990256
(0x5b6770). Original RichBitmapFontTextRenderer resolves _sans to Russo. Preserved
the enabled appearance; corrected the port's disabled label from 0x666666 to
0x5b6770. The running original was on its loading screen during this comparison,
so this color finding relies on the shipped library and renderer source.

Typecheck, formatting and all 441 tests pass. Added coverage verifies scaled bounds,
repeated placement without compounding scale, CSS canvas scaling, hidden-input
handling and disposal restoration. This does not establish full screen parity.
