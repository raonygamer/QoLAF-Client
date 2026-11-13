# Full port audit — work in progress

The requested target is **all original client features and screens**, retaining their appearance and behavior, adapted to the Haxe runtime. The former DOM-panel release did not meet that target. This directory records coverage against the supplied vanilla `Preload.swf`; it must not be used to claim completeness while items remain pending.

Gameplay compatibility rule: the current Haxe game remains authoritative for shield behavior, regeneration, damage and other gameplay calculations. Port the original client’s presentation and options around those mechanics; do not replace them with historical AS3 formulas. Display-only observations must leave native method arguments, return values and state changes intact.

Explicit exception requested by the user: the server's corrosive-percent bug has been patched. Do **not** carry over `Weapon.addCorrosiveArtifactDamagePercent`'s `hasCorrosiveEliteTech ? Damage.CORROSIVE : Damage.ALL` workaround, its call from `Player`, the gold `(all%)` artifact tooltip annotation, or the obsolete changelog claim. Corrosive-percent bonuses must affect corrosive damage only, including weapon debuff estimates, regardless of corrosive Elite Tech. Preserve the upstream corrected calculation when integrating damage estimates. The current TypeScript port does not override that calculation or add that annotation. Artifact fitness weights are separate scoring coefficients, not damage multipliers; they already distinguish `corrosiveMulti` from `allMulti` and need no change for this exception.

The SWF was decompiled with JPEXS 26.3.0. `source-inventory.json` contains every AS3 source file from the client, its SHA-256, and a comment/whitespace-insensitive comparison with the corresponding decompiled file. There are 722 client files: 288 not present in the baseline, 356 with token differences, and 78 with identical tokens. Decompiler changes can produce token differences without a behavioral difference; changed methods need individual review. The baseline, full original sources and raw diffs remain outside the port repository.

Current implementation map (source checked 2026-11-12):

- `src/index.ts` installs typed class bindings, login loading, rendering changes
  and Game/Service recovery.
- `src/runtime/GameSession.ts` installs settings, artifact workflows, rich chat,
  autocomplete, QoLAF messaging, aim assist, target UI and gameplay presentation.
- `src/clock/NativeClockResync.ts` implements the parallel resync command;
  `src/chat/LocalClientCommands.ts` routes it and the local diagnostics.
- `src/ipc/NativeVisualShare.ts` provides automatic visual sharing and private
  explicit broadcast. Public builds compile out the private command entry and
  feedback; `scripts/build.mjs` checks forbidden private-module contributions.
- `src/game/Bindings.ts` centralizes native classes. Reviewed signatures and the
  supplied game bundle generate `src/game/Game.d.ts`; remaining dynamic access
  and unreviewed declarations still need conversion.
- The separate host owns the native Plugins manager and default external client
  URL. The VPS deployment at raony.dev/astroflux uses a fixed astroflux.net asset
  proxy and serves the Public plugin locally. Login rendering was revalidated
  in isolated Cage Firefox on 2026-11-12. Authenticated Steam gameplay, room
  refresh, chat over native screens and hot-toggle checks are recorded below;
  these targeted checks do not establish complete gameplay parity.

These are implementation locations, **not full parity sign-offs**. Complete
settings/screen/text comparison, remaining original functional differences,
rendering behavior, connection failure paths and platform packaging still need
review against the source inventory. Do not list entire implemented subsystems
as absent simply because an older note predates their port. Conversely, a module
or green typecheck alone does not prove that its hooks run correctly in-game.

Radio is excluded by the user's explicit instruction. Preserve the corrected
corrosive gameplay and newer vanilla behavior. Private `/serverip` observes the actual selected SDK transport. Steam verified
the game hostname after /ref; hot reload exposed lost Service endpoint metadata,
now retained weakly on the SDK. Connections never observed still report unavailable.
Do not substitute a guessed address or room ID for that value.

Current verification includes typechecks, Public/Private builds, focused Steam
runtime and host-dispatcher tests, and isolated Firefox login rendering. The
latest full suite has 915 tests: 913 passed. Integration still stops at the
incomplete native registry fixture (first missing class: FragmentFilter); the
excluded NativeRadio test still lacks its LoginButton superclass fixture.
Neither failure is skipped or claimed fixed. The shared HostCore fixture now
matches the current host loader, including child-scope cleanup before global
hooks, so focused adapter tests exercise that dispatcher instead of its older copy.
Historical observations in [LiveComparison.md](LiveComparison.md) and
[OpenIssues.md](OpenIssues.md) apply only to the versions/screens they identify.
A broader signed-in original/client comparison is still required for complete
gameplay and screen verification; the targeted checks do not establish that parity.


## Renewed diff pass, 2026-11-12

`FullPass.json` now inventories all 722 current original source files, records normalized method changes, hashes the port sources, and checks actual Public/Private bundle contributions. `scripts/AuditPort.mjs` regenerates this screening without replacing manual findings. This is a whole-tree screening, **not a semantic parity sign-off**: 78 files match baseline tokens; 217 have implementation navigation candidates; 413 require manual mapping; 14 are radio-specific exclusions. Candidate counts must not be interpreted as feature coverage.

Confirmed gaps from source, live Haxe bundle, and installed adapter inspection:

- Radar boss/miniboss miniatures, circular masking and suppression of ordinary blips are deployed; the layer initializes in the live Steam game. Stale-owner generation/identity pruning is deployed with regression coverage; visible boss encounter comparison remains pending.
- Drop expiry warning pulse: now implemented in `DropExpiry.ts`, with pulse/deadline and update-order tests; live confirmation pending (homing interpolation is separate).
- PlayerClanLogo identity/cache/tooltip ownership fixes; world clan name/rank/logo rendering now has live remote-player confirmation in Steam (see the evidence below).
- TechTree resource batch upgrades to elite level, with cancellation and late-acknowledgement accounting.
- Pod count timeouts, uncertain-purchase/open tracking, duplicate prevention and animation recovery. Reward announcements are implemented but do not provide this recovery.
- Turret terminal weapon disposal and stopping retained weapons on death; turret identity indexes and ignoring competing server rotation snapshots.
- WeaponManager terminal cleanup and drawable-weapon index lifecycle.
- PvP roster retry backoff is now deployed for PvP and Domination: 2 seconds, multiplied by 1.5 up to 10 seconds, reset on a complete roster. Timer tests pass; an actual incomplete-roster recovery has not been observed.

Platform gaps: SDK socket endpoint visibility. Discord presence now has a verified Steam/Proton path (see live verification below); native Windows/itch remain untested. Radio remains intentionally excluded. Current vanilla shield/corrosive calculations and updated art remain authoritative.

Source-reviewed examples that must **not** be marked absent from filename mismatches: friend/queue Service reconnection in `ServiceViews.ts`; skin copying and purchase validation in `HangarCatalog.ts`; rendering adapters installed by `Interpolation.ts`; rich chat and target integration installed by `GameSession.ts`. These are narrower findings, not complete subsystem certification.

Runtime reports still open: Plasma/conc-sphere/flame refresh behavior. Loot homing and numeric PvP text fixes have focused test evidence but require live confirmation. Remote clan nameplates and name/level opacity now have live Steam evidence for another clan; same-clan and lifecycle cases retain regression coverage but need their own observed live checks. Broad typing migration remains incomplete (`Raw`/`any` remain in legacy adapters and declarations).

The requested `/log` command now opens a local native Log/Errors panel with bounded hook diagnostics, method context, live refresh and Copy. Host errors are retained before the panel is opened; around-hook failures still propagate. No automatic upload is added. The Plugins panel now fits its form below the actual row count and hides unnecessary pagination.


Host follow-up: plugins register `name`, `description`, `version` and an explicit
`safeToHotReload: true` opt-in. Only opted-in plugins receive Enable now / Disable
now actions; the current declaration is rechecked before hot activation. Saved
metadata remains visible when a plugin is disabled. QoLAF opts in; the unchanged
AFPUBLIC mod is separately hosted and defaults off. Existing saved enable/disable
choices are preserved. A conflict disclaimer is shown in the Plugins page.
`ChatInputRestore.ts` captures the native input before session adapters and restores
it last, including native DOM placement. Repeated restoration and layout tests pass;
this does not certify all runtime hot-reload side effects.

2026-11-12 room-refresh investigation: live logs identify `ProfilerWindow.redraw`
reading `frame.graphics.clear()` after a warp or `/ref`. The cached constructor
outlived the room-scoped Haxe property aliases. Profiler and disposal-debug factories
now reacquire their dependencies before returning cached constructors, preserving
window state. Regression tests reproduce the exact missing-graphics exception after
cleanup and verify four subsequent room lifecycles. `/restart` is the sole command
that reloads the launcher/plugins; `/upstream` now performs a room refresh.

Clan lookup failure is confirmed by the live BigDB permission error. Clan labels now
use the current vanilla `ClanClient.brief` RPC, retaining stale-response guards and
bounded retries. Live nameplate confirmation remains outstanding. Death-screen XP
spacing now uses measured text/button blocks instead of leading newlines; focused
layout tests cover wrapped killer descriptions and repeated layout. Live visual
confirmation remains outstanding.

Private delivery was exercised in an isolated headless Electron browser: valid-key
POST, authenticated cookie status, protected module import, and launcher/frame
requests for `/astroflux/private/client.js` passed without requesting the public
client module. User reports of Public fallback remain unresolved for their launch
context; fallback errors are now logged, and plugin metadata displays the compiled
build identity. Discord RPC was unimplemented at that checkpoint; see the later transport and live-verification entries.

Private launch verification follow-up: a full isolated Electron run with software
WebGL rendered the native login identity `QoLAF - v1.2.0 TS (Private)`. The request
trace fetched `/astroflux/private/client.js` and never the public client bundle;
exported plugin metadata also reported Private. This proves the current authorized
launch path through rendering, not only authentication/import. It does not explain
the user's earlier Public session or verify their installed Steam patch files.
The preceding headless run without WebGL could only verify module delivery and
stopped at Stage3D initialization; it was not treated as a rendering pass.

Weapon/turret lifecycle pass: `WeaponLifecycle.ts` ports the original stop-on-death
behavior while retaining the weapon for turret rebuild, releases ownership before
terminal removal, guards repeated manager removals against index -1, and destroys
remaining weapons before native Game.exit tears down their effect canvases. Current
vanilla still has a single weapon collection, so cleanup operates on that collection;
the original separate drawable-weapon optimization and turret identity indexes are
not claimed implemented. Checked removal methods in both supplied build 561 and
captured live build 564. Focused tests verify retained ownership, one-time terminal
destruction, unaffected neighboring turrets, invalid indexes, and three room exits.

Steam runtime checks (2026-11-12): Settings remained open while Enter opened/focused chat and Escape closed chat without sending. Expanded artifacts kept chat hidden and Enter did not open it; exiting restored the log. Boss render-root sampling produced 360 changing poses over about two seconds at 180 Hz. No boss components were on-canvas during that sample, so it does not establish visible multipart parity.

Hot reload audit: enabling the client while Settings was already open exposed an uninitialized category list. The adapter now re-enters that active native SettingsState through its dispatcher so the host remounts Plugins; reopening Plugins succeeded in Steam. A separate unload failure read `BitmapChar.texture` after temporary aliases had been removed. The renderer now uses native Haxe getters for character textures/metrics and font metrics. A regression deletes those aliases between layouts; it and 21 related renderer/editor/IME checks pass. The deployed font fix passed a fresh-runtime Disable now / Enable now cycle in Steam: Private metadata and the radar layer returned, Plugins reopened, Settings closed normally, and a 12-second CDP monitor captured no newly emitted errors. This verifies that exercised cycle, not every possible unload state.

Clan-list ownership pass: current live Haxe `PlayerClanLogo.init` still reparents
`player.clanLogo` into each list, and `dispose` removes all clan tooltips globally.
`NativeClanLogos.ts` ports the original identity-stamped cache, per-widget images
and tooltip disposal, missing-logo text fallback, and stale/disposed response
checks. It retains the current game's `ClanClient.brief` RPC rather than the old
BigDB read. A real host-hook fixture verifies two simultaneous widgets, cache
survival, repeated disposal, changed clan identity, late replies after disposal
and unload, and a missing atlas logo. Typecheck and both builds pass; visible
clan-list comparison in Steam remains pending.
Both clan-logo bundles were deployed on 2026-11-12. A fresh Steam reload reached
the game with chat present and four radar children; the 25-second startup monitor
reported no newly emitted errors. This is startup evidence, not a visible clan-list
comparison.

Late miniature textures: `MapLiveMiniature` previously skipped textureless parts
permanently unless a boss's component count changed; this also affected single
miniboss icons. Pending parts now attach when their textures become available,
retain native component order even for out-of-order arrivals, and reject recycled
component generations. Same-count component replacement rebuilds the miniature.
Seven focused map/miniature tests and typecheck pass. This fixes a demonstrated
loading-path gap; it does not establish that every reported radar failure had
this cause.

Resource upgrades to ET: compared original TechTree source with current Steam
Haxe load/buyUpgrade/upgraded/selection/dispose methods. Added the missing native
"Upgrade to ET" button, resource-only serial requests through level six with the
original 50 ms gap, level/affordability guards, and owned cancellation on removal,
disposal, and unload. Late successful acknowledgements retain upgrade counters
without updating disposed icons or advancing the cancelled batch. Finishing
reloads cargo and restores native controls; ordinary purchases also lock the new
button. Four controller/real-host-hook tests cover payloads, serial progression,
duplicate replies, rejection, disconnection, timer cancellation and disposal.
Typecheck passes. No live resource purchase has been made. Live station-button
layout and a user-authorized purchase remain unverified; ordinary upgrade tween
speed and success sound/analytics parity are not covered by this batch port yet.
Deployed public/private batches and reloaded Steam: game/chat/radar initialized
with no new startup errors. Constructed a real Haxe TechTree offstage in that
runtime, loaded it, and selected a level-one icon without invoking any purchase
callback. The new button existed and became visible; y=301 matched the native
Buy-button bottom plus eight pixels. Disposed that temporary view afterward.
This verifies native construction/placement logic, not a rendered station view
or a live transaction.

Pod flow audit in progress (local, not deployed): live Haxe buyPods immediately
increments boughtPods and creates presentations before its RPC reply; exit only
removes display children. The original diff instead persists uncertain mutations
per Game, reconciles the count after a reply, guards stale callbacks and recovers
stalled presentation. Added PodMutation and NativePodRequests as the first part:
eight-second uncertainty, per-game duplicate prevention across view changes,
stale-view callback suppression and ordering that preserves reward reporting.
Two focused tests and typecheck pass. This is NOT the completed pod port.
Before deployment, integrate count-known/in-flight/generation reconciliation,
replace premature native buy-side counters, reset/cancel native animations safely,
and remove the temporary close/reopen recovery instruction in favor of the
original automatic count refresh. Full native pod-screen rendering and transaction
verification remain unproven; no paid pod operation was invoked in Steam.

Pod follow-up (now deployed): replaced premature native buy-side count/pod
creation with a server count request after acknowledgement. PodCount serializes
reads, discards a count that predates a mutation acknowledgement, defers replacement
RPC registration beyond PlayerIO's live handler dispatch, retains timed-out reads
for late replies, and ignores disposed views. The temporary close/reopen recovery
instruction is removed. Scoped native tweens and nested completion/delayed callbacks
are cancelled or generation-guarded on reset/exit; a bounded presentation watchdog
requests a fresh count and stops repeated failed recovery. Rejected or malformed
open replies also reconcile counts. Five focused tests and typecheck/builds pass.
Steam was reloaded, the real pod screen opened read-only, and its server response
rendered `0 Pods`; Close was enabled, blockHotkeys false, and the startup/screen
error monitors recorded no new errors. Screenshot: /tmp/qolaf-steam-check/pods.png.
Returned to RoamingState afterward. No buy/open request was sent. A nonempty pod
animation, paid/open round trip, confirmation-dialog parity, purchase analytics,
reward fallback details, and a visual comparison against the SWF are still not
proven complete by this pass.

Pod confirmation/fallback pass: current Haxe already has CreditBuyBox prompts,
but anonymous trigger listeners allow multiple dialogs and close unconditionally
re-enables Buy. The port intercepts only the two pod buttons' triggered events,
preserving native listeners for unload, and owns one confirmation per active view.
Cancel restores controls only when count/connection/mutation state permits; exit
closes and detaches the owned dialog. Tests cover duplicate triggers, cancellation
without purchase, confirmed request payload, and late acceptance after exit.
Added the original reward-preview fallback text/layout with diagnostic recording
and read-only balance refreshes; preview failure returns to native opening flow.
Typed the actual Starling buttons, CreditBuyBox, CreditManager and SceneBase cargo
member from current runtime structure. The nullable cargo type also exposed a
recycle guard that now falls back to native handling when cargo is unavailable.
Live confirmation check initially caught an event API mismatch: Haxe Starling
Event uses `.type`, not `get_type()`. Fixed the hook, typed DisplayObject's actual
dispatchEvent override (its generated any had masked the error), and added an
ordinary addedToStage event regression. Restored RoamingState, deployed both fixed
bundles, and reloaded cleanly. In Steam, repeated trigger events produced exactly
one Buy 1 dialog (cost 45) and one Buy 10 dialog (cost 450); buttons stayed disabled
inside each dialog and Cancel restored them. Count remained zero. Closed the pod
screen, returned to roaming, and the fresh screen monitor reported no errors.
No confirmation was accepted and no paid/open transaction was tested.

Turret manager diff pass: live Haxe onTurretUpdate still assigned the server angle
on every update while AITurret also simulated rotation locally. NativeTurretUpdates
ports the original behavior: consume that field without changing local rotation,
while applying health, shields, injury, target and weapon fire normally. Initial
syncTurretTarget remains native. Added per-manager ID and parent/sync indexes with
identity validation, provisional-zero exclusion, fallback native lookup/logging,
and removal invalidation that does not evict a replacement. Current Haxe's extra
unitManager.add during syncTurret is retained rather than replaced with the old
SWF registration path. Five focused turret/boss/lifecycle tests and typecheck pass.
This removes the demonstrated competing-rotation path; it does not prove all
reported enemy correction snaps or multipart framerate issues resolved.

Weapon draw index: original WeaponManager separates drawable weapons from its
simulation list. Confirmed current Haxe Weapon.draw is empty and Beam is the only
weapon subclass owning draw. Added maintained rendering membership, factory and
removal hooks, and the current Haxe scene draw order with its visible-object gates.
Simulation/update ownership is unchanged. Unlike a hardcoded beam-only list,
custom weapon draw overrides also qualify; if another plugin gives base Weapon a
nonempty draw, the native scene draw is used. Tests cover ordering, hidden objects,
new/removing beams, repeated removals, a later base-draw plugin, and unload.
Five focused scene/boss/lifecycle checks and typecheck pass. No performance gain
is claimed from timings; this removes the audited empty draw calls structurally.
Deployed draw-index bundles and reloaded Steam without new startup errors. A live
runtime synthetic Message (not sent to the server and applied to a synthetic
manager/turret) verified health 75, shield 20, injury/target/fire applied, while
rotation stayed 1.2 despite network angle -2.5. The real room held 280 weapons and
32 drawing implementations, so the draw list excludes 248 empty calls. Screenshot
/tmp/qolaf-steam-check/weapon-draw.png confirms world/HUD rendering; its FPS label
reads 180, which is not a before/after performance benchmark. The screenshot also
reconfirms a pending layout bug: safe-zone text overlaps the landing prompt.

HUD notice overlap: source Hud.resize uses safe-zone y=stageHeight/2+180 and
landing y=stageHeight-stageHeight/3, which both equal 720 at 1080p. Live Steam
confirmed those identical anchors with heights 30 and 20. Added measured collision
layout for visible safe-zone, repair and landing text: preserve native anchors
when possible, otherwise choose the nearest free vertical slot with a six-pixel
gap. Recompute from anchors without cumulative drift or twice-per-frame position
writes; resize/visibility changes are handled and unload restores native layout.
Tests cover unchanged 720p placement, the 1080p collision, hidden notices, separate
horizontal bounds, and three-label combinations from 600 to 2160 pixels high with
multiple measured font heights. This adapts a collision present in the source
formulas rather than claiming the old client had a separate layout algorithm.
Deployed both notice-layout bundles and reloaded Steam without new startup errors.
Live measurements now show safe-zone y=720, height=30 and landing y=694, height=20,
leaving six pixels between their bounds. Screenshot
/tmp/qolaf-steam-check/notices.png visually confirms two distinct readable lines.
The hidden repair notice retains its native y=750 anchor. The full rendering/HUD
remains visible; no ship movement or gameplay action was used for this check.

### Typed packed-message boundary audit

