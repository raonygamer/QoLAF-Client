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