Reviewed the supplied Haxe MessagePackHandler dispatcher: record lengths include
both header fields, and enemyFire receives an offset without an explicit length.
Added reviewed dispatcher signatures and a central MessagePackHandler binding;
PackedRecordBounds now uses typed reflection and PlayerIO messages. Enemy
observation packet parameters also use the reviewed Message type. Remaining
Raw enemy/manager observations are still pending conversion; this is not full
module typing. Regression coverage exercises adjacent fire records (optional
target must not bleed into the next record), invalid lengths, unknown offsets,
standalone explicit lengths, and nested dispatch exceptions restoring outer
bounds. Six focused packet/torpedo tests pass, as do typecheck and both builds.
No movement algorithm was changed by this typing pass.

### Enemy observation typing and lifecycle follow-up

Converted EnemyObservations from Raw objects and string class lookups to central
EnemyShip, ShipManager, ShipSync and AIResurect bindings with typed reflection.
Reviewed current native enemyFire, damaged, readEnemyEntry, syncEnemyTarget,
aiCourse and aiStateChanged packet layouts before adding method signatures.
Removed the unused third enemyFire argument: the native signature takes message
and offset, while packed bounds remain supplied by the dispatcher observer.
New actual-host-hook regression verifies adjacent packed weapon-stop records do
not become target IDs, stopped firing retains sampled aggro, reconstruction
metadata does not mutate HP/shields, reset clears pooled-life observations, and
unload removes added accessors. Seven focused tests, typecheck and both builds
pass. This removes Raw from this module; it does not complete project-wide typing
or establish live enemy-motion parity.
The native aiStateChanged audit also exposed a protocol mismatch: AIFollow and
AIResurect decode their target with getNumber then int32 conversion. The observer
used getInt for AIFollow and omitted AIResurect. It now matches both native paths;
the regression rejects an integer read at the target offset and verifies both
states update the sampled target. Native state transitions remain untouched.

### Live emitter cadence verification (Steam)

A first three-second RAF sample found all particle lifetimes stationary. The game
clock was also stationary; screenshot inspection showed the native inactivity
connection-loss dialog. This sample is invalid as animation evidence. Reloaded
once and allowed the saved login to reconnect; startup yielded no new errors.
The repeated sample recorded 541 display frames in 3003.6 ms. Player idle thrust
and two hardened-shield emitters each changed existing particle TTL on all 540
comparable frames, with zero unchanged frames. Sampled Nexar Bomber thrusters,
reduced-armor/crystal DOT and bullet/Nexar-bomb explosions likewise advanced on
every comparable frame. This verifies elapsed-time animation of those active
emitters at approximately 180 Hz, not every effect or visual fidelity to SWF.
A separate four-second projectile sample recorded 721 frames but only stationary
Blastwave projectiles, yielding zero moving-projectile comparisons. Plasma and
conc-sphere travel therefore remain unverified; no speculative movement fix was
made from this sample. Ten emitter/drop regression tests pass, including
30/60/120/180 Hz particle counts and travel, elapsed boundaries, pooling, and
render-frame manager invocation. Loot homing still needs a live moving drop.
Read-only sampling helpers are /tmp/qolaf-steam-check/emitter-motion.mjs and
/tmp/qolaf-steam-check/projectile-motion.mjs; no weapons were fired or inputs held.

### Resource-upgrade recovery and completion parity

Compared original TechTree.sendTechUpgrade/scheduleUpgradeToEliteTechStep and
upgraded against NativeResourceUpgrades. Added the missing owned game-recovery
guard to batch availability, preventing a new request during recovery and
preventing a successful in-flight reply from advancing the batch during recovery.
Already acknowledged counters remain recorded, matching the source. Restored the
source success sound and credit refresh for each accepted active-view upgrade;
late/disposed/recovering replies retain counters without stale UI/audio work.
Four batch/native-hook tests pass, including recovery before purchase and during
acknowledgement, duplicate clicks, serial requests, and disposal. Typecheck and
both builds pass. No actual resource purchase was made; paid live flow remains
unverified. Purchase analytics and ordinary-upgrade animation timing still need
separate source parity review.

### Command reload and portable-screen source review

Reviewed original ChatInputText command dispatch and Game portable-screen methods
against LocalClientCommands and PortableScreens. /rec preserves room-wide pending
recycler ownership, /upg creates a fresh upgrade state, and /hangar + /piratebay
require roaming or a real landed state; Pirate Bay also rejects re-entry into an
existing native Pirate Bay. These entry restrictions are present in the port;
this review does not certify every screen's content. Original /upstream aliased
the wrapper restart, but the user's later instruction explicitly limits plugin
reload to /restart. Current dispatch follows that instruction: /ref, /refresh and
/upstream call Game.reload, while /restart reloads the launcher. Corrected the
help page and chat help that still described /upstream as a Thin Wrapper restart.
Updated the stale help-version assertion from 1.1.23 to the requested 1.2.0 TS;
15 existing guide/autocomplete tests pass. Both bundles build. Discord presence
remains a known unsupported platform feature, not a completed command.

### Discord activity model port (transport still pending)

Ported original qolaf/discord/DiscordActivity.as into typed
src/discord/DiscordActivity.ts, plus DiscordPresence's 128-byte UTF-8 text bound.
Snapshot reads existing state only: menu, logged player/system type, dock/death/
warp precedence, nearest hostile activated boss within 1000 units of its edge,
essential-part HP and shields retaining destroyed maxima, and owned Emperor
observations with unknown-state preservation. The Three Emperors placeholder
body is excluded. Typed native boss radius/hostility and essential-component
fields were reviewed and added to generated signatures. Four tests cover state
precedence, boss resource accounting, Emperor rows and Unicode bounds; typecheck
passes. This is a source module, not a deployed working Discord integration:
Steam IPC transport, five-second change sampling, settings lifecycle, command
handling and native end-to-end verification remain required. No activity was
published and no new game-server telemetry requests were made.

The live clan audit found only the local ship in the current room. Its clan cache
is populated and name/level alpha is 1; it cannot establish other-player label
visibility. That reported runtime issue remains open rather than inferred fixed.

### Discord transport and lifecycle wiring

Reused the original Windows/Linux Go helpers, including their existing Proton
relay, rather than inventing another Discord protocol transport. Added the
bounded main-process wrapper in host shell/Discord.cjs and copied it with the
helpers and Go license into QoLAF-Steam/src and the installed unpacked Steam
launcher. Main/preload diffs contained only the intended Discord additions;
previous installed files are backed up in /tmp/qolaf-discord-loader-backup.
Allowed game frames can start/status/update/stop only this fixed helper; renderer
input cannot choose executables or arbitrary RPC fields. Navigation/window close
stops it. Byte-verified extraction uses a content-hash directory under userData.
The Linux helper --probe reports transport_available on the current desktop.

Client root lifecycle now samples every five seconds, sends changed activity
only, respects saved opt-out/application ID and suppresses post-disposal work.
/discordpresence on/off/status/app is installed with bounded failed-start retries
and settings-controlled start/stop. Seven snapshot/lifecycle tests and one host
bridge test pass, covering fragmented output, stale children, payload bounds,
backpressure, opt-out during startup, cadence and retry cap. Typecheck and both
builds pass. Public/Private client bundles are deployed. The already-running
Steam process has not yet restarted with the new main/preload files: Proton
helper launch, Discord activity acknowledgement and real command operation
remain to be verified before declaring native presence functional.

### Live Discord verification in Steam/Proton

Restarted the real Steam game with the patched unpacked launcher, preserving the
private launch URL and authenticated session. The saved login connected normally;
12 seconds of fresh runtime monitoring found no startup errors. The actual
qolafDiscord bridge reported active while connected to the game. In the bundled
helper, active is emitted only for the matching SET_ACTIVITY acknowledgement,
so this verifies the Windows helper/Proton relay/native Discord path, not merely
successful process creation. Invoked /discordpresence off then on through the
real ChatInputText.sendMessage hook: preference false/status disabled, followed
by preference true/status active. Restored enabled state. No server chat sent.
Invoked /ref once, observed the new room connected with chat/radar present and
no fresh errors; Discord remained active afterwards. Native Windows and itch
execution still need their own live verification. Added current desktop command
help and corrected the old AIR Documents-path claim for browser chat-profile
CSV downloads. Existing guide tests pass; both bundles rebuilt and deployed.

### Health/shield presentation source audit and typing

Reviewed original HealthAndShield.update/animateDisplayedValues/renderDisplayedValues
against the existing adapter. The adapter already implements the source's
exponential easing (rate 12, frame clamp 100 ms, 0.05 snap threshold), 120-pixel
bar bounds and optional compact-number formatting. It invokes native update
first, preserving the newer game's warning, texture, tooltip and shield rules;
the old shield tooltip/formulas were deliberately not substituted. Converted
this adapter from Raw/string class resolution to the central typed native
HealthAndShield binding, typed ship getters and native text accessors. Added
reviewed native field signatures. Three regression tests pass, including equal
half-second smoothing at 30/60/120/180 Hz and unchanged simulation HP/shields.
Typecheck initially exposed optional settings and inaccurate mock setter return
types; corrected them and reran successfully. Both runtime bundles are deployed.
This is source/logic evidence, not a live low-health combat comparison.

### Native death-text layout measurement

Reviewed original Killed.enter and RoamingState.updateInput. Automatic respawn
continues to match the source's non-commandable branch; no HP, death or respawn
request was induced for validation. Bundled the actual layoutDeathInformation
function into a temporary probe and ran it in the live Steam renderer using the
real native StarlingTextField and game Button constructors, offstage and disposed
after measurement. Emperor Xhersix text measured 55.9375 px; teleport y=68,
height=26; XP y=104, height=44.453125; protection y=160. Wrapped killer text
measured 110.859375 px; teleport y=123, height=26; XP y=159, protection y=215.
Both cases preserve the intended 10-pixel button-to-XP gap and a separate
protection button. Leading blank XP lines are removed while HTML color markup
survives. This is stronger than display doubles for text geometry, but is not a
full native Killed.enter run or a real death screenshot. The temporary probe
needed a direct native Button lookup because that class has no central binding;
no production binding/API was added solely for the probe.
Native ChatInputText.toggleChatMode itself has no alive/dead guard. The installed
capture handler bypasses the native roaming-input dead-player early return, with
expanded artifacts as the sole screen exclusion. Existing keyboard and death
layout tests pass. Actual chat interaction during a server-confirmed death still
remains unobserved; do not treat this source review as that live test.

### Weapon-selector tooltip ownership port

Source WeaponSelector.clearIcons explicitly disposes per-selector tooltips before
icons; the current Haxe selector creates HomeState tooltips without retaining
ownership and only removes icons on refresh/dispose. Ported the ownership change
with typed native hooks: dispose tooltips whose targets are the selector's icons,
then let the native refresh/dispose run; assign new selector tooltips their source
WeaponSelector group. Existing selectors from before hot enable are covered by
target identity. Unload restores original tooltip groups for surviving icons,
keeping their hover behavior. Purchases, slot handlers and native icon creation
remain unchanged. Real-host-dispatch regression covers repeated refresh, early
listener disposal, unrelated owners, pre-install selectors and unload. Typecheck
and both builds pass. Native Steam verification follows after deployment.
Live Steam verification: loaded the deployed client with no fresh startup errors,
constructed a real native WeaponSelector offstage for the current player, and
refreshed it three times. Registry deltas were [5,5,5,5], all five tooltips used
WeaponSelector ownership, and disposing the selector returned the registry to
its original count (delta 0). No slot changed and no purchase callback ran.

### Hangar preview construction failure cleanup

Compared SkinItem's constructor and disposal with current Haxe build 564. Native
Haxe already tracks both engine emitter groups, so no duplicate tracking was
added. The original catches errors from its eight preview construction steps,
disposes the partial preview, and rethrows the original error; that catch was
missing in the port. Added typed guards on those native prototype steps, retaining
native construction and emitter disposal. Cleanup failures are logged separately
and do not replace the original construction error. Existing idempotent disposal
and detached-section cleanup remain in effect.

The real host hook dispatcher regression injects failure at each of the eight
steps, plus a successful construction, and verifies exactly-once disposal of
attached/detached sections, null early stats, both engine emitters and repeated
dispose calls. Typecheck and public/private builds pass. This is failure-path
coverage; it does not establish visual parity for every hangar preview.

Hangar follow-up live pass: reloaded the deployed cleanup build in real Steam;
startup reported no fresh errors. Constructed all 59 cached Skins as native
preview-mode SkinItems offstage and disposed each twice, yielding no exceptions.
Nine previews used dual engines; 67 optional sections were detached at disposal.
No purchase or ship-switch callback was invoked. This verifies preview data and
normal cleanup across the current catalog, not purchase/switch completion.

Reviewed Hangar, SkinItemBaseStats and LandedHangar against their original diffs.
Catalog deep copies, portable selection, empty fleet slots and purchase-data
checks are already ported. Landed frame-rate writes are already suppressed by
LandedFrameRate; its regression passes. Found and ported the missing
SkinItemBaseStats Localize.t label path via a typed native addStat hook, preserving
native bars, animation and values. Typecheck and public/private builds pass.

Real Steam portable-hangar navigation also passed: 59 rows, initial selection
Aerodeck, message log visible, clean return to RoamingState. Lime backend
framePeriod stayed -1 before and during the screen; the native stage getter
reported 60 in both states and is not an observed 60 FPS cap. The first probe
incorrectly treated the state as a display container; corrected it to inspect
state.container and restored RoamingState before the successful repeat. No
purchase/switch actions were taken. Label update deployed with server hash
validation; live navigation above ran the prior cleanup build, so it is not a
rendered localization check.

### Ability hotkey timing source pass

WeaponHotkeys' tooltip selection, native callbacks, selection and refresh match
the current Haxe implementation; no replacement needed. Abilities.load in the
original adds two Game.TICK_LENGTH ticks to the engine button cooldown. The port's
movement command clock still intentionally trails game.time by 66ms, but this UI
padding was absent. Added NativeAbilityCooldown scoped to the active scene's
Abilities instance, preserving native cooldown calculation and adding the buffer
only to Engine. Tracks identities so repeated load does not accumulate padding;
new hotkeys after refresh receive it, and hot unload restores surviving owned
values without overwriting a subsequent adjustment by another owner. No ship or
server cooldown fields are changed.

Real-host-dispatch regression covers initial existing HUD, repeated load, refreshed
hotkeys, hot disable/re-enable and other-owner changes. Typecheck and both builds
pass. Before deployment, Steam shows engine cooldown 3615 for base boostCD 6000
and reduction 0.39733658954377127; the source-compatible UI value is 3681. Other
abilities are Armor 3013, Shield 3013, Power 18079. Live after-deployment check
follows separately; this entry alone does not prove runtime activation.
Live Steam check after deployed bundle reload: engine cooldown is now 3681;
Armor 3013, Shield 3013, Power 18079, ship boostCD and reduction remain unchanged.
Startup completed with game/chat/radar present and no fresh client errors. An
early read-only probe ran before game creation and was retried after the reload
watch completed. No boost/movement command was issued during this value check.

### Empty ship-menu slot hit area

Original MenuSelectIcon explicitly keeps bgrBmp visible for locked OR unused
slots in both locked/inUse setters. Haxe still hides it in set_locked(false),
including the final setter call in construction. With the port's bitmap text,
this leaves empty unlocked slots without a hit area. Reproduced in real Steam
using a native empty artifact-slot icon offstage: background false and hitTest
false at (1,1), (5,20), (20,20), (39,39), despite numberText.touchable true.

Added typed native after-hooks for both setters to apply the original background
rule, retaining native icon/lock/text changes and setter return values. Regression
covers native construction order, all locked/occupied combinations, subsequent
changes and hook unload. Typecheck and public/private builds pass. No inventory
or purchase operations are performed by this patch or the live probe.
Live verification after deployment/reload: native artifact, crew and weapon empty
slot icons each keep background visible and hitTest succeeds at all four tested
points (12/12). Before the fix, the artifact case failed 4/4. Startup game/chat/
radar were present with no fresh client errors. Icons were constructed offstage
and disposed; no slot-selection or purchase event was dispatched.

### Live remote clan nameplate confirmation

A remote player is now present in the real Steam room. Read-only inspection
finds a matching cached clan identity, visible attached label, name and level
alpha 1, and both clan text nodes alpha 1. The rendered screenshot visibly shows
Rat Lord, rank Lord Of Cheese Rats, its logo, and player LordCheeseRat level 150.
Label stage bounds are x=896.25, y=468.70, width=127.51, height=25. Evidence is
saved outside the repository at
/home/raony/Documentos/astroflux-port-audit/runtime/clan-labels-steam.png.
Own clan plate remains hidden as the original requires. No source change was
needed for this observation; it verifies the previously deployed ClanClient.brief
path for this remote other-clan player, not same-clan/warp/pooling scenarios.

A simultaneous 4-second projectile observation delivered 721 RAF samples but
contained no live visible projectiles; it provides no plasma/conc travel proof.

### Particle-only projectile render-path audit

Compared Projectile.draw and all source AI renderState.draw implementations with
ProjectileFrames, ProjectileAttachments and InstantFrames. Source fractional
course prediction, shortest-angle rotation, stuck-host transforms and instant
lifetime paths are present. Current cached Concussion Sphere and Plasma Blaster
projectiles have no bitmap: their visible content is thrust particles. Their
Effects are respectively f0ZSaPV1ok6kObSHWg5vKA (two emitters, one follows the
emitter) and vWi4xUfpZU-qP-UY8aPdLA (one trailing emitter). This means mesh-only
observations do not establish the visible weapons' frame cadence.

Read-only native-path probe in Steam constructed an unregistered Projectile with
no imgObj, an offstage native display quad, and a separate scene accumulator.
At fractional tick times 0,5.5,11,16.5,22,27.5,33ms, its renderX advanced
100,103.63,107.26,110.89,114.52,118.15,121.78; renderY advanced
200,199.34,198.68,198.02,197.36,196.70,196.04. hasRenderPosition stayed true.
Course remained (100,200,time=1234); the probe never entered the live manager.
The display was disposed afterward. This verifies the actual installed no-image
getter/prediction path sampled by EmitterTargetPose, without firing or touching
live simulation. It does not prove authored effect emission cadence or bouncing
trajectory corrections in a real shot; those remain open observations.

### Bouncing contact observer and typing pass

Compared original Bouncing.execute with Haxe build 564: target retargeting,
integer convergence fractions, heading updates and collision branch order remain
native. No movement correction override was introduced; changing the integer
fraction would be a gameplay change rather than a missing port.

Removed Raw and ad hoc class lookups from ProjectileContacts. Added central
Bouncing binding and reviewed m/p/isEnemy/execute signatures. Unit, Projectile,
ProjectileStuck and ProjectileBullet use existing central bindings through typed
GameReflection hooks. DamageObserver's installer now accepts GameScene, and
nullable projectile weapons are explicitly excluded from contact reporting.
Tests bind class fixtures before installation, matching production bootstrap.

All 15 damage-observer/contact tests pass, including copied native collision
bodies: trajectory, hit count, destruction/explosion returns, piercing, bomb
attachment, rejected candidates, exception recovery and hook unload. Typecheck
and public/private builds pass. This does not resolve observed conc-sphere
visual travel; it confirms this observer retains native simulation behavior.

### Incoming contact/history typing pass

Removed Raw/read/ad hoc lookups from IncomingProjectileContacts. Native Ship,
PlayerShip, Projectile, beam and bullet/bounce/stuck classes now use central
bindings with typed GameReflection hooks. Added Beam and Damage bindings and
reviewed weapon ownership/target/timing/damage fields, Damage.type/dmg(), and
MissileStuck scene ownership. Player history extension has an explicit optional
weapon-recording signature. Scene exit uses the native get_isLeaving getter;
player/owned-unit/healing exclusions and collision-only attribution are retained.

NativeIncomingHistory's scene argument is typed, and fatal-message dispatch uses
GameReflection.bound instead of reaching through untyped Haxe closure internals.
Eight focused tests pass: beam fire ticks, duplicate contact prevention, mirror/
owner exclusions, history age/ambiguity, pooled lifetimes, wall attribution and
unchanged fatal packets. Typecheck and both builds pass. This does not establish
all incoming weapon families or actual death-screen interaction parity.
Public/private deployment hashes validated. Real Steam reload completed with game,
chat and radar present and no fresh client errors, covering installation of both
new typed contact adapters. No death or combat was induced for this smoke check.

### Unique artifact drop visibility port

Source Drop.addToCanvasForReal scales every unique-artifact emitter's startSize,
finishSize and integer maxParticles by 1.5. Current Haxe retains the unique color
change but omits this scaling; no existing port hook supplied it. Added a typed
native hook applying the source scale to newly created effect groups only.
Repeated addToCanvasForReal calls do not compound it; culling/re-entry with a new
group still applies it even when the emitter pool reuses object identities.
Ordinary and expired drops retain native behavior.

Four focused regressions pass: unique/ordinary/expired/new-group ownership,
normal drop expiry/movement ordering and frame prediction independent of pickup
simulation. Typecheck and both builds pass. Game.draw already calls visible Drop
instances every display frame; DropFrames matches the original per-tick speed
prediction. No claim of real homing/drop-pickup cadence is made without observing
an actual moving drop. Unique-loot encounter appearance remains unobserved.

### Drop pickup and native draw follow-up

Compared original DropManager tryBeamPickup/tryPickup/dispose with build 564:
tractor pickup's 2000ms deadline extension, queued retry bookkeeping, successful
pickup removal and reset/disposal order remain supplied by native code. No
replacement was needed for these reviewed methods. This is source inspection,
not a live inventory/pickup transaction test.

Native Steam draw probe: constructed an unregistered Drop with an offstage native
quad and a separate scene accumulator. At 0,5.5,11,16.5,22,27.5,33ms, both displayed
and get_renderX positions progressed 100,101.5,103,104.5,106,107.5,109; Y progressed
200,199.5,199,198.5,198,197.5,197. Simulation position stayed (100,200), speed stayed
(9,-3), and the drop never entered the live drop manager. The temporary display
was disposed and its native beam line returned through Drop.reset. This proves
the installed native draw/getter path follows fractional frames without writing
pickup state. Actual homing loot in flight remains unobserved; this controlled
probe does not claim a full end-to-end pickup verification.

### Live mission-screen review

Opened the native MissionsState in Steam. Timed rows show readable descriptions,
reward icons/counts and horizontal XP values, including boosted XP; the previously
reported one-character-per-line reward failure was not reproduced. Daily rows
show rewards and progress bars. Story was empty; inspected player data contains
three missions, all majorType=time, so no story content was expected for this
account. Daily and Story both accepted Enter into focused chat and Escape back
out without sending. Closed through native MissionsState.close and confirmed
RoamingState. No claim, skip or purchase actions ran.

Saved Daily and Story screenshots outside the repository under
/home/raony/Documentos/astroflux-port-audit/runtime/missions-{daily,story}-steam.png.
The initial Daily-tab probe assumed the HUD button callback interface; native
mission tabs differ, so navigation was corrected to the inspected MissionsState
show method. This was a probe error, not a client hook failure. Existing mission
completion-description and viewed-message adapters were source-reviewed; reward
claim animation and populated Story layout remain unverified.

### Daily login reward adapter typing

Replaced Raw/read/ad hoc reflection in NativeDailyRewards with central native
DailyRewardMessage/DailyRewardChild/Image bindings, typed Text fields, and native
position/size/stage/padding getters. Reviewed native constructor field ownership
and Text.format/defaultTextFormat types. Preserved the already-ported source
layout and early-base-constructor guard; reward callbacks remain native.
The real host dispatcher regression passes for all five highlighted days,
amount/icon centering, optional pod fields, expanded-card redraw and repeated
redraw stability. Typecheck and both builds pass. No login reward was claimed
or synthesized by this test; actual dialog screenshots remain separate evidence.

### Hot-toggle cleanup ordering and room refresh (Steam)

Reproduced a lifecycle failure that was hidden by the old room retaining some
patched objects: after disabling/enabling from Plugins, the next `/ref` produced
native-sized chat without the overlay keyboard hooks. The page timeOrigin and
client resource requests were unchanged, so `/ref` was not reloading the plugin.
Inspected the host's actual callback scopes: the active plugin had
classesInitialized=false and its main room scope contained zero cleanups. Host
diagnostics showed a native SettingsState.resize get_width failure after its
ported background had been disposed. Readiness-replayed global cleanups were
running before the room scope was closed.

Fixed the host Scope lifecycle in AstrofluxClient-Port/public/plugins/core.js:
room scopes are owned children and dispose before parent/global cleanups. Closed
children remove themselves from the parent's ownership set. Added a regression
that failed with the prior order and tests for room cleanup failures, release of
ownership and idempotence. Host suite: 38 passed, one supplied-bundle fixture
skipped. Deployed only the host core module, preserving the production relative
client URL, and reloaded Steam once to install it.

Live verification after the fix: disabled QoLAF from Plugins, opened empty native
chat (400x25 in both display and DOM), closed it, and enabled QoLAF again. The host
reported an active plugin with no diagnostic entries. Ran local /ref: timeOrigin
and private client resource request list stayed unchanged; new room retained
QoLAF chat hooks. Enter focused chat over Settings, Escape closed it; expanded
artifacts hid the log and prevented chat focus. Closing artifacts restored the
log and RoamingState. No server chat messages or inventory transactions were sent.
This verifies the tested hot-toggle/refresh path, not every hook's unload safety.

### Live emitter cadence after the loader lifecycle correction

Compared current EmitterFrames emission, partial-frame birth age, particle motion,
friction and target position paths with original core/particle/Emitter.as and
EmitterManager.as. The elapsed-time path is installed on display-frame parallax
updates and the old manager tick update is suppressed for the active room.
Native Engine render getters override the generic GameObject getters, so engine
mounts read the rendered ship transform rather than its simulation position.

Read-only Steam sampling: 541 requestAnimationFrame samples over 3002ms. Player
idle/normal/crystal thrust, Nexar bomber thrust and bomb explosions advanced
particle lifetimes on every comparable sample. A separate 3003ms/541-frame probe
also compared particle x/y/scale: idle thrust changed pose on 540/540 comparable
frames; observed HardenedShield, Nexar bomber thrust and bomb explosions likewise
had zero unchanged comparable pose samples. This rules out a blanket 33ms
particle-update cadence in this running session, but does not establish the
appearance or travel correctness of every weapon. The accompanying four-second
projectile sample observed only stationary Blastwave objects; conc spheres and
plasma travel remain unverified. No weapons were fired or gameplay state changed
by these probes. Helpers are under /tmp/qolaf-steam-check/emitter-{motion,pose}.mjs.

### Death/respawn review and typed death-message boundary

Compared original Killed.as with current upstream Killed.enter/execute/exit and
Respawn.ts. The upstream build already owns filter disposal on exit, survival
life labels, countdown and native manual respawn; these were not replaced.
Existing measured XP/teleport spacing and automatic-respawn adapters retain their
focused regressions. Actual death-state interaction remains untested here; no
ship was deliberately killed.

Converted NativeDeathMessages to central MessageLog/Localize bindings and typed
GameReflection hooks. Reviewed the native writeDeathNote Player parameter and
writeChatMsg's optional sender fields: upstream itself calls writeChatMsg with
only channel/body for death notes. Updated the generated declaration contract.
NativeChatPresentation now normalizes missing sender metadata to null and only
answers echo requests carrying a player ID and name. It retains the delivery
context locally across nested callbacks. Added tests using the extracted native
writer for sender-less death/system rows and tests for deterministic death-note
selection, getter-backed player names, HTML escaping, fallback to newer upstream
weapon causes, Nexar spelling and hook removal. Twelve relevant tests passed;
typecheck and public/private builds passed.

Follow-up hot-unload edge case: re-opening Settings can leave an older Settings
instance in the native state's return history. A later hot-disable invoked the
ported close/revertState path and tried to re-enter that disposed UI; native
resize then read its cleared bg. This is separate from the host scope-order fix.
Added typed SettingsUnload: when the active room is not leaving, the currently
owned Settings screen transitions to a fresh RoamingState or the native landed
entry point. Inactive/retired settings instances and room teardown do not trigger
navigation. The regression rejects history re-entry and covers flight, landed,
leaving and inactive cases. Typecheck and 13 focused tests pass.

Live follow-up: after deploying the SettingsUnload change and reloading Steam,
opened Settings twice, disabled QoLAF via Plugins, and confirmed RoamingState with
native 400x25 input and no host diagnostics. Re-enabled from native Plugins;
main session hooks returned (12 frame subscribers), the record was active with
an empty error field and host diagnostics remained empty. Closed Settings
normally and confirmed RoamingState. Public/private deployment hashes were
`dde0c4bba87d4c3086ce4b2e825fde8e0a56f85d329cfff76bb2641d597b2049` and
`8d0dcc986782a77c60c3c6c264b92d3486decb657df3e628b73109dd7ff38cad`.

### Chat availability across native screens; classic artifact correction

Live Steam pass opened Map, Ship, Cargo, Leaderboard, Clan, portable Hangar and
portable Upgrade. In every case Enter opened focused chat with the log visible;
Escape closed chat without changing the underlying screen. Drafts stayed empty,
no chat messages were sent, and no equipment/purchase/upgrade action ran. Returned
to RoamingState after each screen. A separate classic-artifact probe failed:
chat remained hidden and could not focus, contrary to the explicit requirement
that only expanded artifacts suppress chat.

Root cause: ArtifactMenu.enter added the game to expandedGames unconditionally,
before deciding whether the overview was expanded or classic. Moved membership,
log visibility and closing active chat into rebuild after view.expandedView is
resolved. This also handles switching views and forced classic layout while
landed. Regression now checks expanded blocks/closes chat, classic preserves it,
landed classic remains allowed even with the expanded preference enabled, and
exit clears membership. Focused tests, typecheck and both builds pass.

The multi-screen pass also exposed stale cleanup after whole-menu removal. Native
MenuHud.close calls unload, but navigating through Game.enterState can remove the
menu without invoking ArtifactState2.exit. ArtifactMenu now releases its overview,
listeners, expanded-chat membership and session record on removedFromStage as
well as native state exit. A regression removes the whole menu and rejects any
later unload navigation through its stale close callback.

The same hot-disable trace found a clan tooltip already disposed by native group
cleanup. NativeClanLogos still retained its reference and called non-idempotent
native ToolTip.dispose after the generic client tooltip hook had been removed.
Its owner cleanup now checks the native target before disposing; a test models
native group cleanup followed by plugin unload and rejects a second dispose.

Live final verification of this batch: classic artifacts allowed Enter/focus and
kept the log visible; expanded artifacts blocked Enter/focus and hid the log.
Both returned to visible chat in RoamingState. Repeated the seven-screen chat
pass, then disabled QoLAF from Plugins. The stopped record had an empty error
field and the host diagnostic list remained empty, including after visiting the
clan page and removing artifact menus through screen navigation. Public/private
hashes: `42665b6482e05d9eda4ee0226ad4579335caf8e4e122d3b3c0ffda2c8f459444`
and `7d7495b7e4d09897e6421d27ff6de0901cdd0929468c4868ac723e300c214a90`.

### Test evidence refresh after loader and screen fixes

Ran the complete current suite: initially 904/908 passed. InitializationFailure
expected a later missing ServiceRoomSelector, but the evolved binding registry now
fails first on FragmentFilter; the test explicitly omits that first class and
still requires a single reported failure, no target/session attachment and no
font mutation. LocalClientCommands expected obsolete /ref help; its assertion now
includes /upstream and explicitly preserves both the Service connection and loaded
plugins, matching the user's room-refresh requirement.

Copied the current host public/plugins/core.js into the shared HostCore fixture;
no production behavior was stubbed or bypassed. Re-ran the complete suite against
that dispatcher: 906 passed, two existing fixture failures remain (Integration
and excluded NativeRadio). Output: /tmp/qolaf-suite-current-host.log. This pass
changes verification evidence and stale assertions only; no new bundle deployment
was needed. A passing fixture subset is not a full-client parity sign-off.

### Target selection and nearby-row semantic review

Compared original qolaf/target/TargetSystem.as and TargetInfoElement.as with
TargetSystem, TargetPicking, NearbyTargets and TargetPresentation. Reviewed:
0.5-second selection cooldown; forced selection versus locks; validity and strict
range boundary; player/group priority; hostile/AF exclusion; pooled lifecycle
invalidation; multipart boss identity deduplication; sorting by group, player,
boss, level, distance and native ID; 0.25-second nearby snapshot refresh; boss
aggregate health with no component shield; obscured hostile-player stats outside
the same group. The reviewed paths match source semantics. Native group getters
are used instead of assuming AS3 field access. Nearby row touch-end selection
also matches the source; no independent radar auto-selection call was found.

Read-only live Steam probe: 901 display-frame samples over five seconds, one
valid hostile within 1000 units at completion, zero current-target changes and no
lock mutation. This supports the idle-nearby case only; it is not proof of every
combat/hit-selection transition. Current focused tests for personal/pet hits,
foreign/healing exclusions, range/hostility changes, pooled reuse, group getters
and row snapshot ordering were included in the preceding 906-pass suite. No
production change was justified by this review.

### Typed artifact-menu lifecycle

Removed Raw/any/read/ad hoc class lookup from ArtifactMenu. Added central bindings
for ArtifactState2, DisplayState and MenuHud; reviewed native owner fields and
methods for DisplayState/DisplayStateMachine/MenuHud, Starling stats access,
RymdenRunt.s and ArtifactOverview.load. Generated definitions retain native field
ownership. Session records now explicitly own native menu/stage/stats/quad
instances and a typed overview extension for the client layout fields. The
MenuHud parent is checked through GameReflection.cast; coordinates, visibility,
alpha and stage dimensions use native getters. Existing behavior for classic,
expanded, landed, whole-menu removal and cleanup is preserved. Updated the
fixture to expose the same native getter/binding surfaces. ArtifactMenu tests,
typecheck and Public/Private builds pass; no Raw/any/api.cls remains in this adapter.

### Steam chat overlay validation and Settings hot-enable listener cleanup

Chat is available on every gameplay screen except the expanded artifact view.
Fresh Steam checks passed for Settings, map, ship, cargo, leaderboard, clan,
portable hangar/upgrade and classic artifacts: Enter focused chat, Escape closed
chat without closing the screen, and no messages were sent. Expanded artifacts
kept chat/log hidden; leaving restored them. Actual death was not induced; its
independent keyboard route is covered by the focused regression.

Hot enable previously rebuilt an already-open native Settings state while its
pre-hook Haxe resize closure remained registered. The next disable restored native
resize against the replacement's disposed background. Before re-entry, remove
only callbacks belonging to that state's Haxe closure cache. Preserve other
owners and remove duplicate registrations. Typecheck, both builds and five focused
tests pass. Public/Private deployed; two disable/enable cycles in Steam finished
with active client and empty host diagnostics.

### Emperor observation/status source audit

Compared EmperorRadarTelemetry and EmperorReadyNotifier with original
core/hud/components/radar/RadarTelemetry.as and core/ipc/EmperorReadyNotifier.as:
Argon arena bounds, three row names/order/icons, ready HP thresholds, freshness,
natural Xhersix visibility/server target, 750-unit Yhgvis/Zharix range, ten-second
reconstruction, stale expiry, and victory-after-removal semantics agree in the
checked paths. This does not establish full encounter parity.

Migrated EmperorReadyNotifier off Raw/read and runtime class lookups onto
GameScene/native getters, typed ObservedEnemy metadata and central MessageLog.
ObservedEnemy documents optional metadata when hooks are disabled; observation
code still never changes vanilla HP/shield/AI behavior. Runtime Steam confirms
native getters, array enemy storage and string room ID; current system Fulzar,
so no claim of live Emperor rows/encounter verification. Added notifier lifecycle
tests covering observation restrictions, reconstruction expiry/end, stale state,
handler cleanup and one victory after actual trio removal. Ten focused tests,
typecheck and both builds pass.
Public/Private deployment completed. Steam hot-disable/enable loaded the updated
client with active record and empty host diagnostics; returned to connected
RoamingState. Emperor encounter verification remains outstanding.

### Reconstruction already active at hot enable

Found and fixed an initialization gap in EnemyObservations: a native AIResurect
entered before hook installation was initially classified as not reconstructing.
Seed new observation metadata from StateMachine.inState(AIResurect), using class
identity because native AIResurect.get_type() incorrectly returns AITeleport.
Do not fabricate a start time or restart the ten-second counter. The notifier
immediately discards stale ready reports while the authoritative reconstruction
has an unknown start, then resumes observations after its native exit. No vanilla
AI/HP/shield state changes. Regression covers pre-hook reconstruction, unknown
start, ready suppression, native exit and pooled reset. Eleven focused tests
passed before the final immediate-invalidation assertion; all four affected
observation/notifier tests, typecheck and builds passed after it. Steam native
class-only probe confirmed type=AITeleport, string match=false, class match=true,
without entering the synthetic state or replacing any live enemy state.


### Room refresh and server endpoint lifecycle

Steam /ref kept performance.timeOrigin and every client-bundle resource entry
unchanged, rejoined with chat/radar initialized, and produced no new exceptions.
This follows the user's explicit override: /upstream also refreshes the room;
only /restart reloads the launcher/plugins, unlike the older AS3 upstream alias.

Found /serverip lost Service endpoint observations after hot enable while Service
stayed connected. Preserve the per-SDK WeakMap using a symbol, leaving constructor
and send hooks fully removable. Unrelated SDK instances do not share records;
never-observed connections remain unavailable and disconnected ones are hidden.
Regression covers retention, isolation, unhooking and extracted real-SDK fallback.
Eight focused tests, typecheck and Public/Private builds pass. Private implementation
is excluded from Public (public bundle hash unchanged). Deployed; fresh Steam
reported Service and Game gsp5.playerio.com, and both remained available through
a hot-disable/enable. Host diagnostics empty and client active. This is selected
transport hostname reporting, not a guessed IP or DNS lookup.

### Attached-projectile render state on hot enable

Compared source Projectile.draw/renderState.draw and drawAttachedTo with the port.
Found that the attachment WeakMap only captured enter() after installation, so a
projectile already stuck to a host at hot enable omitted full-frame host anchoring.
Adopt native currentState on draw for MissileStuck/ProjectileStuck, without calling
enter() or changing physics. Track retired states because native StateMachine's
exitCurrent deliberately retains currentState; exit/reset must not re-adopt it.
Generated Projectile.stateMachine and StateMachine current/previous types now use
the native StateMachine/IState contracts. Regression starts with an already-stuck
projectile, checks rotated rendered host coordinates and fractional missile
correction, then verifies retained-pointer exit and pooling. Twenty-four affected
rendering tests, typecheck and both builds pass. Current Steam sample contained
only Blastwave projectiles: attached/conc/plasma live visual proof remains open.

### Repeatable live Steam integration gate

Added `npm run check:steam` using the running Electron CDP endpoint (9228 by
default; QOLAF_CDP_PORT overrides it). Default mode only inspects readiness,
current-room host ownership, active qolaf.client identity, plugin-record errors
and hook/initialization diagnostics. `-- --refresh` opts into native Game.reload
and asserts a replacement connected Game with identical page timeOrigin and
client-bundle request history. `-- --screens` checks chat focus/log visibility
and Escape behavior for Settings, map, ship, cargo, leaderboard, clan and both
artifact layouts. It restores gameplay/layout preferences and never sends chat
messages or overwrites a user draft. Both optional passes ran successfully in
Steam. These checks cover their explicit lifecycle/UI assertions, not combat
appearance or complete semantic parity.

Re-ran the old Integration.test.ts: it still fails before initialization at
FragmentFilter. Its registry lacks 145 of the 191 required native classes, so
adding a single filter would not repair that fixture. It remains a visible
failure, not skipped or replaced with stub-only passing coverage. The live gate
uses the actual Haxe registry and PluginHost rather than those missing mocks.

### Original gameplay-canvas pointer acceptance

InputManager.as diff accepts Stage or any descendant of Game.canvas. Current
Haxe mouseDown only accepts Stage. The port makes world clips touchable for target
selection, but had no corresponding input hook, so clicking those world objects
could select a target without registering gameplay mouse input. Added a typed
per-session after hook accepting only canvas ancestry, preserving native Stage
handling, activity notification and newer _mouseJustPressed edge behavior. HUD
clicks remain outside that ancestry. No changes to key handling, shield mechanics
or weapon logic. Reviewed the live native Event surface (target field, no getter).
Regression covers nested world clips, Stage, HUD rejection, held/edge reset,
release, single activity notification and unload; existing target lifecycle test
also passes. Generated InputManager mouseDown/flag signatures, typecheck and both
builds pass.
Deployed and hot-enabled in Steam; live gate passed without diagnostic errors.
Synchronous native mouseDown probes verified canvas/world unit/Stage set both
held and edge flags, while HUD sets neither. Restored both flags before returning
to the event loop; no simulation tick, firing or movement was induced. Returned
to RoamingState. This closes the source canvas-input omission, not the remaining
broader input/settings audit.

### Rich input must not mirror typing into gameplay keys

Source InputManager.keyDown explicitly returns when integrated/floating chat has
focus. The browser port only stopped handled navigation/IME keys; ordinary rich
input keydowns bubbled to Lime's window listener. Live Steam reproduced A/W/Space
setting both native downKeys and pressedKeys while the chat input owned focus.
Added a bubble-phase stopPropagation on the rich input itself: same-element
TextEntry Enter listeners/default editing remain available; keyup still bubbles
to release keys held before focus. The shared native bitmap adapter explicitly
records player activity, preserving the original inactivity behavior. Disposal
removes the listener. Twelve targeted tests (composition, clipboard, formatting,
navigation, native Enter, key releases, cleanup/activity) and typecheck/builds pass.
The original InputManager terminal-unload cleanup was also reviewed: ordinary
room dispose intentionally retains the process-wide stage listeners, matching the
single InputManager created by the current native startup; no room-level removal
of those native listeners was introduced.
Deployed/hot-enabled and repeated the live native key-map probe: A/W/Space now
leave down=false and pressed=false while chat owns focus; keyup clears a simulated
pre-focus held key. All maps restored synchronously before gameplay executes.
Live host checks and the eight-screen chat gate pass with no errors.

### Keybinding capture versus integrated chat shortcuts

SettingsKeybind itself matches the original cancel/mouse-binding/listener cleanup
logic, but NativeChatOverlays had no knowledge of its temporary input ownership.
A realistic bubbling DOM Enter probe in Steam opened chat and left the binding
row at Push a Button. Added a stage-scoped weak capture-owner registry: rows claim
on listen and release on key/click cancellation, assignment or disposal; chat
shortcuts defer while capture is active. Chat remains visible, as required. Tests
cover active ownership, cancel/disposal release, mouse binding and chat shortcut
deferral. Typecheck and Public/Private builds pass. Live probes save/restore native
key maps before returning to gameplay, preventing a probe's Enter from becoming
a later gameplay action. No actual bindings were assigned during live checks.
Deployed and repeated the same Steam probe: before=Push a Button, after=W,
listening=false, chatActive=false. Native key maps and saved navigation category
were restored, no key assignment occurred, and the live host gate passed.

### Friend refresh and cargo read queue semantic mapping

Reviewed original FriendManager updateOnlineFriends/onOnlineFriends/
onServiceReconnected against ServiceViews and the current native Haxe detached
callback drain. Duplicate callback suppression, request coalescing, disconnected
queueing, synchronous-failure clearing, callback-error isolation and reconnect
retry are represented. Live Steam read-only probe produced one getOnlineFriends
request and two completed callbacks; no friend relationship changes were sent.

Compared complete CargoReadQueueState against CargoReadQueue: FIFO and 64 pending
bound, request identity, stale/duplicate response rejection, four-field wire reads,
callback release before reentrancy, ambiguous-send fail-closed behavior and
teardown agree. Haxe carries RPC arguments in an array rather than AS3 rest args.
Eight ServiceViews/PlayerInspect regressions pass. Recorded precise review scope
and current source hashes in FullPass.json; unrelated class/UI methods remain
pending. Also mapped the previously verified InputManager fixes as a partial
review rather than leaving that entire source file indistinguishably pending.

Full suite rerun: 915 tests, 913 passed, the same two unresolved Integration and
NativeRadio fixture failures. Three RadarTelemetry fixture regressions introduced
by typed native access were corrected by supplying real get_connected/get_pos
surfaces; their assertions remain unchanged. No failures were skipped. One cargo
cleanup difference remains: original dispose clears sender/current closures, while
TS retains its readonly constructor references. Recorded this as a partial review
and outstanding cleanup gap instead of signing off the entire class.

### Cargo constructor-closure cleanup parity

Resolved the cleanup difference recorded above. CargoReadQueue.dispose now clears
its sender and current-room predicates as well as pending/in-flight callbacks,
matching the original state machine. A retained late-reply closure can still reach
the stopped queue, but no longer retains Game through those constructor fields.
Regression disposes from a response consumer while another request is pending,
checks no second send, no constructor callbacks retained, harmless late duplicate
reply, idempotent disposal and rejection of later enqueue. Eight PlayerInspect
checks pass; state-machine source mapping updated without claiming cargo UI parity.
Typecheck and both builds passed; private cleanup deployed (Public hash unchanged).
Steam hot activation and live host gate passed with no diagnostics. This verifies
activation/lifecycle compatibility, not a browser GC measurement.

### Enemy orbit exit: preserve the in-step render span

Compared original Ship.update/course setter and AIOrbit.exit with the current
Haxe path. Original Ship snapshots its pose before the AI state update and does
not erase it when orbit exit installs a new Heading. The port cleared both render
endpoints on every EnemyShip.set_course, including that in-step transition. At
alpha zero the next draw could therefore show the end-of-step pose immediately.
Extracted the existing history hooks into installShipPoseHistory and scoped an
updating guard with finally cleanup. In-step heading changes retain their start;
out-of-step set_course/initCourse and pooling still clear stale endpoints. No
vanilla AI correction, velocity blending, lead, or state transition is replaced.

Regression uses the real host hook dispatcher, a heading replacement during
update, multiple alpha values, relocation/initCourse/reset and a throwing native
update. Twenty movement/interpolation/boss checks and TypeScript check pass;
Public and Private builds pass. Before this patch a six-second Steam observation
sampled 1,081 frames and 13,058 enemy frame pairs, including network correction
packets; maximum observed displacement was 2.65 units per frame. This sample did
not reproduce a large snap or observe an orbit course replacement, so it is not
proof that every reported motion issue is resolved. Multipart boss live encounter
verification remains pending; existing synthetic tests cover root/mount poses.

Deployed both builds and hot-activated in Steam. Live host gate passed without
plugin diagnostics; returned to RoamingState. Follow-up six-second capture had
1,080 frames and 12,938 enemy frame pairs with maximum displacement 4.05 units.
Different units/corrections were observed, so these captures are compatibility
checks, not a controlled before/after speed or smoothness benchmark. Neither
capture included set_course; the orbit boundary fix is covered by the regression.

### Multipart drawing and turret cleanup follow-up

Compared BossComponent.draw/update/reset, Spawner.draw and Turret.draw rotation
branches with the original source and current BossFrames adapter. Extended the
real hook-dispatcher regression with a translating/rotating root, nonzero mount
and effect offsets, component spin across a full turn, forced independent turret
aim, spawner angle offset, five alpha values, repeated frames without bar drift,
and pooled component/turret reuse. Five boss tests pass. Also re-read original
Turret.destroy/disposeWeapon and current WeaponLifecycle: retained rebuildable
weapons stop firing; terminal removal clears ownership before destruction.
Both lifecycle tests pass. Corrected stale missing cleanup finding in FullPass
and added scoped partial source mappings for the three multipart classes.

Read-only live observation found an active multipart boss in Steam, but all its
parts were off-screen (zero isAddedToCanvas samples). In 541 frames, clips did not
move while their logical root did; stale clip/mount differences of ~2454 units
are therefore not evidence of a visible interpolation failure. This observation
cannot verify actual on-screen boss motion. Do not count it as visual parity.
No runtime source change or deployment was needed for this audit batch.

### Reconcile stale missing-feature findings with current adapters

Spawner baseline comparison, after decompiler-local identifier and annotation
normalization, found addTurrets/destroy/rebuild identical to vanilla. The custom
update delta removes fixed-tick damage/heal position and rise writes, moving them
to the rendered attachment path with damage/heal anchors -25/-10. Existing
CombatTextFrames owns those render positions; no spawner gameplay rewrite needed.

Checked the seven remaining explicit `missing` findings against current source,
entrypoint/session installation and focused tests: PlayerClanLogo, PvP roster
retry, radar miniatures, resource ET batch, pod recovery, turret manager, and
weapon manager. These adapters now exist; old statements saying no adapter exists
were stale. Replaced them with `implemented-partial-verification`, exact paths,
test mappings and outstanding limits. Eighteen focused tests pass. PvP retry
logic was also compared against original requestPlayersIfNeeded and response
reset behavior. Other classes remain partially reviewed, not fully signed off.

No real currency/resources/pods were spent, no multiplayer messages were sent by
this test batch, and no visible boss/miniboss encounter was claimed. Removing a
stale missing label is not completing the broad audit: pending/partial source
reviews and live visual checks remain. No runtime source change or deployment.

### Initial join guards and game-handler callback ownership

Compared initial network readiness and abandoned-scene guards with original
SceneBase.onClockReady/observeGameJoinResponse/abandonUnreadyGameConnection and
current GameRoomJoin's separate network/world deadlines. Four new regressions
cover clock/sync ordering, unrelated packets, late replies after abandonment,
network-ready but unrevealed world timeout, revealed/leaving exclusions and
watcher replacement ownership. These pass without changing readiness behavior.

Found a port mismatch in GameMessageHandlers.removeMessageHandler: it selected
the latest dictionary wrapper for a message type, ignoring the supplied callback.
Current native Haxe removes the specified callback. Since the port deliberately
supports multiple handlers per type, removing an earlier subscription could
remove the later one instead. Now matches original callback or wrapper identity
and retains the latest surviving dictionary entry. Synchronous membership guards
still invalidate removed callbacks immediately; SDK array removal remains deferred
until after dispatch. Two real host-dispatcher regressions cover same-type removal,
removal during live-array dispatch, scene exit and restoring callbacks on unload.
Six focused checks, typecheck and Public/Private builds pass.

Both builds deployed and Steam hot activation completed with an active plugin and
no host diagnostics. The connected-session gate failed: Game and Service sockets
were disconnected, noAutoReconnect was true, leaving/recovery were false. The
probe did not establish when or why the sockets disconnected. Did not clear that
flag or force a reload/reconnect. Live room-refresh verification is therefore
pending; successful plugin activation is not a connected-game pass.

### Service replacement callback ownership and inactivity diagnosis

Live read-only follow-up confirmed idleDisconnected=true alongside disconnected
Game/Service sockets and noAutoReconnect=true. This identifies the inactivity
path; no flags were cleared and the user session was not reconnected.

ServiceMessageHandlers had the same callback-identity mismatch as the Game
adapter: stale cleanup of a replaced callback unconditionally removed the current
subscription. It now delegates removal of the supplied old callback while
preserving the owned replacement dictionary entry. Game handler repeated stale
cleanup likewise preserves the surviving index after the native remover deletes
its dictionary key. Added Service replacement/reconnect/unload and queued removal
regressions; extended the Game test with repeated stale removal. Eight focused
connection lifecycle checks pass. Typecheck and both builds pass.

Full suite: 926 tests, 924 passed, 2 failed. Failure causes remain the incomplete
Integration fixture class registry (first missing class: FragmentFilter) and
NativeRadio fixture's undefined LoginButton base. Neither was skipped or weakened.
Log: /tmp/qolaf-suite-lifecycle.log. Runtime room-refresh verification remains open
because the Steam session timed out for inactivity. This does not establish
connection recovery parity beyond the exercised callback lifecycle.

### Startup cancellation and Service acceptance race

Compared original JoinRoomManager startup Service methods with StartupServiceJoin
and its LoginLoading integration: generation ownership, stale account retries
(two seconds, three attempts after the initial attempt), candidate disconnection,
terminal duplicate-login/kick handling and post-commit ownership are represented.
The new Haxe session join field and native Service ping remain preserved.

Added a regression that accepts a socket, captures its queued joined/error
callbacks, cancels it, accepts a second attempt, and delivers the old callbacks
before and after the new handshake. Old callbacks cannot publish a connection,
show an error, start ping or repeat initialization. Deferred listeners are removed
and cancelling the attempt controller after commit leaves the published socket
owned by the new session. Fifteen login cancellation/provider/status/teardown/
startup checks pass, plus typecheck. No runtime mismatch found in this scoped
pass; no deployment needed. Actual interactive login comparison remains open.

### Receipt proof audit and literal reward/login notice text

Compared BuyFlux.preparePaypalReceiptCheck/prepareFluxAnnouncement and the
complete PurchaseNotice helper against PaidReceiptWatcher/NativeFluxNotices.
Baseline-before-checkout, provider receipt/amount/item filters, timestamp floor,
bounded twelve reads and login-bound reporting are represented. No payment was
initiated or finalized; existing receipt/callback tests exercise this offline.
Legacy Facebook/Kred native purchase methods are absent from the current Haxe
client and were not reintroduced.

Found an actual formatter mismatch: PodRewardNotice.escape did not encode square
brackets, while original ChatPrivateDiagnostics.escapeHTML does so explicitly to
prevent MessageLog role/color markers inside user/item text. Added bracket
escaping, source apostrophe entity and encoded-size budgets (700 for name, 1000
for label) to pod/purchase/rare-artifact formatting. The shared sender/error text
helper also now preserves literal brackets. Added exact markup and entity-bound
regressions.

ClientLoginNotices now uses GameScene/Client/MessageLog bindings and typed queued
rows instead of Raw/read/ad hoc class lookups. It uses the same escaping with the
original 180-character encoded budget, replacing its old pre-escape slice. Added
local-only fixture coverage for identity matching, same-login deduplication across
new Game instances, changed login tokens, formatting and listener cleanup.
Thirteen focused checks, typecheck and Public/Private builds pass. No actual
notices were sent to game/chat services. Live account/purchase presentation still
needs verification; this review does not sign off every credit screen.

### Zoom filter raster resolution: requested versus displayed scale

Found a concrete cause for the reported low-resolution textures persisting after
zoom-in. ZoomFilterCache used camera.get_zoomFactor(), which native Haxe returns
as the destination _zoomFactor. CameraMotion eases _stageContainer.scaleX/Y toward
that value over multiple rendered frames. Thus the filter could rebuild once at
an early small scale, then never rebuild at the final full-size transform.

The render hook now uses the displayed stage-container scale (target fallback
only before a container exists). Added a real host-dispatcher regression keeping
the requested zoom fixed at 1 while the displayed scale moves 0.25/0.5/0.75/1;
each raster is rebuilt and settled scale stops rebuilding. UI targets outside the
world remain excluded. Ten camera/culling/zoom tests, typecheck and both builds
pass. Read-only Steam inspection confirmed attached body filters are cached and
their targets are inside game.canvas, so the adapter targets the actual filters.
No connected-session visual zoom comparison was possible after inactivity timeout.

Also compared Body.updateIsNear to BodyVisibility: camera-centered distance,
view-size revision, sprite/zone radius and hidden/boss exclusions agree. Camera
and culling tests cover enclosing effects, portrait bounds and invalidation across
intervening frames. Loaded suns had image objects, but the stopped/off-screen
session does not prove visible sun rendering; keep that encounter check open.

### Body culling leaves an attached bitmap in current Haxe

Compared Body.removeFromCanvas with the original and native Haxe. The original
calls GameObject.removeFromCanvas before nulling canvas. Current Haxe nulls it
first; GameObject checks canvas before removing the bitmap, so the body becomes
logically culled while its clip can remain attached. Added a post-native repair
scoped to a previously attached body whose same clip remains in its old canvas.
No filter disposal, effect cleanup replacement, or new gameplay behavior.

Confirmed before deployment using actual Steam Body/GameObject/Sprite classes
with an off-stage disposable body fixture: markedRemoved=true,
clipStillAttached=true, children=1. The fixture was disposed immediately and did
not touch gameplay bodies or send any network messages. The current room itself
had no stale attached clips at the snapshot time; this is a reproducible lifecycle
path, not a claim that every visible texture issue came from it.

Regression repeats cull/re-entry three times, verifies sprite detachment,
reusable filter ownership, unrelated children, and repeated removal. Eight
body/camera/cache checks pass and typecheck passes. Existing CameraView fixture
now includes the native removal surface needed by this adapter; assertions were
not weakened. Both builds pass.

Deployed Public fb628c5c83a4d707b976a082a00b3b18cd9f24b3e1f76f898b8bd88c0a3df0b2
and Private 01832970ceee71f217535ef627958fa752c57259709d42562922eab7483785be.
After Steam hot activation, the same disposable native-class probe returned
markedRemoved=true, clipStillAttached=false, children=0. This verifies the
removal repair in the actual Haxe runtime without reconnecting the idle session.

### Chat above newly opened screens: first-frame ordering

Audited original Killed enter/execute/exit and MessageLog.writeDeathNote against
Respawn and NativeDeathMessages. The automatic-respawn branch, native readiness,
survival exit prompt and death-variant selection remain covered by focused tests;
this is not a claim of a fresh connected death encounter.

Found and reproduced an overlay ordering defect in NativeChatOverlays: moving the
log to second-last before moving input to last lets the second move shift the log
under the newly opened overlay. Reverse the move order (input, then log), keeping
both above the overlay in the same frame. New adapter regression failed before
this change and passes afterward, repeats three successive overlay openings,
checks leaving-session inactivity, and checks hot-unload visibility/order restore.
Seven focused chat/death/respawn checks and TypeScript validation pass.
Expanded artifacts remain the sole screen-specific exclusion.

Both builds deployed: Public
0d2f1de1714630b3e0d68874567bba642b9c115fbc08824f8b799ceedcc464cf,
Private 6a7f396f44e649fb4330bf4c5953af7c9ffa1f906a75f2588017a174227fe417.

### Typed native death attribution

Compared Player.deathMessageWeapon/recordDeathLineContact/enterKilled and Killed
with NativeIncomingHistory. Explicit causes win; wall attribution requires local,
recent matching contact; the fatal packet remains unchanged for native analytics.
Migrated the adapter from Raw/read/dynamic class lookups to central Bindings,
typed player/ship WeakMaps, typed SDK fatal-message scope and typed temporary
IncomingPlayer methods. Killed.m and Damage.TYPE_HTML now have concrete declarations.
A recycled weapon without a source unit is ignored without erasing prior evidence.
Native Steam reflection confirms every getter used exists in its loaded classes.

Updated the old fixtures to expose actual native getter shapes and distinct
fallback classes (sharing one fallback prototype incorrectly mixed hook owners).
Nine incoming-history/projectile/death-note tests pass, including a getter-only
weapon/source and null retired source, explicit-cause precedence, pooled reuse,
landing cleanup, fatal packet identity and original analytics cause. TypeScript
validation and Public/Private builds pass. Connected death encounter remains
unverified; this session was previously disconnected for inactivity.

Deployed Public 64cdc3e257baf880b73ffc20c6dd167d980400d4cf36a1ad357bafa02ebd291d
and Private 66a210e11eef0bee7f427568debf175cfd9bde16c6296f904cd779a299a35288.

### Broader validation after chat and native death-attribution changes

Full suite rerun: 933 tests, 931 pass, 2 fail (output retained locally at
/tmp/qolaf-suite-current.log). Existing failures remain explicit: Integration's
old registry cannot bind FragmentFilter and other current required classes;
NativeRadio does not initialize the central bindings before creating LoginButton.
No tests were removed, skipped or loosened to report a green suite.

Added `node scripts/check/Steam.mjs --initialization` for a separate read-only
runtime gate. It validates every reflection.require class named in Bindings.ts
against the actual loaded Haxe registry and checks the real plugin host's current
scene ownership, active client, record errors and diagnostics. It asserts no page
reload or new client-bundle request occurred. This mode rejects --screens and
--refresh, and reports initialization-only plus actual connection status; the
normal gameplay gate still requires a connected game.

Actual Steam result: all 191 required classes present; one active client; current
scene ownership; no hook/initialization errors; no bundle request or page reload.
connected=false, SettingsState. This is useful native initialization evidence,
not a replacement for either the failing fixture or connected gameplay/screen
checks. The session was not reconnected and no messages were sent.

### Map live-miniature source reconciliation

Read the complete original MapLiveMiniature (including internal part), MapBoss,
and MapMiniboss plus Map.syncBosses/hasBoss/syncMinibosses/hasMiniboss. The port
consolidates the two trivial wrappers into shared miniature/controller classes;
the missing candidate mappings were audit omissions, not missing implementations.
Updated four FullPass entries with exact method scope and adaptation details.

Verified animation/tint/pivot/alpha/mirrored scale; interpolated pose and offscreen
fallback; multipart offsets and Advectorian scaling; explosion versus dead hull;
ID-map identity and generation-based reuse; late textures/component ordering;
marker/filter disposal without disposing borrowed game textures. Haxe's single
glow substitutes for the source one-filter FilterChain. Twelve focused map tests
pass, also exercising navigation, player-marker and pooled-line cleanup. No new
runtime change was necessary for this compared scope. Other Map methods and
visible connected boss-map behavior remain unverified, not marked complete.

### Map navigation source audit and native getter boundary

Compared original Map centerOnPlayer/activateGeometry/applyView/centerView,
isPanning/isNavigating, touch/wheel handlers, attach/detach and cancelPan against
MapNavigation + NativeMapNavigation. Pointer anchor, four-pixel threshold, cancelled
child end-event suppression, background double-click recenter, per-map geometry,
wheel focus/viewport ownership and local zoom range/factor are retained.

The wheel guard depended on game.isLeaving compatibility property. It now takes
GameScene and uses native get_isLeaving(). A getter-only regression failed before
this change and passes afterward; actual Steam DOES currently expose both forms,
so this is an alias-dependency correction, not an observed deployed input failure.
Ten focused map checks plus typecheck pass. Full Map.as parity and live connected
map gestures are not claimed complete.

Deployed Public 3a4d2b00b103688e4e9d2d710b4ad5e9fc56534d3e18fe0e6cc7735672fb776a
and Private dd06ea8a16c0ee51104bd1707b49736be20fa05ec7ca8c145eaedd5d39e52109.
Steam was not reloaded or hot-restarted for this getter-boundary-only change.

### Echo callback and refresh-command audit

Compared ClientEchoCommand.run and MessageLog's exact echo. branch. Extracted the
/spececho callback into typed runClientEcho in ClientEcho.ts, using native bindings
and getters. Corrected the name budget to 180 encoded characters (matching the
original ChatPrivateDiagnostics.escapeHTML) rather than 180 raw characters before
escaping. Replies follow the same authenticated Client across /ref but cannot
reach a replacement account, leaving room or missing message log.

New tests cover room replacement, changed Client identity, changed connectUserId,
missing/leaving scene, bounded escaped role markers, start/end/error and IPC not
ready. Added command-dispatch regression: /ref, /refresh and /upstream invoke only
native Game.reload with the draft cleared first; command hooks still function;
/restart alone invokes top launcher reload. These are simulated callbacks, not
real room changes or IPC/chat sends. Existing echo. tests cover exact matching,
self exclusion, channel routing and before-team-filter responses. Live refresh
and multi-client echo remain separate runtime verification gaps.

Fourteen focused presentation/echo/command tests pass (the renderer-failure trace
is an intentional exception-cleanup regression). Typecheck and both builds pass.
Deployed Public c0ed542e5c2bc278a3eeaf70919610cfda361a515094a6c93d88de1af7d51388
and Private c9f41826afb6e56d104a9ad78c04f801b61ccc948ab387b5e4f0e44792510173.
Current Steam session was not restarted for this presentation callback change.

### Chat history and autocomplete state audit

Compared ChatInputHistory, ChatCommandAutocompleteModel, ChatCommandSuggestion,
and ChatInputText arrow/Tab ordering. History preserves the draft slot while
browsing, only suppresses adjacent duplicates and survives Game replacement.
Completion consumes friend/emoji/command arrows before history; Tab is cancelled
before synchronous completion; native casing and passive argument help remain.

Restored two model-level source semantics: built-in suggestions are copied at
construction, and the standalone default result limit is eight. The actual chat
popup still explicitly requests 128, as the source does. Regression mutates the
caller array and returned matches to verify model ownership and checks both limits.
The popup fixture now explicitly requests 128 like the runtime; its scroll and
20th-row assertions are retained. Nineteen focused history, completion, friend and
wheel tests pass; typecheck and builds pass. No user-visible list size changed.
Three source audit entries now carry explicit candidate mappings and scope.
Nullable AS3 inputs outside strict TS contracts and broad rendered popup parity
are not marked verified by these model tests.

Deployed Public 2b2758fdb853c878b1e60c5f764d5da79b16c6aafe1d3e7bd116660b1268dd4d
and Private e08ee9350e2385ccf9c259bb0cc13b8911bbfa01e9c45f4b826f624b892f6e1e.
No Steam reload was needed for this model-construction correction.

### Native loot and bitmapless-projectile pose probes

Read original Drop.draw and current captured Haxe Game.draw: game visits attached
drops and projectiles on its display draw path. DropFrames applies original
pos + tick-displacement * alpha after native drawing; projectile placeholders
use course position plus velocity in seconds. RenderPosition explicitly accepts
bitmapless projectile placeholders so following emitters can read their pose.

Added `node scripts/check/Render.mjs`, a disposable off-stage native-class probe.
It does not alter actual game objects, stage children, room state or network.
Both drop and bitmapless projectile draw methods are invoked through the installed
Steam hook chain with fake per-object timing at 60/120/180 Hz samples. Each X/Y
matches prediction, each render getter agrees with the final clip, and source
position/velocity/time stay unchanged. Clips are disposed in finally blocks.
Native Steam run passes all six scenarios, with 2/4/6 distinct samples within one
33 ms interval. This is stronger evidence for installed pose hooks than isolated
math tests, but explicitly NOT live FPS measurement, actual loot pickup, or a
visual Plasma Blaster/Concussion Sphere particle-trail verification. No production
rendering change or deployment was needed in this pass.

### Particle time-step and pool-budget source audit

Compared original Emitter.update/getEmissionTime/getPostEmissionTime/updateTime,
updateParticleCount/drawParticels, ppms and particleLimit with EmitterFrames. Source
steady ppms uses particleLimit/ttl, unlike current vanilla Haxe's authored maximum;
port correctly keeps the source limit-based steady rate. Burst rate remains native
authored ppms. The rest of this compared loop retains delay/end overlap, per-birth
age, fractional friction/central gravity, expiry, pool ownership, uniform indices,
and graphics thresholds. Rainbow columns preserve the newer vanilla behavior.

Added regressions for fractional steady emission across a temporary pool limit
reduction/recovery, expired particle reuse, and burst birth ages under a reduced
cap. Twenty-one focused emitter/frame/target/delay/mirroring tests pass. No runtime
change was warranted for this compared scope; no deployment performed. Live flame
or Plasma Blaster visual behavior remains an open connected-runtime check.

### Enemy correction interval continuity

Compared original Ship.draw/update and course initialization with the port's
sampleShipPose and installShipPoseHistory. Local prediction, remote wrapped-angle
interpolation, landing-tween ownership and authoritative simulation remain separate.
Port intentionally snapshots completed enemy poses so an incoming course mutation
cannot rewrite an already-started render interval (a previously recorded Haxe
adaptation). Out-of-step relocation/initCourse still clears old endpoints.

Extended the actual host-hook regression with a course-position mutation between
ticks: the ongoing 33-to-66 render interval remains unchanged, the next step starts
at 66 and incorporates the corrected completed position 199, and simulation state
stays authoritative. This complements the pure sampling test with hook ownership
and AI heading-replacement behavior. Twenty-two focused interpolation, movement
buffer, correction and replay tests pass. No new production change/deployment.
These fixtures do not reproduce or close the reported live intermittent snap.

### Typed live map-controller boundary

NativeMapLiveMiniatures now uses central StarMap/GameObject bindings and typed
Boss/EnemyShip/GameScene/Sprite ownership. Reconciliation uses the native enemy
get_id and IntMap.h identity, and native layer visibility/stage getters. Typed
Map.g/mapBosses/mapContainer and MapBoss.layer declarations replace dynamic fields
at this boundary. Generation tracking intentionally uses object identity rather
than inventing wrapper objects. The underlying miniature renderer remains a
separate typing task; this change does not claim all map code is fully typed.
Ten focused map tests pass with native-ID fixtures and central bindings.
Typecheck and both builds pass. Actual loaded Steam registry contains the added
StarMap class; no user input or network messages were needed to inspect it.

Full suite: 938 tests, 936 pass, the same two unresolved Integration/NativeRadio
fixture failures (/tmp/qolaf-suite-map-types.log). Deployed Public
275067b439c6f523a31c59e9cc471a9d44bd90e4dfc5b373b6cf53054c30b45e and Private
ea768e89ce6e81a398009401d78425a4132dc9c26ffaa4f9888d9a94ebef4dfb.

Steam hot activation hit two import timeouts from the host's fixed 10-second
Promise.race; HTTP endpoint returned 200 with correct JavaScript MIME and a ~22.7MB
bundle. Neither failed attempt activated the plugin. Recovered without a game/page
reload: awaited one original host importer promise outside that short deadline,
then supplied its resolved module to normal host.load(hot=true), restoring the
importer in finally. Recovery completed active with no new initialization/hook
errors. Historical timeout records/diagnostics were preserved, so the strict
all-history Steam gate still reports those errors rather than masking them.
Native Render.mjs probe passes again after activation. Host import timeout remains
an open reliability issue; no host timeout source change was made in this pass.

### 2026-11-12 — Slow plugin import and cancellation

Host `public/plugins/core.js` used a fixed ten-second dynamic-import deadline, which rejected two previous Steam hot-load attempts while the client bundle was still downloading. Extended the bounded deadline to 180 seconds. Scope disposal now settles a pending load immediately; late module completion does not call `activate`. Native dynamic import itself is not abortable and third-party top-level module side effects remain outside this guarantee.

Host loader tests: 23 passed, including simulated 120-second success, 180-second timeout with late completion, and immediate unload while the network promise remains pending. Full host suite: 41 passed, one skipped, no failures. Deployed core only, preserving the production same-origin default client URL; local and VPS SHA-256: `d7669c99d0b12a2b9625d9d36313029f61b87456ffaa765fc1ebd0e729d82d7b`. Existing game pages retain the previous host until their next page reload; no forced game restart or new live slow-network trial was performed. This does not establish completion of the remaining client parity audit.

### 2026-11-12 — Stopped automatic music must stay stopped

Re-read original SoundManager.stop/internalPlay/stopAll/stopEffects and current NativeMusicPlayback. The pending-effects gap in an older OpenIssues entry has already been implemented through SoundRequestGuard; current tests exercise cancellation by key, service replacement, unload, and completion. Found a separate mismatch: stop(key) canceled the active request but omitted MusicPlayer.allowStop, leaving the automatic resume request alive. Port now calls allowStop before cancellation, matching original stop(key). Regression starts automatic a, stops a, plays manual b, returns to game music: before fix it queued a again; after fix it queues nothing. All 15 MusicPlayer tests, TypeScript check, Public and Private builds pass. No audible Steam comparison performed; remaining SoundManager cache/loading/volume methods still need semantic review.

### 2026-11-12 — Music volume preserves theme ownership

Original SoundManager.musicVolume pauses non-active tracks and uses SoundObject.setPlaybackVolume to cancel fades without selecting a playlist. Supplied Haxe still invokes Playlist.play(Game.instance.solarSystem.key) from set_musicVolume; port lacked an override. Added adapter that writes _musicVolume, cancels object tweens, pauses non-active tracks and applies originalVolume × requested volume through native set_volume. Active channel survives mute/unmute. Added regression with the native setter's playlist side effect; failed before, passes after. All 16 music tests, typecheck and both builds pass. No live audible proof; SoundManager cache/load-error callbacks remain outside this sign-off.

### 2026-11-12 — Sound download failures and retries

Added typed NativeSoundCache with central SoundManager/SoundObject bindings and generator signature overrides. Mirrors original cache queue removal before notification and null completion on ioError/securityError or synchronous load failure. Consumer failures are individually diagnosed so remaining listeners still complete. Unsafe unload detaches listeners, closes in-flight streams, removes owned queue entries and prevents later callbacks. Existing native playback adapters now accept failure null without dereferencing it; precache only reports a successfully loaded sound. Eighteen focused cache/music tests pass, including failure/reentrant retry, throwing listener, late completion, unload, and null playback/precache. Typecheck and both builds pass. Missing-key getSoundObject completion is still outstanding; no live audio/network failure trial was performed.

### 2026-11-12 — Missing sound keys complete their callers

Added typed getSoundObject guard matching original null/unknown-key callback semantics. Cached sound lookup takes precedence over metadata availability, preserving native cached playback. Extended cache test with null and absent keys (two null callbacks, no sound construction) and cached sound with absent metadata (returns cached object without lookup). Eighteen focused tests, typecheck and Public/Private builds pass. Together with NativeSoundCache failure handling this resolves the previously recorded cache failure gap at source/test level; live error simulation remains unverified.

Runtime verification for missing-key batch: deployed Public SHA-256 `582d875d80f210990c81ab7278529cdbae92ce20103d9cdc7fc972c4d02f4b64`, Private `c43715a4ebd34c001222a657cff13ef7f34cf66d304a6bcaaff5931f3e750fc7`. Prefetched the current module before unloading/re-enabling through the existing Steam host; active 1.2.0 TS, unchanged listener counts, no new diagnostics (two historical import timeouts retained). Actual native SoundLocator service returned null exactly once for each null/absent key and created no missing-key queue. Game remains disconnected; no reconnect forced. Off-stage drop/projectile pose probes pass at sampled 60/120/180 Hz, not a live gameplay FPS proof. Full suite `/tmp/qolaf-suite-sound-cache.log`: 942 tests, 940 pass, two existing failures (compiled Integration registry and excluded NativeRadio binding fixture).

### 2026-11-12 — Stop all owned sound channels

Original SoundObject.stop releases every channel and invalidates fades. Current Haxe stops only sc and removes it from soundChannels, leaving older overlapping effects audible. Added typed NativeSoundChannels stop hook, installed with the music service, using central bindings and persistent native signatures. Cancels tweens, clears ownership/loop/position before stopping, removes cached Haxe restart/complete listeners and stops each unique channel once, including a music channel absent from the effects array. Regression covers overlapping channels, duplicate list entries, current-only channel, late completion, repeated stop and hook removal. Nineteen focused audio tests and typecheck pass. Other SoundObject lifecycle changes (reuse/throttle, pause/resume and completion of older channels while playing) remain unported/unverified; do not mark this file complete.

Channel-stop batch deployed: Public `614d47930c5b54fe6719f236d9236cf9ea5bd594fb3f820beca77c22adf9557c`, Private `a1cf8cdf11e8d00764a5b918cf3d5a717e0d0d2ee796d14f75014de8ca1f49f7`. Steam prefetched hot swap returned active 1.2.0 TS with no activation error. No audible overlapping-effect trial was performed.

### 2026-11-12 — Per-channel completion ownership

Extended NativeSoundChannels with per-channel completion listeners and loop mode captured at playback. Old completion releases only its own channel; looping starts its replacement through native OpenFL Sound.play with the completed channel's volume and preserves a newer current channel. Native cached completion listeners are removed before adoption. Pausing now cancels fades, retires listeners and stops overlapping channels, retaining native stopped sc/position solely for the current Haxe resume path. Paused sc is not re-adopted as live audio. Unload restores native completion listeners on surviving channels. Regression now covers older non-loop completion, late repeat, older loop replacement, overlapping pause, resume ownership and active-channel unload restoration. Nineteen focused tests, typecheck and both builds pass. This is not full SoundObject parity: exclusive-channel reuse, native throttle and fade/resume semantics remain to be reviewed/ported; actual audible playback remains unverified.

Per-channel batch deployed Public `e8bff3ba81582a151b5ec0bb687a37b25a24717a0a9a01c4cf35d22e19ea2efc`, Private `a5969569284537b8a45bb4c6b3da1d7691583c4f3a5857dfc55e67cdb1557639`; Steam prefetched hot swap returned active 1.2.0 TS without activation error.

### 2026-11-12 — Exclusive sound reuse and effect-only throttle

Ported original SoundObject.playObject reuse behavior: exclusive active playback keeps the same channel, updates volume/loop listener, and cancels pending fades. Fresh playback uses native Sound.play with its initial SoundTransform rather than creating a full-volume channel and muting afterward. The native 66 ms time gate now applies only to multipleAllowed effects; exclusive music can start immediately. Existing Haxe wall-clock oldTime convention is retained for compatibility across unload (original AS3 uses getTimer; clock-jump behavior is not yet equivalent). Regression covers channel reuse, loop update, volume update, immediate music restart and effect suppression, alongside earlier ownership cases. Nineteen focused tests pass. Remaining fade/resume and clock-source differences prevent full SoundObject sign-off.

Exclusive playback batch passed typecheck and both builds; deployed Public `552d2f22c07ef95f371ea5986c7f4a4390512dbe7b5396b31f1068c1a3fb09c0`, Private `46237d79027783395ea72d7d63a50868c6005d77c89768b728c4a29df334c7a6`. Steam prefetched hot swap returned active 1.2.0 TS without activation error. No audible comparison was performed.

### 2026-11-12 — Monotonic effect throttling

Replaced the remaining Date.now interval check with SoundPlaybackClock, matching the original getTimer elapsed-time behavior. On first use it translates a recent native oldTime timestamp to the monotonic clock, then no longer consults wall time for intervals. Native oldTime continues updating solely for unsafe-unload compatibility. Tests cover native timestamp adoption, 65/66 ms boundary, forward/backward wall-clock jumps, independent sounds and exclusive playback bypass. Twenty focused audio tests, typecheck and both builds pass. This closes the clock-source issue recorded in the prior batch; fade/resume semantics and audible comparison remain open.

### 2026-11-12 — Fade and resume lifecycle

Ported SoundObject fadePlay/fadeStop/resume behavior into NativeSoundChannels. Resume reuses active channels, otherwise starts paused playback at saved position with initial silence and the explicitly requested target volume. Failed channel creation returns null while preserving paused state for retry. Fade generations prevent canceled completions from stopping/re-notifying newer playback. fadePlay on unpaused stopped audio only completes its callback; fadeStop without a channel completes immediately. Pausing retires sc and tracks the stopped native reference only for restoration on unload. Existing cached active/paused native sounds are adopted at installation. Unload settles owned fades without leaving silent live channels, restores native listeners, and restores native paused sc references. Regression covers saved position, target volume, failed resume/retry, stale fade completion and stopped fadePlay alongside ownership tests; 20 focused tests pass. Full audible playback and exhaustive runtime fade comparison remain unverified.

Fade batch: typecheck and both builds passed; full suite `/tmp/qolaf-suite-sound-fades.log` reports 944 tests, 942 passes and the same Integration/NativeRadio fixture failures. Deployed Public `fb1b3e9a3d833bfd8f14c89321f6a02794d267f872bf988084dbbe84d57f39cb`, Private `84949758de6188a733cc0d4c55076de6a35d99a47d76c84c0476cb2738dfe58c`. Steam hot swap returned active 1.2.0 TS; audible live-game behavior still needs verification.

### 2026-11-12 — Target ordering and selection source pass

Read original TargetSystem.as and nearby-list portions of TargetInfoElement.as/NearbyTargetBar.as against typed TargetSystem, TargetPresentation, NearbyTargets, TargetInfo and NearbyTargetBar. Source priority is same-group last, players first, boss/miniboss first, descending effective level, ascending distance, then unit ID; snapshot cadence is 250ms. Current port matches those rules, including multipart identity deduplication/exclusion and click/row lifecycle validation. Added regressions for equal-distance ties across shuffled manager order and boss priority/active multipart exclusion. Twenty target-focused tests and typecheck pass. No implementation/deployment change required for these examined paths. This does not reproduce or close the earlier live row-switching report, nor sign off all TargetInfo rendering. FullPass now contains explicit partial source mappings rather than unmapped pending rows.

### 2026-11-12 — Active target boss naming

Compared TargetInfoElement.onEnterFrame, resource inclusion, lock interaction, observeUnit, aura updates and TargetInfo.update. Found that original active target display overrides even a spawner label with the owning boss name while aggregating boss health; nearby rows retain getUnitTrueName's spawner-first label. Added TargetPresentation.activeName and used it only for the main target heading. Regression checks boss-owned spawner distinction, compact Regius name, ordinary name and null fallback. Main bar visibility/obscuring, lock phase and empty-target strings match examined source paths. DebuffTracker independently expires display observations rather than mutating current Haxe gameplay; existing tests confirm native arguments/results stay unchanged. Nineteen focused target/debuff tests, typecheck and both builds pass. No live boss encounter or visual sign-off performed; target HUD overall review remains partial.

### 2026-11-12 — Debuff data, duration and tooltip audit

Read original DebuffEffect, DebuffInfo, DebuffDisplay, StringUtils.formatTime and Unit.trackDebuff/updateDebuffs. All seven typed metadata entries deep-equal the original JSON. Countdowns match original rounding, trailing spaces at exact minute/hour boundaries, and red <=10-second warning. Fixed direct DebuffEffect construction with negative duration (source clamps to zero); normal tracker creation already clamped, so this is a public constructor edge rather than an observed gameplay regression. Added failing-before/passing-after test plus refresh sentinel and time boundary coverage. Four debuff tests, typecheck and both builds pass. This small constructor change is built locally, not deployed yet. Source nuance remains: original trackDebuff can reuse an expired record until updateDebuffs prunes it, whereas tracker.record prunes first; no claim of exact between-tick event ordering or full live tooltip parity.

### 2026-11-12 — Debuff refresh versus expiry ordering

Closed the source-order nuance from the previous audit. Original Unit.update calls updateDebuffs, while trackDebuff itself refreshes an existing record without pruning. DebuffTracker.record now preserves that ordering; explicit expiry runs before native Unit.update for this game and when the target display reads observations. Units without tracked effects return immediately without allocating a temporary list. Regression failed before (stack count 1 instead of 2 when refresh arrives at expiry before update) and passes after; native-update coverage verifies unobserved units expire before a later application and gameplay shield/healing fields remain untouched. Eighteen focused debuff/target tests and typecheck pass; both builds include the preceding negative-duration constructor fix. Live packet-order behavior is not claimed verified.

### 2026-11-12 — Native arrows versus custom radar miniatures

Read original and Preload TargetArrow end-to-end: only formatting/local variable names differ, so no custom arrow behavior should be transplanted over updated vanilla. Reviewed Radar's embedded miniature classes against RadarMiniatures and shared MapLiveMiniature: matching scales (0.25 miniboss, 0.1 boss, 0.075 Advectorian), hostile/friendly glow, render-position part offsets, texture/tint/pivot/alpha, lifecycle visibility, 2500 inner/5000 outer radii and rim projection. Captured current Haxe Radar.update only batches when updateVisibility returns true, so the adapter's false return suppresses ordinary markers as intended. Added exact-boundary regression for inner rim, outer visibility/alpha and near-zero centering. Ten radar/map tests plus typecheck pass. No runtime code changed or deployed. Live radar rendering and full controller disposal remain unverified; original TargetArrow classified source-reviewed/no custom delta, Radar remains partial.

### 2026-11-12 — Radar post-disposal frame guard

Added radar lifecycle test using actual host hook dispatcher and native disposal shape (blips = null). It reproduced TypeError: radar.blips is not iterable when a frame arrived while HUD still referenced the disposed radar. Native Haxe explicitly sets blips to null; original source's pruneStaleBlips also guards null. Guarded capture/prune/update and corrected generated Radar.blips declaration through persistent signatures. Regression now verifies pooled contact disposal, mask/layer teardown and no recreation on a late frame. Eleven radar/map tests, typecheck and both builds pass. This establishes the failing lifecycle scenario, not proof that the user's prior warp report came from it.

### 2026-11-12 — Typed live miniature native bindings

Replaced MapLiveMiniature's Raw/read adapter with central GameObject, Unit, Boss, Sprite, Image, Texture and GlowFilter bindings and native getters. Preserved optional rendered-pose accessors and off-screen native pose fallback. Removed now-redundant double casts in RadarMiniatures. Corrected the map controller test boss fixture to implement native getters and made hook exceptions fail the tests: previously three exceptions were logged despite a passing test. Ten map/radar tests now pass without hook exceptions; typecheck and both builds pass. Read-only inspection of the running Steam game's actual Haxe registry confirms Boss and Unit inherit get_movieClip. Steam is disconnected, so this does not verify live encounter rendering or full visual parity.

Both bundles deployed with verified hashes (Public 8d513f45861c72d203d1a65765f656906d09d9ab4fe8a9a57e5d4aec124fcc47; Private 7de2f47ce21363b10feec3eb85b6198134306f16a055a339b911fee5c1715db4). Prefetched hot replacement in Steam returned active, empty error and version 1.2.0 TS without page reload. Re-read original RadarMiniaturePart.update confirms lifecycle, alive/explosion texture distinction, copied transforms and multipart rendered offsets match this typed implementation. Live encounter verification remains outstanding.

### 2026-11-12 — Radar telemetry and notice source pass

Read RadarTelemetry, RadarTelemetryMetrics, BossTimerRadarTelemetry and RoomInvitePulseColor. Confirmed Emperor fallback and notifier messages already emit the exact marker markup; apparent fixed-color discrepancy was not a defect because RichBitmapFontTextRenderer animates recognized markers. Radar.viewWidth is consumed only by the excluded radio spectrum. Added motion-reset/FPS-window and invalid-speed regression. Replaced any/read game access in four color modules with central GameScene constructor typing and native get_isLeaving. Twenty-two focused tests pass; four original-AS3 color comparisons pass again after typing, with 10000 samples each. Typecheck and both builds pass. Audit marks RoomInvitePulseColor source-reviewed, telemetry entries partial with explicit limitations; no live rendering claim.

Confirmed all four AS3 color fixtures equal the current original files byte-for-byte after text newline normalization. Steam's actual Game prototype exposes get_isLeaving. Deployed verified Public 8a77cacf5805f4ec4b5a5194cd38c1b54f6022f969d8819227d7a8fb08cad3dc and Private f493765de32bf7258adc9ca33b58b28ef8a761ea1629873d06330793827fe57e. Did not force a Steam reload for this behavior-preserving type change.

### 2026-11-12 — Boss spawn timer model and typed hooks

Read full original BossSpawnTimers and current model. Checked captured build564 native spawnEnemy/createSetEnemy/ShipFactory.createEnemy/killed/killBoss bodies: pre-destruction observation and separate definition/spawner identity are necessary and hook argument order matches. Replaced Raw/read model and hook access with central GameScene/GameObject types, manager bindings and typed GameReflection; added persistent signatures. Missing clock produces explicit NaN. Typed API.onGame callback to native Game; adapted automation-owned property cleanup to descriptor inspection. Added assertion that a kill after pooling/reset without fresh factory identity does not restart the old timer, and made hook errors fail tests. Ten timer/HUD checks and eleven automation checks pass; typecheck and both builds pass. Full catalog audit and live spawning remain outstanding.

Verified Steam registry contains both newly centralized manager classes. Deployed Public fd68281d8d49175a325f13c572b0f9865518e9356ac6c2dbca58758a62b411f3 and Private 56b2ec34cae14cc140dee01cc14e8767fb718d8a80b3182b2b4cc49d18f8b9bf; prefetched hot replacement returned active, empty error, 1.2.0 TS. Also read catalog end-to-end; marked partial with remaining Raw interfaces and boundary coverage explicitly recorded. Steam remains disconnected, so live spawn countdown behavior is not claimed verified.

### 2026-11-12 — Typed boss spawn catalog and AS3 comparison

Removed catalog Raw interfaces in favor of explicit cache definitions, runtime anchors, body/spawner inputs and definition tables. No Raw/any remains in the boss timing catalog/model/hooks. Copied the exact original catalog into the AS3 execution fixture; cmp confirms it matches. Differential tests execute original build/addSlot/optionKeys/addSource/period/hasEvent/compareRows and compare all rows/anchors against the port over 191 cases. Coverage includes one-day period cap, scalar coercion, capacities, 512/513 option limits, probability, duplicate keys/anchors, secondary slots, seasonal merging in reversed order, stable ordering and disabled/mission/event combinations. Confirmed inputs are unchanged and runtime anchor identity is preserved. Fixture strips line comments before its limited string tokenizer to avoid apostrophes in comments; no algorithm rewriting. Thirteen focused tests, typecheck and both builds pass. Output hashes are identical to the already deployed Public fd68281d8d49175a325f13c572b0f9865518e9356ac6c2dbca58758a62b411f3 and Private 56b2ec34cae14cc140dee01cc14e8767fb718d8a80b3182b2b4cc49d18f8b9bf, so no redeploy/reload needed. Catalog classified source-reviewed; live timer/room behavior remains outside this evidence.

### 2026-11-12 — Concussion/plasma render-path investigation

Read original Projectile.draw/drawAttachedTo/renderTimeToLive, manager draw, attached-state draw and Emitter.drawParticels against adapters. Current captured Haxe Game.draw visits every attached projectile; rebatching after Game.draw is required and present. Read-only Steam cache inspection identifies conc projectile tjflw6OyOUK2bsbbQR2fFA (AI bouncing, no bitmap), thrust f0ZSaPV1ok6kObSHWg5vKA: trail follows target but not emitter, speed0/ttl200; core follows both, speed0/ttl90. Plasma Blaster projectile eCNrTB0y_k2-66hzaeR2nA has thrust vWi4xUfpZU-qP-UY8aPdLA, stationary birth-position trail ttl100. Added combined projectile/particle regression across tick boundaries at 60/120/180Hz: core follows continuously predicted pose, trail stays at birth position, physics unchanged. Made projectile integration test hook errors fail rather than log. Existing 37 focused tests passed; after addition, 20 emitter/projectile tests pass and typecheck passes. No runtime change/deploy; no claim to resolve live bounce/correction report. Steam remains disconnected. Source grayscale batching is handled by NativeWeaponColors.addMesh interception, so absence of a literal grayscaleMeshBatch field alone is not a missing feature.

### 2026-11-12 — Bouncing source delta and current-native fixture refresh

Normalized original vs Preload Bouncing whitespace/decompiler locals. Only unused local2=33 removal and two hit-observation calls differ; custom bounce/correction movement was not added there. Refreshed native Bullet/Bouncing execute fixtures from captured build564 via TypeScript AST; recorded source SHA, only rebound ProjectileStuck constructor. Initially suspected inverted canBeDamage semantics was disproved: original nested negation equals native positive eligibility AND aiTargetSelf AND shooter identity. Removed the proposed adapter change; never deployed it. Added actual native self-target collision regression: reaches destroy, records one contact, excludes self-DPS and preserves all compared native results/state. Eighteen contact/damage tests, typecheck and both builds pass. Rebuilt bundles match deployed hashes fd68281d8d49175a325f13c572b0f9865518e9356ac6c2dbca58758a62b411f3 / 56b2ec34cae14cc140dee01cc14e8767fb718d8a80b3182b2b4cc49d18f8b9bf. No runtime change/redeploy. Incoming bouncing actual-body integration and live conc bounce/correction remain unverified.

### 2026-11-12 — Native incoming conc/bullet contact integration

Added current-native-body incoming contact coverage for bullet and bouncing families: six combinations (single hit, two-victim piercing, miss), with explicit assertions that baseline native code reaches the expected collision branches. Hooked snapshots equal baseline positions/alive/explosion/removal/hit-count/next-update state; recorded victims match native contacts once, and destruction outside execute adds no history. Native fixtures remain build564 extraction from prior pass. Read Weapon.recordIncomingHit/registerSimulatedHit and estimate guards against adapters; existing tests cover rejected ownership/healing/current-ship/invalid-damage cases. Three incoming suites pass, including six actual-native cases; typecheck passes. No production change/build/deployment needed. Bouncing source review now covers its complete custom delta (incoming and simulated hit observations), while the broader live conc travel report remains unverified.

### 2026-11-12 — Missing unequipped weapon firing guard

Normalized Weapon changed methods against Preload and checked captured native code. Original Weapon.update explicitly stops a current local ship's unequipped gun when stale fire remains true; no equivalent existed in port/native. Added WeaponFireOwnership and installed after bindings. Uses native PlayerShip.get_weapon, not AS3 property alias. Current Haxe set_fire(false) can release charged shots: for this stale ownership path only, clear charge effect/UI and time before invoking native setter. Remote players, mirrors, NPCs, selected guns and inactive weapons retain native update; ordinary selected charge release stays unchanged. Tests cover all these cases and unload restoration; three ownership/lifecycle tests, typecheck and both builds pass. Steam registry confirms required getters/methods. Separately identified still-missing source addTechStats guard on absent positionVariance (native overwrites positionYVariance unconditionally); queued next. Corrosive-as-all artifact behavior remains intentionally excluded.

Deployed verified Public be496d24fe62a2349b37950ac95c615e2fcbae955beff719a55b013d22573bf4 and Private ea4dbaec09aadce749dd00d9a6be1383fdbb3a7c92b4b855e1d9e32b0a4c6af6. Steam hot replacement returned active/empty error. Detached-object check using actual Steam PlayerShip/Weapon prototypes: stale gun update cleared fire and invoked zero mock shots; selecting that same gun retained fire and invoked one mock shot with native owner positioning (10,20). No real gun, session state or network traffic was changed. Charge-release handling is covered by the focused fixture rather than live combat.

### 2026-11-12 — Weapon tech variance guard

Ported original addTechStats own-property guard: omitted or inherited positionVariance preserves the authored weapon variance; own zero and undefined retain native assignment semantics. All other calculations execute in the native method, without mutating cached definitions. Typed WeaponTechDefinition and persistent generated signature replace the untyped boundary. Tests execute extracted build564 native method over 25 combinations (levels 0/1/3/6/9 and missing/inherited/undefined/zero/value), compare unrelated state, and verify unload restoration. Four focused weapon tests, typecheck and both builds pass. This is source/native-fixture evidence; live combat spread is not independently verified. Weapon review remains partial.

Deployment verified Public 01bf161998d200a88d6dd281442d8f4936173ba3897eed83f7f42f31dc030faf and Private f0634b375e10c2aef10523cdee24d721c2dafad406fe757b918e46a8b35bfa1c. Steam prefetched hot replacement returned active, empty error, version 1.2.0 TS. No live combat action or forced reconnect performed.

### 2026-11-12 — Weapon description localization

Compared original getDescription to captured and live native Haxe. Missing deltas are localized weapon name and parameterized conditional bonus with translated condition. WeaponDescription transforms only matching native heading/trailing bonus; it retains updated native scaledDebuffDuration, DPS, cloak/pet/debuff sections and gameplay state. Added typed persistent signatures (get_name belongs to GameObject, not Weapon). Extracted build564 description fixture with dependency identifiers rebound. Differential tests cover 108 language/name/condition/compact/subtype combinations, literal dollar replacements, updated duration output, no state mutation and unload restoration. Five focused weapon tests, typecheck and both builds pass. No claim of completing whole Weapon or live gameplay audit.

Deployed verified Public 09b5544e176bc7be9a8c516eda5a4f653069d456a7eee3ba99a0d2a02f818e65 and Private 74be60da507d645c417da6bd13cd2cfe913fff331515cecbec43ba85d772a390. Steam hot replacement reports active, empty error, version 1.2.0 TS.

### 2026-11-12 — Original DPS eligibility differential

Copied original Weapon.as byte-for-byte (cmp verified), executed its canEstimateDamage/recordEstimatedHit/markDamageEstimatePartial using existing AS3 language-boundary harness. 240 ownership/leaving/settings/HUD/amount/healing combinations exposed missing HUD-presence guard in DamageObserver.canEstimate. Fixed guard without changing actual-contact eligibility. Existing gameplay tests needed explicit HUD fixtures, not weaker assertions. 22 focused tests then six targeting tests (including new HUD-absent targeting/history test) pass; typecheck and both builds pass. Estimate and partial flags stay empty without HUD, while real contacts still update history/targets. Broader Weapon review remains partial.

Deployment verified Public ed5af2963d2b178a3f0efcd2d8b103221cece6a7da3b727f41d9799bf76e6f90 and Private 57b330aa91bac4ee8a5f1ddafa815218adf35671e61397689a39552bd86f60e1. Steam hot replacement active, empty error, 1.2.0 TS. No live combat or forced reconnect.

### 2026-11-12 — Actual hit versus estimate lifecycle

Executed original registerSimulatedHit with original estimate methods across 48 ownership/departure/includeEstimate/healing/target-presence combinations. Incoming history intentionally remains a separate tested adapter. Found isPersonalWeapon was rejecting departure contacts, unlike original registerSimulatedHit; moved leaving check into canEstimate. Thus contact history/target offers remain independent of estimate lifecycle, while DPS and incoming NPC history still reject leaving. 27 focused tests pass, then nine native contact tests pass including new departure snapshot equality/history/no-DPS case. Typecheck and both builds pass. This validates callback delivery, not live combat selection during warp.

Server deployment verified Public e27ee00312edd95df7620ac3ce3839f365d4ca3bdb9657246b2bc10ed0642e61 and Private a648ae7426b826df113e3f686fa422972835db7750d9ca454ee83f91329486e0. Next WeaponManager review should check destroyManagedWeapon calling set_fire(false) before destroy against native charge-release behavior, and drawable index teardown consistency. This is a queued inspection, not a confirmed additional defect.

### 2026-11-12 — Teardown must not release charged shots

Read original setter (reset only), current live native setter (onChargeReleased before reset), and WeaponLifecycle. Confirmed cleanup directly used the release setter. Added typed shared cancelWeaponFire to clear positive charge/effect/local HUD first, then use native setter for timing/fire reset. Used for room exit, turret destruction/removal and stale ownership. Native ordinary release remains unchanged. Captured build564 setter fixture only rebinds PlayerShip/Boot/NativeStackTrace identifiers. Tests cover local/remote/non-player/null owners, repeated exit, turret destruction retaining rebuildable weapon, zero cleanup releases, one ordinary release and native timing reset. Six focused lifecycle/ownership/draw tests, typecheck and both builds pass; three lifecycle tests rerun after adding charged turret destruction assertion. Drawable manager membership tests pass, but whole WeaponManager/live combat parity remains unproven.

Follow-up identified: NativeCommandCancellation (artifact menu) still calls set_fire(false) directly. Original PlayState.cancelAllCommands assigns fire=false through the old non-releasing setter. Audit/adapt this modal path with native setter regression next; not included in this teardown deployment.

Verified deployment Public e933e754ea3a83f0593389cd8dfec0917722dc25dc6c231f7f75ca9bb0910ded / Private 8baf2ec408e2c019b47e57cec804727628b850b4385a5b51994e1c8b9040c29a. Steam hot replacement active, empty error, 1.2.0 TS.

### 2026-11-12 — Modal and teleport forced fire cancellation

Compared original PlayState.cancelAllCommands and PlayerManager.m_teleportToPosition forced fire=false assignments with current native charged-shot setter. NativeCommandCancellation regression initially reproduced one unwanted release. Now both modal and teleport handlers use shared cancelWeaponFire; ordinary input release remains untouched. Native-setter modal regression covers all 16 held-axis combinations at zero/positive charge (32 cases), exact command sequence, charge/UI cleanup, and a second setter call during simulated native fire-command processing. Ten focused modal/artifact/lifecycle/ownership tests pass. Teleport call site source-reviewed; full live teleport sequence remains unverified.

Typecheck and both builds passed after the teleport call-site change. Server hashes verified: Public 6802a75367845aca6f900a26ce428b4c7f50cdbdd9e835f49ba7ba12c6d1941b / Private 592325c0a9ad9b7e18bc0bfd8d1fa90f08a973c7903ac1c93df2a6a48fa08fed.

### 2026-11-12 — Teleport lifecycle regression coverage

Read original m_teleportToPosition phase/ownership/timing/effect-error handling against port. Added typed TeleportLifecycle hook fixture using actual host Hooks, explicit scheduler, ship/manager identities and emitter pool generations. Covers normal channel wait, 120/240ms transition, overdue full delay, presentation failures without losing destination, duplicate callbacks, replaced pending transition, reset/landed/departed/manager/lifecycle invalidation, and pooled marker immunity. Eleven focused tests and typecheck pass; four teleport tests pass after replacing Object.create fixture clones with typed constructors. No production change or deployment needed. Fixture uses no movie clip, so real shrink/grow visuals and live server behavior remain unverified.

### 2026-11-12 — Weapon factory and manager source review

Whole WeaponFactory token comparison preserves quoted strings, normalizes decompiler locals and removes token whitespace: 507/507 equal. No custom functional delta, retain vanilla factory. Reviewed manager getWeapon/removeWeapon drawable indexing and destroy/dispose callers: original Turret.releaseWeapon and Game.exit map to current helper paths. Extended NativeWeaponDraw fixture to install lifecycle hooks in production order, populate draw cache, exit twice, assert each remaining weapon destroyed once, no stale beam draw, then add a new beam and render normally. Existing native fallback and unload checks retained. Five focused tests and typecheck pass. Factory/manager now source-reviewed; this status does not establish live whole-game parity. No runtime changes/build/deployment required.

### 2026-11-12 — Weapon class diff sweep and damage display port

String-preserving normalized full-file comparisons: Blaster, Heat, SmartGun identical to Preload; PetSpawner only removes unused local5 initializer. Retain native implementations. Damage changes are display-only localized names/templates, repair newline, per-hit spacing, fixed over/after debuff templates. Live Haxe confirmed missing delta. Added typed DamageDescription and persistent central Damage signatures; no damage arithmetic changes. Exact original Damage.as fixture copied, original methods execute for differential checks: 144 debuff combinations plus direct damage, translation and unchanged arrays. Hook/unload regression and existing weapon description comparison pass (three tests), typecheck and both builds pass. ProjectileGun/Teleport charge ownership and shot-time color paths remain separate audit items; Beam still pending detailed review.

Deployment verified Public 9feccd12dc113bbe6a9d5d6350ea28bf98b31c33b58a0c6473cf711f4029066b / Private 4feefb36ef6c5266d24ef42dea859e847561ea0c8443c332f6506a53ef1823c5; Steam hot replacement active/empty error/1.2.0 TS. Detached actual Steam Damage prototype check returned corrected mixed damage/repair newline and after-duration text, with input array unchanged. No live weapon or account state changed.

### 2026-11-12 — Charge effect weapon ownership

Original ProjectileGun/Teleport shoot pass this to PlayerShip.startChargeUpEffect; current live Haxe uses only effect key and NativeWeaponColors previously resolved selected weapon. Added typed central ProjectileGun binding/signatures and WeaponChargeOwnership per-ship native-call context, restoring prior context in finally. Color callback uses owning weapon, selected fallback outside shoot. Tests cover different selected weapon, nested gun/teleport, unrelated ship, native return, thrown exception cleanup and unload; existing weapon color tests pass (five total), typecheck and both builds pass. Read-only live native shoot confirms synchronous effect call in both classes. No simulation or charge-timing replacement; live charge appearance remains unverified.

Captured native startChargeUpEffect also confirms unchanged default key uWIxfxRAgUm6ThgrRFnixw. Deployment verified Public 0d355de3d3315ae43eb9458ad74bced6d3355ab4d9c83d67777d9be4bd6b1a28 / Private e08c2265b85b80a726c1812fddd2012a183ab56d5b6627853e38fadbeceb7526. Steam hot replacement active, empty error, 1.2.0 TS.

### 2026-11-12 — Typed beam resource lifecycle

ProjectileFactory source inspection shows remaining shot timestamp only affects developer rainbow fallback, not fixed weapon palette; kept gap open. Reviewed Beam initEffects/releaseEmitters/releaseLines/destroy against resource adapter. Replaced Raw/reflection lookup boundary with central Beam/Emitter types and persistent generated signatures. Captured actual build564 native Beam.destroy (only Weapon dependency rebound) for test. Verified retained creation scope, first-shot start emitters, dead-before-release, reentrant pool callbacks, single resource release and batch disposal, plus unload. Emitter test fixture needed required initEffects/destroy methods after central binding; no production fallback added. Eighteen resource/emitter/geometry tests, typecheck and both builds pass. Beam whole-class review remains partial; no claim that synthetic render-frequency tests prove live FPS.

Next Beam gap: original resolveVisualTarget/resolveVisualSecondaryTargets, VISUAL_CONNECTION_GRACE and visualStopEnd logic have no corresponding adapter found in current src/weapon. Existing geometry follows current target only. Compare current native draw/set_fire before implementing visual continuity; do not feed retained visual targets into simulation.

Verified deployment Public f32bd9e4b9dce8e2ae5eb9ec572fdc504356269b551c391831a089998812ba23 / Private 6254d055c52a7a75e1f8e7825d88e6cb4541431b043f65b1a7469b998d10c570. Steam hot replacement active/empty error/1.2.0 TS.

### 2026-11-12 — Beam continuity model (integration pending)

Read full source resolveVisualTarget/canRetainVisualTarget/resolveVisualSecondaryTargets and fire/stopVisuals rules. Retention applies to Skeletor Lightning only: 165ms connection grace and 2.25/33 angular tolerance. Added typed BeamVisualContinuity model; exact Beam.as fixture copied (cmp verified). Original methods execute against 120 range/angle cases and primary/secondary timelines; dedicated stop/resume/deadline test passes. Three tests pass; typecheck passed before final test-only addition. Model is NOT imported into runtime and NOT deployed. Remaining work: connect explicit visual target to BeamRenderGeometry, render retained secondary links without assigning weapon.target/secondaryTargets, port Skeletor-only stop/resume presentation, validate native draw/state isolation. Current native draw directly reads secondaryTargets, so geometry-hook-only integration would miss retained chains.

### 2026-11-12 — Beam continuity renderer integration

Connected typed continuity model to NativeBeamGeometry through explicit visual target/secondary lists; native target, secondaryTargets and simulation endpoints are never swapped. Skeletor-only typed renderer follows native line ordering/heat alpha/batching, using source connected alpha and source setter stop/resume hold. Other weapons still call native draw/set_fire. Geometry hooks remain active for twin/chain rendered coordinates and existing color hooks. Stop at exact deadline clears batches/emitters; resuming held beam avoids replay; unload clears pending hold. Added integration regressions for target loss, independent chain expiry, endpoint/array identity isolation, stop/resume and unload. Fifteen model/resource/geometry/color tests pass; seven geometry tests rerun with unload cleanup coverage. Typecheck and both builds pass. Live Skeletor combat appearance remains unverified; full Beam review remains partial.

Verified deployment Public abef9107e3d1c16c812824750256c790eb95b6d7db98fa3144f7c91531b4d557 / Private 9b666e7c0590c23e3574599b84796c05eb4103377fc2449fe60dacb580b2bb35. Steam hot replacement active/empty error/1.2.0 TS. No live firing or reconnect performed.

### 2026-11-12 — Beam empty-effect guard and Debuff source review

Current build564 Beam.initEffects calls EmitterFactory.create even for null/empty keys; native factory immediately calls Effects.loadKey. Original Beam.createBeamEffect returns an empty vector first. Added a typed factory guard scoped only to Beam.initEffects, with finally restoration for nested calls and failures. Outside that scope creation remains native. Tests cover empty/null keys, valid retained effects, failure scope restoration, first-shot playback and teardown/unload. Twenty-five focused beam/emitter/debuff tests pass; added failure-path regression also passes. Typecheck and Public/Private builds pass.

Debuff.as full diff adds only canStack (types 1 and 3), already represented by DebuffEffect.refresh. Marked that source file reviewed; this does not claim full Debuff UI or full Beam parity. Expanded-artifact/chat overlay tests also pass (four tests).

Verified deployed Public 0a611155e8f17dd835d43e993d091e27005ef75f442527d5c7efe9e55361a6d9 / Private 8a74971742114bf84e4edd0b7e93511cd3ba1c8bb9b326f196d2c3d1b25b1c76. Steam hot replacement reports active, empty error, version 1.2.0 TS. No live combat test or full-game parity claim.

### 2026-11-12 — Typed native beam geometry boundary

Replaced NativeBeamGeometry's api.cls/as-any lookups and Raw maps with central Beam/Matrix/PlayerShip bindings, GameScene/Unit types, typed hook signatures and explicit optional client ship mount methods. Native ship fallback uses get_movieClip. Geometry arithmetic and simulation endpoint ownership remain unchanged. Thirteen focused beam/weapon tests pass, then eight geometry tests including new custom-mount/native-clip integration coverage pass. Typecheck and both builds pass. BeamRenderGeometry/PhaseBladeMounts internals still have legacy loose types; this does not claim whole-plugin type cleanup.

Rechecked Weapon addDebuff against Preload/current Haxe: only AS3 iterator annotation differs, no missing behavior. Init's custom corrosive flag belongs to the explicitly excluded old corrosion calculation. Reset clears observed contact through the installed reset hook. Existing contact/tooltip/tech/ownership tests cover reviewed changes, while broad combat validation remains open.

Deployment verified Public 45612bc7e3a419dd6f57c868b19ec84cabc36204a3e8bb02f176ff58744c540b / Private a71fd1201f28eb56e70ae34eadc686e59a7e8d7b9789570b2733db9a8fb1557c. Steam hot replacement active/empty error/1.2.0 TS. Detached actual installed Beam methods produce primary [10,20→60,20] and chain [60,20→80,20], retained after target removal and stop, without modifying native endpoint objects or target arrays. Detached mock pool cleanup only; no gameplay shot or reconnect. Eight incoming-contact/history/lifecycle tests also pass. Still no live-combat visual parity claim.

### 2026-11-12 — Typed beam geometry and source differential

Removed Raw/read from BeamRenderGeometry, using typed Beam/Unit/RenderedGameObject and native getters. Render accessors resolve positions directly, avoiding eager fallback clip reads. Native clip fallback respects pooled readiness. Persisted weapon offsets, beam points/twin offset and Unit.weaponPos signatures in generator input. Tests now model native Haxe getters. Added exact-original updateRenderGeometry differential covering 144 combinations of rotation, twin state, mount offsets, target presence and body intersection radius; primary/twin/end coordinates and all emitter transforms match within 1e-9. Added pooled-readiness/accessor precedence regression. Eighteen beam/model/resource/color tests, tsc and both builds pass. PhaseBladeMounts remains a separate loose-typed helper; no whole-plugin typing or whole-game completion claim.

Verified deployed Public 30b9b65a5611c65e1e44689593fadd36d3f83e6541b32e4996d844798b96eec6 / Private d61299e1c2802b5362defa12e9efe8cf91c79cc4da773b4843ceb648712bfa43. Steam hot load active, empty error, 1.2.0 TS. Detached installed Beam method check again preserves retained primary/chain coordinates, target arrays and simulation endpoints; no real shot/reconnect. Original Beam fixture byte-for-byte matches current source.

### 2026-11-12 — Mission source pass and localization

Reviewed original/Preload token differences across DailyManager and mission screens. Restored missing MissionView.fixText translation before native substitution (completed descriptions use the existing formatting hook). Captured build564 static formatter with rebound StringTools/Std dependencies; 48 name/value/template combinations verify formatting, source equivalence for ordinary names, literal dollar replacement retained from newer Haxe, immutable definitions and unload. Daily constructor also lacks original translations: DailyMissionLocalization translates instances after initialization and on hot enable, leaves shared definitions/progress unchanged and restores only its own values on unload. Added typed DailyManager binding and persistent Daily/Player signatures. Four focused mission tests, tsc and both builds pass.

Five source entries now reviewed: DailyManager, Daily, DailyList, MissionsList, MissionsStory. Kept MissionView/DailyView/Statusbar partial for font checks, and DailyReward partial with confirmed missing commodity tooltip localization. No claims about mission rewards/gameplay changes or full screen parity.

Verified deployment Public c2e01ece37a660fa2fc4d1ce0312e31913d5a90785ba2a1c9478f277835d9e7a / Private af071807e0655eb32136803e1f56239ee1c22ebfb5b36a23d4f48448825ac66c. Steam hot load active/empty error/version 1.2.0 TS. No reward claim or mission packet sent during validation.

### 2026-11-12 — Mission reward tooltips and bitmap fonts

Added typed MissionPresentation construction scopes for DailyReward.draw, DailyView header/description/progress, and MissionView.addReward. Native format clones map only original mission font aliases to source Russo/Verdana atlases before native measurement; claimed-label font changes use the current native size. Commodity tooltip translation tracks names from DataManager.loadKey only inside reward construction and applies only matching dailyView tooltips. Definitions, reward values and unrelated text stay native. Cleanup restores last native requested font/text only if still owned; WeakRef tracking does not retain disposed screen objects. Persistent method signatures and central DailyReward/DailyView bindings added.

Five focused mission tests, typecheck and both builds pass. Verified deployed Public 1c20985c8dd119eaa6bafa1f5023ac2da1eff1d3419f2b088bf98cb0d956e1ee / Private c972327aeabe871d833c0b34d0ed0991e17cc66e78b15e0c52612afe613cf4f3. Steam hot replacement active/empty error/1.2.0 TS. Detached actual native DailyView widgets using copied loaded records verify: normal header Russo16, description Verdana16 at12, progress Verdana16 at11, three reward labels Russo16 at13; claimed description Russo16 at16. Disposed only detached widgets/new tooltip registrations. No reward claim or mission packet sent. Four remaining mission presentation source entries marked source-reviewed; this is scoped source evidence, not whole-game parity or complete live-screen visual sign-off.

### 2026-11-12 — Clan member ID copy and menu source pass

Ported missing source ClanState Copy ID action via typed central ClanState/row bindings and native Button. Captures each row's persistent player ID without online lookup or management-role gate. Uses source 74x22 control at (43,52), background height76, stride80 and hull fit within40x40. Clipboard success/failure gives Copied/Retry and original failure notice; blank IDs disabled. Prevents simultaneous writes and ignores pending completion after unload. Weak row tracking, disposal hook and unload restore layout/remove added controls. No clipboard write is made without invoking the button. Tests mock the clipboard and verify success/denial/missing ID/repeated click/unload/native early return. Typecheck and both builds pass.

Full normalized source comparisons completed for crew/menu/shop/leaderboard wrappers: ten entries marked source-reviewed with exact annotation/constant/equivalent-expression evidence; landed-hangar cap removal covered by existing LandedFrameRate regression. LandedExplore's removed leave-key branch recorded separately for shared-input audit. ClanState stays partial pending remaining methods.

Verified Public 7331a23e9643a022a3334a4d3f81f93c0e994892dddd054ed1432ef421b797c3 / Private 8f9ed8c964da38836affbf7154c1dc00500c4f7a5f64ad6f1e2a05c6f233fdc9. Steam hot replacement active/empty error/1.2.0 TS. Detached actual native clan row for dummy member renders Copy ID visible at (43,52),74x22; row index2 at y160, background76. Detached row/new tooltips disposed. No live clipboard write, clan RPC, or account change performed. Full gameplay/UI parity remains unfinished.

### 2026-11-12 — Exploration leave-key ownership

Confirmed functional source delta: original LandedExplore.execute removes the second Escape/land-key leave branch after super.execute. Captured build564 retains that branch. Regression using actual captured base/derived methods reproduces chat close immediately followed by leave; it also permits an unloaded land-key leave via the second branch. Added typed LandedExploreInput following original SelectTeam/Report/normal routing while calling current native LandedState.execute exactly once in normal exploration. Keeps native base drawing, menus and loading/blocking guards. Added central bindings and reviewed state-machine signatures.

Copied original LandedExplore source and executed its derived routing against the captured native base in 288 combinations of chat/menu/loading/blocking/leaving/key/child state. Patched outputs match; native double-handling regression reproduced first; unload restores original method. Four focused exploration/chat/frame-rate tests and both builds pass. Fixed the fixture import annotation then reran tsc successfully. No whole-LandedState parity claim: source has other chat focus and initial-world changes covered separately.

Verified deployed Public 68b81873040c2eb62a5b4a76298dc2a4b75fe9335f07792acfbf127c288f0f9e / Private c46e79f2e5b5b3cb60cbd74d0be8f8c942788af819420344b22ef0df6386a271. Steam hot replacement active/empty error/1.2.0 TS. Detached installed Explore.execute with stubbed draw/leave endpoints: Escape closes chat once without leave; hides menu once without leave; normal Escape leaves once; unloaded land key never leaves. No actual planet departure, reconnect or gameplay packet.

### 2026-11-12 — Landed chat-focus parity and completed clan source review

Original LandedState.execute distinguishes chat visibility (Escape closes it) from input focus (history/navigation gating). Current native uses isActive for both. Added typed LandedInput with original priority and native DOM focus identity, retaining frame draw/menu update and loading/leaving/hotkey guards. Session release sequence continues to own welcome/changelog presentation; no duplicate showWhatsNew polling added. A missing chat during teardown now exits input handling safely. Persisted native InputManager/MenuHud/keybind method types.

Executed original LandedState.execute fixture against adapter across 384 combinations (chat visibility/focus, loading, blocking, departure, menu, six keys); outputs match after treating existing release-sequence popup delivery as a separate no-op boundary. Exploration/chat overlay regressions also pass. Final tsc succeeds after adding nullable-chat guard, both builds pass. ClanState full token pass found no further functional changes beyond already ported Copy ID, hull fit and row dimensions; marked source-reviewed with full live-management actions still untested.

Verified Public cd4f8f185f4395fa1b08b5dba56ebec5f435b8fe4231ef562254895d248030b3 / Private b181a2cc44e8413a3705369150f6d59ff8f15a98d48672fd0647303908999d86. Steam hot load active/empty error/1.2.0 TS. Detached installed Explore/Base input check: chat Escape close only, menu Escape hide only, normal Escape one leave, unloaded land key none, focused chat land key none, visible-but-unfocused chat land key one leave. Draw/leave endpoints stubbed; no actual departure or packet.

### Portable screen close lifecycle — 2026-11-12

Executed the original PortableHangarState and PortablePiratebayState leave methods from byte-preserved source fixtures against PortableScreens in 64 combinations (32 per screen), each closed three times. State-machine presence, unloaded state, player presence, landed state and real-body presence all match. Native takeoff is never called. Existing entry restrictions/recycler reuse test also passes. This closes only leave lifecycle verification; native rendered contents/catalog behavior still require separate checks. No production bundle change or deployment was needed.

### Lore and native Pirate Bay source delta — 2026-11-12

Reviewed complete LandedLore and LandedPiratebay original-vs-Preload diffs. Lore changes are covered by ScreenText setting pageReadTime before start and LandedFrameRate removing fixed frame caps. Pirate Bay changes normalize its decompiled fleet scan; captured build 564 hasWeaponInFleet matches the exact original AS3 method for 320 three-ship/query combinations and an empty-fleet case, without mutating the fleet. Eight focused tests pass (PirateFleetParity, ScreenText, ScreenTextPlayback, LandedFrameRate). These entries are source-reviewed; this is not a claim of full rendered-screen parity. No production patch/deployment was needed.

### Scene singleton ownership — 2026-11-12

Found and ported missing SceneStateMachine singleton ordering: outgoing Game.instance is restored during native exit/disposal, cleared after removal if still owned, and incoming game is published before native stage attachment. Closing clears only its own singleton. SceneOwnership uses scoped native hooks, cleans them on exceptions, and retains native room operations. SceneOwnership.test covers transitions to games and non-game rooms, close ownership, and failure cleanup. Full room/reconnect runtime comparison remains open.

### Native scene ownership and simulation timing evidence — 2026-11-12

Ran installed SceneStateMachine methods in Steam with detached prototype-backed Game objects and a recording stage. Actual Haxe casts accepted both objects. Observed exit/dispose old, attach/enter incoming; close observed incoming through disposal then cleared singleton and currentRoom. Saved real Game.instance restored in finally; no real room operations or packets. Script: /tmp/qolaf-scene-ownership-detached.js.

ElapsedClock regression now executes exact original GameStateMachine update/resetTiming bodies in 144 lifecycle configurations across eight timestamps (1152 updates), comparing event ordering and timing fields. Covers absent clocks/current states, previous-state loading gates, accumulator remainders, backward time and capped stalls. Six focused clock/chat/artifact tests pass. DisplayState source delta is only chat availability, already handled by global overlay hooks with expanded-artifact exception. Full state-machine/rendered parity remains open.

### Reconstruction effect attachment — 2026-11-12

Full AIResurect diff exposed missing correction: native build 564 enter creates second effect at targetX/targetY (unused defaults), unattached. Original uses ship position and ship target. ReconstructionEffects scopes EmitterFactory.create during native enter, correcting only the matching reconstruction effect/game/null-target call; native reconstruction and other calls remain intact. Regression covers coordinates/attachment/options, unrelated effects/games, outside-scope calls and exception cleanup. Typecheck and public/private builds pass. Exit authoritative-resource baseline still requires audit.

Also reviewed complete AITeleportEntry, AITeleportExit, AIReturnOrbit, AIBoss and AIMelee diffs: only annotations/formatting and equivalent chained-assignment expansion. Preserve current native AI; this review does not certify the separate interpolation hooks. AITeleport constructor fallback remains to inspect.

Reconstruction deployment: public 21089f016379bb523d58e319eb9b7a839c96162fb5745538926c34e08770965f, private f494efa1c0a0839205ef25a2af6e1e19e26de733eb5ede9f8d33b40cb90382c0. Steam hot-load active/error empty. Detached native enter check via host-owned hooks observed second effect at (123.5, -45.25), attached=true, native invulnerability=true and speed zero. No real ship or particle construction. Initial harness attempts failed because direct replacement conflicts with hook ownership, then because the fake game lacked get_isLeaving; final harness uses the active game for read-only context and host-managed hooks, restored in finally. Script /tmp/qolaf-steam-check/reconstruction-check.mjs.

### Teleport target snapshot fallback — 2026-11-12

Found native syncEnemyTarget constructs AITeleport without destination arguments, giving (0,0), while original ShipManager selects course position or engine position when outgoing AI is AITeleportEntry. TeleportDestination restores that scoped selection before native StateMachine.changeState; before enter replaces nonfinite coordinates with course coordinates as in source constructor. Explicit destinations including (0,0) stay intact outside target snapshot sync. Tests cover normal/entry paths, explicit and nonfinite coordinates, exception scope cleanup and unload. Typecheck and both builds pass. Actual native live-path check still pending.

AIResurect exit follow-up: original recordAuthoritativeResources records only a freshness timestamp. Existing EnemyObservations.endReconstruction already calls recordResources after native exit. No regeneration/shield gameplay rewrite required.

### Native teleport path and ship warp lifecycle — 2026-11-12

Actual installed Haxe syncEnemyTarget parsed detached messages and constructed native AITeleport states in Steam. Captured destinations: course (125,-30), outgoing teleport-entry engine (-90,600). Host-managed temporary changeState hook intercepted only the detached machines, so no gameplay transition or particles were emitted. Script /tmp/qolaf-steam-check/teleport-check.mjs.

Found missing ship WarpJump source changes: temporary 10x engine acceleration and restoration, retained mixed finite/persistent effect leases, and clearing released effect references. ShipWarpLifecycle wraps native enter/exit to supply these changes, retaining native heading, speed, sound and execute. Hot unload restores owned acceleration and releases effects. Focused test covers acceleration, lifetime scope, exit/repeated exit, unload and restored native behavior. Typecheck and both builds pass; full native/rendered warp comparison remains open.

### Native warp lifecycle verification and projectile source review — 2026-11-12

Actual installed Haxe WarpJump enter/execute/exit passed in Steam on a detached ship and three fake emitters intercepted through host hooks. Acceleration 12→120→12, speed 30000, all effects retainUntilKilled=true, played=3, killed=3 across repeated exit, remaining references=0. Native factory definition/texture validation and retention hooks ran; no real particles, sound or gameplay mutations. Script /tmp/qolaf-steam-check/warp-check.mjs.

Full token review: Intro differs only by three loop annotations; Cluster only inlines constant 33. AIStateFactory mine branch rewrite is equivalent and its Nether instant appearance selection is covered by NetherBeamStyle. Five focused Nether/warp tests pass. Boomerang/Missile thrust-anchor changes are present in ProjectileThrustAnchor but their full behavior remains separately unverified.

### Missile and boomerang trail source review — 2026-11-12

Reviewed original ProjectileThrustAnchor and complete normalized Missile/Boomerang deltas. Existing port samples interpolated tail minus radius, keeps authored emitter rotation zero, and invalidates old pooled projectile lifecycles. Other Missile deltas inline constant 33/annotations; Boomerang removes shadow fields and redirects its game reference to inherited m (current native g remains initialized). Thirteen focused projectile/emitter tests pass, covering rendered frames without simulation ticks, attachment rotation, reset/death/missing clip and factory capture before first frame. Broader run first exposed a stale EmitterTargets fixture missing Beam.initEffects/destroy, now explicitly supplied; no production workaround introduced. No new bundle needed. This is source-delta coverage, not full native combat certification.

### Typed projectile AI factory boundary — 2026-11-12

Migrated NetherBeamStyle from raw api.cls/as-any reflection to live AIStateFactory, EnemyShip and DataLocator bindings. Added ProjectileAISettings for the fields actually read by build 564 createProjectileAI, plus generated factory and Projectiles loadKey signatures. Removed Raw/any from this hook and its regression fixture. Runtime inspection of the loaded Projectiles table confirms declared primitive types for all 18 fields; frequency also permits native parseFloat-compatible strings. Regression preserves AI/range/TTL/shared records and absent optional style properties. Typecheck and public/private builds pass. This is one boundary migration, not a claim that all plugin typing is complete.

Expanded projectile integration check initially exposed a missing static createProjectileAI in its generic binding fixture after making the binding required; fixture now supplies the native method boundary. All nine ProjectileFrames/NetherBeamStyle tests and final typecheck pass. Public/private builds deployed; Steam hot-load checked separately.

### Death screen font sizes — 2026-11-12

Found native Killed still uses unsized DAIDRR for all labels, unlike original source atlas selection. DeathPresentation maps death cause to size-20 atlas with 12-point base text, XP/cargo labels to size-12 atlas, countdown/lives to size-52 atlas; execution switches countdown font after native instructions select 20-point size. Existing game-session measured layout runs after presentation hook. Weak ownership restores fonts on unload; unchanged repeated frames do not add pivot/layout work. Two focused font/layout tests, typecheck and both builds pass. Full death/respawn behavior remains open.

Death font deployment: Steam hot-load active/error empty. Native Killed.execute with detached actual Starling TextFields produces Press SPACE to respawn at size 20 using DAIDRR_24. No real player/death/respawn action. Fields disposed. Script /tmp/qolaf-death-font-check.js.

### Roaming chat focus and input priority — 2026-11-12

Native updateInput blocks gameplay on chat visibility, keeps processing after Enter and always blocks automation when chat is active. Original gates on actual input focus, returns immediately after Enter and invokes updateCommands if automation controls are claimed. RoamingInput ports these branches, delegates dead/unloaded input and native gameplay/menu paths, and scopes native isActive only during unfocused roaming. Two persistent hooks avoid per-frame cleanup accumulation; finally restores scope after errors. Five focused roaming/respawn/chat tests, typecheck and both builds pass. Full native screen transition checks remain open.

Steam deployed/hot-load active. Actual Haxe RoamingState.updateInput with detached state/native ChatInputText prototype: unfocused→commands; focused→throttle blocked; focused automation→commands; Enter→toggle only; chat remains visible. No real gameplay actions or packets. Script /tmp/qolaf-roaming-input-check.js.

### Roaming zoom restoration — 2026-11-12

Original RoamingState.enter reapplies SceneBase.settings.cameraZoom with camera.zoomFocus(zoom,1). Port previously restored once on the first checkZoom/wheel call per game. NativeWorldZoom now also reapplies latest saved zoom on each native roaming enter with the original one-frame focus, retaining initial/hot-enable fallback. Expanded integration test covers returning from a temporary zoom and changed saved preference on a subsequent entry. All five NativeWorldZoom/WorldZoom/ZoomFilterCache checks, typecheck and both builds pass. Actual native landing/menu round trip remains unverified.

### Exploration artifact reward ownership — 2026-11-12

Full ReportState diff exposed missing count/dedup/late-callback behavior. ExplorationRewards credits each confirmed nonempty ID once per report during callback creation (before native createArtifact requests metadata), captures original player, reuses cached artifacts after concurrent inventory refresh, and avoids UI if leaving, scene changed, container closed or plugin unloaded. Keeps native ArtifactBox layout/tween values and null-result error reporting. Captured native createArtifact does not increment counts or insert into inventory. Regression covers count/limit notification once, metadata race, owner changes, closed report, leaving/null inventory and null metadata. Typecheck and public/private builds pass; no real reward requests made.

SelectTeamState full token diff only changes five loop type annotations; preserve native implementation.

Steam hot-load active/error empty. Detached native ReportState callback creation and delivery verify count=1, limit notification=1, inventory length=1, cached artifact preserved after simulated inventory refresh; closed report causes no UI access. No live inventory or reward requests. Script /tmp/qolaf-exploration-rewards-check.js.

### Frame-based exploration generation — 2026-11-12

Found missing original async map lifecycle. MapGeneration runs one native tryGenerateMap per enterFrame after one loading frame, displays original Calculating exploration map... text, advances failed seed by .12341/halves above 1, and publishes body caches only after success. Suppresses constructor draw and replaces ExploreState.createMap setup to defer area controls until ready. Cached maps retain native immediate draw. Clears native constructor premature cache writes; initializes empty area arrays for native execute/stopEffect during pending/no-area states. Exit, Sprite disposal and plugin unload remove frame work/loading labels. Three focused exploration suites, typecheck and both builds pass. Native map geometry algorithm remains unchanged; full geometry diff/visual comparison still open.


### Exploration boundary safety — 2026-11-12

Completed whitespace/local-name-normalized ExploreMap diff against Preload. Geometry changes beyond the already ported async lifecycle add empty-start, missing-direction and null-next checks plus a 130*45*8 boundary-step limit. Native build564 lacks these checks. MapBoundary now ports them, preserving native start-point selection, next-point selection, three narrowing passes and edge processing. Other geometry deltas are equivalent constant inlining, iterator annotations and getStartPoint loop restructuring. Tests cover isolated cells, seam directions, dead ends, missing starts, bounded non-closing paths and successful postprocessing; typecheck/public/private builds pass. Full visual comparison remains unverified.

Before boundary deployment, detached Steam native generation using a cloned planet passed: initial done=false/cache=false, first frame pending, second frame done=true, five areas, one finish and one draw. No live cache/UI changed. Script: /tmp/qolaf-explore-generation-check.js.

Boundary deployment verified in Steam: hot-load active/error empty, version 1.2.0 TS. Detached native map generation still finishes on frame two with five areas and one finish/draw. Native prototype check returns isolated direction -1, empty-area shell null, wrapped seam direction 6. Public SHA 3078773e249393706679eef1156f69d84aa3f2fc2b70a27267984a295396fe1a; private SHA b89d6645622cf7d07c39a220c77a6474d293b1df8665b3e547b2d2574732ba7d. No live exploration action performed.

### Crew and exploration source audit — 2026-11-12

Compared full token streams after whitespace/local-variable-name normalization, then inspected all changed spans. Source-reviewed closures (not runtime screen certification):

- core/hud/components/CrewBuySlot.as: Full token diff identical; no original custom delta.
- core/hud/components/CrewDetails.as: Full token diff moves three field initializers into constructor before first use and relaxes one iterator annotation. No custom functional behavior to replace.
- core/hud/components/CrewDisplayBoxNew.as: Full token diff expands identical chained scale assignment (0.9) and relaxes an iterator annotation. Preserve current native implementation.
- core/hud/components/dialogs/CrewDialogBox.as: Full token diff identical; no original custom delta.
- core/hud/components/dialogs/CrewJoinOffer.as: Full token diff only relaxes two CrewMember iterator annotations.
- core/hud/components/shipMenu/CrewSelector.as: Full token diff only relaxes three iterator annotations.
- core/player/CrewMember.as: Full token diff only relaxes iterator annotations and inlines identical 21600000 training-time cap. Preserve current native implementation.
- core/hud/components/explore/ExploreMapArea.as: Full token diff only relaxes one int iterator annotation. Native area selection, rewards, hover and tween behavior are not custom QoLAF changes.
- core/hud/components/explore/ExploreProgressBar.as: Full token diff only relaxes two Emitter iterator annotations. No custom functional progress behavior.
- core/states/exploreStates/ControlZoneState.as: Full token diff identical; no original custom delta.

ExploreState full diff confirms deferred map completion and null area guards are its functional custom changes, now implemented. ReportState recheck confirms count-once, captured inventory owner, metadata deduplication and late callback UI guards already covered by ExplorationRewards. CrewState recheck confirms only loop annotations/constant coordinate inlining. Two presentation gaps remain recorded: ExploreArea completion label Russo atlas size 20 and CrewDisplayBox name atlas size 14. No crew purchases, training, reward collection or clan actions were performed. This review does not certify current native gameplay or full screen rendering.

### Crew/exploration font parity — 2026-11-12

ExplorationPresentation ports the two remaining font deltas identified above. After native CrewDisplayBox.addLocation, direct size14 font13 name fields in its GradientBox use Russo16. After native ExploreArea.handleFinished, direct size20 font13 completion labels use Russo24. Central bindings and signatures added; no broad font replacement or gameplay changes. Ownership-aware unload restores previous font while respecting another plugin replacement. Four focused tests, typecheck and both builds pass. Source-reviewed status covers original custom deltas, not full live crew behavior.

Deployed public a6349d0df84f174e6b7e80f1b7b0744e8d67d24582b6e08abfc8d3bd1771076f/private 54ed818ad523b89ccfdb01c9bbdbaffa8ea5c35add1467c9be0f5ca1f7bb9b02. Steam hot-load active/error empty. Detached actual native ExploreArea.handleFinished produced EXPLORED!, DAIDRR_24, size20. Detached children disposed; no reward action or live screen state changed. Crew font covered by focused hook test; native crew walkthrough remains open.

### AI/render lifecycle audit — 2026-11-12

Full normalized source diffs for AIChase/AIFollow/AIObserve/AIOrbit/AITurret/Blastwave are identical. Stuck-projectile source deltas map to existing attachment, render lifecycle and contact hooks; 28 focused tests pass. Instant audit found range guard implemented only for tentacles: general instant states still delegated to native tick rendering/unguarded lifetime scaling. Fixed all instant states to validate finite positive projectile/weapon ranges, retain native integer TTL scaling once and 33ms course advancement, with rendering exclusively in frame path. Splitting execute only handles death release. Updated invalid-range regression to cover both ordinary and tentacle rays. Initial tests exposed a stale fixture missing AIStateFactory.createProjectileAI; fixed fixture, then all 18 instant/projectile tests passed. Typecheck and public/private builds pass. Full combat visual certification remains open.

Deployed public eeecb3cc5c8bf2f837bdf066ba0cea98d76fcd33b89e9a9b3a543238ec14d321/private 6351e8ae2a8d5d5e28bf64b7dcf7e7e9b9902929514d8c98056a9c93e057a997. Steam hot-load active/error empty. Detached native Instant prototype check: invalid range keeps TTL100/tick0 and advances time33; valid range75/100 scales TTL81/tick1/time66; repeated execution leaves TTL81. No projectiles fired or server messages sent.

### Warp/landing lifecycle audit — 2026-11-12

GoWarpState only changes obsolete upstream version constant; retain current Haxe negotiation. WarpJumpState functional diff maps to WarpAnimation and PreparedWarp, but lifecycle runtime verification remains open. LandedRecycle review exposed lost replies after plugin disposal. RecycleRequests now reconciles already-issued replies against captured cargo/selection after hot unload, with no UI callback and duplicate suppression. New focused test changes the displayed quantity after issuing, unloads hooks, delivers twice and verifies one original-quantity removal, one commodity credit, no UI and completed recycling flag. Three focused tests, typecheck and both builds pass. No actual recycle request sent. Full recycle/paint/warp visual and source audit remains incomplete.

Deployed public327546fb86f9a1dcc027ed394909f9a597187df8e4a75abdeaf80fb47eea06cd/private8a7822d6b6312c20272fecd58058ba832d83e9c2e436567dd090cfd0cd9a3ad1. Confirmed no pending recycle owner before Steam hot-load; plugin active/error empty/version1.2.0 TS. Late-reply behavior verified in isolated hook fixture only, no live cargo mutations.

### Warp lifecycle regression verification — 2026-11-12

Added WarpAnimation.test.ts using the actual host Hooks dispatcher and typed screen doubles. Verified source creation-time anchoring even when enter is delayed; strict timeout boundary; 800-speed trigger; one .1s fade; no transition before completion; one transition despite repeated completion/direct invocation; idempotent exit; room teardown/unload preventing late completion; restoring original camera step; disposing own glow exactly once; preserving a foreign replacement filter. Combined with ShipWarpLifecycle, three tests pass. No runtime change or redeployment needed. This establishes hook/state lifecycle parity, not live fade appearance or prepared-room-discovery parity; no real warp or gameplay messages sent.

### Prepared warp discovery verification — 2026-11-12

Compared original JoinRoomManager prepare/consume/cancel/completion/error/match paths with PreparedWarp and WarpTransition. Added combined real-host-dispatcher tests: early and late results reused only after visual commit; no duplicate discovery; exit/new Service join/precommit failure/different level/type/destination force fresh discovery; stale results ignored; replaced Service identity cancels a consumed join and restores the old scene listener; committed failure delivered once; unload cancels waiting scene and suppresses subsequent callbacks. Seven tests across PreparedWarp/WarpAnimation/ShipWarpLifecycle pass. Tests use callbacks and detached state doubles only, no server requests. Native room selection, resolved room data, actual live join and visual fade remain unverified; these tests do not close the whole JoinRoomManager audit. No runtime edits/deployment required.

### Missing paint-shop functionality — 2026-11-12

Source diff showed paint modes and Free Test Drive completely absent from port. Added typed PaintShop installer on native enter: original four mode buttons/current label, exact extended/extreme/zero ranges, initial preview and emitter hue, local test-drive values captured before leaving and applied after1s/2s. ShipFactory.createPlayer consumes one-use nonzero engine hue override as original. Native slider is already horizontal; old Feathers assignment fix is unnecessary. Native buy controls unchanged. Timers/added controls removed on unload; active-screen slider-range restoration remains an audit gap. Source field engineColor does not exist in current Haxe, so ownership uses a player WeakMap consumed by typed factory hook. Initial strict compile found nullable engine; guarded before final passing typecheck/tests/builds.

Two focused tests cover exact ranges, mode transition, captured ship/engine values and delayed local application, without network requests. Final public b41352926b84c6a2b548db327292702562178bdb1467788a4d5659433cfb389c/private4a99546d11b1805f9b39ab3ed9efb68c670d698b03637064de1b170f4581ca6d deployed; Steam hot-load active/error empty. Detached native sliders/buttons/font/filter check produced Original label, four mode buttons at original coordinates, Free Test Drive at270,485, brightness[-.18,.04] and ColorMatrixFilter. Harness bypassed native enter/exit to avoid world transitions, then disposed detached controls. Actual station walkthrough/test-drive appearance remains unverified. Script /tmp/qolaf-steam-check/paint-check.mjs.

### Paint-screen unload ownership — 2026-11-12

Closed prior active-screen bounds gap. PaintShop captures actual native minimum/maximum before applying mode and restores still-owned limits on unload via native setters. A range changed by another plugin is left alone. Exiting a screen drops its snapshots so later disposal cannot mutate dead controls. Regression additionally verifies added controls removed and second delayed test-drive application cancelled; committed first local appearance remains intact. Both focused paint tests, typecheck, and public/private builds pass. Full live station/test-drive appearance still open.

Final deployment public3d6f7d5c7e36c7ab2bd5c34784836ee9e1f5f12dc19dfb73db8ae7badb2ec1a0/private6d6213b8276ac9075930d9f20bd1c961dec4b1a3e9e1353c342d2b89145d5b9e; Steam hot-load active/error empty. Also inspected native Slider.fraction: zero-width ranges explicitly return0, so Un-Paint zero bounds do not introduce NaN geometry.

### Fleet, upgrade and artifact menu source review — 2026-11-12

FleetState/UpgradesState full normalized token diffs identical to Preload. ArtifactState2 full lifecycle mapped to ArtifactMenu plus NativeArtifactFavorites direct share handler and NativeArtifactDraft composer insertion. Event routing differs structurally but closes native menu and queues unsent guarded insertion as original. Latest user chat requirement supersedes source unconditional chat suppression: only expanded artifact view hides chat. Eleven focused menu/context/draft/chat tests pass. Full ArtifactOverview and live visual parity are separate open scope.

IntroState review found star fade mismatch: native enter asynchronously fades canvasBackground after voice preload, while port BackgroundLayers already exposes stars at configured alpha. Original fades canvasStars from0 to configured brightness concurrently and restores immediately for F/G skipped intro. Current native code inspected from build564. NativeMusicPlayback covers stopEffects+stopMusic delta; small intro Russo fonts remain to inspect. This is now an explicit partial audit finding, not marked complete.

### Intro star fade parity — 2026-11-12

BackgroundLayers now owns an intro-scoped brightness factor. Starts at0, follows native background tween setter (therefore preserving delayed voice preload, duration and easing), restores configured brightness on enterRoaming/exit, and adopts already-running intro progress when installed. Brightness edits during intro scale current progress instead of skipping the fade. Other scenes cannot steal ownership. Cleanup clears intro before disposing stars/restoring upstream alpha. Expanded existing actual-upstream parallax fixture tests cover fresh and already-running intros, skip, early exit, settings changes and layer teardown; all three tests pass. Typecheck and public/private builds pass.

Deployed public97ed9db2afb371f0858b396f0dc904224e7d12f4352c71eb64b7ed346f02c2b4/private001bd6016d99235801d68b1b4d0adf54bd6f6461046db1e3579cde26fcced57a. Steam hot-load active/error empty. Detached native IntroState lifecycle hooks with native entry/transition intercepted produced star alpha0 at entry, .15 at half fade, .3 on completion with configured.3. Restored original alphas synchronously; no intro/room transition/audio/gameplay requests triggered. Actual intro visual walkthrough and small font changes remain open. Script /tmp/qolaf-steam-check/intro-stars-check.mjs.

### Safe-zone weapon input parity — 2026-11-12

PlayState source handleWeaponFire adds all-weapon cancellation and one fire-off per safe-zone visit; current Haxe only suppresses fire-on. NativeSelfMovement guarded new commands but did not stop held fire. Native hotkey parentheses also allowed switching with selectedHotkey=null while weaponIsChanging. WeaponInput ports both source changes, keeps key20..24 priority and fireWithHotkeys behavior, and uses existing cancelWeaponFire to avoid releasing stale charge. Null player/ship/HUD/settings gates protect transitions. Typed hotkey/selected-key signatures added.

Four focused WeaponInput/NativeControlTiming/WeaponFireOwnership tests pass; typecheck and public/private builds pass. Regression covers held fire, repeat safe updates, exit/reentry, switching already in progress, same selected key, lowest key priority and ordinary release. No actual fire commands sent. Remaining broad PlayState aim/debug/input mapping not certified by these tests.

Deployed public980aef76d088a3093d8a1bda56e40ce36e7816f206df5d8a2185e2a94cc37be4/private5aacf85476f69d6e7b7576f52545bebf9564594068e1f93b7d22b7110c2de006. Steam active/error empty. Detached installed native PlayState handler with fake player/weapon/command sink: two safe-zone updates generated exactly [[3,false]], no weapon changes while switching, fire=false and fireWithHotkeys=false. No actual network commands; script /tmp/qolaf-weapon-input-check.js.
