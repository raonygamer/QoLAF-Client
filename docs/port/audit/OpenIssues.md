# Open port issues

Current user acceptance target: functionally workable, not exact pixel parity.
Work in substantial implementation batches, then run affected checks and repeat.
Do not spend completion time on pixel-level comparisons. Radio stays excluded.

This ledger tracks user reports and source/runtime evidence. A code change or
passing test alone does not close a visual parity issue. Completed work and
screenshots are recorded in [LiveComparison.md](LiveComparison.md).

Current source-status reconciliation: 2026-11-12. The table is a navigation index,
not a completion certificate. Earlier notes below preserve historical tests and
screenshots; they do not verify the current dirty worktree. Recent turns ran focused regressions and isolated Cage probes for specific
reported defects. A broad gameplay and original-SWF comparison remains unfinished.

Private `/serverip` now observes the selected browser SDK transport. Steam
verified both Game and Service hostname reports and retention across hot-disable/enable.
Connections established before any observer was installed still report unavailable. This is not an exhaustive list of gaps: complete semantic
coverage of the source inventory and removal of remaining Raw/any are unfinished.
Radio remains excluded by user request. Do not count it as an outstanding port.


| ID | Issue | Status and evidence | Next verification / work |
| --- | --- | --- | --- |
| UI-01 | Target bars switch as nearby units appear | Fix pushed in `981af14`: removed radar-driven automatic selection absent from original. Integration regression passes; personal weapon/pet hits still select. | Observe multiple nearby units without firing, then compare actual hits and manual lock against original. Nearby rows retain source sorting. |
| UI-02 | Mission XP reward renders one character per line | Autosized HTML fix pushed in `981af14`. Haxe passes stale hit-area width to HTML compositor; regression covers narrow prior width. | Verified the exact reported timed mission locally: XP 2093 (+628) and boost icon render horizontally. Screenshot `/tmp/QoLAF-TimedText.png`. Reported vertical-letter defect closed; general UI parity still tracked separately. |
| UI-03 | Hover tooltips clip text, including artifact descriptions and Players label | User confirms still broken after the first text fix. Native WrapText measures with OpenFL but paints with bitmap fonts. Adapter now measures using the same Starling HTML compositor; verification in progress. | Players tooltip verified after reload at screen edge: full text, green shortcut P, matching measured/rendered bounds. Also verified Armorlock Protocol and Recycle Generator multiline tooltips: title, stats, wrapped effect text and Fitness are readable within their backgrounds. Exact Phase Nullifier sample and broader DPI/image cases remain open. |
| FX-01 | All emitters/thrusters look stepped below display FPS | Frame-delta adapter implemented with rendered engine mounts, fractional emission, lifetime and friction/gravity scaling. Live probe observed particle advances across 1,618 frames without simulation ticks. | Compare thruster appearance against original during movement; audit remaining visual limits and fast-forward setup. Current native rainbow effects retained. Simulation unchanged. |
| FX-02 | Moving world text looks stepped | AF/pet labels now follow ship draw: live probe checked 10,147 positions with zero mismatches. Combat text now tracks rendered owners with independent rise, fractional lifetime and owner-reuse guards; tests cover 30/60/120/180 FPS. | Live native-particle probe passed 360 frames (298 without simulation ticks), zero mismatches. Source turret/spawner offsets and 120-unit rise cap ported. Newest-slot ownership now matches source: replaced numbers keep independent rise and cap, while healing follows its own slot. Regression passes. Real combat comparison and other world labels still require audit; full parity remains open. |
| CHAT-01 | Actual chat renderer/composer is incomplete | Rich document, browser input transport and bitmap editor are now active on native TextEntry. Live formatted draft, Ctrl+A selection, pointer drag and command Tab completion verified. Source offsets, global restriction, serialized limits and font changes covered by native-hook tests. | Original Color/Size toolbar and popup are active, including bitmap hex input. Live FF6600 and 24px selection changes verified; original color popup visually compared. Context-menu/clipboard interactions and resize/focus cases need broader verification. Port original integrated Simple/Advanced panel, links/artifact tokens/images and sizing. Word navigation/double-click selection, live IME and full original comparison remain open. Preserve current game messaging rules. |
| CHAT-02 | Chat autocomplete parity incomplete | Command, emoji and friend completion are implemented in `ChatCommandAutocompletePopup.ts`; IPC/saved-visual providers, history suppression, Tab ordering and source metadata were added in the current worktree. | Live scrollbar/resize/focus/custom-registry comparison remains open. Current code is not covered by the earlier screenshot sign-offs. |
| CHAT-03 | Source command coverage | Parallel `/resync` is implemented in `NativeClockResync.ts`; `/qipc3dbg` is wired to existing diagnostics, and private `/ssv all` uses the visual broadcast queue. Current public/private metadata has been inspected. | `/serverip` Game/Service reporting and hot-reload retention passed focused tests and Steam checks. Audit remaining command semantics against source and execute current regressions when testing resumes; do not advertise unimplemented handlers. |
| MAP-01 | Orbit colors differ from original | Fixed canvas-backed vector texture channel swap via DisplayTexturePixels. Live Fulzar map now renders blue orbits matching SWF; safe-zone ring tint also corrected. | Color defect verified in OrbitBefore/OriginalOrbits/OrbitCorrected screenshots. Actual graphics-context restoration still needs live verification; restoration draw path is regression-tested. |
| PORT-01 | Full semantic/type/UI parity | Implementations exist for aim assist, settings, rich chat, artifact workflows, map/boss presentation and loading/recovery. Their presence is not proof of source parity. Remaining Raw/any and unreviewed source differences are real unfinished work. | Continue method-level source comparison; verify screens and timing against the original using the user accounts after testing resumes. Preserve newer vanilla gameplay and the user exclusions. |

## Gameplay invariant

Preserve the current Haxe game's gameplay, especially shields and corrected
corrosive percentages. Port client features and presentation around it. Do not
restore old gameplay workarounds to make the visuals match.

## Simple chat lifecycle audit

The native Haxe `ChatSimple` used `message.nextTimeout` instead of
`message.timeout`, retained an extra eleventh row and rebuilt on every receive.
`NativeSimpleChat` now ports the original ten-row projection, muted-row filtering,
100 ms receive batching and earliest visible expiry (including equality at the
expiry timestamp). Switching back from Advanced reprojects after its cached
native stage listener. Regression tests cover those boundaries and preserve
Advanced's native receive path. All 208 tests and type checking pass.

This is lifecycle parity only. Simple still uses the native WrapText projection;
original bitmap rich rows, image entries, role hover, clipping and panel geometry
remain part of CHAT-01. This change has not yet been verified in the live browser.

## Integrated chat geometry

`ChatLayout` ports the source 680×500 stage-space fit and narrow-window rules.
The native Simple projection now uses the source viewport mask and bottom
clipping; Advanced's background, viewport and existing rows reflow to that fit.
The integrated composer sits immediately below the panel, with the source
background, tab inset/gap/height and 39px input row. Opening the composer opens
Advanced temporarily and closing restores Simple unless Advanced was already
open. The first browser check exposed the old preference hook overwriting this
placement; both hooks now share the source fit, with an integration regression.

Remaining CHAT-01 gaps include the original tab skin, bitmap message renderer,
virtualized Advanced rows, rich links/images/context interactions, and emoji and
image controls. Current toolbar reserves space only for implemented Color/Size
controls. Geometry work does not establish complete chat parity.

## Received bitmap chat projection

`NativeChatMessages` now draws Simple and Advanced rows through the ported
`RichBitmapFontTextRenderer`, using the original Verdana48 bitmap format, default
14px (or the stored font-size setting), full opacity, wrapping, inline styles and
source animation flags. Native queue/filtering and message delivery remain in
place. The adapter keeps the upstream field only as the native text-property
boundary, detaches it from rendering, and disposes it with its row. Cleanup
restores surviving native fields. Tests use actual atlas metrics and source
animation helpers, covering colored/sized glyphs, wrapping, font changes, new
rows and disposal. All 211 tests pass.

This does not finish Advanced's virtual list, artifact label resolver, embedded
images, role/link hover or context menus. The source-rendered rows are the next
foundation for those features, not a claim that the chat port is complete.

## Chat control theme

`NativeChatTheme` applies the original AstroTheme integrated tab colors, 0.86
skin opacity, Russo 12px labels, selected/disabled label colors and 12px horizontal
padding to existing native channel buttons. Native selection and event behavior
remain intact. Bitmap input uses the source idle/focused/disabled skin colors,
0.86 opacity and right/bottom padding. Disabling integration restores the native
tab appearance. The regression covers all these visual state transitions and
cleanup; all 212 tests pass. Remaining theme work includes the original prompt
and missing emoji/image controls, alongside the broader CHAT-01 work.

## Advanced message context menu

Ported the source ChatMessageContextData and ChatMessageContextPopup, preserving
310px width, 32px rows, panel clamping, outside-click cleanup and action order.
Advanced rows now open this menu on right click; left clicks remain available for
scrolling. Browser coordinates use the native canvas/CSS transform and require
the topmost hit to belong to the chat viewport. Copy uses source plain-text
parsing. Player/room IDs remain separate, system/self blocking is excluded, and
clan metadata uses the original PlayerObjects/Clans lookup flow. Block invokes
the original ignore service action and removes that player's local history.

Live right-click/copy verified with local /echo output. Copied text was pasted
into an unsent draft and then cleared. Full player/clan lookup, block behavior,
covered-panel rejection and resize/scroll cases need broader integration testing;
no player was blocked. Source popup and metadata tests pass (214 total).

## Emoji picker

Ported the original ChatEmojiPicker, ChatEmojiPickerModel and EmojiPickerCatalog:
1,391 atlas-backed emoji in eight source-ordered categories, 12×5 visible cells,
category highlights, scrollbar dragging, wheel paging, variation selectors and
source charcoal styling. Connected the picker to the rich editor's selection
replacement and serialized length limits; the composer reserves its original
36px button plus spacing. Native input retains focus after insertion.

All catalog entries resolve against the actual Verdana48 atlas. Tests cover
category/reset/clamping, scrollbar gestures, integer cell hit-testing, full-color
mesh positions and emoji dispatch (216 tests total). Emoji autocomplete and image
shortcuts are still separate open features. Live wheel and insertion verification
is in progress.

Emoji wheel/category selection/insertion now verified live after correcting the
Starling wheel bridge and editor atlas choice. Original picker compared visually;
217 tests pass. New comparison evidence: original chat tabs are roughly 100px
wide, while the current adapter sizes them to text plus padding. Trace inherited
Feathers minimum width and correct it; tab geometry parity is not yet established.


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


Image-shortcut dependency port: added the complete source ChatDiscordImageLink
parser/fallback/label helpers and ChatImageShortcutStore. Storage uses plugin
storage instead of SharedObject; preserves the original 64-entry cap, alias
normalization, sorted entries, exact direct-image URL validation, updates at
capacity, and memory-only operation when persistence fails. Prefetch is an
explicit injected dependency for the upcoming image cache, not a fake loader.

Four tests cover signed Discord query preservation, provider fallback order,
source offsets, markup-attribute exclusion, channel policy, persistence/reload,
malformed records, alias isolation and capacity. No network image fetches or
player messages were performed. These dependencies are not wired into the live
composer yet. Remaining required work: actual image cache/decoder and rendering,
source picker with its two bitmap fields and pagination, channel gating,
selection insertion, :alias: expansion, and live comparison. Do not count the
Img feature as complete based on these helper tests.


Image picker source port added: original 430x236 panel, two bitmap input
contracts, validation feedback, five-row pagination, saved-entry selection,
removal, prefetch callbacks, outside touch and focus cleanup. Fixed the AS3 int
page-index conversion explicitly; tests exercise an entry on the second page.
BitmapInputAdapter now forwards prompt properties to its bitmap editor view.
Consolidated the previously existing rich/ChatDiscordImageLink with the tested
chat-level class so the actual markup parser and picker share one implementation.

224 tests and typecheck/build pass. Picker tests use a fake input boundary and
real ported toolbar controls; they do not prove live DOM focus or glyph placement.
The picker is not installed in NativeChatFormatting yet: cache/decoder/view
integration and live comparison remain required. No fake cache or no-op loader
has been attached to the game. Next: port ChatImageAsset/ChatImageCache and the
browser decoding/upload boundary, then wire composer controls and image views.


Image asset/cache port completed as typed modules. Preserves GPU plus retained
CPU byte accounting, minimum/default frame delays, shared pending loads,
original-first normalized cache keys, prefetch references, synchronous hits,
24-entry/96 MiB LRU thresholds, live-reference protection and callback isolation.
The cache is instance-owned with injected loader/clock so the eventual game
adapter can share one cache across views without emulating Flash globals.

Five tests exercise reentrant prefetch release during delivery, oversized
textures, reference reservation, consumer exceptions, retry after failure,
last-use eviction, normalized signed keys and exact resource disposal. All 229
tests, typecheck/build and changed-file formatting pass. This does not validate
GPU upload or network decoding; integration remains unfinished.

Inspected actual compiled openfl.display.BitmapData in the extracted game:
fromBytes/fromBase64/fromFile return null, while fromCanvas constructs a bitmap
from lime.graphics.Image.fromCanvas. Browser decoding must feed fromCanvas and
then Starling Texture.fromBitmapData. A direct port of Flash Loader.loadBytes
would not work. Preserve the source GIF animation threshold (60000 pixels),
4096 dimension / 8000000 pixel bounds, 20 MiB encoded bound, 20-second per-candidate
timeout, candidate fallbacks and retained restoration pixels in that adapter.


Incremental GIF decoder and synchronous facade ported from ChatGIFDecodeTask /
ChatGIFDecoder. GIFBytes adapts browser Uint8Array responses to the source's
ByteArray read operations; compressed sub-blocks are assembled once. Restored
AS3 zero-filled fixed vector sizes for LZW prefix/suffix/stack/output, corrected
converter shift syntax, and preserved interlace passes, transparency, disposal
2/3, frame delays, source dimension/frame-count/total-pixel limits. Incremental
nextFrame still returns at most one composited bitmap per call.

Independent Pillow-generated fixtures exercise interlaced local/global palette
and LZW behavior plus four animated disposal/transparency frames. Every decoded
RGBA frame matches the independent hash. The facade test checks ownership of
successful frames and disposal of all partial resources on a late stream error.
Fixtures can be regenerated with scripts/GenerateGIFFixtures.py (Pillow 13.0.0).
All 233 tests, typecheck/build pass. These are CPU pixel tests using a bitmap
boundary fixture; actual Haxe bitmap upload, network timeout/fallback behavior,
frame scheduling, composer wiring and live image comparison remain unverified.


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
/tmp/QoLAF-ImageProbeGIFThird.png. Image assets reported 512 and 2048 bytes,
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


ChatImageThumbnail source port added. Preserves 220x140 maximum preview bounds,
no upscaling, 92x16 loading / 110x16 failure geometry, source bitmap status text,
cache-hit geometry priming, stale-generation release, and frame playback driven
by the native enterFrame event and source elapsed-time deadlines. Catch-up keeps
the original N+1 transition bound. All presentation is complete before invoking
size callbacks because a virtualized row may dispose/recycle itself there.

Four tests cover aspect limits, cached reopening without re-invalidating layout,
late load delivery after recycling/disposal, placeholders, exact GIF deadlines,
bounded catch-up, stopped listeners and reentrant size callbacks. 245 tests,
typecheck/build and changed-file formatting pass. The thumbnail is not yet bound
to chat message rows; this does not claim live playback or image-viewer parity.
Next: share cache between composer and received-message views, port source row
layout/image placement and viewer interaction, then verify actual chat rendering.

Advanced received-message rows now share the composer's session image cache.
New messages use the source channel policy and first image link, collapse that
link in rich text, and position the thumbnail at the message body using the
renderer source-index map. Text and preview align along the row's bottom edge;
preview-size callbacks reflow the scroll container and retain its prior position
or bottom-follow state. Row removal releases its cache reference; session cleanup
restores the original fields and disposes the shared cache. Decoder creation is
deferred until the first image request.

The row regression verifies channel filtering, asynchronous preview dimensions,
body offset, bottom alignment and reference cleanup. Typecheck, build, all 245
tests and changed-file formatting pass. This integration has not yet been
visually verified in live chat. Previously materialized rows lack source message
metadata and deliberately do not infer channel permissions from text. Simple
chat image placement, viewer interaction and alias expansion remain open.


ChatImageViewerWindow source class port added, preserving native display-list
controls, 700x520 default / 320x220 minimum geometry, stage constraints, staggered
placement, URL deduplication and bring-to-front, title-bar movement, grip resizing,
non-upscaled centered image layout, GIF deadlines, loading/failure labels and
cache-reference disposal. Its factory accepts the session cache and native clock;
AS3 vector initialization and uninitialized primitive fields were adapted explicitly.

Two regression tests exercise geometry, deduplication, animation boundaries,
small-stage resize constraints, pointer identity, move/resize, close listeners,
failed requests and late delivery after disposal. Typecheck/build and all 247
tests pass. This class is not yet wired into message clicks and has not been
visually compared live. Next integrate hit testing, session ownership and viewer
opening with Advanced/Simple chat; preserve existing context/scroll interactions.


Advanced chat now opens the source image viewer on native ended-touch events.
Activation checks actual visibility, viewport clipping, topmost hit ownership,
row bounds and thumbnail bounds. Session disposal removes the touch listener
and closes that session's windows before releasing its cache.

Live verification caught and fixed two integration defects: the viewer initially
tried to resolve the ported ChatComposerFormatButton from the upstream registry;
it now uses ChatFormattingClasses. The regression explicitly rejects that class
from the supplied upstream resolver. Static PNG uploads also swapped red/blue
when OpenFL retained a canvas-backed image. Reading getPixel32 before upload
materializes normalized pixel data. Re-uploading the same live bitmap after this
read changed the incorrect yellow background/cyan diagonals into the expected
cyan background/yellow diagonals. Evidence: /tmp/QoLAF-ViewerColorProbe.png.

After rebuilding and one controlled reload, the new production path rendered a
440x280 local PNG as a correctly colored 220x140 thumbnail, then opened the native
700x520 viewer from a real mouse click. Verified title, source placement, centered
unscaled image, title-bar dragging (+200,+40), grip resizing (to 430x310), image
aspect preservation and close control. Screens: ViewerCorrectedRow, ViewerOpened,
ViewerMoved and ViewerResized under /tmp/QoLAF-*.png. Live cache references were
1 after viewer close and 0 after row removal (ViewerCleanup.png). Probe rows and
globals removed, temporary host dist PNG deleted, console closed. No player chat
message was sent. Typecheck/build, all 248 tests, formatting and diff checks pass.

This verifies Advanced PNG viewer integration, not full chat parity. Actual GIF
playback visual comparison, Simple-chat image layout, alias expansion, external
image-host CORS and comparison of this viewer against the running SWF remain
open. Earlier upload-probe claims did not cover this canvas-backed PNG color bug.


Simple-chat image layout is now integrated with the shared session cache. Source
ChatSimple behavior retained: prefetch on receive, ten-message/100ms projection,
first-link thumbnail, invisible spacer sized from actual bitmap-font line height,
source-index positioning, newline before visible suffix text, secondary image
links rendered as labels, reuse by message identity and release when no longer
visible. Native WrapText owns text and thumbnails together so the same clipping,
vertical shift and transforms apply; layout hooks reposition attachments after
width/font reflow. Image completion queues the next refresh rather than mutating
text during label validation.

Regression uses original Verdana atlas metrics and actual rich renderer: checks
channel policy, shared prefetch/load, spacer sizing, source positions, asynchronous
reflow, suffix/link handling, reused entries and removal cleanup. Typecheck/build,
all 249 tests, formatting and diff checks pass.

Live local-only 220x140 two-frame GIF showed correct red/left-white and
blue/right-white frames in Simple chat, with the author bottom-aligned and suffix
on the following line. Screens: /tmp/QoLAF-SimpleGIFOne.png and
/tmp/QoLAF-SimpleGIFTwo.png. Switching to Advanced retained the cached image;
clicking opened the source viewer, whose actual playback showed both frames
(/tmp/QoLAF-GIFViewerThree.png and /tmp/QoLAF-GIFViewerFour.png). This verifies
native frame-driven playback, not exact timing against the SWF. The probe was
inserted directly into the local display queue; no player message was sent.
Removed probe from queue and both views, closed viewer, verified reference count
zero and only the renderer remaining under Simple WrapText (SimpleCleanup.png).
Temporary GIF deleted and console closed. Original SWF visual comparison,
external-host CORS, alias expansion and remaining chat interaction parity remain
open. Advanced suffix text can be covered by the thumbnail; compare its source
layout before deciding whether that needs adaptation.


Saved image aliases now expand on the closing colon in the composer using the
original ChatEmojiAutocompleteParser's visible-text token boundaries. The shared
picker store resolves aliases case-insensitively; replacement goes through the
rich editor's visible range operation, retaining styles and length restrictions.
Only source embed channels participate (including privateSaved -> private), with
integration/visibility/activity guards and a reentrancy guard. Browser selection
changes also recheck the token after the input binding updates its selection.
IME composition is explicitly excluded until compositionend commits the text.

Two regression tests cover source URL/path/namespace boundaries, open and closed
tokens, selection rejection, styled replacements, unknown aliases, channel policy,
IME completion and listener cleanup using the actual editor model/input binding.
Typecheck/build and all 251 tests pass. This alias interaction has not yet been
verified live; the currently open browser still runs the previous build. The
original emoji/friend autocomplete popups and their command-help positioning
remain unported. Next verify saving/typing/removing a temporary alias live and
continue those suggestion popups; do not interpret alias support as completion
of the autocomplete system.


Emoji autocomplete catalog/model port added. EmojiShortcodeCatalog preserves all
1,391 source CLDR 48 names, canonical shortcodes and keyword strings, picker order,
Unicode/VS16 conversion, normalization cache, seven ranking levels and the four
compatibility aliases. ChatEmojiAutocompleteModel preserves ranked buckets,
suggestion caching, max-results cap, copied matches, wraparound selection and
selected completion. ChatCommandSuggestion now accepts optional display text and
emoji scalar while preserving existing command completion argument positions.

Regression compares all three full catalog arrays against hashes independently
computed from the original AS3 literals, resolves every canonical shortcode back
to its original index, verifies scalar/renderable emoji mapping, all seven ranks,
compatibility aliases, non-exact keywords, selection/caching and defensive copies.
Typecheck/build, all 253 tests and diff checks pass. No live reload was needed for
this unbound data/model addition. The shared suggestion popup still needs emoji
preview rendering and integration with command precedence, caret tokens, closing
colon selection, keyboard/mouse acceptance and command-argument help placement.
Saved image alias live verification from the previous entry also remains open.


Emoji autocomplete now uses the shared native popup with source 40px preview
column, 20px bitmap emoji, canonical display text, descriptions and pooled rows.
Composer integration tracks visible caret tokens, gives active command-name
suggestions priority, stacks passive command argument help above emoji choices,
and supports ArrowUp/Down, Tab, Escape and closing-colon acceptance. A closing
colon preserves an already-selected match; otherwise it resolves exact canonical
or compatibility aliases before ranked fallback. Selection replacement uses the
rich editor and does not submit chat. Composition, hidden/inactive input and
integration-off states are guarded. Rejected replacements do not recursively
retry the unchanged closed token. History navigation dismisses both popups.

Live SWF comparison for ':grinning' exposed an existing shared-popup font mismatch:
device Verdana omitted/distorted underscores compared with source bitmap labels.
Both command and description fields now use verdana16_bitmap (source registry
choice at 12/10px). After rebuild/reload, popup geometry, preview placement, row
ordering and bitmap labels visually match the same SWF query. Evidence:
/tmp/QoLAF-OriginalEmojiSuggestions.png and /tmp/QoLAF-EmojiBitmapSuggestions.png.
Live ArrowDown+Tab and ArrowDown+closing-colon inserted the second emoji and
closed suggestions (EmojiTab.png, EmojiColon.png). '/echo :grinning' displayed
passive help above the emoji panel (EmojiArgumentHelp.png). Both original and
ported drafts were cleared without sending messages. No temporary files or
runtime probes were installed.

New regression verifies preview geometry, display/completion separation, bitmap
font selection, pooled-row hiding and keyboard completion. Full suite: 254 pass;
typecheck/build, formatting and diff checks pass. Remaining: saved-image alias
live check, more mouse/wheel/occlusion cases, small-stage help stacking and the
friend/player suggestion system. This is not a claim of full chat parity.

Friend/player autocomplete source parser and model are now ported as readable
TypeScript. Parser uses decoded visible offsets, source punctuation/email
boundaries and the 64-character limit. Model preserves exact/prefix/word/substring
ranking, identity deduplication, status-first metadata, ship skin/context,
wraparound selection and defensive match copies. Explicit rosters remain separate
from friends: IDs disambiguate duplicate names and names containing @; spaces and
quotes follow the original quoting/fallback rules. Suggestion metadata is appended
to the existing constructor without changing existing call argument order.

Three regressions cover token boundaries, Unicode/spaces/selection limits,
ranking and metadata, duplicate identities, selection, roster isolation, quoted
names and ID fallback. Typecheck and full build/test suite pass (257 tests).
This is not yet user-visible: native popup friend previews, section headings,
roster refresh/source selection and rich-editor replacement wiring remain open.
No browser reload or game input was used for this change.

Shared native autocomplete popup now supports the original 20px section heading
(bitmap Verdana 12, cyan), including row capacity, row/preview offsets, scrollbar
placement and drag math. Optional ship texture resolver adds pooled native images
in the source 40px visual column, fitting 36x30 without upscaling, centered with
rounded offsets. Texture changes readjust the image; absent/failed textures hide
old previews and restore the full text width. Shared textures are not disposed.

Regression tests cover heading changes and constrained capacity, scrollbar top
press without jumping, thumbnail dimensions/position/reuse and resolver failure.
Typecheck, build/full suite (259 tests), formatting and diff checks pass. These
capabilities are not wired to friend completion yet. Friend paint filters and
metadata hydration, native roster source/refresh logic, insertion/keyboard/wheel
integration and live comparison remain open. No live reload was needed here.

Ordinary @friend completion is now connected to the rich native composer. It
reads online friends before persisted friends, hydrates skin and fleet paint from
live players (ID first, otherwise unique case-insensitive name), resolves account
IDs without using transport playerKey, and lazily requests online friends with a
30-second throttle. Disposal suppresses late callbacks. Skin textures resolve
through Skins -> Ships -> native texture service, with cached misses as in source.
Native pooled previews use the upstream ShipFactory color-filter path; unchanged
paint reuses filters, changed/default paint and disposal release owned filters.

The friend popup follows command-name/emoji precedence, stacks under passive
command help, handles arrows/Tab/Escape and mouse row acceptance, and replaces the
visible token plus trailing space through the rich editor. History and inactive
composer states dismiss it. IPC-specific commands do not fall back to friends:
the independent IPC/visual-reset providers are still unported and remain open.

Roster regressions cover persistent versus transport IDs, ambiguous names,
texture cache, refresh recursion/throttle and late callbacks. Integration test
uses the native event-invocation fixture plus actual rich editor model to verify
styled replacement, keyboard completion, command-help stacking, IME and IPC
exclusion. Paint regression verifies filter reuse/replacement/disposal. Full
build/suite passed 262 tests before the final paint-only regression was added;
all 8 popup tests and typecheck passed afterward. Live SWF comparison remains
required for this newly wired feature; no reload or game input in this change.

Live friend autocomplete comparison completed for the two logged-in accounts.
One F5 down/up pair loaded the latest local bundle; autologin reached the safe
station and diagnostics reported connected with zero runtime errors. Typing @
showed the reciprocal online friend, ship thumbnail, level and persistent account
ID. Native Tab inserted the name and trailing space and dismissed suggestions.
The SWF's @ entry showed matching popup position relative to its composer,
508x44 single-row panel, 40px visual column, bitmap labels and metadata layout.
Accounts/ships differ, so this is not a same-texture color equivalence test.
Evidence: /tmp/QoLAF-FriendSuggestions.png, /tmp/QoLAF-FriendTab.png,
/tmp/QoLAF-OriginalFriendSuggestions.png. Both unsent drafts were cleared;
/tmp/QoLAF-FriendCleanup.png confirms the local composer is empty. No messages sent.

Source input audit found two remaining shared-popup differences, now fixed:
mouse-down selects/highlights a row before mouse-up acceptance; scrollbar touches
stop propagation, update during stationary phases and release drag state when
cancelled. Regression exercises press without acceptance and cancellation after
a stationary drag. Typecheck, build, full suite (264 tests), formatting and diff
checks pass. These final touch changes were tested in fixtures, not another live
reload. Remaining: multiple friend rows/live mouse-scroll cases, same-ship paint
comparison, IPC/saved-visual roster providers and the previously recorded chat
and broader port gaps.

During the Tab screenshot several target-bar text labels temporarily disappeared
while bars stayed visible; subsequent cleanup screenshot showed them restored.
This may relate to the earlier intermittent label redraw issue; cause remains
unproven. Preserve this observation for renderer/cache investigation rather than
claiming the full scene matches based on the popup alone.

Investigated intermittent target/vanilla label loss in the live Haxe renderer.
Read-only scene inspection found affected text still had glyph geometry (for
example 52 vertices for 'No nearby enemy' and 100 for the safe-zone message), no
pending recomposition, and unbatched meshes. Parent exclusion tokens were already
-1, so the observed failure is not proved to be a stale parent token or missing
layout. Runtime probe evidence: /tmp/QoLAF-LabelCacheAudit.png and
/tmp/QoLAF-LabelCacheDetails.png. Switching seven affected labels to batchable
restored visible labels (/tmp/QoLAF-LabelBatched.png), motivating a batching fix.

First attempt covered only port-owned font instances; reload reproduced the loss.
Runtime inspection then confirmed port target labels were batchable but vanilla
safe-zone text still used upstream font26 with batchable=false. That attempt was
not sufficient (/tmp/QoLAF-LabelFixSettled.png, /tmp/QoLAF-LabelFixAudit.png).
Final implementation hooks native BitmapFont.fillMeshBatch so upstream fonts and
port font aliases share the batching path while retaining native plain layout.
The source rich compositor also sets batchable for plain as well as rich output.
TrueType compositors are untouched. Temporary runtime state was removed by reload.

Typecheck/build and full 264-test suite passed before extracting the native hook
into BitmapFontBatching.ts; afterward typecheck/build and the added hook regression
passed. Regression verifies upstream instances, native argument preservation and
cleanup. Existing compositor test now verifies batching for both plain and HTML.
This is a renderer workaround supported by the live isolation, not a claim that
the deeper Haxe/WebGL defect or all previous rendering issues are resolved.

Final live check after the broader hook: automatic login succeeded; target and
safe-zone labels remained visible while showing friend suggestions, after the
scene settled, and after Tab completion/clearing the draft. Screenshots:
/tmp/QoLAF-AllBitmapLoaded.png, /tmp/QoLAF-AllBitmapSettled.png,
/tmp/QoLAF-AllBitmapCleanup.png. Diagnostics connected=true/runtimeErrors=0.
No messages were sent; console is closed and composer empty. The live bundle
used the same hook body before its extraction into a dedicated module; extraction
was typechecked, built and tested without a redundant reload. Longer gameplay
sampling and non-text separate-mesh interactions remain verification work.

Autocomplete wheel routing now follows the source's explicit display-list hit
check. Previously it selected the first visible popup and used only CSS bounds,
so covered suggestions could steal wheel events and command argument help above
another popup could not receive them. ChatAutocompleteWheel checks each visible
candidate, maps CSS coordinates to native stage coordinates, verifies the topmost
hit belongs to that popup and then consumes the event. Zero deltas, hidden/alpha-0
ancestors, detached nodes and right/bottom boundary points are excluded.
Regression covers scaled/offset coordinates, stacked popups, covering windows,
exclusive edges, zero delta and hidden ancestors. Typecheck/build/full suite:
266 pass. Live wheel occlusion check is still pending; no reload performed.

Follow-up live screenshot /tmp/QoLAF-BitmapFollowup.png still shows all target,
empty-target and safe-zone labels after the previous broader batching fix,
with the chat composer empty. This is another sampled observation, not exhaustive
continuous rendering verification.

Source autocomplete acceptance audit: mouse-up explicitly dismisses/redraws
before emitting completion; Tab intentionally leaves state intact for the editor's
CHANGE event. Port previously used the same non-dismissing path for both. Mouse
acceptance now dismisses first, including when an editor rejects insertion, while
Tab retains the source behavior. Passive command help remains non-completing but
now paints its selected row at source alpha 0.88 (previously forced transparent).
Regression distinguishes rejected mouse versus Tab completions and checks passive
help highlighting/non-insertion. Typecheck/build/full suite: 267 pass; formatting
and diff checks pass. This source/fixture verification did not require another
live reload. Live wheel occlusion and longer gameplay audits remain open.


Native vector texture upload audit resolved MAP-01. TextureManager draws OpenFL
sprites into a BitmapData then uploads the canvas directly, reproducing the same
red/blue swap previously confirmed in chat image decoding. DisplayTexturePixels
marks factory source objects in a WeakSet and materializes pixels after their
BitmapData.draw. The native restoration callback reuses the same source, so its
fresh bitmap takes the same normalized upload path without replacing the native
cache, geometry, transforms or restoration lifecycle. Unrelated draws are left
alone. The first regression caught the host after-hook result argument before
the source argument; corrected implementation passes the real host hook fixture.

Live comparison: /tmp/QoLAF-OrbitBefore.png shows yellow orbit lines;
/tmp/QoLAF-OriginalOrbits.png shows SWF blue lines;
/tmp/QoLAF-OrbitCorrected.png shows corrected blue lines after build/reload.
Safe-zone rings outside the map also regained their source blue tint. Both map
windows were closed afterward. No chat messages or movement inputs were sent.
Typecheck/build/full suite: 268 pass; formatting/diff checks pass. Regression
covers initial upload, fresh-bitmap restoration, source/matrix/key preservation,
unrelated draws and hook cleanup. Real GPU context-loss restoration and other
map layout/miniature differences remain unverified, not covered by this color fix.

Map lifecycle audit: source MapLiveMiniature scales, offsets and borrowed-texture
handling match the current port; the different ships in the comparison accounts
do not establish a miniature scale bug. A separate concrete gap was found in
native MapPlayer.update/dispose. Source hides hull, label AND supporter badge
when a player/ship is absent, dead, landed or at zero HP, restores the badge on
reappearance, and kills layer tweens before disposal. Upstream omitted the alive
check, left badges behind and did not kill the opening tween.

MapPlayerLifecycle now ports those conditions around native drawing. It preserves
opening-tween visibility while a marker is already visible, and leaves native
position/team-color/drawing behavior intact. Regression covers missing/dead/
landed/zero-HP ships, all three visual parts, reappearance, initial tween ownership,
return-value preservation, disposal ordering and hook cleanup. Verified native
TweenMax exposes killTweensOf. Typecheck/build/full suite: 269 pass; formatting
and diff checks pass. Live death/landing/reopen verification remains open; no
account was killed or moved for this fixture check.

Map navigation audit found a missing source playerJoined readiness guard. Source
Map.as ignores joins before viewport initialization (PvP map load enumerates the
current roster) and after disposal. The port previously only reactivated geometry
when a view existed, then always called native playerJoined. It now suppresses
those unready/late joins for the owning game and preserves native behavior for
other game instances. Valid joins activate their own map geometry before creating
the marker, preserving independent normal/PvP scales and native return values.
The existing map integration regression now exercises pre-load, normal/PvP and
post-disposal joins. Source pan threshold, cancellation and wheel zoom arithmetic
were also checked against current code without finding another mismatch there.
Typecheck/build/full suite: 269 pass; formatting/diff checks pass. Live concurrent
map/join lifecycle remains unverified; no synthetic server join was sent.

Remaining map-marker source audit: MapSpawner matches current native behavior.
MapKilled's native implementation adds a killedSystem/current-system condition
absent from the old client; preserve that newer correctness fix. Its animation
and cleanup otherwise match. MapDeathLine.dispose had a concrete missing source
step: removeFromParent before returning the line to the shared pool.
MapDeathLineLifecycle now performs that detach before native disposal, including
when the game's line pool is already absent. It does not dispose pooled geometry.
Regression verifies detachment before a pool can reuse the object, no-pool teardown
and native return preservation using host hooks. Typecheck/build/full suite:
270 pass; formatting/diff checks pass. Live death-line map reopening remains open.

Map disposal audit: native Map.dispose clears marker arrays but omits display
container disposal; native MapBodyBase.clean also omits detaching its borrowed
line before returning it to the pool. MapDisposal now detaches the map container
first so removedFromStage cleanup runs, retains native marker teardown, clears
and disposes the mask/container, then calls the native superclass disposal.
Repeated disposal and late updates are ignored, matching source lifecycle guards.
Body cleanup detaches pooled lines without disposing their geometry.
Confirmed RoamingState and Hud construct a fresh MapState on each opening.
Regression exercises pool-return ordering, retained pooled geometry, container,
mask and remaining child disposal, duplicate disposal and late updates.
Typecheck/build/full suite: 271 pass; formatting/diff checks pass.
Live local preview: one reload, open/close/reopen/close in Fulzar succeeded with
markers and blue orbits visible; connected with zero reported runtime errors.
Evidence: /tmp/QoLAF-MapFirstOpen.png and /tmp/QoLAF-MapReopened.png.
Every keyboard action used separate key-down/key-up calls with finally release.
This sample does not establish heap stability or PvP/death-line lifecycle parity.

## Target binding lifetime audit

Source UnitManager.add binds picking immediately; remove unbinds and force-clears
the selected unit before native reset. The port previously only reconciled clips
every 250 ms and never cleared a selection on unbinding. A removed and reused
object could therefore retain selection/lock across lifetimes. TargetPicking now
hooks native manager add/remove, binds existing units immediately and retains
reconciliation for late-created/replaced clips. A clip replacement preserves the
same unit selection; actual removal clears it even when locked. Session cleanup
restores touchability/listeners and clears the session's target.

The regression uses real host hooks and NativeUI's began-phase handler. It checks
locked removal before reset, same-object reuse, immediate new-unit picking,
texture replacement, late textures, bypassed removal reconciliation and cleanup.
The full-suite fixture initially lacked native UnitManager.add/remove; extended
that fixture after confirming both methods in current upstream JavaScript.
Typecheck/build/full suite: 272 pass. Live pooled-combat verification remains open.

Compared map touch/wheel navigation, player draw coordinates and live miniature
ownership, scaling and part visibility against source; no additional mismatch
found in those paths. This does not close broader live map parity. Target arrow
radius, rotation and animation increments also match source. Aim assist remains
a real runtime gap: settings exist, but PlayState acquisition/tracking/lead and
turn-control integration are not ported yet.
Live initialization after one reload also succeeds: connected, rendered game/HUD,
zero reported runtime errors. Screenshot /tmp/QoLAF-TargetLifecycleLoaded.png.
This confirms initialization only, not pooled-target combat behavior.

## Aim-assist source port in progress

Added AimAssistTarget and AimAssist under src/aim. These port PlayState's actual
eligibility, projectile leading, player-guided acquisition, locked profile,
stationary tracking, manual override, correction/deadzone crossing and tracking
settle/restart hysteresis. Eligibility takes DamageObserver-compatible confirmed
contacts and preserves player/beam/missile/teleport exclusions, exact hit-window
boundaries, pinned-target behavior and minimum distances. Lead uses the current
native EnemyShip.calculateOrbitSpeed for AIOrbit and respects TTL/max lead time.
The controller tests consume the real ported ClientSettings defaults.

Typecheck and eight targeted regressions pass. These modules are not yet wired
into GameSession: no claim of working live aim assist. Next required work is the
native PlayState adapter, automation/map-navigation ownership, currentAimAngle
exposure, original debug overlay and live comparison. Upstream updateMouseAim
currently coalesces to one command with a 66 ms send interval; retain that newer
transport behavior while adapting the original assist around it. Native weapon
properties mix fields and get_* accessors, so the boundary uses read().

Aim-assist runtime adapter now installs from GameSession with the actual per-player
ClientSettings, TargetSystem and DamageObserver. It samples native overlay input,
uses the source 12 px hull-center deadzone, exposes corrected currentAimAngle,
and routes mouse/keyboard assistance through native sendCommand. It retains the
current Haxe one-command-per-66-ms transport. Disabled assist leaves upstream
steering intact. Automation ownership and active map gestures release/yield the
assist; map navigation now exposes its pointer ownership without mutating ships.
Entering/exiting states discards accumulated assist state. The automation property
getter delegates to its Haxe method so both access paths see the same correction.

Integration regression uses actual host hooks and both automation/assist installers.
It covers disabled behavior, confirmed-target acquisition, the 65/66 ms boundary,
command coalescing, corrected-angle property/getter agreement, deadzone input,
automation ownership, keyboard acquisition and disposal. Map regression also
checks pointer-ownership begin/end state. Typecheck/build/full suite: 281 pass.
Original debug overlay, live enabled-assist combat comparison and the ordinary
mouse deadzone/hysteresis behavior when assist is disabled remain open. The latter
still follows current upstream steering rather than the source client's extra
input stabilization; do not mark full aiming parity complete.
Live initialization after one reload: game/HUD render and remain connected with
zero reported runtime errors (/tmp/QoLAF-AimAdapterLoaded.png). This is only the
initialization check; no firing, target manipulation or account movement was used.

Aim debug overlay now uses native OpenFL Sprite/Shape/TextField with the source
460x218 panel at (8,72), typewriter 12 text, 14 diagnostic lines, and source ray
colors/widths/lengths. One session-owned overlay is reused, duplicate named
panels are removed, stale diagnostics reset, and disable/exit/session cleanup
remove the display. Settings now address native currentState (the earlier fixture
incorrectly supplied activeState) and call the installed visibility handler.
The source static toggle method also writes through ClientSettings.

The first live test exposed mouseEnabled/mouseChildren being plain OpenFL fields,
not setters. Fixed those boundaries and tightened the fixture. Typecheck/build/
full suite: 282 pass. Corrected live panel and input ray verified in
/tmp/QoLAF-AimDebugCorrected.png; panel removal verified in
/tmp/QoLAF-AimDebugOff.png. Debug and assist both false after cleanup; probe global
removed, console closed, sale popup dismissed. No weapon fire or ship movement.
This does not verify enabled-assist combat, original SWF side-by-side diagnostics,
or the absent debug command registration.

Rendering follow-up: during the overlay check the sale popup showed missing
prefixes on several bitmap labels (including stat labels and description lines),
persisting after debug was disabled. Compare AimDebugCorrected/AimDebugOff against
the earlier DebugPaste screenshot. Cause not yet established; investigate native
OpenFL/Starling rendering handoff and existing bitmap batching/cache issue rather
than treating the overlay display check as full rendering parity.

## Live bitmap draw-path investigation

Reopened the sale popup: its text initially rendered fully, then prefixes vanished
again without the debug overlay being enabled. This rules out treating the debug
panel as the necessary trigger. Painter.cacheEnabled read false between frames;
setting false once did not resolve it (CacheBefore/CacheDisabled screenshots).
This was not a valid cache-disable experiment: finishFrame selects the speculative
processor and nextFrame re-enables the regular processor. See the corrected
per-frame experiment below.
Temporarily setting 193 existing TextField mesh batches to separate draws restored
the description and stat labels (TextSeparateDraw screenshot). Restoring their
original batching values brought corruption back; a later sample recovered again
without changing layout. Keep the earlier global batching workaround under review,
but do not simply invert it: earlier live target/safe-zone tests showed missing
labels on separate draws too.

A one-second temporary Context3D binding probe checked actual GL ARRAY_BUFFER and
ELEMENT_ARRAY_BUFFER bindings against the runtime's cached bindings for the first
600 bind calls. Both mismatch counts were zero (BufferCounts screenshot; total
calls observed 157848). It restored the original methods on completion. All text
batch flags and the prior cache flag were restored; probe globals were deleted.
Console and sale popup were closed. No production rendering change was made.

Evidence: /tmp/QoLAF-CacheBefore.png, /tmp/QoLAF-CacheDisabled.png,
/tmp/QoLAF-TextSeparateDraw.png, /tmp/QoLAF-BufferAudit.png,
/tmp/QoLAF-BufferCounts.png. Remaining investigation: batch/index-buffer contents,
upload reuse and draw ordering. The buffer probe does not exclude every GL state
or index-data problem. Font metrics/layout are not established as the cause.

Index upload follow-up: forcing a second upload after Effect.uploadIndexData made
the sampled popup/background render fully (IndexUploads.png), but this experiment
is NOT a valid fix or clean A/B proof. OpenFL uploadFromTypedArray uses bufferData,
which shrinks storage to the supplied payload. The extra upload could shrink a
quad buffer below Effect's remembered capacity; restoring native reuse then caused
new WebGL index-buffer-too-small warnings (IndexReuseRestored.png). Removed the
probe and reloaded to discard its GPU state. Do not ship that upload override.

After the clean reload, an observation-only three-second probe wrapped native
IndexBuffer3D.uploadFromTypedArray and Effect.uploadIndexData without changing their
arguments or results. It recorded 14 uploads, 55,906 quad-reuse decisions and zero
known undersized reuse cases. Only buffers uploaded during the sample had known
sizes, so this does not prove all reused buffers were correctly sized. The sample
still showed missing label prefixes (IndexSizeAudit.png). Both methods restored
automatically after the capture; console and popup closed afterward.

Next evidence needed: actual index contents/draw offsets versus expected quad data,
including buffers already allocated before capture. Reuse-size arithmetic alone
has not explained the original prefix loss. No production rendering change or
additional reload-loop workaround was introduced.


## GPU contents and clipping isolation (2026-11-10)

Live WebGL2 readback compared complete index payloads for 500 Effect uploads
(81,786 indices), then complete vertex payloads for 500 uploads (1,177,600 bytes).
Both samples had zero mismatches and zero undersized buffers. This includes
buffers created before the capture. These bounded samples rule out neither
incorrect CPU geometry nor changes after upload. Evidence: /tmp/QoLAF-FullIndex.png
and /tmp/QoLAF-FullVertex.png. Wrappers restored themselves after two seconds;
readback restored the prior GL binding and index ByteArray position.

A draw-time observation checked the first 1,000 Effect draws for index binding,
enabled vertex attribute buffer bindings 0–2, cached depth/stencil/cull/scissor
enables, front stencil reference/read/write masks and depth write mask. No
mismatches. The reported 36,912 is total calls observed, NOT all checked calls.
Evidence: /tmp/QoLAF-DrawState.png.

A 15-second draw-only scissor bypass visibly removed intentional clipping from
weapon rows, but missing text persisted (/tmp/QoLAF-ScissorIsolation.png). A separate
15-second stencil bypass showed complete text (/tmp/QoLAF-StencilIsolation.png),
and prefix loss returned after restoration (/tmp/QoLAF-StencilRestored.png).
Neither bypass is a fix: intentional clipping must remain, and this defect has
also recovered spontaneously in earlier samples.

Follow-up complicates the stencil hypothesis: Painter.renderMask was called zero
times in a one-second sample. Painter uses non-shared context and stencil reference
127; first prepareToDraw had desired comparison ALWAYS and all actions KEEP.
Bypassing stencil only inside Effect.render did NOT restore the text. During that
15-second capture, all 314,429 Effect draws and 5,340 other drawElements calls
reported stencil enabled and front STENCIL_FUNC=519 (ALWAYS). Evidence:
/tmp/QoLAF-MaskAudit.png, /tmp/QoLAF-StencilState.png,
/tmp/QoLAF-StarlingStencil.png, /tmp/QoLAF-StarlingStencilRestored.png.
Thus the single all-draw stencil A/B is a lead, not root-cause proof. Check back-face
stencil state and repeat isolation with enough samples to separate spontaneous
recovery; distinguish OpenFL composition from Starling draws. Do not globally
disable stencil or ship an unconditional buffer reupload.

All temporary render/draw wrappers automatically restored and restoration was
observed in the console. No game reload, settings change, message send, movement,
or firing occurred during these captures. Production code remains unchanged.


## Nearby target lifetime parity (2026-11-10)

Compared source TargetInfoElement.refreshNearbyTargets, updateNearbyTargetBars and
onNearbyTargetSelected. The original re-sorts every 250ms by group/player/boss
priority, level, distance and id; fixed slots would not match that source. The
missing parity was its lifecycleId guard and immediate active boss-identity
exclusion between refreshes.

NearbyTargets now owns the same sorted snapshot, validates each cached entry's
lifetime before showing/selecting it, and suppresses all parts of the active boss.
TargetPicking increments a session-local WeakMap generation before native unit
removal, including non-selected units, because Haxe units lack the source
lifecycleId. Locked target removal still clears before native pooling. Reused
objects become eligible again only after a fresh snapshot. This does not claim to
eliminate intentional source distance/priority reordering or the independent text
rendering defect.

Verification: typecheck and full suite (286 passing). Regression cases cover
remove/reuse without an intervening frame, stale clicks, snapshot membership,
multipart bosses, source ordering, and live eligibility changes. Existing native
manager hook test also asserts generation invalidation before reuse. Rebuilt the
client bundle and reloaded the local preview once with separate F5 down/up calls;
autologin returned to the game and nearby HUD rows rendered
(/tmp/QoLAF-NearbyReload.png). Actual combat pool-reuse visual comparison remains
unverified; no game units were artificially removed or reassigned during live QA.


## Target resource multibar parity (2026-11-10)

Source CustomProgressBar.renderMultibar explicitly sets BOTH fill ratios to zero
when the layer reaches zero. The port previously retained a colored interpolated
trail at zero. Matched that branch while preserving ordinary-bar interpolation.
Also ported the source multibarEnabled/dividend setter behavior: changed settings
reset layer colors; identical assignments retain them; nonfinite dividend falls
back to 10000 and finite values clamp to at least 1. Tip positioning now uses the
actual minimum-width overlay, as in source updateLerpTip.

Verified typecheck, full suite (289 pass), and regressions for zero layers versus
ordinary trails, palette reset versus stable settings, and invalid dividends.
The bundle was rebuilt by the test pre-step. These are behavior/geometry checks,
not a live combat visual comparison; no additional browser reload was performed
for this change. The intermittent text draw defect remains separate and open.


## Chat role hover cards (2026-11-10)

Ported source ChatRolePreviewPopup and connected the already-ported renderer's
roleTagAtPoint lookup to Simple and Advanced chat. The native 280x70 card retains
Verdana sizes, border/background, explanations, pointer gap, edge flipping and
small-viewport scaling. Simple remains click-through. Advanced checks the scroll
viewport and hit ownership. Covering windows, clicks, hidden/removed views, new
messages and scroll changes close the card. Session cleanup removes listeners and
both popup nodes. Plain typed [mod] text does not become a role card; lookup uses
the source parsed tag/color rules and remains presentation-only.

Typecheck and full suite: 291 pass. Tests use the real role parser and renderer,
plus popup geometry and stage-hook fixtures covering both views, occlusion,
scrolling, clicks, small bounds, wording and disposal. Live local previews showed
[mod] in Simple (/tmp/QoLAF-RoleHover.png) and [client_dev] in Advanced
(/tmp/QoLAF-RoleAdvancedHover.png). No messages were sent: Simple temporarily
replaced its displayed label; Advanced received one temporary local row that was
removed by its cleanup timer. Preview timers restore the original view/data.
The final additional Advanced scroll-hit ownership guard was checked by the
regression suite; the earlier live bundle verified the same successful hover path.

This closes missing role-card wiring only. Advanced virtualization, artifact/ping
hover cards and other chat gaps are not claimed complete. Intermittent text
corruption remains visible elsewhere and is independent of this addition.


## Verified artifact token resolution (2026-11-10)

Ported ChatArtifactLinkData and ChatArtifactLinkResolver from the original client.
The resolver loads PlayerObjects before Artifacts, verifies record keys, owner and
revealed===true before constructing the current Haxe Artifact, and projects its
localized plain-text name and display color. Preserved coalesced player/artifact
waiters, 32 pending resolutions, 30-second negative caching, 256-player and
512-artifact/negative bounds, registry eviction, local snapshot precedence,
room/session reuse, account isolation and disposal/reentrant notification guards.
Map keys handle prototype-like IDs without inherited Object properties. Cache
identity also prevents old account callbacks becoming current after A→B→A.

GameSession owns the resolver. Both received-message renderers now resolve token
labels and refresh existing glyphs when verified data arrives, retaining the raw
wire token in message history and preserving scroll position. This does NOT yet
port the artifact stat hover card, artifact sharing controls or outgoing channel
policy; those remain required follow-up work.

Verification: typecheck, 298 tests passing. Resolver cases cover invalid ownership,
hidden records, request coalescing/limits, negative expiry, account changes, cache
bounds/eviction, local snapshot precedence and disposal. Renderer integration
asserts fallback→verified label/tinted glyphs while the underlying raw text stays
unchanged. One local reload/autologin succeeded. A temporary Simple label for the
account's first revealed inventory artifact resolved live to
[Artifact: Armorlock Protocol] (/tmp/QoLAF-ArtifactProjection.png). Only read-only
BigDB requests were made; no chat message or database write was sent. The display
probe restores its prior text after 20 seconds unless normal chat updates already
replaced it. Intermittent unrelated bitmap drawing corruption remains open.

## Artifact hover card implementation (2026-11-10)

Ported ChatArtifactPreviewPopup's 390px card, 64px icon area, owner line,
fitness, upgrade count and wrapped native stat markup. Advanced chat maps rendered
label glyphs back to raw artifact tokens. Only verified resolver data opens the
card. Delayed results revalidate the row, token, scroll position, visibility and
actual stage hit; clicking, covering chat, replacing rows or leaving closes it.
Atlas textures remain borrowed and are not disposed with the popup.

Verification: typecheck and 300 tests passed. Focused renderer coverage additionally
checks raw-token offsets after label projection and rejection of hidden rows.
Popup tests cover geometry, icon sizing, stat wrapping and borrowed texture
ownership; lifecycle tests cover delayed callbacks, scroll, covering UI and
cleanup. Live visual comparison of this card is still pending. This does not close
artifact sharing/outgoing channel policy, ping previews, virtualization or the
intermittent bitmap corruption issue.

## Live artifact card and stale role hover audit (2026-11-10)

Verified artifact hover in the connected Haxe game using one temporary local
Advanced-chat row for the account's revealed Armorlock Protocol. No player chat
was sent and no database record was written. The verified card displayed its
atlas icon, orange name, cyan owner line, fitness and native colored stats;
390px width and 12px pointer gap match ChatArtifactPreviewPopup.as. Screenshots:
/tmp/QoLAF-ArtifactHover.png and /tmp/QoLAF-ArtifactLeave.png. Moving off the token
closed the card. The local row has a 90-second removal timer restoring the prior
chat view. This validates this artifact's live rendering, not every possible
localized stat combination or side-by-side SWF parity.

Found and fixed role hover lifetime gap: previously covering UI was checked only
on a touch event. A stationary pointer could leave a stale card after a modal
appeared or its role label changed. Visible role cards now revalidate stage hit
and the role under the stored pointer each frame, including Advanced scroll
ownership. Regression tests exercise these transitions without another touch.

## Friend ping receive formatting and snapshots (2026-11-10)

Ported ChatFriendPingFormatter's longest-name, case-insensitive matching, ASCII
identifier boundaries and visible-text/source-range conversion. Colored wrappers
split at existing tag boundaries, preserving HTML style stacks and entities.
Known targets follow own player, online friends, then offline friends precedence;
live records hydrate ID-only friends, ambiguous name matches are rejected, and
message-time snapshots retain identity, ship/paint, clan and location after a
player leaves. Source files remain read-only (the original worktree has unrelated
user changes).

Native integration observes writeChatMsg's receive scope and formats the filtered
body at colorRights, after the native length/team/profanity checks. Supporter and
sender prefixes remain outside the added markup; updateTexts captures ping ranges
before either chat view consumes the message. No messages are sent. The scoped
context restores in finally, including nested receives, and ordinary system
updates are unaffected. Existing history is not retroactively recolored.

Typecheck and 303 tests pass. New cases check matching boundaries and overlapping
names, tag/entity preservation, exact per-character colors, live/offline target
precedence, snapshot independence, native size rejection, supporter/role prefixes,
system-message isolation and hook cleanup. Friend ping hover cards, room-type
lookup and self-ping sound remain incomplete; this is the receive data path for
those source features, not a claim of full chat parity.

Live receive-path check: one controlled reload/autologin completed with canvas,
bridge and connection active and runtimeErrors=0. A synchronous display-only
writeChatMsg probe for the account's own name produced the expected #66aaff markup
and a ping snapshot (visible range 8..16 and current skin); its new queue row was
removed in finally and Simple chat refreshed. No transport send was invoked.
/tmp/QoLAF-PingReceive.png records the returned row data. The immediate renderer
sample was empty, so this confirms native receive projection/snapshot wiring,
not a visual assertion of the resulting glyph color.

## Friend ping hover card (2026-11-10)

Ported ChatFriendPingPreviewPopup: original 276×82 geometry, 56px ship slot,
14px name with 22px field height, ID/level/clan/location fields, blue border,
12px pointer gap and edge flipping/clamping. Uses the native ShipFactory paint
filter and borrowed atlas texture; replacing/removing the preview releases its
filter without disposing shared textures. Location labels use only the original
seven recognized room types.

Advanced hit testing maps rendered glyphs back through source offsets into the
message-time ping ranges, including artifact token projection. Lazy room lookup
matches the exact RoomInfo ID within the requested solar system, coalesces waiters,
limits pending requests to four, and retries failures after 30 seconds. Unknown
modes remain unlabeled. Closing, scrolling, covering the chat, changing the row or
disposing the session prevents late replies from reopening/repainting old cards.

Verification: typecheck and 306 tests pass. Coverage includes exact field geometry,
paint disposal/texture ownership, changed snapshots, lazy type lookup and unknown
modes, concurrency/retry limits, stale callbacks, and real renderer hit mapping
after a projected artifact label. One reload/autologin succeeded. Live local-only
receive/display probe rendered the current player's ping in blue and its hover
card with ship, ID, level, clan, Fulzar and Hostile labels, matching the source
layout (/tmp/QoLAF-FriendHover.png). Moving off closes the card. The probe removes
its queue entry synchronously and its temporary display row after 60 seconds;
no transport send is invoked. This verifies one live card, not all ship paints or
an exact SWF screenshot comparison. Self-ping audio and other chat gaps remain.

## Self-ping notification audio (2026-11-10)

Ported the source receive-side self-ping notification. The filtered body must
contain a complete ping of the current player; messages from their own persistent
ID, live ID, case-insensitive name, or a missing sender name stay silent. Playback
runs only after native receive processing accepts/delivers the message. Optional
audio errors cannot interrupt chat delivery.

Bundled the exact original assets/sounds/ping.mp3 (SHA-256
 e8fa9a746fbee2c6026e02b9add525935bc12e4e95aed188e21f5ec1c2fbf03c)
as src/assets/sounds/Ping.mp3. Esbuild embeds it into the single JS module.
ChatPingSound uses native OpenFL Sound/SoundTransform and the existing SoundMixer,
with the source's 1× effect-volume multiplier. Lazy loading retains overlapping
notifications, rechecks mute on completion, retries after loading failures, and
releases loading listeners/channels/buffer on session disposal.

Verification: typecheck, 309 passing tests, source/ported asset hashes identical,
and single-module build guard passed. New checks cover current effect volume,
muting before/during loading, finished-channel cleanup, disposal during loading,
load-failure retry, own-message/system-message suppression, and native length
rejection before any ping. Existing friend hover/source layout work remains;
this does not close unrelated chat, rendering or overall parity gaps.

Live verification: reload/autologin succeeded. A local receive-only self-mention
probe (no transport send) loaded the embedded MP3 and invoked native Sound.play
once with duration=1320ms, volume=0.1 (the current effect setting), and a non-null
SoundChannel. /tmp/QoLAF-PingAudio.png captures those values. The temporary message
was removed synchronously in finally. A 10-second temporary play observer restores
the original method automatically; this verifies native loading/channel creation,
not a claim that the physical speaker output was heard.

## Target HUD group identity and presentation audit (2026-11-10)

Side-by-side HUD captures showed Series as an obscured gray row in the original
but a red/blue stats row in the port. Source rules were equivalent, but the Haxe
boundary was wrong: Group exposes get_id(), not a plain id field. Both target
presentation and automatic priority compared undefined===undefined and treated
all non-null groups as the same. Live read-only inspection confirmed raw ID type
undefined for every group, while actual get_id() distinguished Series from the
current group (/tmp/QoLAF-TargetGroups.png and TargetGroupGetters.png).

A shared samePlayerGroup helper now reads the actual native getter and rejects
absent IDs. This fixes both hostile-player stat obscuring and groupmate priority
without changing game relationships or native gameplay. Regression checks use
getter-backed groups and cover hostile priority during cooldown, nearby sorting,
matching groups, nonmatching groups, missing IDs, friendly players and NPCs.

Also restored the source white RGB/unchanged-alpha boss-icon filter for the
18px active-target and 16px nearby icons. Native concatValues supplies the Haxe
Vector expected by ColorMatrixFilter; attached filter disposal belongs to the
native DisplayObject and leaves atlas textures borrowed. Nearby row refreshes
now retain the source pressed background until touch ends instead of erasing it
every render frame. Tests cover retained press, release selection, empty-row
reset, known/obscured fills and white-filter alpha preservation.

Typecheck and all 314 tests pass. Integration fixture now includes the inspected
native ColorMatrixFilter dependency; initial suite failure was that missing test
dependency, not a live runtime missing class.

Live follow-up: one reload/autologin succeeded with runtimeErrors=0. Series now
renders gray while Glafira and TheException retain red/blue known-stat fills,
matching the actual group relationships and original HUD capture. Screenshot
/tmp/QoLAF-TargetGroupFixed.png. No account/group membership was changed. The boss
filter and held-row presentation are regression-tested; an actual boss encounter
and live held-row comparison remain additional visual checks.

## Pooled floating-text alignment audit (2026-11-10)

Compared current TextParticle.sizeToCurrentText/TextHandler.add with the inspected
Haxe implementation. The original always assigns pivotX for center, right and
left alignment. Native add assigns only center/right, so a pooled right-aligned
message retains its old horizontal pivot when reused for left alignment.
CombatTextFrames now restores all three source branches after native add, using
the final native measured width. Message position, pool selection, newer zoom
behavior and timing remain native.

Added the inspected upstream TextHandler as a fixture. The regression first
reproduces the unpatched right-to-left failure, then exercises repeated reuse
through the actual host hooks (right/left/center/left/default), checking identity,
position and pool length. Typecheck and all 315 tests pass. Preview remained
connected with runtimeErrors=0 before reload; this change is built but has not
been visually verified in the running browser. This does not resolve or explain
the separate intermittent bitmap corruption or establish full animation parity.

## Emitter visibility footprint (2026-11-10)

Source Emitter.cullingRadius includes rendered particle radius, maximum absolute
spawn spread and speed times maximum authored lifetime, with a 100-unit floor.
The native Haxe updateOnScreen still hard-codes 100. Ported the source visibility
method, including canvas-target bypass, one-second visible refresh, fractional
distance scheduling and the source maximum-delay jitter. Large effects now stay
eligible for rendering when their origin is outside the old fixed-radius check.
Particle simulation and current native rainbow behavior are unchanged.

Regression exercises a 280-unit footprint with origin 250 units outside the
camera boundary: the old check rejects it, while the adapter retains emission.
It also covers offscreen fractional distance, delay cap, canvas effects and the
100-unit minimum. Typecheck and all 316 tests pass.

Live: one reload/autologin succeeded. A standalone object using the actual hooked
native Emitter prototype returned radius=280, visible=true, next=1000. A real
native TextParticle/handler reuse probe also confirmed right/left/center/left
pivots (170.769/0/85.385/0) at constant width, closing the prior text-boundary
runtime verification gap. Probe particle was never added to the game display and
was disposed in finally; no game objects or messages were changed. Evidence:
/tmp/QoLAF-RenderBoundary.png. Preview reports connected=true, runtimeErrors=0.
An actual large combat effect at the screen edge still needs visual comparison.

Further source difference found during this audit: the original's remastered
aura rendering includes grayscale textures/layers, breathing/pulse alpha and
AuraLightning/AuraOutlineLightning. Those paths are not yet implemented in the
port's emitter adapter; SettingsGeneral already exposes related wording. This
remains an explicit fidelity gap, not an implemented feature inferred from UI.

## Emitter target lifetime guards (2026-11-10)

Ported Emitter.hasStaleTarget for existing Haxe target types. EmitterTargets
captures a reset generation immediately when EmitterFactory.create returns and
invalidates it through GameObject.reset and Engine.reset (the engine override
does not call its base). Following effects stop before moving, emitting or
writing batches when their target has been recycled. Engine effects additionally
require a living ship that still owns that engine. Enemy effects require a
positive native getter ID and matching identity in the native enemiesById map.
Independent effects with no followed target retain their native lifetime.
Emitter disposal releases its attachment; a new factory effect captures the new
life. Directly assigned different targets are captured on their first frame.

Tests cover recycle-before-first-frame, new-effect recapture, emitter reuse,
missing/detached/dead engine ships, native enemy ID/registry identity, and stopping
before any particle update. Integration uses actual host Hooks and factory/reset/
render ordering and verifies restoration on cleanup. All 321 tests pass; typecheck
passes after correcting a test-only unknown narrowing. One reload/autologin
succeeded; screenshot /tmp/QoLAF-EmitterLifecycleReady.png shows the live rendered
game, and preview reports connected=true, runtimeErrors=0. Actual combat pool
recycling has not yet been visually observed.

The original also validates target generations inside delayed multiple-effect
factory callbacks. This commit guards already-created effects; delayed factory
callback capture remains to be ported. ProjectileThrustAnchor's custom validity
path is also dependent on that source class being ported. Neither is claimed
complete by these guards.

## Delayed emitter target lifetime (2026-11-10)

Closed the delayed multiple-effect capture gap from the preceding audit.
EmitterDelays records the target generation while native EmitterFactory.create
schedules its TweenMax callback, then checks that snapshot before the callback
runs. Recycled targets, invalid engine/enemy attachments and leaving games do not
create follow-up effects. New effects capture the new target life. Targetless
factory calls and timers outside the factory retain their native callbacks.
Nested factories restore their previous scope in finally, including exceptions;
delay, callback receiver/arguments, timer parameters and native returned handle
are preserved. No factory definition, rainbow configuration or particle physics
was replaced.

The extracted actual Haxe factory method is exercised with empty emitter
configuration to isolate its real delayed recursion. Tests cover valid one-shot
follow-up, recycle before callback, new-life scheduling, targetless effects,
leaving games, unrelated timers, nested factories, exception cleanup, callback
arguments and hook restoration. Typecheck and all 324 tests pass. This change is
built and source/runtime-boundary tested, but has not yet been reloaded into the
running browser or observed during combat. Remastered auras and custom projectile
thrust-anchor validity remain separate unfinished work.

## Rarity aura display layers (2026-11-10)

Ported AuraRenderLayer's world-transform and display-order behavior. Native
createRareType results now receive a dedicated native MeshBatch and layer beside
the owning movie clip instead of remaining in the global shared effects batch.
Multiple aura layers remain adjacent without shuffling each other every frame.
Layer transforms map world effects into the owner's parent space, inherit owner
opacity/visibility and effects visibility, and detach when the owner is absent.
Preparation runs before emitter early returns, including idle/offscreen frames.

Dedicated batch removal releases its layer on death, pool disposal or scene
cleanup. Unloading restores live emitters to native shared batching. A retired
batch cannot release a newer layer after its emitter object is reused. Atlas
textures remain borrowed. This implements the original owner-scoped batch role
using native MeshBatch; it does not add those batches to the shared native pool.

Typecheck and all 326 tests pass. Tests cover ordering stability, transforms,
reparent/hide, release, duplicate preparation, stale batch callbacks and unload.
Live reload/autologin succeeded. A temporary local blue-rarity effect on the
player ship returned native MeshBatch, ownerIndex=1, layerIndex=2, sameParent=true,
touchable=false, blend=add and equal owner/layer alpha=1. The effect rendered and
its scheduled cleanup removed exactly one probe emitter; cleanup was observed.
Screenshots: /tmp/QoLAF-AuraLayers.png, AuraVisible.png and AuraCleanup.png.
No transport messages or account state changes were made. Preview remained
connected with runtimeErrors=0. The final retired-batch guard is test-verified
but was added after that live reload.

Remaining aura scope: GrayscaleAuraStyle/Effect (padded bounded atlas sampling,
grayscale/tint, reconstruction and flowing rim), source pulse/blue breathing,
lightning/outline meshes and texture anchor/contour extraction, multipart aura
targets, and the disableRemasteredAuras setting's complete rendering behavior.
Current texture/color/pulse appearance is still native, not full aura parity.
The delayed-target guard from aa50dfe was also loaded by this reload; its combat
trigger remains covered by the native-factory test rather than visual observation.

## Rarity aura pulse and blue breathing (2026-11-10)

Ported Emitter.softAuraAlpha and applyBlueAuraBreathing into AuraPulses. Rarity
factory results are classified without changing their native authored colors,
particle generation or timing. Non-blue rarities fade in over the first 20% of
life and out over the final 80% with the source smoothstep. Blue uses the source
six-second clock, 1.8% size breath, 5% brightness breath, cosine lifetime envelope
and fixed 0.42 color interpolation. Native mirrorY is honored when present; full
source mirrored/multipart target adaptation remains separate work.

The frame renderer applies this after native size/tint/alpha calculations.
SceneBase.clientSettings.disableRemasteredAuras is read dynamically; disabling
restores the native per-particle size, tint and alpha on the next frame, and
re-enabling needs no emitter recreation. Disposal drops rarity classification so
pooled exhaust or other effects cannot inherit it. Non-rarity effects are untouched.

All 331 tests pass. Typecheck passes after adding explicit receiver types to the
new test fixture's setters. Regressions cover pulse endpoints/midpoints, all rarity
classifications, six-second phase samples, color weight, mirror flag, pool reuse,
actual host factory hooks, live setting reads and full EmitterFrames output before/
after the toggle. Built but not yet reloaded/visually compared with the SWF.
Shader reconstruction, grayscale/tint, flowing border and lightning are still
unported, so pulse parity does not imply full remastered aura appearance or full
implementation of the setting's shader behavior.

## Native remastered aura shader and padded atlas geometry (2026-11-10)

Ported GrayscaleAuraStyle/Effect using the native Starling MeshStyle/MeshEffect,
VertexDataFormat and Program assembler. The actual AGAL instructions are retained:
remastered four-read B-spline reconstruction, continuous coverage sharpening,
grayscale/tint, synchronized flowing rim and bounded premultiplied output;
vanilla five-read soft grayscale; constrained one-read bounded grayscale. Shader
variants follow disableRemasteredAuras and the native context profile. Haxe class
metadata gives styles distinct batching/clone identities and effects distinct
program-cache keys. Uniforms use native FloatVector instances and fragment enum 0.
The flowing phase uses the native server clock, with a local timer fallback.

Quads rebuild from their texture before adding the original two-texel padding.
Each vertex carries half-texel-inset frame bounds, including rotated atlas frames,
so sampling outside the ship frame fades to transparent rather than reading its
neighbors. Styles attach to active/inactive rarity particles; newly allocated
particles and texture changes prepare geometry too. Pool disposal/unload restores
native styles and original positions/UVs. Shared point scratch storage avoids
per-particle geometry-helper allocations.

Typecheck and all 334 tests pass. Regressions cover repeated padding, rotated
frames, bounds, shader modes/read counts, live setting variants, native uniform
vectors, server-clock phase and attribute cleanup. The native browser rendered a
temporary six-particle/24-vertex aura with qolaf.rendering.GrayscaleAuraStyle and
GrayscaleAuraEffect (#1 program). Vanilla variant #11 also compiled/uploaded and
activated successfully; the prior setting was restored synchronously in finally.
Cleanup was observed: probe emitter alive=false and every pooled particle back to
starling.styles.MeshStyle. Screenshots /tmp/QoLAF-AuraShaderLive.png and
/tmp/QoLAF-AuraShaderCleanup.png. The probe made no network sends or account
changes. The final scratch-point allocation improvement is regression-tested but
was made after that reload. Constrained mode is tested as generated AGAL but not
live on a constrained GPU context. No full side-by-side aura appearance claim.

Remaining aura work: lightning and outline meshes, texture anchors/contours,
source mirrored/multipart target adaptation, full visual comparison across rarity
types, and actual context-loss restoration. Pulse and shader paths now both honor
the existing disable setting; its full appearance still depends on the remaining
lightning integration.

## Interior aura lightning and texture coverage (2026-11-10)

Ported AuraTextureAnchors and AuraLightning, including source timing, geometry,
endpoint selection and frame integration. Borrowed bitmap uploads are captured
from native POT/rectangle textures; disposal and subsequent uploads invalidate
cached point clouds by root revision without retaining disposed bitmap sources in
cache entries. No GPU readback or guessed rectangular endpoints. Coverage uses
actual atlas UV/position mapping, alpha>=48, at most 96x96 samples, four-neighbor
components (preserving holes and diagonal separation), 32 components and 4096
points. Rotated frames and trimmed positions follow texture setup coordinates.

Native lightning mesh retains eight arcs, fourteen segments per arc, two glow/core
quads per segment, 720ms bursts, source fade/jitter/travel and bounded endpoint
selection within one opaque component. Source rarity frequency multipliers are
preserved; only the first golden emitter owns bolts. Frame integration selects
the highest-alpha actually drawn particle and follows its position, rotation,
scale signs, radius and opacity. Disabled/stopped/offscreen/leaving/missing-owner
frames hide the mesh. Mesh and cache lifecycle follow emitter/texture disposal.

Typecheck and all 340 tests pass. Tests cover coverage threshold/holes/components,
rotated mapping, cache invalidation, unreadable bitmap fallback, work limits,
seeded native mesh geometry/timing, endpoint component identity, strongest-pulse
selection, opacity ancestry, visibility gates and disposal. Final readability-only
const/type cleanup was also typechecked and retested.

Live reload/autologin succeeded. A temporary local blue aura produced one opaque
component with 2054 anchor points and an 896-vertex native lightning mesh. During
295 samples, lightning was visible in 212. Scheduled cleanup removed the one
probe emitter and sampling interval; observed in /tmp/QoLAF-LightningCleanup.png.
Preview remained connected=true, runtimeErrors=0. No transport sends or account
changes. This proves native texture capture and bolt integration, not exact
side-by-side visual equality across all ships and rarity types.

Remaining: AuraTextureContours and AuraOutlineLightning's occasional crawling
accent, mirrored/multipart targets, actual context-restoration checks and broad
visual comparison. Interior lightning is implemented; the entire aura family and
full port are not declared complete.

## Outline aura lightning and closed contours (2026-11-10)

Ported the original AuraOutlineLightning onto native Starling meshes, sharing
the strongest rendered aura particle with interior lightning. Retains fourteen
segments per arc, glow/core geometry, arc-length contour sampling, travel/jitter,
720ms bursts and the original /16 frequency scale with quiet-gap compensation.
Both meshes share visibility, opacity ancestry and emitter disposal handling.

AuraTextureContours traces closed boundaries including holes from captured
texture coverage. Rotated atlas mapping is preserved. Segment coverage is checked
against native pixels, including the closing edge; open/truncated paths and
transparent shortcuts are rejected. Work is bounded to 32 loops, 768 points per
loop and a 32768-sample validation budget. Unreadable/unsupported coverage yields
no outline, rather than a fabricated ellipse.

Typecheck and all 345 tests pass. Added native-resolution narrow-gap checks,
concave/diagonal boundary cases, holes, rotated textures, cache invalidation,
work bounds, wrapped contour sampling, original burst timing and frame lifecycle
assertions for both meshes.

Remaining: mirrored/multipart targets, actual context restoration, and full
side-by-side appearance comparison across ships and rarity types. Bitmap text
corruption remains a separate unresolved issue.

Live reload/autologin succeeded with one F5 press/release. An 80-second local
blue-aura probe produced eight contours (544 points) and an 896-vertex outline
mesh. At unchanged source timing, 106 of 1592 samples were visible. The timer
removed its one created emitter and sampling interval, observed in
/tmp/QoLAF-OutlineCleanup.png. Preview remained connected=true, runtimeErrors=0.
No transport sends or account changes. This verifies native contour/outline
integration and cleanup, not complete visual parity.

## Self-effect reflection and pooled emitters (2026-11-10)

Source EmitterFactory.create uses abs(movieClip.scaleX) for self texture sizes
and renderMirrored for a separate Y reflection. Native Haxe create uses signed
scaleX, and the port previously reflected only remastered blue pulses. Added
EmitterMirroring to correct the native size sign through native setters, retain
authored size signs, honor an explicit composed renderMirrored getter, and reset
reflection for non-self/pool reuse and disposal. EmitterFrames now applies the
reflection to ordinary particles and to the disabled-remastered path too.

Typecheck and 346 tests pass. The inspected native factory fixture exercises
all four scale-sign combinations, authored negative sizes, getter precedence,
non-self reuse and disposal. Frame regression checks both enabled blue breathing
and disabled remastered rendering remain mirrored.

Live reload/autologin succeeded. Temporary target wrappers borrowed the existing
ship texture without modifying the ship. The real factory returned expected
start/finish sizes 3.66/2.64 for all four sign combinations, with mirrorY
true,true,false,false. Every created emitter was removed synchronously in finally.
Evidence: /tmp/QoLAF-MirrorNative.png. This verifies native factory integration;
it is not a full visual comparison of multipart ships.

MultipartAuraTarget and PlayerShip's experimental multipart/aura lifecycle still
need porting as a complete feature; generic mirroring support does not close that
remaining scope.

## Combat text ownership cleanup (2026-11-10)

Compared source TextParticle.releaseSourceOwner with the native Haxe reset.
Native reset already clears ordinary damage/healing slots, but does so without
a lifecycle guard; native disposal does not release them. CombatTextFrames now
retains the source owner separately from its active movement attachment and
releases only the matching slot from the same owner generation, including when
the owner died or the particle was disposed. It nulls the native owner reference
after this check so native reset cannot subsequently clear a new lifecycle's
slot. Replacement particles are not cleared.

Typecheck and all 347 tests pass. Regression includes both damage/healing slots,
dead-owner motion detachment, replacement slots, and the inspected native reset
function to verify that its unguarded cleanup cannot undo the lifecycle check.
Live standalone native TextManager/TextHandler/particle probe confirmed reset
and disposal both release the owner slot and zero its offset. Its detached
canvas and entire private particle pool were disposed in finally; no real unit,
transport or gameplay state was changed. Evidence: /tmp/QoLAF-TextRelease.png.

Also inspected the current timed mission panel: Mandrom Terror description,
reward rows and XP are horizontal/readable (/tmp/QoLAF-TextMission.png). This
case does not reproduce the previously reported vertical XP text. Other tooltip
and intermittent bitmap corruption cases remain open. Ownership cleanup does
not claim to fix bitmap rasterization or establish full visual parity.

## Original combat atlas and particle layout (2026-11-10)

The native TextHandler still selected font13/font26 despite the original combat
atlas already being registered. Ported TextHandler.add and TextParticle's text
preparation/reset behavior through CombatTextLayout: DAIDRR_COMBAT is selected
before measuring, generous 800x100 bounds are measured once, final padding is
45x42, every alignment sets its pivot, and the original word-wrap option and
fractional lifetime are retained. Text updates no longer invoke native autoWidth
on every assignment. Pool return composes empty text; immediate reuse skips that
extra composition. Native zoom fields baseScale/createdZoom remain intact.

Handler disposal now disposes active and inactive particles, matching source;
native disposal omitted the inactive pool. Existing owner cleanup hooks still
run for reset/disposal. Typecheck and all 348 tests pass, including native handler
pool reuse, measurement counts/font at measurement time, alignment, fractional
lifetime, nonwrapping output and complete pool disposal.

Live temporary standalone handler rendered 12345 (15px), +250 xp (20px), and
Mission complete! (40px), all reporting DAIDRR_COMBAT with correct centered pivots.
Evidence: /tmp/QoLAF-CombatFontLive.png and /tmp/QoLAF-CombatFontCleanup.png.
Scheduled cleanup disposed its private pool and removed its display layer. No
mission completion or XP event occurred; these were local display samples only.
The bundled russo64 bitmap and metrics SHA256 hashes match the source files
exactly. Full moving-combat comparison, text tooltip corruption, and remaining
TextManager-specific source presentation still require audit.

## Damage formatting before measurement and original pool capacity (2026-11-10)

TextManager source audit found initial damage/healing strings were still laid
out as raw digits, then formatted by an after hook. Source formats before add
and requests no wrapping for combat numbers. DamageText now scopes a synchronous
formatter around the native createDmgText call. CombatTextLayout consumes it
before measuring and sets noWrap=true. The existing after hook handles aggregated
updates. Nested calls restore their previous context in finally; exceptions and
other game sessions cannot affect later notifications. Native damage/heal totals,
250ms aggregation, velocity adjustments, baseScale and createdZoom are retained.

TextManager's native pool starts with 40 particles. Before loadHandlers borrows
that array, CombatTextLayout extends it to the original 80, without replacing
the array or repeatedly allocating on subsequent initialization.

Typecheck and all 350 tests pass. The inspected native createDmgText method is
used to verify formatted initial values, aggregation, healing speed, setting
toggles, zoom, nonwrapping, exception cleanup and foreign-session isolation.
Pool regression verifies 80 unique IDs and shared array identity with no repeat
allocation. These changes do not change combat calculations or newer shield
mechanics.

The first live run caught a hook-order failure: a later handler.add around hook
was bypassed by the earlier layout replacement. Replaced that approach with a
shared WeakMap scope consumed by CombatTextLayout itself, then replaced the
isolated regression with both production hooks installed in their actual order
and the inspected native manager/handler methods. All 350 tests pass again.

Live retest: 12.5k measured width 192.861328125, exactly matching a separate
field using the same font/format plus source padding; wordWrap=false. The second
hit reused that particle and displayed 13k with total=13000. Native baseScale=1.5
and createdZoom=0.25 were retained. Pool count was 80 before and after cleanup,
and the temporary owner reference was released. No real damage event or transport
send occurred. Evidence: /tmp/QoLAF-DamageLayoutFixed.png.

Intermittent UI text corruption reproduced again on the sale panel before the
retest probe (/tmp/QoLAF-DamageRetestBefore.png) and recovered by the next capture.
This is still unresolved; the damage-layout fix does not establish a cause or
a fix for missing UI glyphs.

## Missing-label capture investigation (2026-11-10)

Further live checks narrow the missing-label symptom without establishing a
production fix. All temporary draw wrappers, copied meshes, and CSS overrides
were restored. No gameplay or transport operations were invoked.

- Front and back stencil functions both reported ALWAYS with KEEP operations;
  the sampled faces did not disagree. Shader observation checked 1,000 effect
  draws and 2,120 uniform values/maps without program, uniform or texture-binding
  mismatches. Depth function and all four blend factors matched requested state
  across another 2,000 effect draws; equations were FUNC_ADD and all color writes
  enabled. These are bounded observations, not proof about every draw.
- Native mesh copies of Health:, Base stats: and Special Weapon: remained
  complete in a screen capture where the original labels disappeared. Source
  indices and positions were valid. Copies were removed and disposed.
- Corrected cache isolation disabled caching after every Painter.nextFrame for
  20 seconds (3,569 frames). Screen captures still lost labels. During that test,
  targeted label observation found 504 copies, 100 audited draws, 70,968 index
  bytes and 473,120 vertex bytes with no copy, buffer or capacity mismatches.
  Do not ship global cache disabling or speculative buffer reuploads.

The next observation changes which layer needs investigation. A small region
covering Health: was read after draws. The native offscreen framebuffer uses the
opposite vertical orientation from the default framebuffer. With that accounted
for, two traced frames accumulated the label pixels in the native framebuffer,
then retained them through the final canvas draw. Subsequent five-second sampling
of the default framebuffer returned exactly 227 bright pixels on all 1,796 draw
samples, while a desktop capture during sampling showed the label missing.
A second five-second sample returned 227 bright pixels, all opaque (alpha sum
57,885 = 227 * 255), on all 1,794 samples; its desktop capture also lost text.

A direct PNG export of the canvas after its default-framebuffer draws contains
the complete sale description and stat labels. DOM inspection found one canvas,
which is the inspected GL context's canvas, with no DOM overlay at the sampled
point. This suggests a discrepancy after the observed canvas rendering, such as
browser compositing or desktop capture. It does not identify a browser/driver
defect, establish exact same-frame correspondence for the export, or prove every
text issue has that cause. Distinguish these missing-glyph captures from the
user-reported wrapping/alignment and moving-text defects when assessing parity.

Removing canvas translateZ(0px) for 15 seconds did not eliminate the desktop
capture symptom; the original transform was restored. No production rendering
change is justified by these experiments. Use direct canvas evidence alongside
desktop captures for subsequent UI comparisons; keep this issue open until the
post-render discrepancy is isolated.

Local evidence: /tmp/QoLAF-GlyphGeometryLater.png,
/tmp/QoLAF-FrameCacheRestored.png, /tmp/QoLAF-DepthBlend.png,
/tmp/QoLAF-PixelTraceFlip.png, /tmp/QoLAF-FinalPixelsDuring.png,
/tmp/QoLAF-FinalPixelsAfter.png, /tmp/QoLAF-FinalAlphaDuring.png,
/tmp/QoLAF-FinalAlphaAfter.png, /tmp/QoLAF-CanvasLayers.png,
/tmp/QoLAF-CanvasExport.png and /tmp/QoLAF-NoTransformLater.png.

## Artifact outgoing channel policy (2026-11-10)

Ported ChatArtifactChannelPolicy and the source ChatInputText command-to-channel
mapping. The composer now checks actual parsed commands before native handling
can clear the input. Global, Local, Group, Modchat and unrelated commands reject
valid artifact tokens with the original restriction message. Private aliases,
saved-private, Clan and QoLAF are permitted by policy; permitting QoLAF does not
implement its missing transport. Separate guards protect direct sendGlobal,
sendGroup, sendLocal and sendChatMessageMod calls, including Clan's native route
through sendLocal(body, "clan"). Private recipient arguments remain recipients.
Rejected artifact drafts do not enter session history. Malformed token-like
prose remains ordinary chat; a malformed prefix cannot hide a later valid token.

Typecheck and all 354 tests pass. Regression exercises actual host hook dispatch,
the inspected native command parser behavior, every private alias, command
redirects from an allowed tab, direct send methods, history/draft preservation,
markup-wrapped tokens, malformed prefixes and hook cleanup. Tests use local
recorders; no live chat message was submitted. Production session installation
is wired, but a live reload/send test was not performed for this change.

The source sharing buttons, insertArtifactLink composer action, channel-tab
disabling/automatic destination selection, and QoLAF/floating-room transport
remain incomplete. This change supplies the final send policy, not those UI or
transport features.

Also compared TextManager's non-damage notifications with the current Haxe
implementation: XP, score, PvP, level, bonus XP, frag score, mission/boss/uber
messages, drop aggregation, map entry and reputation retain source text, timing,
position, color and size paths. They use the already-ported shared text layout.
This source inspection does not establish live animation or full visual parity.

## Rich editor word operations and click selection (2026-11-10)

The artifact sharing source path also depends on rich-editor selection semantics.
Before adding its UI, audited those dependencies: Ctrl/Alt navigation and word
deletion were delegated to browser defaults, and native pointer input did not
implement the source double/triple-click behavior. Extracted
feathers.utils.text.TextInputNavigation from the original repository's
libs/feathers.swc with ffdec and ported its exact word/punctuation rules. These
are the library's ASCII word rules, not ChatWordBoundary's separate Unicode
moderation rules. RichBitmapFontTextEditor.as supplies the subsequent snapping
to complete emoji clusters and artifact spans.

Ctrl/Alt+Left/Right now use those rules, including selection collapse and Shift
extension. Ctrl/Alt+Backspace/Delete and browser deleteWord input events edit the
rich document rather than a partially edited DOM projection. Double click selects
the source word; triple click selects the line. Native click counts use MouseEvent
detail after pointer release, with default DOM double-click selection suppressed.
Markup formatting, atomic artifact tokens and emoji sequences remain intact.

Typecheck and all 359 tests pass. Added coverage for native click integration,
bitmap selection geometry, all-word selection, reverse selection, both keyboard
modifiers, beforeinput deletion, unchanged surrounding formatting, whole artifact
tokens/emoji, disabled input and read-only deletion.

Reloaded once with explicit F5 release. The prior session had reached the native
idle-disconnect dialog. Autologin completed; the new game session reported canvas,
bridge and connection present with zero preview runtime errors. In the actual
composer, a temporary unsent formatted draft produced word-right [4,4], extended
word [4,8], double-click [0,3], triple-click [0,13], and word-delete [8,8] with red
"two" formatting preserved. A physical double-click separately selected and
highlighted "one". Temporary drafts were cleared and chat visibility restored.
Evidence: /tmp/QoLAF-WordLive.png, /tmp/QoLAF-WordCleanup.png,
/tmp/QoLAF-NativeWordClick.png and /tmp/QoLAF-NativeWordCleanup.png.

Artifact share UI/channel selection and QoLAF transport remain separate unfinished
work; this closes the editor operations needed to edit those references faithfully.

## Composer artifact label resolver wiring (2026-11-10)

Found an integration gap while tracing sharing: the message renderer received
ChatArtifactLinkResolver, but NativeBitmapInput constructed both editor model and
view without it. Thus model-only artifact tests passed while the actual composer
displayed raw references and did not treat them as atomic labels.

GameSession now passes the existing resolver into the native rich input. Its model,
bitmap renderer and caret metrics use the same presentation function. Input
changes request resolution; completion reparses labels while retaining source
selection positions, explicitly invalidates the renderer's unchanged-wire-text
cache, and projects the new visible selection to the DOM. Session cleanup removes
both change and resolution listeners before disposing the editor.

Typecheck and all 360 tests pass. The new integration regression uses the actual
resolver with deferred PlayerObjects/Artifacts callbacks and the actual native
input adapter: fallback label, colored resolved label, unchanged wire source,
whole-token selection, increased rendered glyph geometry, and ignored late
completion after disposal are all checked.

After one reload/autologin, a real revealed Armorlock Protocol reference in an
unsent draft changed from "A [Artifact] Z" to
"A [Artifact: Armorlock Protocol] Z". The raw draft remained unchanged and source
selection mapped to the complete visible label [2,32]. Its orange bitmap label
and selection were visible in /tmp/QoLAF-ComposerArtifactLive.png. Cleanup restored
the previous empty draft and closed the composer; no chat message was sent and no
artifact data was modified. Sharing actions and automatic channel selection are
still unfinished.


## Advanced chat receive batching and retention (2026-11-10)

Compared original ChatAdvanced.updateText/flushPendingMessages with the native
Haxe implementation. Ported the original 100 ms receive batch, bottom-follow
capture before inserting rows (2 px tolerance), and 150 ms scroll debounce.
Pending messages are rechecked against mute state and the current source queue.
Clear, removal from stage, disposal and plugin cleanup cancel pending work.

Native addText checked the row limit before insertion with a strict greater-than
comparison. The adapter now enforces the exact configured limit and excludes the
native player-options popup from the message count, disposing it when necessary.
The existing rich-message addText hook still handles row rendering.

Typecheck and all 364 tests pass. Four regressions exercise the actual host hook
dispatcher and an extracted native addText method: burst timing, bottom following,
reading history, exact retention, popup disposal, mute/block changes and lifecycle
cancellation. Preview status reports canvas, bridge and connection present with
zero runtime errors. No live messages were sent. Live receive/scroll behavior has
not yet been visually verified for this change.

Still open: the original virtualized list, initial bottom reveal/settling and
full advanced-history UI parity. This change retains the native ScrollBox and its
initial load path; it does not establish complete chat parity.


## QoLAF chat transport prerequisites (2026-11-10)

Artifact share insertion defaults to the original QoLAF channel unless already
in Private/Clan. The port has no ClientIPCService or ClientQolafChat integration;
therefore adding only the sharing controls would not reproduce that flow.
Original service uses a dedicated invisible Service-1409_24 room, not the gameplay
connection. Authentication owns its lifetime; scenes only attach/detach receivers.

Ported ClientIPCCodec, ClientIPCAssembler and ClientIPCMessagePack into src/ipc.
Wire format is the original QIPC3 version-3 PlayerIO binary message, unpadded
base64url, CRC32 and 150-character frames. Multipart END is the commit point.
Preserved sender/channel isolation, duplicate/conflict handling, idle and absolute
deadlines, replay limits, per-peer bounds and nonrecursive atomic message packs.
Binary primitive encoding was checked against BinarySerializer decompiled from
the original libs/PlayerIOClient.swc (signed int, uint, float, double order).
No game connection or public chat sends were used by these checks.

Typecheck and the full 371-test suite passed. Added seven protocol tests including
independently specified SDK token bytes, UTF-8 and opaque payloads, base64url
comparison against Node, known CRC32 vector, exact 65536-byte limit, multipart
ordering, replay, expiry, mutation isolation and malformed packet rejection.
A follow-up audit caught JavaScript regex end-anchor acceptance of trailing
newlines; explicit source-equivalent ID length/type character checks and tests
now cover it. Targeted protocol tests passed again after that correction.

Runtime cross-language interoperability is NOT yet proven. An isolated AIR oracle
using the unchanged original ClientIPCCodec compiled at /tmp/QoLAF-IPCOracle.
The installed AIR runtime exited without producing its expected output.json;
its commercial-license notice was the only output after resolving local runtime
library loading. Do not treat the compiled oracle as a successful runtime test.
The new protocol modules are not yet wired into the client bundle's runtime.

Next required work: port ClientIPCService connection generation guards, authenticated
receive envelope, discovery schema 4/presence, paced queue (Local 1s, Private 200ms),
reconnect/expiry/cleanup and message-pack dispatch; then ClientQolafChat receiver,
channel tab/send integration, reward notices and artifact sharing controls. Keep
new gameplay connection semantics intact and verify actual interop before claiming
QoLAF chat or artifact sharing complete.


## Dedicated IPC Service transport and native ABI (2026-11-10)

Ported the original ClientIPCService into typed browser code, with its send queue
and channel policy extracted into readable classes. Source behavior retained:
invisible Service-1409_24 joins; validated 19-field handshake; 8-second join timeout;
generation guards and exponential reconnect; stable authentication login ID versus
per-socket session ID; schema-4 finite discovery; acknowledgments before peer-ready
notification; retired-session rejection; 60-second presence and 150-second expiry;
authenticated chat-envelope identity; whole-pack channel validation; chat restriction,
missing-player notice correlation and duplicate-login handling; deferred SDK callback
removal; and best-effort graceful leave.

The queue retains Local 1000 ms / Private 200 ms pacing, separate waiting/active
transmission deadlines, bounded storage, source factories, destination/session
checks, radio and discovery/presence priorities, same-destination contiguous packing
only when the pack stays one physical frame, and completion/error callback isolation.
NativeIPCClient adapts the inspected Haxe wrappers. Haxe Message has no getObject;
its SDK raw._internal_("get-objects") supplies an uncoerced copied field array.
No game or scene timer is held by the service.

Verification: typecheck and all 392 tests pass. Twenty-one added tests exercise
transport/queue behavior and the actual extracted Haxe Multiplayer/Connection/Message
wrapper code. Coverage includes delayed stale join callbacks, reconnect identity,
wrong handshakes, ACK ordering, retired peers, envelope identity, rejecting entire
mixed-channel packs, listener mutation, delayed handler removal, presence, bans,
kicks, duplicate login, notice correlation, pacing, packing, priority, factories,
queue limits and expiry. A test-fixture callback typing error was fixed before the
final successful typecheck. No live sockets or user chat messages were used.

Independent current-SDK compatibility check is now reproducible with:
`npx tsx scripts/CheckIPCInterop.ts /path/to/PlayerIOClient.minified.js`.
Downloaded the original endpoint's SDK to /tmp/QoLAF-PlayerIOClient.js; SHA-256:
0ac4f691d1b81857d32481cf5ef4c900e2bb9848eb025d541e6a2357338dbfee.
Its decoder accepted all 1,022 generated packets, including Unicode, bytes and
numeric boundaries; 1,020 reserialized byte-for-byte. Two SDK encoder failures were
observed and asserted separately: astral Unicode (URI malformed) and Number.MAX_SAFE_INTEGER
(invalid byte). Our inner packet codec handles both; outer Service frames are ASCII,
so these values never pass through the SDK string/numeric encoder directly. This
is independent JavaScript-SDK runtime evidence, not an AIR interoperability result;
the previous AIR-oracle limitation still stands.

Not yet installed into Index/authentication or the live client. Remaining: reuse one
NativeIPCClient per native authentication owner, attach service lifetime to auth/host
cleanup, exclude the reserved IPC Service room from ordinary gameplay selection,
port ClientQolafChat inbox/scene receiver and reward announcements, then wire the
QoLAF channel and artifact sharing. The protocol version label accepts only numeric
release triples and Public/Private; identify the port by its own numeric version,
not the original AS3 source version. UI may keep the explicit development suffix.
No claim of live connection, visible chat parity or completed sharing is made here.

## Screen parity follow-up — 2026-11-10

Changelog now has its native popup and complete source release archive; live
selection, both scrolling regions and Escape were verified. Historical notes
describe the original client, not claims of implemented port features. Empty
key-binding labels are fixed and visually verified. Still audit narrow-window
layout, reopening/context restoration, the tabbed client help, welcome/credits,
player inspection, music/radio and ship-visual dialogs against original source
and running UI. These remain full-port requirements, not optional follow-ups.

The tabbed help window is now ported and exercised in-game across all tabs.
Its source reference text remains explicitly marked as describing the original
client. Convert the automation examples to the actual JavaScript module API and
review feature availability as each remaining port feature lands. Welcome,
inspection, music/radio and visual-editor dialogs remain outstanding.


### Inspection follow-up — 2026-11-10

The seven-tab native inspector is now implemented and live-tested, including
ship/artifact details, paging, cargo, stats, Close and reopening by @name.
See LiveComparison.md for failures found and corrected during the runtime pass.
Still verify remote-account read failures, online-friend lookup, artifact Share
draft insertion and scroll-versus-click cancellation. Automatic QoLAF sharing
remains dependent on the unfinished IPC/chat port. Welcome/credits, music/radio
and visual-editor screens remain outstanding. The Help popup also needs its
short-viewport layout bounded; its fixed 500px content currently exceeds a
415px stage with a large browser console open.


### Welcome implemented — 2026-11-10

The native first-time help invitation is now ported. Live checks cover waiting
for Sale, accepting into help, Later, and persistence after reload. Browser
storage replaces the absent AS3 sharedObj. Login credits were already ported.
Still missing: the automatic once-per-release changelog sequence, music/radio
and ship-visual dialogs; short-viewport help layout remains open. Welcome
geometry was compared to source, not a freshly reopened SWF welcome instance.


## MUSIC-01 — native screen implemented, transition checks remain

The native /music window and service-owned playback are ported and exercised live.
Track selection, play/pause/resume/stop/next, automatic ownership and account reload
persistence work. The earlier disappearing-heading diagnosis is not supported by
pixel inspection: clean active-window captures before/after interaction contain
identical heading pixels (422 bright pixels, zero differing pixels in the heading
rectangle). The heading also survives the final OpenFL framebuffer composition.
No experimental renderer patch was retained. Other labels and full visual parity
still need direct comparison; this finding is limited to the inspected heading. Browser autoplay unlocking, actual room/death
transitions, failed-audio loads and external radio takeover still need live checks.
Radio and ship-visual windows remain separate outstanding screens.


### Release startup sequence and short-viewport help — 2026-11-10

Automatic changelog now waits for the active game, Sale/other modals, and recovery.
It marks the port version after successful opening, including manual /changelog,
and keeps an in-memory fallback when browser storage is denied. Welcome explicitly
waits for the release sequence, rather than racing it on independent timers.
The historical AS3 archive remains distinct from the port version used for persistence.
Help preserves its 720×500 source layout, scaling the whole native window only when
needed to keep tabs and Close inside the viewport. Radio and hull-editor screens
are still missing; this work does not complete screen parity.

## VISUAL-01 — native hull editor implemented; live weapon/sharing still open

The original developer hull-editor screen is now ported and connected to
`/sv devvis`, with source account checks, bitmap inputs, settings controls,
source layout, draft isolation, presets, validation and original shader previews.
Compared directly to the original running SWF, correcting checkbox width, input
styling and disabled sliders. All nine pattern/palette preview combinations ran
without reported runtime errors. Cancel/reopen preserves the original settings;
invalid hex disables Apply. Details and screenshots are in LiveComparison.md.

Local hull application and per-account persistence are implemented, but the
current test ship is not a source-supported hull and live Apply was not tested.
Do not mark application or full visual parity verified. Remaining: supported-hull
Apply/restore, context/lifecycle transitions, actual phase-blade rendering,
visual IPC sharing, other /sv features and the Radio screen. Cosmetic model,
spatial transforms, palette boundaries, draft validation and disabled slider
transitions have regression coverage.

### VISUAL-01 phase-blade rendering follow-up

The live weapon rendering adapter and emitter tint path are now implemented.
Extracted native beam-code regressions cover geometry, palettes, pooling, cleanup
and other-weapon passthrough. A temporary visual-only native beam rendered with
source bloom/blending and exact final-segment length in the browser, then was
removed cleanly. This does not prove equipped-weapon combat parity. Still verify
supported-hull Apply and persistence, actual twin-blade/target/emitter appearance,
context restoration and room transitions. Port the original render-interpolated
beam endpoints and visual IPC; Radio and the broader /sv family remain open.

### Beam render coordinates — 2026-11-10

Native beam drawing now uses displayed hull/target poses for muzzle points,
twins, target/body contact, chained endpoints and emitter placement. The original
phase-blade authored-mount transform is ported for ordinary player hulls, including
base scale, pivot and mirroring. Native simulation endpoint objects, range, target
selection and damage updates are not replaced. Palette emitters share the active
render geometry without adding properties to native weapon objects.

All 434 tests pass, including 60/120/180 FPS sampling without simulation updates,
undrawn-object fallback, body-radius contacts, authored mounts, extracted native
draw/chain order and failure cleanup. Remaining beam parity: original visual target
hysteresis/grace, multipart visual mounts (depends on the missing multipart ship
visual port), actual combat/twins/emitter comparison, and supported-hull Apply.
Radio, visual IPC and other /sv screens/features remain outstanding.

## RADIO-01 — native view ported, service remains unconnected

Ported the original 900×780 RadioPopup into native Starling controls: room and
queue lists, request/peer panes, leader/DJ controls, seek revision guards, queue
modes, local volume, source chrome, viewport scaling, and disposal. RadioInput
retains native focus/selection and full query text while truncating only its
unfocused bitmap preview; passwords are masked. RadioMarqueeTextRenderer keeps
the source 28px/s motion and 1.25-second endpoint pauses.

This view is **not installed as a working /radio command**. RadioViewService is
the boundary for the pending session service. The browser still needs a media
backend, authenticated IPC room integration, synchronized playback, invites,
and RadioChatBridge/modal chat behavior. No placeholder service was shipped.
The temporary local screen-review harness used isolated test data, never joined
a room, and never downloaded media. Opening a screenshot is not playback proof.

Live review corrected a collision with ScrollBox's internal content field,
the bound base draw getter overwriting the marquee override, and Haxe's
get_passedTime accessor. Long labels now clip and animate in the browser.
Four added tests cover bitmap clipping across revalidation, marquee motion,
native slider interaction boundaries, changed-track seek cancellation, listener
request routing and queue mode coupling. Full suite: 438 passing tests.

### Scaled native inputs — corrected

Small-viewport hull-editor DOM inputs overlapped because upstream placement ignored
ancestor scale in width/height. Corrected for bitmap inputs and the Radio input
adapter; verified small and full viewport sizes and physical Color B focus. Full
suite now 441 tests. Remaining screen/backend work is unchanged. The original Music
checkbox's low-contrast enabled color is intentional in the shipped Aeon theme;
only its disabled-color mismatch was corrected.

The input-placement follow-up also excludes masked/offscreen glyphs from DOM
bounds. Live long-draft content measured 1040px while its input remained 508px;
the draft was discarded without sending. Full suite: 442 passing tests.

### IPC runtime connection installed — current service version required

Native authentication now owns the IPC service and excludes its reserved room
from normal joins. Live legacy room attempts disconnected before handshake; the
current Service-1410_24 address passed the handshake and stayed online. Address
and client_version now follow native JoinRoomManager instead of hardcoded 1409.
This corrects the earlier inventory note that IPC was entirely uninstalled.

Still pending: commit/verify ClientQolafChat inbox, scene receiver and QoLAF tab/send
integration, then reward/visual sharing and Radio applications. No live human chat
or original-AS3 interoperability was tested; zero peers were present.

### Weapon-color screen installed — 2026-11-10

`/sv wc` now opens the original native RGB/slider/grayscale dialog. Apply, Cancel,
reopen and reset were exercised live; the Haxe weapon-name getter was corrected.
Explicit per-weapon colors have local rendering and per-account persistence.
See LiveComparison.md for evidence and screenshot. All 450 tests pass.
Remaining: equipped combat and charge-up transitions, remote IPC sharing, and the rest of the visual command family.
Radio remains a disconnected view. No claim of complete screen or feature parity.

Follow-up audit caught a shader-batch transition when grayscale is turned off:
release the isolated emitter batch before restoring ordinary particle styles.
Regression covers both batch membership and newly emitted particles. All 451
tests and typecheck pass after the correction.

### QoLAF chat receiver and channel installed — 2026-11-10

The original authentication-owned inbox and native QoLAF tab/send path are now
installed. Local-only inbox rendering and unsent draft/tab selection were checked
in-game; transport reported online with zero peers. All 457 tests pass. No peer
message was sent, so live cross-client interoperability remains unproved.
Remaining: trusted-relay/role tags, automatic reward/purchase event hooks, artifact
sharing transport, real warp/reconnect delivery checks, and Radio integration.
The visual emitter ownership transition between hull palettes and explicit weapon
colors was also corrected with a two-direction regression.

### Chat role/relay presentation installed — 2026-11-10

Original exact-ID cosmetic badges, client-developer labeling, trusted Discord/
announcement projection and rich visible-text profanity filtering are now active
on the native receive path. Source Unicode boundaries are preserved. Native length
and PvP checks remain in place. Local rendering and physical role-card hover were
verified; all 462 tests pass. See LiveComparison.md for evidence and remaining
chat work. No production relay or cross-client send was performed in this pass.

### Original-client diff refreshed — artifact review, 2026-11-10

Regenerated the complete comparison from the current original-client working tree
against the decompiled supplied Preload.swf. Local evidence is under
`/home/raony/Documentos/astroflux-port-audit/current/` (inventory, method inventory,
and per-file unified diffs). Counts remain 722 files: 288 added, 356 changed,
78 unchanged. Normalized method review reports 4,564 added, 1,268 changed,
40 removed and 2,852 unchanged. These counts describe source differences, not
completed port coverage. Original source working-tree changes were left intact.

Compared `ChatInputText.selectArtifactChannel` and `insertArtifactLink` directly:
removed the stale rejection claiming QoLAF was unavailable. The native composer
now selects QoLAF from unsupported tabs, retains Private/Clan/QoLAF, registers the
artifact locally and inserts the token with the original spacing and selection
replacement. It only opens a closed composer; no send operation is called.
Deferred insertion is cancelled on session disposal, leaving or replacement.
Seven focused draft/policy tests and all 470 suite tests pass; typecheck passes.
Live draft interaction against the new release remains to be checked.

Artifact screen mismatches confirmed from the refreshed diff (still open):

- `ArtifactOverview`: classic/expanded layout toggle, expanded chrome and layout,
  setup scrolling/layout, inline sorting and selection synchronization.
- `ArtifactShareContextPopup` and overview/state handlers: native two-row context
  menu and return-to-play draft insertion.
- `ArtifactFavorites`, `ArtifactCargoBox`, `ArtifactBox`, overview recycling:
  account-scoped annotations, markers, protected selection and recycle pruning.
  Favoriting must not be exposed without the original recycling protection.
- Purify minimum controls, unique/recycle-generator/favorite protections and
  pending-operation guards; capacity footer and inventory summary refresh.
- `ArtifactSorting`: original dialog chrome, close handling and sort options.

`NativeArtifacts.ts` currently supplies fitness tooltip/sorting additions only;
it is not a port of the full artifact overview. Preserve the current Haxe gameplay
and server-operation contracts while implementing the original UI around them.

The same artifact diff review also corrected fitness sort ordering among
unrevealed entries and restored `onSort`'s scroll-to-top after rebuilding cargo
rows. A native-hook regression checks both directions, revealed-first grouping,
row disposal/rebuild order and delegation of unrelated sort types.

### Rendering omissions found by source diff — 2026-11-10

The port omitted `GameObject.hasRenderPosition` lifecycle semantics. Original
`renderX/renderY/renderRotation` use a clip only after drawAt has positioned it;
reset/addToCanvas invalidate that state. Port emitter targeting instead trusted
isAddedToCanvas alone. Added the lifecycle guard and applied it to emitter and
floating-text positions, with a regression for undrawn body anchors and reused
clips at the origin. This is a confirmed semantic discrepancy relevant to the
reported missing sun; the sun's actual live appearance still requires verification.

`Projectile.draw` frame prediction and `ProjectileManager.draw` per-frame vertex
copies were also missing. Native Game.draw moved projectile clips every frame,
but native manager.update only copied them into MeshBatch on 33 ms ticks. Added
source position/rotation prediction and a per-display-frame batch rebuild after
the existing draw traversal. Projectile physics are untouched. Grayscale batch
clearing now follows primary batch clearing, and torpedo warnings follow render
frames instead of simulation updates. Regression samples copied vertices at
60/120/180 Hz without simulation ticks, and checks pooled/dead-object handling.

Full local suite: 476 passing; typecheck and formatting pass. Not a claim of
complete rendering parity: source renderState attachments, timestamp-aligned
server bullet drawing, ribbon-head refresh, body culling/distortion integration
and the remaining changed rendering methods still need semantic review and live
comparison. User specifically requires this review across ALL changed client code.

### Ribbon heads and attached-projectile rendering — 2026-11-10

Ported `RibbonTrail.updateHead` and `Projectile.positionRibbonHead` from the
original source. Heads now use the final displayed projectile transform every
frame, including the authored radius offset. Tail history still advances only
through the native tick path. Native RibbonTrailPool.update already copies these
vertices after Game.draw; it does not need a second history update.

Ported `Projectile.drawAttachedTo`, `ProjectileStuck` render-state entry/exit,
and `MissileStuck.draw` fractional convergence. Attachment state is discarded on
exit and projectile pool reset. Drawing changes clip transforms only, leaving
course positions, TTL and newer native gameplay intact. Ribbon heads are updated
after attachment transforms, matching the original draw ordering.

Typecheck and the full local suite pass (479 tests). Regressions cover ribbon
heads at 60/120/180 Hz, unchanged tail history/physics, radius offsets, inactive
trails, host rotation, fractional convergence, state exit and pool reset. These
changes have not been visually verified in the live game. Instant/InstantSplitting
render states, timestamp-aligned server bullet drawing and the other previously
listed omissions remain open. Neither the missing sun nor whole-client parity is
marked resolved. The required scope remains every original client change across
all files, including non-rendering code and screens.

### Instant ray presentation — 2026-11-10

`InstantFrames` ports the original Instant/InstantSplitting frame fade, thickness,
fixed fired-world origin, displayed rotation, renderTimeToLive rule, and line
release on exit/reset. Native live execute still owns simulation TTL and course
time. Dead execution retains its native clock advance but releases lines once;
the native splitting path previously detached lines without returning them to
the pool. Game.exit also releases tracked lines before native room teardown.

Four integration regressions run extracted Service1412 state methods through the
host hook dispatcher and test 60/120/180 Hz fade, non-drifting origins, unchanged
simulation positions/lifetimes, state exit, death and projectile reuse. Full suite
483 passes before the room-exit cleanup addition. Original orbit lightning,
instant-ray color/grayscale integration and room-owned Nether Blob tentacle
visuals remain unported; this does not close full projectile presentation parity.

Live preview server was reachable and reported a connected canvas with zero
runtime errors. That status predates reloading this change and does not verify it.
Desktop comparison was interrupted by active user focus changes; no reload or
combat input was issued. Latest changes are built locally for the next comparison.

Room-exit cleanup now has two additional native-hook regressions (one per state).
Final full suite: 485 passing. Typecheck passes. Live visual comparison remains
outstanding for these changes.

### Camera bounds and large-body visibility — 2026-11-10

Found another concrete missing source correction relevant to the sun: native
StarlingCameraFocus.isCircleOnScreen tests whether any bounding-box corner is
inside the view. An effect enclosing the viewport has no corner inside and is
incorrectly rejected. `CameraView` ports the original overlap predicate. The
regression demonstrates native rejection and source acceptance of that case.

Ported source updateViewRectangle using all four corners through the actual
stage-container globalToLocal transform, rather than requested destination zoom.
World culling radius includes portrait height; persistent size revisions survive
multiple render frames between simulation ticks. `BodyVisibility` ports the
original visual/zone extent, center, distance scheduling and zoom/resize cache
invalidation. Hidden/boss anchors and body course updates remain native.

Also restored original emitter→camera→parallax frame ordering. Camera movement
now uses the hook around phase after emitter before-hooks, regardless of module
installation order. Cached native enter-frame listeners still reach this path.

Five new culling regressions pass; full suite was 490 passing before the frame
ordering change, whose cached-listener regression was then extended and passed.
Typecheck/build and diff whitespace checks pass. These corrections are built in
the local preview. No live sun-appearance claim: browser connector inventory is
empty, and active desktop focus changes previously interrupted comparison.

### Original artifact sorting dialog — 2026-11-10

Reviewed the pending ArtifactSorting implementation against the complete source
class and the original overview chooseSorting/onSort/refreshArtifactAdequacy.
The port now uses its 665×520 native-display panel, theme/borders, bitmap headline,
scrolling stat rows, source tooltips and ten sort controls. Original comparator
semantics include revealed grouping, potential, fitness, adequacy with equipped
modifier-family counts, modifier count, upgrade count, names, and native stat
values. The actual Service1412 Artifact initializes levelPotential and provides
the recycle-rate constant used by the dialog.

Lifecycle integration toggles the popup, centers it in expanded mode, keeps
source overview controls above it, closes on overview disposal/plugin cleanup,
and restores the sort button. Sorting rebuilds cargo and resets scroll. Four
regressions cover comparators, controls, theme/geometry, popup lifecycle and
cleanup; typecheck passes. Expanded ArtifactOverview layout, overview stat rows,
and broader artifact screens remain unfinished. This dialog has not yet been
visually compared in the running client.

### Artifact cargo grid and capacity footer — 2026-11-10

Ported original drawArtifactsInCargo row calculation and configurable columns,
with the source minimum of 100 cells and original native ArtifactCargoBox actions.
The old Haxe calculation added an entire empty row at exact multiples above 100.
The cargo container uses the ported original scrollbar skin.

Ported refreshCapacityFooter: only artifact count and capacity level are compared
per visible frame; changes update the footer without rescanning or rebuilding the
grid. Maximum capacity replaces the upgrade button with count text. Native
onUpgradeCapacity is still invoked only by its button; no purchase was performed.
Frame listeners are removed on rebuild, overview disposal and plugin cleanup.

Full suite: 493 passing after extending the compiled integration fixture with
the newly required native overview/Player/TextBitmap dependencies. Typechecking
passes. Regression coverage includes empty inventories, exact and partial rows,
configurable columns, unchanged artifact identity, live count updates, maximum
capacity transitions, leaving the room and cleanup. Full expanded layout and
live visual comparison remain open.

### Public 1.1.23 naming and login Control cancellation — 2026-11-10

Restored the requested public version convention: QoLAF v1.1.23 (Public), with
original credits and no TypeScript/port suffix in login, /echo, help, IPC version
or module metadata. Archived 1.1.22 release notes retain their historical version.

Login cancellation previously relied on an instance onKeyPress hook installed
after native code cached its callback, plus a once-per-second Control poll.
`LoginControl` now observes browser capture-phase keyboard input from plugin
activation, preserves the source startup override after key release/blur, and
immediately cancels a pending countdown and restores the profile chooser.
Listeners detach on login/plugin teardown. Regressions cover a brief tap between
timer ticks, a native callback bound before patching, startup-before-panel input,
modifier combinations, blur and cleanup. Live cancellation still needs a browser
check; automated coverage does not establish whole-client parity.

### Artifact setup selection and source skin investigation — 2026-11-10

Ported syncSetupSelection label/sizing rules and AstroTheme's isToggle=false
ownership for overview setup buttons. The current Haxe syncSetupButtons writes
selected directly; the adapter invokes native setters so the selected skin is
updated regardless of property aliases. Active setups use “Setup N” at 72px,
inactive setups use their number at 32px, the buy control remains 34px, and gaps
are 6px. Native safe-zone/recycle checks and change/buy callbacks are retained.
Only overview-owned buttons stop self-toggling; other native toggle controls are
unchanged. Full suite 496 passes, including rejected changes, accepted changes,
selected appearance, dimensions and unrelated controls. No live setup change or
purchase was performed.

Horizontal overflow is NOT yet ported. Source review located its Aeon horizontal
thumb up/hover/down/icon textures and scale9 geometry in BaseAeonDesktopTheme.
The original AeonDesktopTheme.swc assets were extracted to /tmp/QoLAF-Aeon/export
for the next implementation, avoiding a substitute scrollbar design. Expanded
overview layout, row overflow and visual comparison remain open.

### Artifact setup horizontal row — 2026-11-10

Added native display-list clipping, horizontal wheel scrolling, thumb dragging,
and track paging with original Aeon SWC textures and scale9 geometry. The row
uses source dimensions and updates classic cargo/separator positions when it
overflows. Viewport bounds exclude clipped buttons; disposal removes wheel
listeners and supports restoring buttons on plugin unload. Atlas provenance is
recorded beside the extracted image.

Verification: TypeScript check, formatting check, and all 499 tests pass.
Tests cover overflow, bounds, wheel/drag/page behavior, shrinking, cleanup, and
texture loading cancelled by disposal. Live visual comparison, touch-content
dragging/inertia, and expanded overview layout remain open; this is not full
artifact-screen parity.

### Instant beam orbit lightning — 2026-11-10

Ported BeamOrbitLightning from the original ActionScript: fixed 288-vertex mesh,
three bounded orbit arcs, source weapon-key eligibility, noise/phase formulas,
additive blend, source color whitening, and network-server-time fallback. Instant
rendering now drives the mesh each display frame and releases it with the beam
on death, state exit, pooling reset, room exit, and plugin cleanup. Ordinary and
splitting rays retain their existing eligibility/behavior.

Validation: 503 tests pass, TypeScript and formatting checks pass. Regressions
exercise native Instant callbacks, 180 Hz geometry changes without simulation
aging, unused-geometry collapse, invalid-frame hiding, eligibility and disposal.
Live visual comparison remains outstanding. This does not implement the separate
room-owned NetherBlobAttackVisuals controller or full beam grayscale/color parity.

### Instant and splitting ray color selection — 2026-11-10

Connected selected weapon colors to native Instant/InstantSplitting entry before
pooled BeamLine initialization. Inner/core and glow colors now follow the source
selected RGB, and line ownership enables the existing grayscale mesh style for
these rays. The projectile exposes determinedColor/determinedGrayscale for the
orbit effect; original properties are restored on reset and unload. Line reuse
clears tint ownership on every init. No damage or gameplay fields are changed.

Verified actual extracted native enter methods for both ray types, core/glow
values, grayscale routing, unselected pooled reuse, unrelated lines/rooms, and
restoration. All 506 tests and TypeScript checks pass. Browser visual verification
of the shader remains outstanding.

### Room-owned Nether tentacle snapshots — 2026-11-10

Ported NetherTentacleVisuals from the original source. Activation captures only
position, endpoint, scale and local timing, so an expired/reused projectile cannot
remove or move its appearance. The 350 ms fade starts at the first displayed
frame, rejects pending shots older than 500 ms, supports unsigned timer wrap,
and caps active shots and line geometry. Pooled pairs are returned on expiry,
partial allocation failure, manager disposal, room exit and plugin teardown.
Native Instant lines are suppressed for the exact Nether enemy/tentacle weapon;
the current Haxe integer TTL arithmetic and course clock are preserved.

Validation: 510 tests pass, TypeScript and formatting checks pass. Coverage
includes projectile reuse before first render, partial allocations, geometry and
capacity limits, timer wrap, stale pending shots, and native Instant timing.
Live encounter comparison remains pending. The separate Nether beam Chrono-style
selection (NetherBlobAttackVisuals.instantStyle) is still unported.

### Nether beam appearance and refreshed local upstream — 2026-11-10

Ported AIStateFactory's Nether beam Chrono-style choice for the exact enemy
faction and beam weapon key. Only appearance fields reach the native state
constructor; source AI, range, TTL and shared cached records remain unchanged.
Missing optional amplitude/frequency fields retain the native source defaults.
Tests cover eligibility, fallback, immutable source data and physics fields.
Full suite: 511 passes; TypeScript and formatting pass.

Fetched a fresh official asset snapshot locally: client SHA256
`a1c06864d50ab174e2fa9e5a036318c824727d59105073de717b40fcd9d6b013`.
AIStateFactory, Instant and ProjectileManager definitions match the previous
snapshot byte-for-byte. A fresh browser window showed the 1.1.23 (Public) identity
and the local /Client/qolaf-client.js URL in Plugins. The older window showed an
outdated-client notice. Screen comparison remains incomplete; the user was also
actively switching windows, so input routing was unreliable. No gameplay parity
claim is based on these screenshots.

### Artifact tooltip source formatting — 2026-11-10

Replaced the appended decimal Fitness text with the original cargo/active tooltip
construction. Cargo uses integer Fitness followed by Adequacy before upgrades;
active slots show Adequacy without the cargo-only Fitness/restriction/max-upgrade
lines. Names and labels use localization; restriction colors and native stat HTML
remain intact. Crew upgrade end times are refreshed before formatting. Equipped
tooltips refresh with reloadStats, including changed setup adequacy.

Adequacy scoring now shares the same family-weight computation between sorting
and single tooltips without scanning the whole cargo for every tooltip. Tests
check exact output, localization, native stat flags, upgrade timing, cargo/active
differences and changed setup scores. All 513 tests, TypeScript and formatting
checks pass. Live hover comparison remains pending. Expanded overview layout and
favorite protection are still separate unported requirements.

### Artifact favorites foundation, not yet activated — 2026-11-10

Ported account-scoped local favorite storage and source recycle guards. Guards
cover tile selection, Select Max (including its 40-item cap), final selection
pruning, protected tooltip text, and frozen selection while the recycle response
is pending. Clearing a recycle highlight preserves upgrade highlights. Tests use
only simulated requests; no live artifact was recycled or modified.

Full suite: 515 passes; targeted favorite tests rerun after tightening malformed
storage handling. TypeScript and formatting pass. These modules are intentionally
not installed in Index yet: the source context menu and inset gold markers still
need integration before this can be considered a player-usable feature. No star
icon is in the original marker; it is a four-sided inset outline.

### Favorites UI connected — 2026-11-10

Installed the favorites foundation with the source 190×66 context menu, 32px
rows, bitmap labels, border/hover/down colors, placement clamping and outside
click dismissal. Unrevealed artifacts can be favorited but cannot be shared;
action requires a matching, non-cancelled press/release. Favorite tiles receive
the source four-sided gold inset outline while preserving their ordinary frame.
Changing a favorite prunes protected recycle selections and respects pending RPCs.
Share closes the enclosing menu before inserting an unsent artifact chat draft.

Adapted browser pointer coordinates through native DomOverlay.toCss. The current
Haxe ToolTip has no hideType, so the adapter hides only shown artifactBox tooltips.
Native event/touch values use accessors without depending on unrelated aliases.
Menu, marker and document listeners are removed on disposal/unload.

Full suite 517 passes; focused UI/integration tests and TypeScript rerun after
accessor tightening. Tests cover exact menu dimensions, eligibility/cancelled
presses, marker geometry, pending/stale toggles, pruning and close-before-draft.
No live favorite, recycle, or chat action was performed. Browser visual comparison
is still pending; this does not establish whole artifact-screen parity.

### Recycle panel text and login hint boundary — 2026-11-10

Ported the source overview's recycle/supporter text stack: Russo/Verdana bitmap
fonts, 200px classic width, explicit description wrapping, favorite-protection
notice, and control positions computed after text measurement. Expanded widths
are supported by this helper but the expanded overview itself remains unported.
Setup-row unload now restores saved button coordinates instead of leaving y=0
over the active slots. Regression coverage checks both supporter states, classic
and expanded text widths, wrapping-dependent heights, and restored positions.

A local reload rendered and connected. The screenshot at room loading exposed a
stale Ctrl hint: upstream ConnectStatus.set_subText ignores empty strings. The
login adapter now explicitly clears connectSubText. This does not add room-join
cancellation; Ctrl applies to countdown/site authentication. The live key arrived
after authentication, so live cancellation is still unverified. No further
reload was performed once active gameplay was visible. Recycle screen visual
comparison remains pending. Full suite: 523 passes; TypeScript passes.

### Purify controls and room-owned recycle state — 2026-11-10

Ported source Purify/Save controls, numeric input restrictions, classic positions,
and saved filter semantics (fitness 110, strength 90, lines 0 by default). Input
edits affect selection only after Save. The selector preserves cargo order,
caps requests at 40, checks unrevealed artifacts against any failed minimum,
and excludes favorites, unique artifacts and the Recycle Generator. Fitness
uses the existing source calculation. Requests use the current native bulkRecycle
protocol; local inventory/cargo update only after a successful server response.

Manual recycling, Purify and favorite changes now share g.artifactRecyclePending,
as in the original, rather than separate view-owned flags. Retired Purify views
accept authoritative responses without touching disposed controls; reopened views
reconcile their tiles. Tests simulate empty/full cargo, server rejection,
submission errors, duplicate replies, disposal, reopening, protection exclusions,
40-item cap, classic/expanded control coordinates, persistence and unsaved edits.

All 528 tests, TypeScript and formatting pass. No live Purify/recycle request was
performed. Desktop was in use, so no reload or UI input was issued this turn.
Visual comparison remains pending. Expanded geometry in this adapter prepares
for the still-missing expanded overview; it does not implement that whole screen.

### Expanded artifact overview connected — 2026-11-10

Ported the original in-space expanded overview into the native ArtifactState2
lifecycle. The source preference defaults to expanded; landed menus stay classic
without overwriting it. Layout toggles rebuild the overview, restore the classic
menu frame/backdrop/stats correctly, and use native MenuHud.close on close/share.
The native state owns a container rather than being a display object itself;
views now retain their actual menu owner so artifact sharing reaches that menu.

Implemented source full-stage/minimum dimensions, three-column geometry, active
slot/setup placement, borders/background alpha, loading panel, wrapped inline
sorting, stats/upgrades/recycle control placement, inventory summary and the
original fitness/adequacy guide with the medium Verdana bitmap renderer. Existing
Purify, favorite, cargo and recycle adapters receive the expanded geometry.
Setup-row overflow updates the sorting row, cargo bounds and panel border.
Inline sorting also dismisses the stat-type popup. Closing a view retires delayed
loading callbacks; all draw-component adapters reject disposed views.

Tests cover native DisplayState container ownership, stage-origin positioning,
classic/expanded transitions, landed preference preservation, close/resize
listener cleanup, FPS/backdrop restoration, source geometry, loading disposal,
sorting order toggles, wrapped sorting rows, information text and native-close
chat sharing. Full suite 531 passes; latest loading cleanup changes reran focused
screen tests, TypeScript, formatting and build. The rich-text test uses original
Verdana24 atlas metrics, but is not a browser/WebGL visual comparison. Live
side-by-side screen verification, drag-scroller parity and remaining whole-client
mismatches are still open. No live account actions or reloads this turn.

### Expanded mode transitions and capacity response parity — 2026-11-10

Compared native toggleRecycle/toggleUpgrade against the source overview. The
native handlers invert the classic Sorting button and know nothing about the
expanded sorting bar or information column. Added source visibility rules for
both modes and their return transitions. Exposed the source inventory-summary
refresh callback used by Purify, and refresh it after capacity responses/cargo
rebuilds as well as ordinary stat/sort/recycle updates.

Ported capacity confirmation cancellation/error recovery and the source
footer-only success update. The native game currently clears and rebuilds the
grid on success; the source preserves tile identity, selection and scroll.
Capacity changes now refresh open overviews for the same player, re-enable the
footer when applicable, hide the limit warning, and refresh credits. Maximum
capacity does not open a purchase dialog. Late responses avoid retired controls.

Tests cover both mode entry/exit paths, summary updates, cancellation without an
RPC, failed/successful responses, maximum capacity, late failure and retained grid
identity. All 533 tests, TypeScript and formatting pass. Transactions were simulated
only. Current desktop capture shows other apps in use; no keys, clicks or reloads
were issued. Browser visual comparison remains pending.

### Setup scrollbar interaction and label atlas — 2026-11-10

Resolved the earlier uncertainty about setup-row content dragging: current
AstroTheme.setScrollerStyles explicitly selects mouse interaction. The inherited
Feathers desktop scroller does not enable content-drag inertia here; adding it
would diverge from the original. Compared the decompiled baseline Scroller and
SimpleScrollBar against the current setup row settings.

Ported the actual remaining differences: thumb values snap to the source 38px
step; track paging uses range × viewport/content rather than a whole viewport;
holding the track waits 250ms, then repeats every 50ms, approaching the pressed
location. Release, stage removal, disposal and loss of overflow stop the timer.
Setup labels now use the source 16px Russo atlas at size 10 with pixel snapping
disabled, rather than shrinking the native primary 56px atlas. Unrelated native
toggles keep their fonts and behavior.

Tests check exact page distance, initial repeat delay, continued hold, release,
thumb snapping, lifecycle cleanup, original label atlas and unchanged unrelated
controls. All 533 tests, TypeScript and formatting pass. No browser inputs or
reloads were issued; live visual/input comparison remains open.

### Floating-text elapsed time — 2026-11-10

Compared Game.update, TextHandler.update and TextParticle ownership with the
current upstream frame order. The state-machine draw runs before floating-text
updates, so attached text reads the current interpolated pose. Retained current
upstream damage aggregation and zoom compensation.

Removed the port-only 250ms text-duration cap. The original passes the full
render-frame duration; after a stall the cap delayed both motion and expiration.
Added coverage for a 600ms frame with a moving owner, expiration across the next
500ms, and invalid/negative duration inputs. Existing 30/60/120/180 FPS checks
still pass. All 535 tests, TypeScript and formatting pass. This is source and
automated verification; live visual comparison remains open.

### Torpedo display timestamps and observer clock — 2026-11-10

Ported the Xhersix-specific Projectile.draw timestamp projection and the scalar
XhersixTorpedoTimeline.projectOffsetSeconds validation. The source captures the
prediction setting per projectile life, applies signed offsets within 250ms,
and uses a single server-clock sample per Game.draw. Pool checkout/reset now
capture/release eligibility; player shots, waves, other weapons and disabled
new projectiles retain their normal render prediction. No native course, TTL,
collision, fastforward or damage method is replaced. The original's separate
server-course/collision changes remain outside this display-only implementation
and need compatibility review against the requested current-game mechanics.

Auditing the clock exposed three visual paths invoking SceneBase.getServerTime,
which writes game.time. Ported the source networkServerTime observer semantics
using the native clock directly, with lazy fallback. Applied it to aura flow,
beam emitter tint, developer hull styles, instant orbit lightning and torpedo
rendering. Instant lightning can now use the current clock instead of tick time.

Regression coverage includes signed/horizon/invalid timestamps, 30/60/120/180 FPS,
unchanged physics and TTL, one clock sample per frame, per-life settings and pool
reuse, read-only visual clock calls, and the actual aura shader upload path.
All 541 tests, TypeScript and formatting pass. Desktop was on other applications;
no game inputs or reloads were issued. Live encounter/visual comparison remains
unverified, and this does not establish complete projectile or client parity.

### Ribbon pool reset and visual ownership — 2026-11-10

Compared extensions.RibbonTrail and core.pools.RibbonTrailPool against current
upstream. Ported resetForPool defaults at checkout/return and after native orphan
reclamation: detached follow line, playback/visibility, follow ratios, repeat,
alpha, white color and zeroed segments. Native resetAllTo only changed segment
history; it now also writes vertex positions/alpha immediately, as the original
does, so the next batch cannot copy old geometry before a simulation tick.
Native orphan detection and its return value remain intact.

Custom weapon-color ownership now releases a ribbon's owned grayscale style and
mesh association when it leaves the active pool. Cleanup of the former projectile
cannot subsequently restore colors/styles onto that trail after reuse. The live
projectile's own color remains in place when only its ribbon is returned.

Tests cover checkout/return, repeated or unrelated removal, geometry before a
tick, native orphan reclamation, full reset defaults, custom shader release and
old-owner cleanup after reuse. All 543 tests, TypeScript, formatting and diff
checks pass. Preview status currently reports the login/profile screen; no login,
reload or gameplay input was issued. Live trail comparison remains unverified.

### Implementation-first batch — 2026-11-10 (unverified, local)

Per the user's revised workflow, accumulate missing feature implementations before
running the broad test/fix and deployment pass. Do not treat the following draft
code as tested or as complete source coverage:

- Direct-texture damage/heal overlays and kamikaze inversion styles, frame-following
  overlays, delayed-callback ownership and room/pool cleanup.
- Original enemy cloak presentation (half opacity, preserved fades and overhead
  opacity), retaining the source's reveal behavior instead of moving enemies away.
- Optional teleport shrink/grow animation with per-transition preference capture,
  delayed server destination, stable contact radius, cancellation, and emitter
  generation checks. Multipart/aura restoration needs integration with the remaining
  ship-visual implementation.
- Native portable recycler, upgrade and Pirate Bay command entry points and safe
  screen closing. Full portable all-ships hangar/catalog and recycler RPC ownership/
  background-automation lifecycle remain to be carried over; these entry points
  alone do not complete portable screens.

These changes have only been authored/formatted. They have not been built, tested,
visually compared, pushed or deployed. Continue the full feature inventory before
claiming the implementation pass complete. Radio currently has a ported view and
contract but no connected service/room/audio implementation. The inventory's
filename differences also include adapted equivalents, so absence of an identical
filename is only a lead, not proof that a feature is missing.

Implementation-first batch continuation (still unverified/local):

- Added the portable all-ships hangar entry point. Its native Hangar view now
  reads the Skins catalog, copies records before presentation changes, resolves
  valid PayVault prices/sales, sorts catalog names, and uses native SkinItem
  purchase versus preview modes. Ordinary hangar/fleet records also use copies
  so UI sorting cannot mutate the shared database cache.
- Added shared recycler ownership across normal/portable screens, selected-junk
  snapshots, optional immediate dismissal, late-response cargo reconciliation,
  and completion/auto-close tracking. The portable entry point honors the
  no-transition option and returns an existing request owner.
- Added original /ref, /refresh, /tptodeath, /y and /yes command dispatch.
  No command or transaction was executed while authoring these paths.
- The historical thank-you popup is explicitly gated in the source to version
  1.1.0 (MOD_CLIENT_VERSION == 100); it must not be displayed for 1.1.23 merely
  because its source file is present. Existing changelog/help sequencing remains.

No tests/build or production deployment were run for this accumulated batch,
following the requested implement-first workflow. Remaining source coverage and
native ABI validation are still required before this batch is ready to publish.

Ship-visual continuation (local, unverified):

- Ported the original ShipVisualScale validation/parser and native `/sv scale`
  command, including the shared two-second visual cooldown and saved local scale.
- Hull scaling uses ratios, preserves the native radius through a matching divisor,
  removes/reapplies the factor around texture changes, synchronizes shadow size,
  and clears ownership on pooled-ship reset and session disposal. Teleport scaling
  remains a separate multiplier.
- Full appearance selection, multipart hulls, aura refresh, attachment anchors,
  combined reset commands and visual-state synchronization still need integration.
  Scale persistence currently uses its own key pending the complete visual-state
  adapter. This entry does not claim those paths are implemented or runtime-tested.

- Added `ShipVisualCatalog`: original exact/partial matching, bitmap deduplication,
  active-skin and saved-selection resolution, engine lookup, boss/spawner assembly,
  layer ordering, and representative-part selection. Cached records remain intact.
- Added `ShipVisualAttachments`: original attachment snapshot, engine configuration,
  emitter toggle, multi-projectile shooting-point selection, restoration and pool
  ownership cleanup.
- Added `MultipartShipVisual`: native MovieClip construction, pivots/mirroring,
  animation registration, layered assembly, rotation/transform updates, native
  fleet color filter and cleanup. Multipart shadows follow the original omission.
- These three modules are authored building blocks, not yet wired to the command
  and visual-state controller. Their availability does not establish that hull
  selection is playable. Next integration must connect selection/reset/persistence,
  interpolated draw transforms, teleport scale, canvas lifecycle, and phase-blade
  mounts before the deferred runtime verification pass.

Ship appearance controller integration (same local batch):

- `NativeShipVisuals` now connects catalog selection, multipart rendering, original
  attachment controls, align/shadow/original-color commands, combined reset and
  account-local saved appearance restoration. It calls the existing weapon and
  developer-color adapters for reset rather than maintaining duplicate color state.
- Multipart containers follow the final game draw transform and the independent
  teleport and appearance scale multipliers. Pooled reset/destroy releases owned
  render state; native texture switches dispose the previous shadow before vanilla
  allocates another. Native fleet color-filter and melee methods were located in
  the current Haxe bundle.
- Corrected the texture-vector length boundary: native MovieClip consumes a Haxe
  Vector, so multipart texture availability uses `get_length()` through `read`.
- The first TypeScript check found the earlier LocalClientCommands draft missing
  its `read` import. Fixed it; the repeated `tsc --noEmit` passed. This was an
  authoring/ABI check, not the deferred behavioral test suite or live visual review.
- Remaining integration includes aura selection/lifecycle, multipart phase-blade
  mounts, full visual-state synchronization/previews and broader screen/features
  coverage. No new build, live reload, push or deployment was performed.

Aura continuation (local authoring, not live verified):

- Connected `/sv aura` and `/sv au`, source palette aliases, saved selection and
  reset to the existing native rarity-aura factory and remastered render hooks.
  Rainbow uses the source ten-second server-clock hue cycle, 1.12 size multiplier
  and 0.3125 lightning cadence. Multipart and green/gold size factors follow the
  source distinction from ordinary single-hull effects.
- Added native GameObject-derived multipart aura targets with transformed pivots,
  rotation, reflection and effects-space coordinates. Emitter pose lookup now
  honors these explicit render getters. Ship draw synchronization updates assembly
  transforms before the frame emitter pass, with final game-draw synchronization.
- Aura lifecycle stops during teleport/landing/removal, refreshes after scale or
  hull changes, and releases on reset/destruction. Generation-and-target ownership
  checks prevent cleanup from touching recycled emitters owned by another effect.
- Corrected the previous texture ABI note: the texture service returns an Array;
  native GameObject converts it to ObjectVector before constructing MovieClip.
  The multipart adapter now performs that conversion too. Merely accepting either
  length accessor, as the previous entry described, was not sufficient.
- TypeScript check passed for the integrated aura changes. Deferred behavior/live
  checks, multipart phase-blade mounts, visual sync/previews and remaining feature
  coverage are still outstanding; nothing from this batch has been deployed.

Phase Blade and visual-share continuation (local):

- Connected the existing authored Phase Blade mount math to the appearance
  controller. Multipart traversal takes the first two available mounts in source
  order, mirrors a lone mount into the second point, and falls back to the active
  single hull when no part supplies a muzzle. The multipart transform is refreshed
  at lookup. Only Beam.draw geometry is redirected; native simulation endpoints
  remain untouched.
- Added `VisualShareWire` using the original primitive field schema, sorted weapon
  styles, session/revision validation, and optional palette/scale extensions.
  Added the original `/ssv enable/disable` target parser, including quoted display
  names, opaque IDs and the optional immediate-apply flag.
- Wire/parser modules are not yet attached to visual-share negotiation or command
  dispatch. No messages were sent. Remaining work includes the handshake/order
  state machine, remote visual application and previews; these are not established
  by the presence of the wire encoder.
- `tsc --noEmit` and tracked diff whitespace check passed. Behavioral/live
  verification and publication remain deferred for the accumulated batch.

Visual-share negotiation implementation (local, not connected):

- Added the original canonical appearance fingerprint, preserving default-state
  hashes and optional developer-palette/scale suffixes. MD5 is injected as the
  native equality-hash implementation; it is not used for sender authentication.
- Ported VisualShareHandshake's scene/session cache, reciprocal nonce rounds,
  retired-scene rejection, authenticated-peer checks, 512-peer bound, independent
  eight-query/eight-write limits, queue congestion handling, finite retries,
  three-share budget, delayed verification, deadlines and disposal guards.
- Adapted sends to the existing ClientIPCService callbacks and primitive messages.
  This class has not been instantiated in a game session and has sent no traffic.
  Next integration must supply unified local snapshots, receive revision ordering,
  remote renderer state, per-player sharing controls and preview updates.
- TypeScript and tracked whitespace checks passed. Negotiation behavior has not
  been exercised; the full deferred verification pass remains necessary.

Unified visual state and remote rendering (local, no transport binding yet):

- Added a scene-owned state store. Local snapshots combine live appearance options,
  actual scale, developer palette and per-weapon styles, then normalize through the
  wire schema. Remote records are validated/detached and never replace local state.
- NativeShipVisuals can apply a remote player's selected hull, multipart assembly,
  attachments, shadow/color options, scale and aura. It reapplies after pooled reuse
  and restores the player's current vanilla skin when a synchronized record clears.
- Weapon coloring now resolves remote state by the native weapon owner's player ID
  and current ship identity. Remote developer hull/Phase Blade palettes independently
  require the original developer identity check; packet settings cannot grant it.
- Local persistence and the existing editors remain authoritative for the local
  account. Remote values do not write those preferences. Incoming IPC ordering,
  saved remote records, sharing controls and preview integration remain unfinished.
- TypeScript passed for these changes. No live application, message sending,
  behavioral suite, build or deployment was performed in this continuation.

Visual-sharing scene integration (local, unexecuted):

- Connected negotiation and incoming share handlers to the authenticated IPC service,
  including service replacement/disposal, per-session revisions, stale/conflicting
  revision rejection and source-compatible default-state hash retention.
- Added remote profile/hash persistence and `/ssv` direct sharing, reset and
  enable/disable controls. Quoted @names resolve separately from opaque IDs;
  developer exceptions and the Public build's manual `all` restriction follow the
  original. Deferred enable/disable preserves the currently saved appearance.
- Local editor changes now notify the state store; the source coalescing behavior
  sends the latest snapshot with queue-time refresh and one-second retry cadence.
  Group preview refresh events are emitted, but custom preview-image lookup still
  requires its separate source adaptation.
- Remote state acceptance now invokes the native appearance adapter before saving
  the hash/profile. Multipart transforms are initialized immediately, so aura
  creation has the actual assembly pose before the next frame.
- TypeScript and tracked whitespace checks passed. No new bundle was built or
  loaded, and no visual-share messages were sent during implementation. The added
  network/lifecycle paths still require the deferred behavioral and live checks.

Native player-list preview continuation:

- Located the actual source preview consumer in PlayerListItem's constructor.
  The Haxe constructor finishes by calling `update`, allowing the adapter to apply
  the selected preview through native methods without replacing the whole screen.
- Added selected representative-hull frames, original-color filter handling,
  additive blend mode, source 40px sizing/pivot/position and supporter-badge offset.
  Local changes refresh tracked rows; existing group update events continue to
  drive native row updates. Disposal releases tracking and plugin cleanup restores
  vanilla current-skin previews for surviving rows.
- Added the original chat preview-state accessor for other native consumers.
  Source previews intentionally show a representative hull, not the assembled
  world sprite or scaled teleport pose.
- TypeScript and tracked whitespace checks passed. Live row layout/filter behavior
  is unverified. No build/reload/deployment was performed. The remaining broader
  feature inventory still includes radio service/rooms, floating chats, and
  network/profiler windows; visual feature code is not proof of full-port parity.

Profiler implementation continuation (local):

- Ported the original native-display ProfilerWindow to OpenFL: title/buttons,
  selectable text, drag/resize, stage constraints, keyboard/wheel isolation,
  pause/resume/reset behavior, selection/scroll retention, geometry restoration
  and teardown. No DOM replacement panel was introduced.
- Added RuntimeProfiler's bounded 512-frame percentile sample, weak RX identity
  deduplication, per-section CPU aggregates and one-second summaries. Browser
  memory is reported only when available; it is not labeled AS3 memory.
- Wired `/profiler` to the native overlay and measured reachable game/manager
  method boundaries while active. Exact original phase coverage, observed traffic
  counters and the separate network/packet/disposal panels remain unfinished.
  Unwired packet rates display unavailable rather than fabricated zero traffic.
- Fixed the initial AS3-to-TypeScript instance-reference/nullability errors;
  TypeScript passed. Required native panel classes were found in the current
  bundle. Live input/layout behavior and timing coverage remain unverified.
  No bundle build, desktop interaction, push or deployment was performed.

Network monitor and profiler traffic continuation (local):

- Traced the Haxe Connection wrapper and local PlayerIO SDK. Added a shared
  Game/Service observer at runMessageHandler and successful connected SDK sends,
  preserving raw message identity for weak RX deduplication. Replacement raw
  connections release old send hooks; IPC-only connections are outside this scope.
- Wired profiler RX/TX sampling and the original `/network` Starling overlay:
  250x42 background, Russo 12 text, source colors, top-right position, one-second
  MB/s and packet rates, toggle/reset behavior and native frame-event cleanup.
- Uses the SDK messageSerializer for application payload bytes, equivalent to the
  original monitor's serialized-message measurement (not WebSocket/TLS overhead).
  Failed/unavailable serialization displays `--`, not estimated byte counts.
- TypeScript and tracked whitespace checks passed. Runtime traffic accuracy,
  overlay placement and reconnect cleanup still need the deferred live checks.
  Packet, heading and disposal debug windows remain unfinished. No game reload,
  generated bundle, outgoing message, push or deployment occurred in this turn.

Disposal-debug continuation (local):

- Ported the original fixed-size native disposal window, including drag/cancel,
  stage constraints, 250ms refresh, reset peaks, geometry restoration, source
  table layout and teardown. Adapted memory labeling to JS heap availability.
- Wired `/disposedbg` and a native manager report for text/emitter/projectile pools,
  active/inactive particles, shared/custom batches, vertex totals, emitter refs,
  active unit flashes and allocated legacy flash filters. Port-owned aura batches
  are included through their actual emitter references.
- Added observed text spawn/emitter checkout/projectile checkout/flash activation
  counters. These are explicitly scene-attachment observations, not invented
  pre-attachment lifetime totals. Uninstrumented creation/request/grayscale metrics
  display unavailable; full original cumulative coverage remains outstanding.
- TypeScript and whitespace checks passed; referenced native classes and pool
  fields were inspected in the current bundle. The panel has not been opened or
  visually compared, and no bundle was built or deployed.

### Packet debugger capture and acknowledgement source port (local draft)

- Read original `core/network/PacketDebugWindow.as` capture/filter/command acknowledgement implementations. Added readable `network/PacketCapture.ts` and `network/CommandAcknowledgements.ts` with the original 600-entry cap, RX identity suppression, RX/TX visibility filters, inclusion/exclusion matching, packed-message decoding, 24-field payload limit, command/course labels, and escaped/truncated string display.
- Command acknowledgement tracking retains the original movement-only types (0/1/2/8), latest command per type, superseded count, 15-second expiration, and authoritative timestamp plus input-state matching. It does not send commands or alter movement.
- This is the model portion only: the native packet/heading window, raw SDK-to-message adapter, reconciliation hooks, and restore/settings/command integration remain to implement. These files are not installed into GameSession yet. No runtime or packet capture claims.
- Whole-worktree TypeScript check and whitespace check passed. Behavioral/runtime verification remains pending with the implementation batch; nothing built or deployed in this step.

### Native packet window and traffic integration (local draft)

- Added `network/PacketDebugWindow.ts` using native OpenFL display objects, matching the original packet view's 560×270 default, Verdana text, colors, RX/TX/pause/clear buttons, filter field, output, and drag/resize controls. Capture pauses with PAUSE; filters only affect display. Added parent-coordinate pointer conversion and stage capture for focused keys to avoid game input leakage.
- Added `network/NativePacketDebug.ts` and GameSession installation for `/pktdbg` and `game.togglePacketDebug`. Traffic reuses NativeTraffic's current Game/Service observation. Raw SDK identity remains the RX deduplication key.
- Inspected current upstream ABI: Haxe playerio.Message lacks getObject, SDK exposes `_internal_('get-objects')` and `_internal_('get-types')`; adapter reads those without mutating the message. Verified OpenFL TextField.set_type uses integer 1 for input.
- Six focused decoder/acknowledgement tests pass, including malformed packed lengths, packed course units, duplicate callback identity, filtering precedence, bounded history, superseded command handling, and strict expiry boundary. Whole-worktree TypeScript and whitespace checks pass. These are not visual/runtime tests.
- Remaining: heading mode, immutable reconciliation snapshots, live correction target/input providers, heading restore preference, and actual native-window runtime validation. Acknowledgement collection is connected on TX but its authoritative-course consumption awaits heading hooks. No build, deployment, or live traffic capture in this step.

### Heading diagnostics and newly confirmed movement gap (local draft)

- Added HeadingGraphics and HeadingDiagnostics, plus `/headingdbg` integration in the native packet window: source 820×500 opening size, 230px heading panel, legend, local/target ship vectors, angular and turn-input arrows, immutable receipt snapshots, independent live state, packet ages, command echo status, and persisted heading-open preference. Scene disposal preserves that preference; explicit closing clears it.
- Observes current ShipSync.fastforwardMe only for this scene's local ship. Captures raw and local headings before native replay mutates them, then records replay and observes the actual Converger.target separately. Does not invoke replay twice or modify physics. Three focused tests verify receipt isolation, pause/live-state separation, and bounded vector geometry; existing six packet tests and whole-worktree TypeScript pass.
- **Confirmed significant outstanding semantic port:** current source tree has remote rotation presentation, but no port of original ShipSync queueSelfCourse/flushPendingSelfCourse/resetSelfCourse and related command replay changes. Current upstream fastforwardMe uses its original 2000ms path and immediate convergence. Original local self-reconciliation, stale/duplicate handling, persistent input replay, and Converger local soft-correction thresholds (45/300) still require full source diff and implementation. Diagnostics deliberately label current branches native-matched/native-converge/native-too-old instead of falsely reporting original soft-correct or emergency-snap. These labels are temporary until reconciliation is ported.
- Remaining heading work: physical keybinding provider; source-equivalent reconciliation hooks once that port exists; runtime input/layout/persistence validation. No native window has been visually checked, and this local batch remains unbuilt/unpublished.

### Local movement reconciliation source implementation (not installed yet)

- Added `movement/MovementReplay.ts`: retained axis states after pruning, boost's four-axis baseline, chronological insertion preserving equal-time order, full 33ms replay buckets, ship/converger ownership resets, and replay-state forcing.
- Added `movement/SelfCourseQueue.ts`: newest complete packet coalescing, equal-time revisions, stale/duplicate rejection, once-per-fixed-step flush, immutable authoritative baseline, 1000-tick replay bound, current-input copy at exact final boundary, target clearing on matched/too-old packets, and explicit-course timestamp floors.
- Added `movement/LocalCorrection.ts`: source local correction factor .55, 120 correction-speed cap, 300-unit emergency snap retaining live A/B/L/R flags, .08 angular correction, and target advancement before applying new input to both target and course. Remote/AI convergence is not replaced by these helpers.
- Nine focused movement tests pass across retained inputs, sorted/equal-time transitions, boost flag baseline, owner replacement, stale/equal/duplicate packets, replay limit, target clearing, correction cap/snap, and target/input ordering. Whole-worktree TypeScript and whitespace checks pass.
- These movement helpers are not wired into GameSession. Native integration must replace command dispatch/replay and self-course receipt together, flush after clock update before player update, preserve newer nonmovement abilities, and connect explicit-course lifecycle resets. Original timestamped boost windows/syncBoost and death-line replay behavior need comparison before claiming complete movement parity. No gameplay/runtime test or deployment in this step.

### Timestamped boost history and native adapter (local draft, not installed)

- Compared original PlayerShip.boost/syncBoost/isBoostActiveAt/pruneBoostWindows/updateSpeedBoostState with the current JS: upstream uses one g.time-based boostEndTime and Converger.updateHeading consults get_usingBoost, so historical replay currently sees visual-now boost state.
- Added Movement BoostHistory with original 5s retention, 66ms confirmed-duplicate tolerance, nearest unconfirmed matching, authoritative timestamp cooldown, and inclusive-start/exclusive-end windows. Five focused tests pass for expiry, matching, duplicate protection, pruning, reset, and cooldown reduction cap.
- Added NativeBoostHistory adapter (not yet called by GameSession): native boost visual effects transition once, syncBoost updates authoritative window/cooldown, replay-time context wraps Converger.updateHeading and get_usingBoost without replacing current native physics or changing shield/other abilities. The native one-end-time expiry check is suppressed only within a synchronous PlayerShip.updateHeading call so overlapping source windows remain authoritative; original field restored in finally.
- Whole-worktree TypeScript and whitespace checks pass. Native adapter has no live validation yet. Still required: integrate command dispatch/self-course queue/boost history together, validate cached Haxe message callback interception, boost-end forced commands, lifecycle resets, and source death-line replay behavior. No build or deployment in this step.

### Self-movement native integration (local draft installed in GameSession)

- Added NativeSelfMovement: source command dispatch with monotonic course timestamps, redundant-axis suppression and forced transitions, sorted replay, queued local course/boost packets, fixed-step flush before playerManager.update (after native tickUpdate's clock assignment), local correction rules, and explicit-course lifecycle resets. Native nonmovement ability implementations remain in place; source firing guard and command stamping are applied at dispatch.
- Added NativeThrottle for original checkAccelerate's once-per-course-tick axis transitions and delayed/forced boost-end command. Integrated NativeBoostHistory with the movement module. These now install in GameSession before diagnostics.
- Verified Haxe binding implementation caches `method.bind(instance)` under hx__closures__[method.__id__]. Self movement echo suppression matches commandReceived's exact cached bound callback at Connection.runMessageHandler, preserving unrelated callbacks. Native message-pack calls still require live ABI validation.
- NativePacketDebug now receives source reconciliation records through game.recordHeadingDebug, with original matched/soft-correct/soft-correct-large/emergency-snap prediction labels and explicit ignored-packet overrides. Removed its former native fastforward observer.
- 17 focused movement/boost/integration tests pass, including actual hook composition in a fixture, command dispatch, correction target input, cached self echo interception, and explicit-course reset. Whole-worktree TypeScript and whitespace checks pass. Tests do not establish live gameplay parity.
- Remaining movement scope includes death-line collision/replay, full turn/aim/control diff, remote movement beyond the existing rotation buffer, and live boost/clock/lifecycle checks. No bundle rebuilt or deployed in this step.

### Death-line sweep and replay integration (local draft)

- Added source-equivalent finite-segment collision geometry in DeathLineCollision: complete movement sweep, endpoint clearance, center-line crossing rejection before the overlap escape exception, and strictly outward same-side escape. Negative radius clamps to zero; tangent clearance stays nonblocking as in source.
- NativeDeathLines now wraps every local Converger.updateHeading (including replay targets), rolls a blocked predicted step back to its immediate starting position and zeroes velocity, and leaves the advanced simulation timestamp intact. Warp jumps bypass the sweep. Explicit authoritative course replacements remain accepted.
- Replaced only the local PlayerShip.updateHeading native lastSafeX/Y rollback path, which could otherwise undo accepted authoritative corrections. Native boost-history wrapper runs outside this replacement to retain expiry/effect handling; native remote/AI updates remain unchanged.
- Four geometry tests plus the four native movement integration tests pass, including crossing at high speed, overlap escape/inward/sideways/cross-center cases, endpoint and tangent cases, replay contact isolation, authoritative replacement, and warp bypass. TypeScript and whitespace checks pass.
- Death-message evidence is still incomplete: the recent live-contact call is guarded and reaches recordDeathLineContact when available, but the original IncomingWeaponHistory/recordDeathLineContact feature has not been ported into this worktree. Do not claim death-cause attribution parity. Live wall/boost testing and broader movement/aim/remote diff remain outstanding. Nothing built or deployed in this step.

### Control timing and channeling reconciliation (local draft)

- Source diff found assisted steering still retained a 66ms wall-clock debounce. Removed that extra debounce from NativeAimAssist and installed NativeControlTiming after aim-assist hooks so handleTurn uses the source 33ms course-time gate, including backward time resets.
- Added source checkBoost course-time gating and channeling's once-per-course-tick A/L/R clearing, correction-target clearing, and forceMovementReplayState. Braking is retained as in source. Added the missing automation-controls guard to NativeThrottle.
- Eleven focused control/aim checks pass, including new simulation cadence and channeling history reset cases. Whole-worktree TypeScript and whitespace checks pass. Existing aim tests cover solver/eligibility/debug data, not a live complete mouse-input pipeline.
- Still outstanding: ordinary native mouseAim fallback retains upstream logic and needs the full source comparison; direct automation aim and complete input mode/turn transitions need audit. No runtime visual comparison or deployment in this step.

### Ordinary mouse steering and dual-axis release (local draft)

- Source comparison confirmed upstream mouse steering used rotationSpeed/33 and 66ms wall-clock debounce, while source uses rotationSpeed*33/1000, a wider restart band, and course-tick dispatch. NativeAimAssist's ordinary-input path now remains active when aim assistance is disabled, using its already-maintained raw mouse angle/deadzone and source thresholds instead of falling back to native transport.
- Added SteeringCommands to preserve source opposite-direction release ordering and stopMouseTurn's release of both left/right flags. Previously only one stop command was selected when both flags were set.
- Four targeted tests pass, including a composed native-hook fixture with assistance disabled that throws on upstream fallback, verifies deadzone-retained heading, and verifies both release commands. Whole-worktree TypeScript passes.
- This does not finish direct automation aim handling or prove visual/runtime input parity. Cases with missing ship/overlay/assist state still fall back to native behavior; normal updateCommands initialization is covered by the fixture. Changes remain local/unbuilt/unpublished.

### Automation/manual steering interaction audit

- Compared existing AutomationControls with original updateAutomationAim/setAutomationAimAngle/clearAutomationAimAngle. Existing implementation already retains owner checks, finite normalized angles, source .6-step threshold, simulation-time gating, stop during boost/teleport/channeling, and dual-axis release.
- Found and fixed new NativeThrottle interaction: its automation guard returned before the existing automation wrapper could route RoamingState's chat-open checkAccelerate(true) into owned steering. It now delegates that branch to the pre-existing ownership wrapper. AutomationControls test now composes both modules and verifies chat-open opposite-turn release, owner transfer, blocked states, rollback, and cleanup.
- Fixed NativeAimAssist.get_currentAimAngle still excluding disabled assistance, which exposed raw native pointer angle instead of the source deadzone-retained manual angle. Extended native mouse test verifies the reported angle as well as actual turn commands with assistance disabled.
- Both composed interaction tests and whole-worktree TypeScript pass; whitespace check passed. This is code/test evidence only, not live user-input or screen parity. No build/deployment.

### Heading physical-input provider

- Connected the native heading panel to current SceneBase.settings.keybinds through HeadingInput, matching the original acceleration/deceleration command IDs, two-slot binding labels, unbound fallback, and live DOWN/UP state. The provider is independent of packet/replay heading flags and reads replacement bindings on each refresh.
- Five focused heading tests pass, including both-slot/secondary-only bindings, changing physical state, unbound versus unavailable, immutable packet snapshots, and live course separation. Whole-worktree TypeScript and whitespace checks pass.
- This closes the missing provider code path only. Native display, actual keyboard behavior, and full port parity remain unverified; no build or deployment.

### Remote throttle/brake playback source port

- Added RemoteMovementBuffer from original movement/RemoteMovementBuffer.as: 66ms delayed transitions, immediate initial state, 32-snapshot bound, same-state/equal-time coalescing without delay extension, stale-command consumption, boost flag baseline, and stall/clock-reversal recovery.
- Integrated with existing RemoteShips rotation ownership: observe raw course flags, buffer movement commands, reset both buffers at lifecycle boundaries, apply sampled A/B before and after Converger.run, and retain cinematic/dead/warp exclusions. Course receipt no longer writes throttle immediately. Remote boost confirms timing before stale-pose rejection and clears turn flags only for accepted poses, matching source ShipSync.
- Seven focused remote movement/rotation tests plus TypeScript and whitespace checks pass. These establish buffer behavior, not live packet/hull/engine visual parity. Remote convergence/physics beyond these presentation hooks still needs source comparison. No build/deployment.

### Remote convergence and Haxe lifecycle getters

- Added source remote-player calculateOffset branch: advance target, strict >45 position snap, .55 velocity correction, buffered-angle ownership, and fallback pi/4 snap/.08 angular smoothing. Hook applies only to remote players, preserving local adapter and current AI convergence.
- Corrected remote rotation eligibility to use Haxe get_isLanded/get_isWarpJumping through read(), matching the movement buffer and preventing playback from overriding cinematic state.
- Ten focused remote correction/movement/rotation tests pass. New cases cover strict snap boundary, buffered angle preservation, fallback angular behavior, actual getter-shaped warp/landing state, and pooled buffer reset. TypeScript and whitespace checks pass. Live packet/convergence/visual validation remains pending; no build or deploy.

### Incoming weapon/death-line evidence model (local draft)

- Ported original IncomingWeaponHistory into telemetry: 16 detached contacts, 1500ms strict age checks, lifecycle identity, repeated-contact collapse, normalized attacker names, explicit boss-turret parent alias input, and ambiguous-weapon rejection. No pooled Unit/Weapon references are retained.
- Ported detached death-line evidence with finite geometry checks, exact recent blocked-start tolerance, finite-segment proximity, lifecycle/age filtering, and no latency/speed-expanded wall radius.
- Four focused tests pass covering attribution matching, ambiguity, repeated contacts, time reversal/age, contact bound, lifecycle separation, and boost clamp-point versus wall proximity. Whole-worktree TypeScript and whitespace checks pass.
- Not yet wired to NPC weapon contact observations or death-note/Killed display; explicit server causes must continue to win and fatal packet/analytics must not be rewritten. NativeDeathLines currently calls a guarded optional recorder, so this model alone does not complete attribution. No runtime/build/deployment.

### Native incoming-history lifecycle and wall display integration

- Installed NativeIncomingHistory before movement: player recordDeathLineContact/deathMessageWeapon/recordIncomingWeaponHit adapters, scene/ship identity, pooled generation reset, landing clearing, and post-death history disposal. NativeDeathLines can now record actual recent live clamp contacts.
- Death-note fallback obtains damage type only within the exact cached PlayerManager.killed callback at Connection dispatch. It changes writeDeathNote's cause argument without editing the packet or analytics. Native Killed.enter resolves before ship destruction and updates DEATH LINE presentation after native layout creation; explicit server causes retain priority.
- Five focused history/lifecycle tests pass; native service test covers explicit cause preservation, wall position evidence, landing, pooled reuse, ship replacement, and cleanup. Whole-worktree TypeScript and whitespace checks pass. Cached dispatch/display paths need direct integration/runtime tests; no claim of live display verification.
- NPC weapon contacts still need wiring at existing native collision observations with source eligibility; recordIncomingWeaponHit is an adapter, not yet a capture source. No build/deployment.

### Incoming NPC bullet/bounce contact capture

- Audited current native ProjectileBullet/Bouncing enemy execute branches: candidate position getters precede their swept test; destroy/explode and bomb ProjectileStuck transition follow collision success. Added IncomingProjectileContacts using scoped candidate observation and those exits, without adding another collision scan or changing projectile physics.
- Installed via NativeIncomingHistory. Preserves original incoming-hit exclusions: player/owned attackers, healing, invalid/nonpositive damage, dead/invulnerable victims, and mirrors that are not their Player's current ship. Nested scan ownership restores in finally; destroy->explode consumes only one candidate.
- Six focused incoming-history/contact tests pass, including actual host Hooks composition for position-only misses, destruction outside execute, collision recording, nested destroy/explode deduplication, and exclusion cases. TypeScript and whitespace checks pass.
- Remaining contact coverage: source registerSimulatedHit paths beyond these NPC bullet/bounce/stuck exits must be audited; the source's extra swept-collision fallback is not reproduced by this observer. Cached death dispatch and display paths still need direct/runtime validation. No build/deploy.

### Fatal dispatch verification and missile contact path

- Added an actual-host-Hooks test for cached PlayerManager.killed dispatch through Connection: frozen fatal packet retains identity/cause, analytics retain original suicide cause, chat/death screen use Death Line, and later notes outside callback scope do not inherit the fallback. This validates hook composition in a fixture, not the live native renderer.
- Audited original MissileStuck.enter's registerSimulatedHit call and connected the explicit stuckUnit contact after native enter with the same incoming-hit exclusions. It does not depend on a bullet scan or alter projectile state.
- Seven focused incoming-history/contact/dispatch tests pass, plus whole-worktree TypeScript and whitespace checks. Beam/mine and source extra swept-collision contact paths remain to compare; runtime verification remains pending. No build/deploy.

### NPC beam contacts and mine scope audit

- Added incoming NPC Beam.shoot observation at due native firing ticks with a live eligible victim. Uses native pre-call fireNextTime and post-call lastFire; it does not call heat checks again, infer damage from aiming, or alter shot timing. Source duplicate contact collapse makes one observation per shoot call equivalent for same-timestamp catch-up ticks.
- Audited original Projectile.registerMineBlastHit: it explicitly requires the local player's ship or owned unit. Consequently it cannot supply incoming NPC death-weapon attribution; no speculative NPC mine scan was added. Existing personal mine damage observer is a separate feature.
- Eight focused incoming-contact/history/death-dispatch tests pass. New beam fixture verifies draw-only calls, strict due boundary, target-body exclusion, and missing-target exclusion. TypeScript and whitespace checks pass.
- Remaining source extra swept projectile fallback and native/runtime contact/display validation are not established by these tests. No build/deployment.

### Rebuilt-bundle regression audit

- Compared the extra ProjectileBullet sweep with its source entry condition: it belongs exclusively to usesServerBulletCourse/executeServerBullet, not ordinary bullet collision handling. The port still lacks that server-course path; attaching its sweep to ordinary collision observers would duplicate or change native collision behavior.
- Updated the existing aim integration fixture to compose NativeControlTiming, advance simulation course time, and verify the original 33ms gate plus manual steering with assistance disabled. Updated weapon-color fixtures to include the native weapon game reference required by scene ownership checks. Both focused suites pass (5 tests).
- TypeScript passes. Built the current bundle via npm test; the rebuilt suite reports 596/597 passing. The compiled integration fixture now exposes missing cloakStart and openfl.display.Sprite dependencies during startup. These must be reconciled against the actual runtime and fixture before this batch is considered validated; previous tests against an older bundle were insufficient.
- No deployment or live visual verification in this audit. The full port remains incomplete.

### Rebuilt integration fixture and live native-panel smoke check

- Verified the current official bundle exports openfl.display.Sprite and EnemyShip.cloakStart/cloakEnd. Extended the integration fixture with the native overlay API and newly hooked ship/converger methods instead of disabling production features to pass the fixture. Graphics test doubles record commands; they do not claim renderer equivalence.
- Rebuilt bundle passes all 597 tests, TypeScript, and whitespace checks. This supersedes the prior 596/597 startup result.
- Opened the existing local preview at http://127.0.0.1:8087/ in Firefox. Observed login artwork, version/credits, and native Plugins button; the saved session then logged in automatically and rendered gameplay. Preview diagnostics reported connected=true and zero uncaught runtime errors before diagnostic commands. Original SWF remained open separately.
- Opened and hid the live profiler, heading/packet panel, and disposal panel through their native game methods. Profiler sampled render/simulation timings; disposal counts updated. Heading panel rendered but was waiting for a local course, so replay/movement correctness remains unverified. Evidence screenshots: /tmp/QoLAF-ProfilerAudit2.png, /tmp/QoLAF-HeadingAudit.png, /tmp/QoLAF-DisposeAudit.png. One manual console command was malformed by keyboard-layout punctuation; this console SyntaxError is not a plugin startup failure.
- No deployment. Full screen comparison, movement/heading verification, and outstanding feature porting remain incomplete.

### Live empty-label width regression fixed

- Live Firefox inspection reproduced vertical single-letter wrapping in the offer description/stats and daily-reward labels. Current Haxe call sites set Text size before wordWrap/text. The port's defaultTextFormat setter requested auto-width while empty, collapsing the initial 100px layout width to zero before wrapping was enabled.
- Text now preserves layout width during empty-field style changes. Actual text assignments still own auto-sizing (including clearing text), and explicit narrow widths still wrap. Added a regression reproducing 0 versus 100 before the fix and asserting a single line plus explicit-width wrapping afterward.
- Rebuilt bundle, TypeScript, formatting/whitespace checks, and all 598 tests pass. One paired F5 press/release reloaded the local preview; it auto-logged in with zero uncaught runtime errors. Offer text is visibly horizontal again: before /tmp/QoLAF-PlayCheck.png, after /tmp/QoLAF-WrapFixed.png. The daily popup did not reappear on reload; its live layout is not verified by the offer result.
- Original DailyRewardMessage also contains missing layout changes: TODAY label, centered amount/icon pairs and computed card positions. The current native dialog is not a complete semantic port of that source and still needs adaptation. Do not conflate the shared text fix with completion of the reward screen.
- Live read-only movement check confirmed prepareHeadingReplay/flushPendingSelfCourse are installed and the local ship has a live course/converger. Movement and heading reconciliation are still unverified. No deployment.

### Native daily reward layout port and live verification

- Added NativeDailyRewards, installed at classesReady. Uses the existing DailyRewardMessage/DailyRewardChild objects and reward callbacks; adapts only layout. Ports source 10px spacing, unwrapped day/amount labels, 8px amount/icon gap, pair centering, vertical card placement and TODAY positioning. Empty unused amount fields retain zero width.
- Native constructor/redraw order matters: CreditGainBox redraw expands the highlighted box from 150 to 200px. The first live preview exposed overlap when reserving only the constructor width. Layout now reserves the actual rendered highlighted width, including padding, on each redraw; the regression covers that transition for every highlighted day and repeated redraw stability.
- TypeScript and full rebuilt suite passed (599 tests); focused daily/integration tests passed after the width correction. Formatting and whitespace checks pass.
- Constructed a temporary DailyRewardMessage for day 2 in the logged-in local preview, without clicking Take Reward or invoking callbacks. Screenshot /tmp/QoLAF-DailyFixed.png confirms horizontal labels, centered reward pairs and non-overlapping cards. Removed/disposed the temporary dialog afterward. Current server reward amounts/callbacks remain native. No deployment; comparison against the SWF reward screen and other screen/movement work remain pending.

### Live movement, camera and engine frame cadence

- Ran a bounded native command-manager acceleration/braking probe in the local logged-in client. Released both commands in finally and restored the temporary heading observer. Result: 19.7413 units moved over 1452ms simulation time, 3 self-course reconciliation receipts, final sampled speed 10.8641 before release. This verifies the command/replay path, not keyboard focus or exact correction parity.
- Instrumented Game.draw temporarily during a second bounded movement probe, restoring its original property descriptor in finally. Over ~1.45s: 261 render frames, 44 course-time transitions, 213 frames with ship clip movement while course time was unchanged, and 257 camera tracker changes. This establishes between-tick hull and camera updates in the current native session. Evidence: /tmp/QoLAF-FrameResult.png.
- Read-only engine capture over ~1s: 181 render frames, 4 engine emitters observed, 150 frames where a retained particle TTL decreased without a new ship course tick. Evidence: /tmp/QoLAF-EmitterResult.png. This covers sampled engine particles, not every emitter family or attached-text behavior.
- Investigated a possible landing getter mismatch and rejected it: the current official bundle defines Player.isLanded as a direct boolean and contains no get_isLanded. No speculative production change was made. Landing animation parity itself remains unverified.
- Temporary observers restored; console closed. No deployment. Floating-text cadence, input-driven movement, and full original-client parity remain pending.

### Live attached damage-text cadence and position verification

- Created a temporary local damage label through native TextManager.createDmgText using a surrogate owner that follows the real ship's course/clip. This exercised installed attachment and rendering hooks without altering ship HP or its existing damage-text slots. Short acceleration/braking commands were released in finally, the temporary TextManager observer was restored, and the diagnostic particle was removed through its native handler.
- Initial surrogate omitted render readiness: GameObject.hasRenderPosition uses receiver identity in a WeakSet, so inheriting a ship does not inherit readiness. That intentionally unready path produced up to 0.547 units of difference from the rendered clip. Corrected the probe's own readiness; no production code was changed for this test artifact.
- Corrected live result: 180 sampled text frames, 149 with text movement while the ship course timestamp remained unchanged, maximum error 3.4561e-11 units relative to the rendered clip plus the particle's independent velocity integrated from TTL. Evidence: /tmp/QoLAF-TextRenderResult.png. This confirms the attached damage-label path follows interpolated ship motion at render cadence in this session.
- This does not establish all text categories, turret/spawner attachments, multiple successive hits, or visual equivalence with SWF. Existing test coverage and future comparisons remain necessary. Temporary instrumentation restored and console closed; no deployment.

### Live settings and host Plugins lifecycle

- Opened the current native SettingsState in the logged-in local preview. General page rendered with source sidebar/chrome and readable controls. Dismissed the unrelated native SaleSpinner through its own close handler to inspect the page; no purchase action occurred.
- Exercised showCategory for all nine available categories: general, graphics, cosmetics, hud, combat, chat, bindings, aim, automations. All constructed successfully and reported the expected active category with a populated page. This is construction/lifecycle evidence, not a visual audit of all controls or persistence testing.
- Invoked the actual settings Plugins button callback. Native plugin manager rendered with the current client enabled and its controls; did not add/remove/toggle plugins. Screenshot /tmp/QoLAF-SettingsPlugins.png. General layout: /tmp/QoLAF-SettingsGeneral.png.
- Restored the previously selected bindings category, closed SettingsState through its own close method, and removed the temporary audit reference. /tmp/QoLAF-SettingsClosed.png confirms gameplay HUD returned and both settings/plugin panels disappeared. Preview reported connected=true, pluginsButton=false, runtimeErrors=0.
- Original SWF remains behind its inactivity popup; attempted keyboard navigation did not dismiss it. An unsent character entered its chat was cleared and the editor closed without sending. Exact side-by-side settings parity is not established. No production changes or deployment in this check.

### Floating-chat Service ownership layer port

- Added service/ServiceConnectionPool and ServiceConnectionLease from the original chat Service pool sources. Preserves per-game/per-room join sharing, canonical current-protocol IDs, reserved-room exclusion, verified 19-field joined handshake, synchronous reuse callbacks, lease ownership, socket-specific bans, 8-second timeout, generation invalidation, and deferred handler detachment for PlayerIO live-array dispatch.
- Port includes primary adoption/relinquishment/retirement semantics: never publishes a primary connection, never disconnects a current primary candidate, retains a relinquished-but-still-published socket until ownership transitions, and lets primary kick/disconnect handlers execute. A failing consumer releases only its own lease; detached handlers do not splice live dispatch arrays.
- Runtime inputs supply current Game, current protocol/client version, reserved IPC room and monotonic timer scheduling. No hardcoded version added to transport logic; current-game Haxe getters are read through read(). No room creation, authentication changes, automatic chat messages, or primary initialization traffic.
- Five focused tests pass covering ID/schema checks, shared/pending/ready reuse, bans, final disposal, timeout/stale callbacks, primary handoff, and failure during live dispatch. TypeScript, formatting, and whitespace checks pass.
- Not wired to native runtime/window yet. FloatingChatConnection, shared composer send limits, isolated receive formatting, window/command integration, and runtime validation remain outstanding. No sockets opened, messages sent, build, or deployment for this addition.

### Floating chat transport and window behavior port

- Added FloatingChatConnection with verified pooled Service leases, isolated chat/print/ban handlers, source send validation, shared main-composer cooldowns, group/private packet targets, native variadic send calls, owner/generation checks and synchronous-ready disposal handling. GameSession now installs the shared composer send-slot method and restores it on cleanup.
- Added FloatingChatModel from FloatingChatWindow's receive/history/command behavior: private reply state is per window, unknown commands cannot invoke main chat, quoted and longest-known player targets retain message text, clear/history/status semantics match source. FloatingChatLayout preserves source 680x460 initial dimensions, window staggering, stage constraints and composer/view geometry.
- Added FloatingChatPresentation from MessageLog.formatFloatingChatRow: source supporter markup, escaped sender names, rights/role tags, trusted relay identity, profanity filter and friend-ping snapshots, without writeChatMsg or primary dispatch.
- Added tests for real pool plus adapter receive/send/disposal, rate limits, bans, synchronous reused-lease close, model commands/receive/history, layout and isolated formatting. Rebuilt full suite: 618/618 pass. No live chat messages or auxiliary sockets opened by this work.
- Still incomplete: native floating window/composer/view creation, drag/resize event wiring, artifact/image/context interactions, /floatingchat runtime registration and visual comparison. The added model/layout/formatter are not yet attached to a visible window. Radio and other outstanding full-port items remain open. No deployment in this step.

### Native floating window integration and browser verification

- Added native FloatingChatWindow, FloatingChatComposer, FloatingChatView, NativeFloatingChat and window-owned APIScope. /floatingchat now opens the original title/header/buttons/grip geometry, native Advanced scroll view with source bitmap renderers and per-window artifact resolver, native composer with integrated theme/formatting/emoji/image controls, isolated history/reply state and explicit pooled connection attempt. Drag/resize handlers and close/reconnect controls are wired. Added original six floating command suggestions (plus modchat for eligible players), without main/custom command fallback.
- Live browser exposed source-only readiness properties: serviceConnected, initialWorldIsRevealed and isRecoveringGameConnection do not exist in current Haxe Game. Added ServiceGameReadiness mapping to the real Service connection getter and the exact six Game.tryRunGameLoop initialization flags. Both transport and pool use it; source flags remain authoritative if present. Regression tests cover each missing initialization gate, disconnect and leaving/recovery.
- Live construction also exposed missing updateTexts on the isolated log adapter; supplied the local dispatcher so hover adapters can close without touching the primary log. Group sends now use Haxe get_group/get_players via read(). Fixed the primary context Block packet to native sendToServiceRoom(type, array), and added explicit isolated-context handling: floating Block has no primary fallback, matching sourceContext behavior.
- Browser exercised /floatingchat 2147483646 against a nonexistent room. Native window rendered and reported the expected missing-room error; Reconnect became enabled. No chat messages sent to other players. /tmp/QoLAF-FloatingThird.png records the window. This verifies the error path, not a successful auxiliary-room handshake.
- A focused native editor synthetic key probe sent local /help with two Enter keydowns and one keyup: exactly one help row, cleared floating draft, zero primary queue changes, both primary game and Service connections still connected. Resized through the window's own geometry/constrain path to 480x300; bitmap rows reflowed, scroll width 454. /tmp/QoLAF-FloatingResized.png and /tmp/QoLAF-FloatingLifecycleCrop.png.
- Invoked the actual close button's triggered event. Observed parent=false, disposed=true, browser input detached, model queue empty, both primary connections still connected. /tmp/QoLAF-FloatingClosedCrop.png. Preview subsequently reported runtimeErrors=0. Pointer dragging itself and a successful remote join/send remain unverified.
- Rebuilt full suite after integration/autocomplete: 620/620 pass. Added two APIScope ownership/disposal regressions afterward; focused 23/23 pass, TypeScript and whitespace checks pass. Autocomplete addition is code-tested but was added after the browser window probe; needs a fresh visual/focus check. Exact side-by-side original SWF comparison is still pending (original is behind inactivity dialog).
- Remaining floating parity audit: completion popup focus/closure on Escape/send/resize, native keyboard versus synthetic event dispatch, drag/reconnect click behavior, all rich hover/image/artifact interactions and successful Service handshake. Existing full-port/radio/gameplay/UI audit remains open. No push or deployment in this step.

### Floating composer focus/popup parity correction

- Compared source closeChat, resizeFloating and floating Enter handling with current composer. Added shared dismissal of formatting, emoji/image picker and completion popups on Escape, resize and Enter submission. Disposal clears callbacks before removing controls.
- Floating-only completion now requires actual browser input focus; focus/blur events refresh visibility, preserving the draft. Main composer behavior remains unchanged. Extended the autocomplete regression to check unfocused drafts, explicit close, no main-command fallback and blur preservation.
- Fresh rebuilt browser probe opened the native floating window using the same nonexistent-room error path (no player chat sent). Observed: focused suggestions visible; Escape hides suggestions and blurs input while retaining /g; resize hides suggestions; /help submitted exactly once and left suggestions hidden; native Close removed window. All results true in /tmp/QoLAF-FloatingFocusCrop.png. Probe used synthetic native DOM events; physical keyboard and pointer drag tests remain open.
- Successful-room transport, exact side-by-side SWF rendering, remaining floating rich interactions, radio and the larger full-port inventory remain outstanding. No deployment.

### Chat boundary and supporter presentation audit

- Audited current direct sendToServiceRoom/rpcServiceRoom and Game.send/rpc call sites against inspected Haxe wrappers; remaining direct game calls use the native array argument contract. PlayerIO Connection.send remains variadic. Verified official Message stores type/length as fields, while Connection roomId/connected are getters; no speculative message-field conversion applied.
- Corrected /floatingchat reserved-room preflight: the pool canonicalizes but does not reject the reserved index during serviceIdFromIndex, so the window command must compare the resulting room ID before constructing UI. It now emits the original IPC-reserved message immediately for 24 and zero-padded equivalents. Added regression coverage for reserved, malformed, primary-room, disconnected and unrelated command routing without view construction. Added /floatingchat to main-chat completion suggestions.
- Compared MessageLog.writeChatMsg with Player.SUPPORTER_ICON_ASCII in original source. Main chat was retaining the vanilla U+2605 star without a separator, unlike original U+2B50 plus space. Native prefix detection still uses vanilla markup; projected rich output now matches the source glyph/separator, including rights/role/ping composition. Existing upstream-input fixtures remain vanilla; expected source output corrected and tests pass.
- Moved readiness imports to the import blocks for readability. Rebuilt full suite 623/623 pass; TypeScript, formatting and whitespace checks pass. No fresh browser/render claim for the supporter glyph and no deployment. Larger port and SWF parity work remains unfinished.

### Radio playback state machine port

- Read original RadioService/RadioRooms boundaries and RadioAudio/RadioAudioFile/RadioTransport. Desktop source launches an embedded native helper and validates native cache files; those host operations cannot be transplanted into a browser page. No helper launched or media/network request performed here.
- Added RadioAudio as the source playback state machine with injected RadioSound/RadioSoundChannel IO: prepared-file metadata checks, exact helper stream URL validation, 5-second decoded-position buffer, partial-stream readiness, 40MB cap, 15-second prepared timeout, 20-second stream starvation, 900ms drift threshold with strictly greater than 3-second correction interval, pause/volume/end handling and listener cleanup. Platform contract explicitly requires decoded length, not full-duration metadata.
- Added RadioStreamURL with the original authenticated 127.0.0.1 MP3 URL/port/token/video checks. Added five tests covering endpoint bounds, buffer readiness/truncation, drift/cooldown/end behavior, starvation/timeout/stale callbacks and invalid/oversized input. Initial test fixture had a 12-character video ID; corrected fixture to the required 11 characters and retained rejection coverage. All five focused tests, TypeScript, formatting and whitespace checks pass.
- This is not a playable radio integration yet. Browser sound adapter, browser-compatible helper transport, room coordination/password/leadership protocol, service orchestration and UI wiring remain outstanding. Existing native desktop helper is source evidence, not evidence of browser support. Full-port objective remains open; no deployment.

### Radio snapshot/timeline wire port

- Added typed RadioState/RadioTrack/RadioPeer and RadioStateWire from original RadioRooms.receiveState, readRoster, snapshotMessage, timelineMessage, appendQueueOptions, validTrack/copyTrack and expectedPosition.
- Preserves legacy packets and queue-options versions 1/2/3; current encoder emits exact v3 primitive order with selected track, shuffle/repeat/keep/mask, successor session and roster. Decoder requires authenticated host identity/session and room identity, strict primitive types/bounds, monotonic revisions, bounded tracks/roster, unique member identities, host-role consistency and a designated DJ successor. Queue-revision mismatch returns snapshotRequired without applying a timeline to the wrong queue; snapshot acceptance while awaiting remains source-compatible.
- Playback position uses shared timestamps, freezes while unsynchronized/paused/buffering, ignores backwards time and clamps to track duration. Track copies retain original 96-character title truncation while incoming validation permits 160 characters.
- Five new focused tests cover exact field order, legacy versions, resnapshot/stale gates, malformed identities/types/options/authority and shared-clock behavior. Combined RadioAudio/RadioStateWire tests: 10/10 pass; TypeScript passes. No radio network traffic, build/deployment or browser playback claim. Room coordination/password/handoff orchestration, native-helper browser transport and UI integration remain incomplete.

### Radio authoritative queue transitions

- Added RadioQueue from RadioRooms.enqueueTrack, pause/resume, advanceTrack, beginTrack, setQueueModes, seek, playTrack, removeQueueEntry/removeTrack and publish. Owner interface supplies live host/online/synchronization/handoff gates, shared server time, readiness reset and publishing; publication revisions are incremented by the queue before notification.
- Preserves 10-track cap and source title copy, initial/restarted buffering, natural-completion-only repeat-one, explicit skip behavior, retention/played-mask compaction, repeat-all forcing retention, shuffle boundary exclusion, end-of-queue pause, one-second resume scheduling, seek clamping without implicitly unpausing, and explicit removal semantics. No controls mutate while guest/unsynchronized/transferring leadership.
- Six focused queue tests plus previous radio audio/wire tests: 16/16 pass. TypeScript passes. Still not wired to a running radio room/service or browser audio; readiness coordination and peer/request/leadership orchestration remain outstanding. No network traffic or deployment.

### Radio readiness coordination

- Added RadioReadiness from RadioRooms.ready, waitingCount/waitingMs/waitingForPeers, finishReadinessIfPossible, resetReadiness, ready receive validation and acknowledgement completion rules.
- Captures a fixed cohort of current, recently seen peer sessions when the leader buffers. Preserves the eight-second monotonic deadline without refresh on repeated callbacks, session departure pruning, early valid acknowledgements, shared-clock/online/handoff gates, one-second scheduled start, and a manual pause during buffering. Guest acknowledgements carry exact source fields and retry no faster than once/second until delivered; stale session/room/leader/playback/reset/deadline callbacks cannot mark a new playback delivered.
- Four tests cover deadline/cohort stability, early/stale/handoff acknowledgements, disconnected peers and missing-clock gates, and guest retries/stale completions. All 24 Radio*.test.ts tests pass (including existing native view tests); TypeScript passes. No runtime radio integration or network sends yet. Full room/service/transport integration and all other unfinished full-port requirements remain open.

### Radio request ledger source comparison

Implemented `RadioRequests` from `RadioRooms.as`: bounded admission, session-bound replies,
request cooldowns, duplicate-result replay, 150-second lifetime, and send-failure abandonment.
Corrected member invalidation to retain expired pending entries rather than deleting them;
otherwise a retry could re-enter moderation. Terminal decisions remain immutable. Request
clearing preserves admission limits; room departure resets them, matching the separate
source lifecycle paths. Added four focused tests; all 28 radio tests and TypeScript checking
pass. This module is not wired into a live radio room yet; playback and end-to-end room
coordination remain incomplete. No deployment performed in this pass.

### Radio IPC outbox port

Ported `RadioRooms.queuePacket`, `flush`, and `canSend` into `RadioOutbox`, adapting
only the IPC callback signature to `ClientIPCService`. Preserved the 24 queued-packet
limit, 200ms private/1000ms broadcast pacing, priority handling, original 15-second
send lifetime, state serialization at actual send time, and revision catch-up after
completion. Session, room, member, join attempt, control authority, playback, and
handoff revision/deadline gates are rechecked before sending. Retries retain their
record and attempt identity; stale callbacks cannot settle a newer attempt.

Eight focused tests include request-ledger/outbox interaction: a received Pending
result survives a late send failure and expires at the original 150-second deadline.
All 36 radio tests, TypeScript checking and diff whitespace checks pass. These are
local protocol tests, not evidence of live radio playback. Room orchestration and
browser audio/helper integration still need completion before runtime registration.

### Radio leader membership lifecycle

Ported original join/leave admission, DJ role changes, kicking and member expiry into
`RadioMembership`. New sessions reset DJ authority and invalidate pending song requests;
repeated joins refresh presence without changing roles. Preserved eight-listener capacity,
legacy five-field joins, seven-field password admission, reply pacing, 65-second presence
expiry and the three-minute kicked-attempt fence. A new explicit join attempt may rejoin,
as in the original. Room clearing retains the monotonically increasing authority nonce.

Six focused tests cover those source branches; all 42 radio tests and TypeScript checking
pass, with clean diff whitespace. Password proof verification is an injected contract here;
cryptographic implementation, discovery, room orchestration and runtime wiring remain open.
These tests do not establish browser/SWF screen parity or live radio playback.

### Radio discovery and advertisement directory

Added `RadioDirectory` from the original RadioRooms directory, refresh, advertise,
receiveAdvertisement and close-message paths. Preserved authenticated session matching,
legacy four-field advertisements, password flags, 64-room cap, detached UI snapshots,
65-second expiry, 20-second discovery/broadcast pacing and 10-second directed replies.
Directed advertisements do not postpone broadcasts. Leadership proof is queued before
advertising, and close messages remove only the matching room/session.

Five focused tests pass, together with all 47 radio tests and TypeScript checking.
No live room discovery was triggered; the module still needs the room coordinator.
Password proofs, control/handoff orchestration and browser media remain unfinished.

### Radio DJ control protocol

Ported control submission, validation, leader execution, result matching and timeout into
`RadioControls`, connected directly to `RadioQueue` for actual playback transitions.
DJs submit the original eleven-field command with authority, command nonce, state revision
and shared-clock expiry; only the leader applies it. Duplicate, expired or stale commands
request a fresh snapshot. Revoked authority returns denied. Requesters keep one pending
operation and fail it at the original five-second deadline without changing local playback.

Five tests use real RadioQueue transitions and cover duplicate application, stale authority,
revision/deadline gates, correlated results, timeout and queue rejection. All 52 radio tests
and TypeScript checking pass. Native UI/runtime wiring, leadership transfer, password proofs
and browser media are still incomplete; no live playback or deployment is claimed.

### Radio leadership transfer and succession

Ported the handoff offer/acknowledgment/commit protocol into RadioLeadership. The recipient
must hold the exact offered snapshot; the sender retains leadership until the outbox confirms
the commit. Revision changes, recipient session changes and the 15-second deadline cancel
pending transfer. Disconnect takeover requires the previously designated successor and the
absence of the old authenticated leader. Added original earliest-DJ successor selection and
role reconstruction to RadioMembership, preserving prior authority ordering and filtering
stale peer sessions. A transferred former leader becomes DJ; a disconnected former leader
is omitted.

Six leadership tests and one membership adoption test pass; all 59 radio tests, TypeScript
checking and diff whitespace checks pass. The coordinator still needs to perform the full
adoption transaction (clear outbox/requests/readiness, update state and directory, resync).
These extracted methods are not yet registered in a live game radio session.

### Radio password proof compatibility

Implemented RadioPassword with pinned @noble/hashes 2.4.0 for synchronous SHA256/HMAC,
matching the original synchronous admission path. The original bundled as3corelib.swc was
extracted and SHA256 decompiled to /tmp/QoLAF-Corelib: createBlocksFromString masks each
UTF-16 code unit with 255. Password key derivation therefore must NOT use UTF-8. Join
proofs use ByteArray.writeUTFBytes in RadioPassword.as and retain UTF-8 encoding. No
normalization or trimming is applied to passwords. Empty passwords retain empty keys/proofs.

Four tests check code-unit limits, non-ASCII/surrogate key derivation against Node crypto,
UTF-8 HMAC with every binding field, exact comparison, and browser bundling without external
imports. Library usage follows https://github.com/paulmillr/noble-hashes. Original hash source
also agrees with https://raw.githubusercontent.com/mikechambers/as3corelib/master/src/com/adobe/crypto/SHA256.as.
Full rebuilt suite: 682/682 pass; TypeScript checking and diff whitespace checks pass.
Protected room joining still needs live coordinator wiring and cross-client testing.

### Radio coordinator assembled and exercised across peers

Added RadioRooms, composing directory, membership, password proofs, requests, queue,
readiness, controls, outbox and leadership. Implemented original create/join/invitation/leave,
authentication attachment, reconnect/disconnect handling, clock freeze/recovery, snapshots,
telemetry, view snapshots, callback disposal and leader adoption transaction. Adoption clears
old queued work and request/control/readiness state, rebuilds roles, changes revision and
session authority, updates directory entries and resynchronizes listeners. The coordinator
structurally accepts the existing ClientIPCService without a replacement IPC implementation.

Eight multi-peer local protocol tests cover protected Unicode-password join, bad-password
rejection, queue readiness and anchor agreement, leader-authoritative DJ pause, handoff and
former-leader DJ status, delegated disconnect takeover, ordinary-listener timeout, request
moderation, kicks and explicit rejoin, handler disposal, session reconnection and clock loss.
Tests use deferred transport preparation/completion and the actual ported component classes;
no messages were sent to real players. Full rebuilt suite: 690/690 pass; TypeScript and diff
whitespace checks pass. This resolves the previously missing coordinator, but browser media,
RadioService/Invites/ChatBridge and native runtime registration remain unfinished. No live
radio playback, visual parity or deployment is claimed from these local tests.

### RadioService orchestration port

Added RadioService implementing the existing native RadioViewService contract, using the
real RadioRooms and RadioAudio state machines. Ported song lookup scheduling, listener
request approval/denial and expiry, DJ automatic acceptance, queue capacity accounting,
progressive-stream fallback, complete-file caching, sequential prefetch, stale-job generation
checks, playback revision checks, game-clock grace, account switches, music ownership,
volume retention and stop/disposal. Helper/file IO, audio creation, timer and game/music
access are explicit platform boundaries; no NativeProcess behavior is pretended to exist in
a browser. Opening the view starts only capability checks, not setup or room membership.

Six service tests exercise the actual coordinator/audio state machines with controlled media
IO: successful preparation/start/stop, stale resolve/download callbacks after room changes,
stream fallback and failed-track removal, capacity, volume/clock continuity and cleanup.
All 77 radio tests and TypeScript checking pass, with clean diff whitespace. The browser media
transport, native sound/music adapter, invitations/chat bridge and runtime registration remain
unfinished. No real helper downloads, player messages or deployment were performed here.

### Radio popup chat layering and Escape lifecycle

Ported RadioChatBridge's sibling reordering, topmost-surface checks, focus ownership and
Escape routing. Added optional bridge injection to RadioPopup: attach after overlay insertion,
consult before closing on Escape, and detach during disposal. Restoration uses the original
sibling indices without removing/readding chat, preserving native composer lifecycle/focus.

Four bridge tests plus all four existing radio screen tests pass; TypeScript and diff whitespace
checks pass. Tests cover both sibling orders, a higher visible popup, stale logical chat focus,
chat-first Escape and teardown after popup removal. This remains a boundary port: native
focus ownership/cancel-held-commands callbacks and gameplay chat gating must be supplied by
runtime integration. The upstream PlayState does not expose cancelAllCommands, so calling
that nonexistent method would not release held controls. Invitation rendering/acceptance is
separate and still unfinished. No live browser behavior or deployment is claimed here.

### Native radio focus and held-command release boundary

Added NativeRadioChatBridge using DOM editor ownership before OpenFL focus, and
NativeCommandCancellation implementing original PlayState.cancelAllCommands through the
Haxe state's existing sendCommand method. It clears static cruise and hotkey firing, releases
aim assist, sends false only for held throttle/brake/turn axes and firing, clears weapon fire
flags and restores zoom. It does not issue shield/boost commands or run on non-PlayState
screens. Added a session-scoped releaseAimAssist bridge to the existing aim port with cleanup.

Three new tests cover native command IDs, inactive/non-play guards and DOM/OpenFL focus
precedence; existing aim test now verifies release restores manual angle and disposal removes
the injected method. Eight focused cancellation/aim/chat tests and type checking pass; diff
whitespace is clean. NativeRadioChatBridge still needs runtime instantiation with the radio
popup; no claim that the live radio window is wired yet. Main gameplay input gating while
radio remains open also needs integration, as do the media helper and invitations.

### Radio invitation handshake

Ported RadioInvites and target selection: quoted player/list grammar, all-or-nothing peer
resolution, room/all-peer scopes, member/duplicate exclusion, 512 outgoing cap, one queued
IPC send at a time, 200ms pacing, queue-full retries, send-time acceptance deadlines, replay
suppression, explicit accept/deny, expiry and leader-confirmed protected-room join keys.
Receiving invitations never creates RadioService, starts audio or installs tools. Deferred
preparation rechecks current room, leader authority and recipient sessions.

Five focused tests cover target parsing, receive/accept/confirm, duplicate invitations,
bulk pacing, delayed preparation, session replacement, queue saturation, expiration, decline
and disposal. An initial test incorrectly re-invoked preparation after completion; retaining
the transmitted packet fixed that fixture. All 86 radio tests and type checking pass; diff
whitespace is clean. Native chat command/notice integration and live invitation testing still
remain, along with browser media/runtime wiring. No player invitations were sent.

### Radio helper control protocol

Ported RadioTransport's bounded JSON-line protocol and worker lifecycle behind a platform
channel interface. Capability probing is separate from explicit setup; requests retain source
IDs, operation matching, deadlines, heartbeat and sanitization. Progressive stream updates
remain nonterminal and require the original loopback capability URL. Cancellation blocks the
next job until the cancelled worker emits its terminal response, with a ten-second deadline.
Prepared-file validation belongs to the platform adapter rather than trusting helper paths.

Five tests cover fragmented replies, probe/setup separation, cancellation ownership, stream
updates, wrong-operation replies, oversized output, stale callbacks, heartbeat/deadlines and
sanitized file validation. All 91 radio tests and type checking pass. The original Go helper
is available in AstrofluxClient/tools/radio and uses stdin/stdout for control, plus tokenized
loopback HTTP for audio; no browser control endpoint exists yet. Browser-facing process/media
adapter and runtime registration remain required. No tools downloaded or helper launched here.

### Native OpenFL radio sound adapter

Inspected actual current Haxe Sound.load: it calls AudioBuffer.loadFromFile and exposes the
complete decoded buffer, not AIR progressive decoded duration. Added NativeRadioSound for
complete-file playback, mapping native Haxe accessors/events/channels and cloned sound
transforms. Progressive load explicitly fails into the existing RadioService complete-download
fallback rather than treating metadata duration as playable buffered audio. A separate browser
progressive adapter is still needed for full progressive parity.

Close suppresses callbacks, stops owned channels and releases buffers that finish decoding
late (OpenFL close does not abort the pending load). Three tests cover accessor/event mapping,
volume/channel cleanup, late decode cleanup and integration with real RadioAudio readiness
and fallback. Type checking and diff whitespace pass. These tests use a controlled OpenFL
boundary; no real browser audio has been played, and helper/browser bridge and runtime
registration remain unfinished.

### Native radio environment and music ownership verification

Added NativeRadioEnvironment to bind RadioService to existing ClientIPCService, current Game
clock/player identity, SoundLocator volume, native audio adapter, session timers and escaped
radio-colored local MessageLog notices. Reuses the already-ported MusicPlayer.acquireExternal
and releaseExternal methods instead of duplicating ownership or changing saved preferences.
A platform factory remains required for the browser/helper control channel.

Added three tests around the actual MusicPlayer plus installed native playback hooks: pending
automatic loads cannot start after radio acquires ownership; release restores the newest game
request without changing preferences; explicit /music takeover invokes radio's leave callback
without transiently resuming the old song; paused manual music remains paused and service
teardown releases radio. All eight music tests and TypeScript checking pass; diff whitespace
is clean. Runtime creation/registration still depends on the browser helper adapter, so this
is not a live music/radio verification or deployment.

### Browser radio helper transport and original-helper probe

Added scripts/radio/Bridge.mjs and Run.mjs (`npm run radio -- --helper <executable>
--origin <exact game origin>`), plus BrowserRadioPlatform. The loopback bridge launches the
original helper only for an active browser connection, relays its JSONL protocol, binds the
allowed browser origin, and exposes validated prepared MP3 cache files by opaque URLs.
Browser commands are serialized; split UTF-8 replies retain their content; closing a connection
aborts its requests and invalidates prepared-file mappings. The bridge owns tools/cache paths.

Verified the browser platform + real HTTP bridge + RadioTransport together against a controlled
helper process, including prepare/audio retrieval/disposal. Additional tests cover fragmented
replies, external prepared URLs, truncated streams and shutdown. Built the original Go helper
without editing source into /tmp/QoLAF-RadioHelper, then probed it through these same transport
layers using a fresh temporary cache/tools directory: available=false, canSetup=true, and the
original missing-tools status. No media tools were installed and no songs downloaded. The
probe supplied the browser Origin from Node; actual browser CORS and audio remain unverified.

TypeScript check, rebuilt full suite: 725/725 passing. Runtime registration, native popup
comparison, bridge-address configuration UI, invitation command wiring and progressive audio
remain incomplete. This is transport integration evidence, not completed radio parity or a
live deployment.

### Native radio registration, commands and modal keyboard

Index now installs a plugin-owned lazy RadioService controller and per-game native RadioPopup
entry points. /radio opens the source popup; /invitetoradio and /radioinvite connect to the
ported invitation handshake. Invitation ownership tracks authentication without creating audio
or downloading tools. Game teardown dismisses only its popup; plugin teardown owns the service.
/radiobridge validates and stores the loopback bridge address; a native configuration view is
still needed. Command suggestions/help include the new entry points.

NativeRadio uses the bitmap dependency graph for RadioPopup and the source pulse-color factory
for notices (neither is supplied by the unmodified game's class registry). RadioKeyboard lets
Enter open/submit the main composer while the popup blocks movement; Escape closes chat first,
then Radio. Held Enter/Escape releases are consumed, and editors, IME Enter and higher dialogs
retain their own input. Overlay changes preserve blockHotkeys while Radio remains open.

Tests cover local command routing/address validation/no eager media startup/teardown, native
notice dependencies, and real RadioChatBridge keyboard ownership. Rebuilt suite: 728/728;
TypeScript and diff whitespace checks pass. No live player invites or messages were sent.

Live comparison attempted on local preview with one released F5 press. Login rendered, but
authentication timed out with 'The server did not answer in time. Please try again.' Retried
saved login once; latest diagnostics at 2026-11-11T03:47:15.923Z still connected=false,
runtimeErrors=0. Thus native radio construction/rendering/audio and actual browser helper CORS
remain unverified. The loaded browser predates the final bitmap resolver fix; reload the built
client once login connectivity is established before evaluating the radio view. Full radio
progressive playback and overall client parity remain open.

### Native Radio view mounted and compared against the running SWF

Created a temporary native-renderer probe (no service/helper/player messaging) and mounted the
real RadioPopup on the loaded Starling root while the login server was unavailable. It exposed
a missing Haxe boundary: redraw read stage.stageWidth/stageHeight without ensuring those
aliases existed. The popup acquired NaN scale and invisible geometry. Changed these reads to
native-aware read(), and changed keyDown to read the native keyCode getter. Added a regression
covering full-size and half-size layouts with getter-only stage/event objects. Five focused
RadioScreen tests, TypeScript check and rebuilt bundle pass.

After the fix the actual popup rendered at full size and resized with the browser console.
Opened /radio locally in the running original SWF and captured both views:
/tmp/QoLAF-RadioRenderedCrop.png (port, inactive diagnostic service) and
/tmp/QoLAF-RadioOriginalCrop.png (original, missing-tools state). Main panel/control geometry
aligns visually; this does not prove all states or interactions. RadioInput remains a visible
mismatch: original query preserves its underlying one-pixel input border and has a separate
RadioQueryInput preview overlay, while port uses one generic flat RadioInput for all three
fields. Compare original core/hud/components/InputText.as, RadioQueryInput.as and
AstroTheme.settingsInput before correcting query/editor focus, disabled and preview styling.

Temporary browser popup was explicitly disposed (console RADIO_PREVIEW_REMOVED), the preview
module removed from host dist, and original Radio popup closed. No songs/tools downloaded and
no player messages/invitations sent. Browser still needs successful authentication for real
service/UI/keyboard/playback checks. KWin one-shot script objects must be loaded under a fresh
name to refocus later; re-running a completed script did not refocus. Firefox Linux Alt+2 selects
the second tab; Ctrl+2 did not. Avoid ydotool absolute mouse coordinates on this setup: they
landed on the tab strip despite the intended pixel coordinates.

### Radio field/query presentation correction and live editor check

Separated ordinary group inputs from the query-specific idle preview in RadioInput and
RadioPopup/NativeRadio wiring. Confirmed original src/assets/images/text_input.jpg is entirely
RGB(52,59,65); reproduce it as an opaque quad (0x343b41). Query-only preview background is
0x161a1d inset one pixel, matching RadioQueryInput.as, and hides immediately on editing.
Group fields retain native text/password rendering with five-pixel padding rather than query
ellipsis/cover; query keeps eight-pixel padding and the full native value/selection.
Disposal is idempotent. Added tests for the border, resize, focus, preserved text/selection,
plain group-field behavior and listener teardown.

Mounted the actual updated native popup on the renderer again using an inactive diagnostic
service. Screenshot /tmp/QoLAF-RadioInputsCrop.png shows the corrected query border/group
backgrounds compared with the previous SWF capture. Actual native query focus probe retained
110 characters and selection 8..20, with both preview layers hidden and native opacity 1
(console RADIO_EDITOR 110 8 20 false false 1). This did not submit a query or contact media.
Explicitly disposed preview (RADIO_PREVIEW_REMOVED) and removed temporary host module.
TypeScript/build, seven focused input/screen tests and full rebuilt 731/731 suite pass.
Source parity for all field focus/disabled/theme states is still not exhaustively demonstrated;
actual authenticated radio playback, progressive audio and remaining client features stay open.

### Radio native row gestures and volume setter

RadioList now reads currentTarget, globalX/globalY and cancelled through native-aware accessors.
Without another screen preinstalling aliases, actual Haxe getter-only touches produced undefined
coordinates and could never select a row. Regression exercises successful selection, cancelled
release, pointer drag and scrolled content. RadioPopup.changeVolume now calls set_musicVolume
when present instead of creating a plain shadow property and bypassing native audio/settings
side effects. Its regression verifies no shadow property and no changes during sync/disposal.

Populated the actual native popup with an isolated diagnostic service (eight directory entries,
ten queue entries, two peers and a listener request). It renders populated rows, narrow queue,
requests, enabled leader controls and scrollbars: /tmp/QoLAF-RadioRowsCrop.png. No IPC messages,
queries, helper operations or actual playback were performed. This validates native construction
and displayed populated state, not actual server synchronization or complete interaction parity.
Disposed the temporary view (RADIO_PREVIEW_REMOVED), removed the host preview module. Native
keyboard processing/console updates may lag at inactive-window frame rate: wait for UI state
before repeating a pasted command. Full rebuilt suite 733/733 passes; typecheck/build and diff
whitespace pass. Remaining full-port and playback work remains open.

### Real browser complete-file audio bridge probe and decoder URL fix

Generated a three-second silent MP3 with local ffmpeg, used a temporary fixture helper process
and the actual Bridge + BrowserRadioPlatform + RadioTransport + RadioAudio + NativeRadioSound
against the loaded Firefox Haxe runtime. Initial native decode failed. Inspection of bundled
Lime/Howler confirmed it picks codecs from the filename extension before fetching, while the
bridge exposed extensionless opaque URLs. Added .mp3 to the opaque audio route and strict
browser validation; integration regression now requires that suffix.

After rebuilding the temporary browser probe and restarting its owned fixture bridge, actual
browser results were ready=true, duration=3000ms, buffering=false, position=768ms and 799ms,
volume=0. Native bytesLoaded remains zero in this complete-buffer runtime; decoding/readiness
and playback work despite it. Evidence /tmp/QoLAF-AudioFinalResultCrop.png. Thus local HTTP
browser-to-loopback CORS, prepared-file transfer, OpenFL decoding, channel position advancement
and cleanup ran successfully. Test used only synthetic silence, no external media downloads,
no user music preference changes, no IPC or actual group traffic. Original helper probe was
separately verified earlier; this test uses a controlled helper process for deterministic audio.

Six focused bridge/browser-platform tests pass; TypeScript check and build pass. Temporary
server and hosted probe/endpoint files are removed after verification. HTTPS-hosted play still
needs verification: bundled Howler switches HTTP sources to HTML5 audio on HTTPS pages, so
success on the HTTP local preview must not be generalized to GitHub Pages. Progressive playback,
real helper media preparation and authenticated synchronization remain open.

### Vanilla flash ownership and enemy lifecycle comparison

Compared current `/home/raony/Documentos/astroflux.js` damageFlash/startKamikaze with
original `Unit.as`, `EnemyShip.as`, DamageFlashEffect and KamikazeFlashEffect.
Vanilla already supplies damage/heal flashes and kamikaze pulses. The original
client changes their rendering to a half-strength white sibling overlay and a
direct-texture inversion style, respectively; UnitFlashes ports that rendering
change rather than introducing a new gameplay feature. Timings remain 80ms for
hits and 125ms for kamikaze pulses. Original source also deliberately shares the
white damage overlay with healing; this is not an accidentally missing heal tint.

Found and fixed cancellation leaving kamikazeStarted true: original
stopKamikazeVisual explicitly clears it. Cancellation now clears that flag after
EnemyShip has evaluated its vanilla explosion, restores the prior style/blend,
and invalidates delayed callbacks. Two focused regression tests failed before
and pass after the fix, covering explosion preservation, destruction, reset,
reused enemy callbacks and plugin disposal. Typecheck and build pass. These are
lifecycle/source checks, not proof of GPU-rendered visual parity; an actual
combat comparison remains outstanding.

### Live GPU flash probe: lost texture fixed

Mounted temporary 100px source/damage/kamikaze images in the existing Firefox
Haxe Starling root. Real render failed with `can't access property get_format,
s is null` in createAGALTexOperation from DamageFlashEffect.createProgram.
`Mesh.setStyle(style, false)` discarded the image's texture; original AS3 style
assignment uses default copying. Fixed UnitFlashes to copy style data when
applying either flash style. Restoration still uses the saved original style.

Rebuilt temporary probe with the same corrected assignment and explicitly ran
Starling.render: FLASH_DRAW_OK. Sustained rendering showed the blue source,
half-white damage layer and orange inversion (screenshot
/tmp/QoLAF-FlashColorsCrop.png). Both shaders therefore compile and render in
this actual Haxe/OpenFL GPU pipeline. The fixture uses synthetic solid textures,
not live combat; it does not prove animated/atlas/alpha or full combat parity.
Added texture-retention regression alongside lifecycle tests: 3 pass, typecheck
and build pass. Temporary images are explicitly disposed and hosted probe removed.

### Follow-up custom-style state audit

Reviewed every explicit setStyle call after the flash texture fix. Weapon grayscale,
particle tint and phase-blade styles already initialize texture and smoothing before
using copy=false; they do not have the null-texture flash bug. They did omit
textureRepeat, which the original style assignment preserves. Added that setting
when creating projectile/ribbon/particle styles and when reusing beam segment styles.
Saved-style restoration remains unchanged. Regression asserts repeated projectile
and ribbon textures retain repeat=true under grayscale; 11 weapon/blade tests pass,
as do typecheck and build. This is state-preservation evidence, not a new live GPU
comparison for repeated textures.

Also restored original ClientDevVisualPopup help/error wording: Apply saves and
shares with updated clients; validation says six hex digits. The previous wording
claimed sharing was still being ported and leaked a TS class name into the error.
Apply already invokes ShipVisualStateStore.changed, consumed by NativeVisualShare.
Authenticated cross-client sharing verification is still a separate open requirement.

### Screen/source comparison: automation help contract

Compared screen string literals and method inventories against matching original AS3
classes. Many missing popup method names are extraction into helpers, not missing
screens; those inventories alone are not parity evidence. Found a concrete mismatch:
Settings imports JS/MJS modules, but the guide still instructed SWF/SWC authoring and
showed AS3 syntax. Adapted its install instructions, default-export script example,
metadata, event subscriptions, structured-command example and control example to
current browser contracts. Kept lifecycle/control semantics and the visible unfinished
port notice; no claim that the full port is complete.

Regression extracts the actual displayed module example through the rich-text parser,
imports it, then runs initialize/start/update/render/stop/dispose through AutomationManager.
It succeeds without lifecycle errors. Eleven guide/manager tests pass; typecheck/build pass.
Screen inventory and hover-popup source checks did not establish full visual parity;
rendered screen comparison and remaining functional ports stay open.

### Animated flash restoration and damage-frame synchronization

Followed original EnemyShip.hideKamikazeVisual style assignment through native
Mesh.setStyle copying semantics. Restoring the saved style with copy=false rewound
the movie-clip texture to the frame captured when the pulse began. Changed restoration
to copy current style data, matching original AS3 assignment. A regression advances
the texture during a pulse and failed before/passes after this change.

Expanded installed-hook tests for the separate damage overlay: current texture,
transform and alpha follow Game.draw, texture changes readjust geometry, duration is
80ms, repeated hits do not extend it, reset disposes its image, and stale callbacks
cannot hide a new flash on the reused unit. Five flash tests, typecheck and build pass.
These use display-boundary fixtures with the real host hook manager; they complement
rather than replace the earlier real-GPU shader probe and pending combat comparison.

### Radio removed from browser scope at user request

User explicitly requested stripping radio from the browser for now. Removed native
radio installation, per-session hooks and all four radio autocomplete commands.
No radio invitation handler, popup, helper connection or audio runtime is installed
by the browser entry point. Dormant implementation and tests remain in source for
possible later reuse; their work is no longer a browser completion requirement.
Stopped the owned temporary helper bridge and removed its hosted audio probe.

Verified rebuilt bundle contains none of installNativeRadio, createRadioPopup,
RadioAudio, radiobridge, invitetoradio or radioinvite. Eleven affected autocomplete
tests, typecheck and build pass. Earlier full suite was 744/744 before this removal.
Local build updated; this entry does not claim a remote deployment or browser reload.

### Target presentation source comparison

Revalidated local preview reports connected game, hidden login/plugin controls and
zero runtime errors at observation. Compared TargetInfoElement nearby sorting,
250ms snapshot cadence, target validity, distance and aura text constants against
port sources. Those inspected paths match; this does not establish full screen parity.

Fixed two target-name mismatches: spawner faction/type naming must precede parent
boss naming, and null/empty target names must display Unknown. Added cases for
boss-owned spawners, missing types, level suffixes and Regius compaction. Ten target
presentation/nearby-row tests pass, along with typecheck and build. No gameplay
selection priority or newer vanilla shield behavior changed.

### Health/multibar animation comparison

Compared CustomProgressBar.as maximum/value setters, interpolation, hidden stats,
partial-layer capacity, zero-layer handling, color persistence and glow brightness
against ProgressBar.ts. Inspected numerical behavior matches source. Added frame-by-
frame checks at 30/60/120/180 FPS for damage-trail advancement, immediate healing and
maximum clamping, plus partial top layer and exact 10000-unit boundaries. Six focused
tests and typecheck pass. These prove bar model behavior, not the entire rendering
loop or side-by-side screen appearance.

Remaining concrete visual difference: port builds the 28x18 glow texture with manual
uniform-stop pixel interpolation, while original uses Flash Shape.beginGradientFill
with ratios [0,32,64,96,128,160,192,224,255] and rasterizes it into BitmapData. Native
OpenFL Shape/Graphics APIs exist in current upstream. Reproduce that raster path and
compare rendered glow before claiming exact health-bar visual parity.

### Health-bar glow source raster path restored

Replaced the manual 28x18 alpha-pixel approximation with the original sequence:
OpenFL Shape, Matrix.createGradientBox, nine-stop linear beginGradientFill with
source alpha values and authored ratios, drawRect/endFill, BitmapData.draw, then
Starling Texture.fromBitmapData. Confirmed current Haxe CanvasGraphics maps gradient
type 0 to createLinearGradient and Matrix exposes createGradientBox. Kept bitmap
ownership until bar disposal so texture restoration can retain its source.

Nine progress/native-UI tests, typecheck and build pass. This verifies construction
through boundary fixtures and preserves existing model behavior. Actual OpenFL
raster output and comparison with the original Flash screenshot remain unverified;
using the same drawing operations is not itself proof of identical rasterization.

### Clock resync implementation; tests paused by user

Implemented previously advertised but absent /resync [1-10] from Clock.as and
SceneBase.resyncClock. Added local command interception/help/autocomplete and
NativeClockResync: FIFO parallel sends, sample-count cooldown, 10s expiry,
median-latency outlier pruning, average offset/latency, and draining stale replies
before accepting another batch. Ordinary native time requests are held while the
batch has unmatched replies. Scene/clock replacement, disconnection and plugin
cleanup release the owned response handler.

Adapted to current clock.Clock's epoch timestamps and preserved newer vanilla
setTargetSyncTimeDelta/slew/backward-time guard instead of overwriting it with the
old clock implementation. No live clock requests were sent. User explicitly paused
tests to focus implementation; only TypeScript compilation and build were run and
pass. Runtime behavior and source-parity tests remain unverified. Temporary glow
probe collector was stopped and hosted probe removed; no continued UI testing.

### Missing command integrations implemented (tests remain paused)

Connected /aimdebug and /aimassistdebug to the existing aim-assist settings and
native overlay refresh. Added /upstream and /restart using the enclosing browser
launcher's reload path, so the normal update/plugin loader runs again. Added
/switchinstance <pve|pvp|ci> from original ChatInputText: active warp-gate safe-zone
checks (including landed gate), pending-warp guard, PvE/PvP selection, and own-clan
MD5 room identity, delegating the transition to current Game.warpJump. Original
Haxe Body.TYPE_WARP_GATE and spawnersCleared fields confirmed in local upstream.
No actual warp or page reload was performed.

Added missing autocomplete entries for these commands plus existing ref/refresh,
tptodeath, rec, upg, hangar and piratebay. TypeScript compilation and bundle build
pass; tests and live interactions deliberately not run per user's instruction.
These implementations still require later runtime/parity verification.

### Room and solar-system diagnostics ported

Added /listrooms <service|game> and /listsystems with source ChatPrivateDiagnostics
formatting: system/name/type ordering, population/capacity, version/service metadata,
PvP brackets, moderator/clan flags, galaxy/levels/coordinates, colors, bounded escaped
fields and whole-row overflow fallback. Adapted Haxe table maps and getters; results
remain local chat. Async room callbacks are discarded after leaving their game.
Commands are wired into interception, help and autocomplete. Compilation/build pass;
no tests or live room-list requests run while testing is paused.

### Warp command implementation — 2026-11-11

- Ported `/warp` and `/privatewarp`: original quoted two-argument grammar, system-name/key lookup, PvE/PvP/clan selection, canonical clan hashes, fresh private room IDs, and native game warp transition.
- Ported `/warptofriend`: online friend refresh, exact ID/name then prefix lookup, stale-session guards, live room metadata lookup, reserved IPC exclusion, optional mode selection within the friend's sector, and original clan-sector hashes.
- Added the missing resolved-room handoff to Haxe JoinRoomManager. Existing friend rooms use PlayerIO `joinRoom`, preserving metadata and avoiding recreation of disappeared rooms. Fresh override rooms use `createJoinRoom`. Native warp performs the game/fade transition, including deferred match setup.
- Added command reservations, help, and autocomplete suggestions.
- Validation: TypeScript check and bundle build only. Tests and live gameplay checks remain paused by request. Friend-warp retry/recovery parity with the original extended JoinRoomManager remains outstanding; this change does not port that entire recovery manager.

### Compilation boundaries — 2026-11-11

- Corrected the earlier assumption that private commands could be exposed in the shared browser client. Original CONFIG::PRIVATE behavior must remain a compilation boundary.
- `npm run build` defines `__QOLAF_PRIVATE__=false`; private warp helpers, room diagnostics, inspector, and automation implementation are eliminated. Public commands retain denial responses; private command suggestions/help are gated.
- `npm run build:private` writes exclusively to ignored `private-dist/`, outside the Pages artifact path. Login, help and IPC identity reflect the compiled Public/Private flavor.
- Build validates esbuild byte contributions before writing output and rejects private implementation in public artifacts. This caught a top-level initializer retaining NativeAutomations; moved its split into the consuming function and rebuilt successfully.
- Current repository visibility is PUBLIC; inspector source is tracked. Source confidentiality remains unresolved pending the user's choice of a private repository split or changing repository visibility. No publishing or visibility changes performed.
- Checks: tsc and both compilation flavors. Gameplay tests remain paused.

### Public client version exchange — 2026-11-11

- Ported original `core/ipc/ClientIPCEcho.as` into `src/ipc/ClientIPCEcho.ts`, retaining QUERY/REPLY packet layouts, authenticated peer-session matching, five-second cooldown, twenty-second response window, exactly one same-nonce retry, unique results, bounded reply jobs, and disposal with the authenticated transport.
- Wired `/spececho` to native chat with owner/session guards and escaped player names. Responders stay silent. `/echo` now includes the current game protocol in the original version-label format.
- Registered `core.ipc.ClientIPCEcho` in the raw class bridge; revision 123 accompanies version 1.1.23. Public/private build identity follows the compile-time flag.
- Checked TypeScript and public compilation including private-code exclusion guard. No live IPC queries sent; gameplay and automated tests remain paused. Cross-client exchange still needs runtime validation after tests resume.

### Death-message presentation — 2026-11-11

- Ported all original Emperor, Aureus, Faction, Nether, and generic death-template catalogs and their selection rules into readable PascalCase TypeScript files.
- Ported `DeathMessageSelection` with the original ten-second server-clock buckets, length-prefixed UTF-16 FNV hash, unsigned 32-bit arithmetic, and pool-specific final mixing. Selection does not depend on local RNG, join time or chat history.
- Hooked native MessageLog.writeDeathNote: fixes only the displayed Naxar spelling, preserves reported killer/cause, applies the original family precedence and environmental exclusions, strips level suffixes only for matching family variants, localizes before escaped placeholder substitution, and falls back to upstream for unmatched cases.
- TypeScript and public build pass; private-code exclusion remains enforced. Tests and live death events were not run under the current pause.
- Separate outstanding gap found: EmperorReadyNotifier (arena observations, reconstruction/ready status, xr/yr/zr and victory coordination) is not yet ported. Death-message presentation does not complete that system.

### Emperor observation prerequisites — 2026-11-11

- Added EnemyObservations and installed native packet/lifecycle adapters for damage/resource updates, masked enemy sync, initial target sync, AI course/state targets, reset/reuse, and reconstruction enter/exit.
- Preserved the original two-second resource freshness window and unsampled-target sentinel. Metadata is exposed on raw EnemyShip through restorable prototype descriptors.
- Current Haxe AIResurect.get_type returns AITeleport. Reconstruction observation therefore follows its actual class lifecycle, not the misleading state type. No AI behavior, health, shields, regeneration or targeting is modified.
- Adapted AI course parsing to the current optional slowdown fields; masked enemy-sync target IDs use the current +1 wire encoding.
- Compile/build pass with private-module exclusion. Tests remain paused. EnemyFire packed-record bounds are not yet adapted; do not infer raw aggro from weapon targets as a substitute. EmperorReadyNotifier, chat shortcuts and radar coordination presentation remain to be wired on top of these observations.

### Emperor coordination and radar implementation — 2026-11-11

- Ported EmperorReadyNotifier: Argon arena bounds, source HP thresholds and zero-shield condition, fresh-resource/close-range observation rules, raw-target requirement for Xhersix, five-second sparse HP broadcasts, fifteen-second expiry, reconnect refresh, ten-second reconstruction cycles, stale peer rejection, and non-extending duplicate reconstruction deadlines.
- Added source packet schemas for status and trio victory. Queued status snapshots revalidate the current scene/room/enemy and refresh HP at send time. Peer reports only update presentation and never gameplay objects.
- Hooked authoritative native killed packets before hull disposal; local victory publication waits for actual trio removal. Scene cleanup removes transport handlers/timers; reconnecting to a replacement IPC service recreates the tracker.
- Connected xr/yr/zr and optional slash forms. Successful publications consume the input; failed attempts are sent through ordinary native chat with the original delayed gray warning. Ready transitions reuse the existing chat ping sound.
- Added native Emperor radar rows: original boss_nexar_3/2/1 icons, 18px icon bounds, 22px row height, 285px text width, source colors and grouped HP text. The rows prepend the existing metrics/boss timer layout only in the coordination area. Removal-based victory fallback and duplicate suppression follow the original radar.
- Exposed core.ipc.EmperorReadyNotifier through the raw class registry.
- TypeScript and public bundle build pass, including private-code exclusion. Tests/live IPC/gameplay remain paused; runtime parity is unverified. The earlier missing bounded enemyFire raw-target observation remains outstanding.

### Packed enemy-fire target observation — 2026-11-11

- Inspected current core.sync.MessagePackHandler: each packed length includes its two-field header, but the native enemyFire call drops the length argument and its handler tests the whole message length before reading a target.
- Added PackedRecordBounds to retain each complete record's exclusive end during native dispatch, restoring prior context for nested/reentrant use and removing it in finally.
- Adapted enemyFire to bound optional target reads to that record. Firing packets with an actual target field update raw enemy aggro; stopped/targetless events do not clear the ship observation. Weapon fire/target updates retain native behavior with the corrected record boundary.
- This implements the previously outstanding Emperor weapon-target observation path. TypeScript and public bundle compilation pass; tests remain paused and the path has not been exercised in live gameplay.

### Hangar selection and preview lifecycle — 2026-11-11

- Compared original Hangar/SkinItem with the current Haxe implementation. Current upstream already tracks both dual-thruster emitter groups; retained that behavior.
- Expanded the original onSelect guards/error reporting to owned-ship mode as well as catalog/shop mode. Null selections are ignored; empty-slot instructions and native switch/buy/preview modes follow the source.
- Added idempotent preview disposal and cleanup for the seven original optional detached sections (buy/details/special weapon/premanufactured/special stats/description/base stats). Native cleanup continues to own attached children and tracked emitters.
- TypeScript/public compilation pass; tests and live screen checks remain paused. This does not establish full hangar visual parity.

### Developer login notices — 2026-11-11

- Compared original LandedUpgrade screen contents and cargo-load transition with current Haxe; those inspected paths already match and were retained.
- Ported ClientLoginNotices with the original account-ID developer authorization, authenticated peer login metadata validation, own-account exclusion, login-token deduplication across warps, 4096-entry bound, and gold/red notice markup.
- Notices are local MessageLog rows only; no send/broadcast path was added. Display names are escaped, including role markers. Retained rows carry the authorized viewer identity and are removed when attaching a different/unauthorized account.
- Peer listeners follow the active authenticated IPC transport and are removed on scene disposal. No new compile-private functionality is exposed: the original feature is runtime developer-authorized, not CONFIG::PRIVATE.
- TypeScript/public compilation pass. Tests/live login discovery remain paused; no runtime parity claim.

### Passive connection-health notices — 2026-11-11

- Ported original ConnectionHealthMonitor thresholds, adaptive baseline, two-slow-reply episodes, pending-response limits, 90-second per-socket-type cooldown across rooms, foreground grace, and evidence reset after observer gaps.
- Added Game-session observation of existing clock timeRequest/serverTime and Service RPC callbacks. No periodic probes, retries, clock changes or reconnect actions are introduced. Per-frame evaluation suppresses notices while backgrounded, loading, warping or recovering.
- Corrected six new EnemyObservations `after` hook signatures after inspecting host public/plugins/core.js: callbacks receive `[result, ...arguments]`. The previous signatures would treat a return value as the incoming packet. Other newly added argument-consuming hooks were checked against the same convention.
- Checked historical ThankYouPopup trigger: original explicitly limits it to revision 100, so its absence in revision 123 is correct rather than a missing active screen.
- TypeScript and public build pass, including private implementation exclusion. Automated and live tests remain paused; runtime behavior is unverified.

### Player-target mention normalization — 2026-11-11

Ported the original `af.ChatPlayerCommandNormalizer` allowlist and leading-target normalization into `src/chat/ChatPlayerCommandNormalizer.ts`, attached to the native composer parser through `LocalClientCommands`. `/w  @name message` now produces the original target payload; optional opening quotes are preserved, message-body mentions and unrelated/custom arguments are unchanged. `ssv` retains its own parser as in the original send path. Native saved-private chat is outside the allowlist. Source comparison used original ChatInputText sendMessage and the current Haxe parseCommand/sendMessage implementations.

TypeScript check and public bundle build passed, including the private-source contribution guard. Tests and live command sends remain paused. This closes the missing normalizer implementation, not live chat parity verification. All changes remain local.

### Bomb displacement port in progress — 2026-11-11

Confirmed original BodyManager enables bomb distortion (12-shell cap), while stellar/body distortion is deliberately disabled. Current Haxe class registry includes FragmentFilter, FilterEffect, and Painter but omits both DisplacementMapFilter and RenderTexture. Referencing those absent classes would silently drop the effect or crash rendering.

Added readable ports of RingDistortionSource (including its session-owned shared procedural textures, transparent center/exterior, original radial pixel math, and context-restoration callback) and ShockwaveDistortion (80ms delay, source blast speed with 350 fallback, linear radius growth, sinusoidal strength, full-shell camera bounds and world-to-screen positioning). TypeScript check passed. These classes are not yet installed: the shared GPU displacement compositor and pooled-projectile factory/explosion/reset integration remain to implement. No claim of visible shockwave parity; live tests remain paused.

### Bomb displacement compositor and lifecycle connected — 2026-11-11

Implemented RingDistortionFilter on the current native FragmentFilter/FilterEffect/Painter GPU APIs. It draws the original ring images into one stage-sized render-target texture with an opaque neutral clear, then applies one shared displacement pass to the world. UV mapping uses FilterHelper's actual padded/clipped stage bounds and the input/map root sizes; no full-size CPU bitmap updates. Native class names, constructors, texture creation, sampler/constants setup, target-state restoration and filter-detachment semantics were checked against the local Haxe bundle.

NativeBombShockwaves now installs per GameSession: exact original two explosion-effect IDs, native projectile definition aiBlastSpeed, immediate-AI-creation fallback, reset-aware once-per-pool-life guard, registration before particle/camera throttling, original finite-input/quality guards, 12-ring limit, reverse source compositing order, settings disable and session teardown cleanup. Original stellar distortion remains disabled. Existing world filter is restored after the bomb effect detaches.

TypeScript check and public bundle build passed (including private-module exclusion). GPU output, map alignment across zoom/resize/context loss, shell behavior in actual gameplay, and interaction with other filters are not verified while tests are paused. Implementation is connected, but visible parity remains open until runtime comparison. No deployment or publishing performed.

### Mine explosion contact semantic correction — 2026-11-11

Compared original Projectile.registerMineBlastHit with DamageObserver.explode. The port incorrectly reused estimated-hit state as the once-per-explosion guard; original has independent mineBlastHitRegistered and estimatedHitRecorded flags. Added the separate pool-reset-owned guard, original unit-list/candidate-position checks, and original canBeDamage eligibility call. Closest-target selection, estimated damage, and auto-target offer remain local observations; native/server damage is unchanged. TypeScript check passed; no tests or live sends performed.

Also checked two apparent inventory gaps: ProjectorWarning is Flash-projector-only (not applicable to browser), and NetherBlobAttackVisuals already exists through NetherBeamStyle/NetherTentacleVisuals with the exact original weapon/projectile keys. No duplicate implementations added.

### Error diagnostics and failure-isolated teardown port — 2026-11-11

Ported ClientErrorDiagnostics browser behavior: preserves first error plus latest 15, 8192-character detail cap, adjacent duplicate suppression for two seconds, safe thrown-value formatting, console evidence and snapshot. Registered original qolaf.diagnostics.ClientErrorDiagnostics raw class. Browser error/rejection listeners detach on plugin disposal; bitmap validation and handled initialization failures record directly. Browser uses in-memory evidence as original does when AIR file APIs are unavailable; no storage, downloads or uploads added.

Ported ReloadCleanupRunner with original fixed initial callback count and independently protected error reporter. APIScope now uses it; a logger exception previously could abort remaining cleanup. TypeScript and public bundle checks pass. Tests remain paused.

Chat comparison also confirms an outstanding structural mismatch: original ChatAdvanced uses ProfiledChatList and StableChatListDataViewPort for variable-height virtualized rows; NativeAdvancedChat still uses native ScrollBox with rich row adapters. Batching/retention alone does not establish parity of large-history scrolling, validation convergence or initial bottom reveal. Full list migration requires coordinated changes to NativeChatMessages, NativeChatLayout and context/hit-testing adapters; remains open. MessageRandom is no longer referenced by the original chat formatting code, so adding an active RNG there would be incorrect.

### Advanced-chat initial bottom reveal and settling — 2026-11-11

Ported original ChatAdvanced bottom-seek state machine into ChatBottomScroll: immediate seek for opening, 150ms live-message debounce, 50ms verification, two confirmations, 2px tolerance and 60 bounded corrective attempts. The initial list is transparent/noninteractive until the newest row exists; a live burst during opening preserves the outstanding reveal. NativeAdvancedChat refresh now filters queue rows and resets batches, and replaces the constructor-cached Haxe load/unload listeners so the stock anonymous 200ms bottom jump is not scheduled on subsequent opens. Clear/unload/disposal cancel seek callbacks and pending batches. Existing rich row construction remains intact.

TypeScript/public bundle checks passed including reveal-state preservation; tests and live screen comparison remain paused. The full virtualized-list migration is still outstanding: this implements source scroll lifecycle on the current native row collection, not full advanced-chat parity.

### Advanced context-menu row ownership and visibility — 2026-11-11

Matched original ChatAdvanced onProfileFrame/row-removal context lifecycle in NativeChatContext. Context now owns its materialized row as well as message; row disposal, detachment, hiding, parent hiding, zero alpha, view removal, and initial noninteractive scroll reveal close/inhibit the menu. Frame checks are attached to the actual view, so isolated floating chat does not depend on a mismatched main-game frame identity. Removed listeners and closed context during teardown. Existing role/artifact hover adapters already had removal/frame invalidation and were inspected without adding duplicate handlers.

TypeScript and public compilation pass. UI tests remain paused; runtime context/scroll behavior and full virtualized chat parity remain open.

### Chat batch layout and new-row binding — 2026-11-11

Inspected current Haxe ScrollBox: every add/remove calls arrange(), which scans row bounds again through scroll clamping and scrollbar layout. NativeChatMessages additionally scanned every older row after each addText and projected each new row twice. Replaced that scan with the known appended row, supplied its message before initial rich projection, and retained the full scan only for initial preexisting-row attachment. Added nestable ChatLayoutBatch to defer native arrangement until receive/refresh batches finish, including exceptional exits. Retention disposal, rich renderers, source metadata, thumbnail callbacks and existing hit-test interfaces remain connected.

TypeScript/public compilation passed. No benchmark or runtime test was run while tests are paused, so no measured performance claim. This removes confirmed repeated work but does not implement the outstanding virtualized list.

### Explicit materialized chat-row binding — 2026-11-11

Added ChatRows shared per-view mapping and materialization notification. NativeChatMessages, NativeChatContext and FloatingChatView no longer independently infer ownership from the final child after every addText. Notification requires an actually appended native row, and carries its message object directly; the API also allows future virtualized materialization without replaying a message insertion. Existing rows are seeded against retained queue order (duplicate message strings remain separate entries), fixing missing context bindings when attachment occurs with an already-open view. Listener and registry lifetimes follow the view's API scope.

TypeScript/public compilation pass. This is the integrated row-binding prerequisite for virtualization; list virtualization itself and live UI parity are not yet verified/complete. Tests remain paused, changes local.

### Advanced/floating chat virtual rows connected — 2026-11-11

Added VirtualChatList: retains chronological message entries independently of native display children, estimates uncached heights from a typical measured row, materializes only viewport-adjacent WrapText/rich rows, releases off-screen rows, and preserves per-entry height measurements. Native scroll shell keeps its wheel/thumb/mask behavior; contentBottom now reflects the entire data collection. Height discoveries defer further layout to subsequent frames rather than recurse (original StableChatListDataViewPort intent). Resize/font/artifact-presentation changes invalidate measurements.

NativeAdvancedChat now appends/retains/clears the model and uses actual last-message renderer availability for original bottom reveal/settling. Context Block clears the model rather than only visible children. Main and floating chat share the adapter. Materialized rows notify rich formatting/previews/context bindings directly. Audited HookRegistry order and corrected batch installation to wrap virtual arrangement; native row inference cannot overwrite an already-explicit virtual binding.

TypeScript/public compilation pass. This is an initial connected virtualization implementation, NOT verified equivalence to the original Feathers List. Pending runtime comparison includes long mixed-height history, rapid scroll/resize, images/artifact reflow, font changes, retention at capacity, reopen/clear/dispose, and hover/context correctness. The adapter currently disposes off-screen rows rather than reusing a Feathers renderer pool; performance and pool parity remain open. Tests remain paused; no publication.

### Virtual chat renderer reuse and hover ownership — 2026-11-11

Added bounded native row reuse to VirtualChatList. Off-screen rows release their message association before detaching; the next message reuses the WrapText/rich-renderer pair. The spare pool is bounded by the current materialized row count, and clear/unload/disposal release both active and pooled nodes. ChatRows now emits explicit release notifications. Rich rows clear old message/markup and dispose thumbnail subscriptions/resources before reuse, preventing stale image/channel metadata. Context menus close immediately on row release.

Ping/artifact/role previews now validate hover from their owning view's enterFrame instead of comparing an isolated floating-chat facade against the main game from the host frame event. They also close on row recycling, before a reused renderer can impersonate the previous hovered row. Existing async image generation guards were inspected and retained.

TypeScript/public compilation pass. No runtime tests or benchmarks performed while paused; renderer-pool correctness and visual/performance parity remain to verify against the original. All changes local.

### Settings slider theme-state parity — 2026-11-11

Compared SettingsPageStyle/AstroTheme with NativeControls. Checkbox outline geometry and favorite-marker inset were already represented. Settings slider thumbs diverged: the port invented dark hover/down/disabled colors and disposed/recreated the thumb on state changes, while original settingsSliderThumb provides only one default 10x14 gray/bordered skin. Removed invented palette variants and retained the native thumb node across states; disabled interaction remains controlled by isEnabled. Native press state and slider value handling remain intact.

TypeScript/public bundle checks pass. Visual/pointer parity remains untested while tests are paused; no deployment.

### Login chooser persistence and disabled auto-login — 2026-11-11

Compared original initializeProfileLogin/profileCanLogin/onSteamIntegrationChanged/removal flow with LoginProfiles. Persisted the Steam integration choice separately from availability, restored it into the Steam profile, and refreshed chooser state after toggle. Browser availability remains false without erasing the user's stored preference. Auto-login now checks enabled before hiding the chooser/starting its countdown, matching original profileCanLogin; previously a disabled selected profile could leave all panels hidden after connect returned early. Removal now persists the panel's new selection rather than the removed ID. Returning to the chooser clears stale status before fail() supplies a new error.

TypeScript/public compilation pass. No account login, credential output, external requests, tests or deployment performed. This checks chooser semantics, not complete Steam account-linking/runtime authentication parity.

### Saved-profile normalization and Steam identity — 2026-11-11

Ported original sanitizeSiteProfile/loadLoginProfiles checks to normalizeSavedProfiles: require site type and non-null credentials, normalize string fields, enforce original identifier/secret length limits and provider credential rules, sanitize account display name through siteProfile, and retain only the first canonical profile ID. Invalid root storage/null array entries no longer throw before the chooser is built. No stored credential values were read or printed during this work.

Steam row now uses original steam:<userId> (current fallback), session display label and source detail text. The previous port's unscoped selected ID migrates to the current session ID; a different account-scoped ID will not auto-login a different Steam user. TypeScript/public compilation pass. Runtime/authentication tests remain paused, no publish/deploy. Full login/Steam integration parity is not claimed.

### Authenticated login profile-name cache — 2026-11-11

Ported original Game.onInitPlayer -> Login.cacheAuthenticatedProfileName behavior through native PlayerManager.initPlayer completion. LoginProfileNames captures the successful pending profile with its actual PlayerIO client and connectUserId, then accepts only that client's own initialized player's name. New login UI clears prior ownership; plugin teardown releases it. Uses latest profile storage, updates only the matching site entry or account-scoped Steam-name cache, preserves unrelated preferences/credentials, trims names to original 64-character limit, and avoids unchanged writes. Steam chooser now displays cached in-game account name separately from the platform label.

Verified local Haxe initPlayer calls addMe for connectUserId and initializes synchronously before returning. TypeScript/public compilation pass. No credentials inspected or network authentication executed; runtime name-caching verification remains pending with tests paused.

### Credential form source behavior and geometry — 2026-11-11

Ported Login.validateAddCredentials feedback: per-field uppercase errors, live token/ID lengths, numeric Kongregate IDs, Simple e-mail/password feedback, and submit enabled only for valid inputs. Corrected custom form to LoginInput geometry (underline y30, error row y35, source Russo font sizes, vertically chained fields and centered action buttons with 10px gap). Added source Simple-only underlined Forgot password link using the native recovery state. Back now returns from add to provider selection and from edit to profile chooser; chooser clears editing ownership. Added Enter submission on the native editor elements with repeat/IME-composition guards and cleanup.

TypeScript/public compilation pass. No live login, recovery request, UI test or deployment was performed. Exact rendered form spacing/font/input focus parity remains pending while tests are paused.

### Login cached keyboard listener correction — 2026-11-11

Current Haxe Login.onKeyPress only knows native site/register/password_recover states, and loginForm registers a cached bound closure before the port installs. The previous api.after method hook could not reliably observe that closure. LoginProfiles now explicitly replaces the registered stage keyDown binding, handles chooser/ported credential states with the original Enter latch and in-flight/countdown guard, delegates native recovery/registration handling, and restores the prior binding during teardown. DOM credential Enter handling shares the same latch to prevent the DOM and stage paths submitting twice. Native keyUp retains release ownership.

TypeScript/public compilation pass. Keyboard runtime/repeat/IME verification remains pending while tests are paused; no login or deployment performed.

### Recovery request and registration-back parity — 2026-11-11

Compared original core/login/RecoverDialog.as and RegisterDialog2.as with current Haxe. Recovery native implementation lacked recoveryInFlight and Cancel disabling. RecoveryRequest now guards the actual SDK invocation reached by the constructor-cached native button/keyboard callback, disables Cancel until native Recover reenable (including success-popup dismissal), ignores retired callbacks, and restores controls if the adapter is removed. Registration's native Cancel -> setState(site) is routed to the source provider selector instead of profile chooser. Recovery returns to chooser as in source.

Also checked responsive login layout: the original extra scaling/logo-hiding branch applies specifically to Flash projector warnings, so no browser-only reproduction of that branch was added. TypeScript/public bundle pass. No recovery emails, registration requests, live tests or deployment performed.

### Registration status restoration and provider navigation

- Compared original `Login.onConnectStatus` and `cancelRegistration` against the
  current Haxe listener and ported login navigation. Haxe restores its vanilla
  `loginContainer` after an empty registration status; the original restores the
  registration screen. Replaced the actual cached `connectStatus` listener on
  the registration dialog, with teardown restoring the native binding.
- Centralized provider selection navigation: Add, credential Back, and registration
  Cancel now clear editing/focus and set `qolaf-account-types`. Previously Add/Back
  left the preceding screen state active, allowing Enter to follow its handlers.
  Returning to the profile chooser also clears native input focus.
- Source audit exposed additional registration work still outstanding: Haxe's
  registration validation can continue when only password confirmation differs;
  it lacks the original in-flight guard and registered-profile persistence.
  These are not claimed fixed by the screen-restoration change.
- No account creation/recovery requests or live tests performed; runtime screen
  and focus behavior remains unverified while testing is paused.

### Registration request lifecycle port

- Added `login/RegistrationRequest.ts` around the existing native registration
  fields/buttons. Both the cached touch callback and keyboard method now use the
  original all-field validation gate, including password confirmation. Retained
  the current game's email validator and PlayerIO SDK call signature.
- Restored original pending-request guard, Confirm/Cancel locking, synchronous
  exception recovery, and field errors. Generic SDK errors stay on the form
  instead of hiding it behind an error-only connection status. Disposed screen
  callbacks are ignored and native button callbacks/method restored on cleanup.
- Successful registration stages a simple profile before the native fbConnect
  event. Existing handleConnect persistence/name-tracking then saves it with the
  selected profile. Credentials are not logged or added to build artifacts.
- This supersedes the preceding entry's outstanding validation/persistence gaps.
  Steam integration during registered-account login remains separately incomplete.
- Type-check/public bundle build pass. No live registration, recovery, or gameplay
  requests were invoked. Visual/form behavior and server callbacks remain untested
  under the user's continuing test pause.

### Native registration/recovery buttons and recovery keyboard guard

- Verified current Haxe LoginButton.onTouch calls its callback regardless of its
  `_enabled` flag, while the original guards callbacks and sets touchable/cursor/
  alpha. Added `login/NativeLoginButton.ts` to adapt the actual native buttons in
  registration/recovery, replacing their cached touch listeners and observing
  enabled changes. Native callbacks remain live for the request lifecycle hooks.
- Restored original button background height 41/alpha .7, label height 30/y 6,
  Russo size 12, disabled alpha .4, and no native frame/hover recoloring. All
  modified properties and listeners restore on plugin teardown. Source widths,
  existing colors and native positions remain intact.
- Recovery now guards its touch callback and direct keyboard onRecover method
  before native field validation, preventing duplicate Enter presses from
  changing errors while a request/success popup is pending. SDK guard remains.
- Type-check and public build pass; live touch/keyboard/render verification is
  still paused. Native recovery/registration input appearance remains to audit.

### Registration/recovery LoginInput presentation

- Compared original `core/hud/components/LoginInput.as` with current Haxe `Si`:
  native forms still had boxed black backgrounds/frames, left-aligned Verdana
  editor text, vanilla placeholder/error fonts, and full opacity.
- Added `login/NativeLoginInput.ts` for the existing recovery email and four
  registration inputs. Restores original white underline at y30, placeholder y4,
  Russo12 placeholder/Russo10 red error labels, centered Verdana14 editor and .7
  field opacity. Existing 250px widths, error y35/height15 and native field spacing
  already match and remain unchanged.
- Per-field cloned formats avoid mutating shared native static formats. Restores
  native formats/properties and removes the added line on teardown. Native DOM
  editors, password masking, error behavior and focus callbacks are retained.
- Browser tab sequencing remains unverified: Haxe setPrevious positions the next
  field but does not set the original Feathers nextTabFocus link. No live keyboard
  testing or account requests performed. Type-check/public build pass.

### Connection hint bitmap lifetime and authenticated keyboard teardown

- Original ConnectStatus.subText explicitly hides the label on empty/null values
  because Text can retain its previous bitmap. Port previously only assigned an
  empty string. `setLoginStatusHint` now updates both text and visibility; the
  native status setter is hooked too so ConnectEvent.update follows this rule.
- Restored original Login.updateStatus clearing its subtext for each new phase.
  Countdown ticks now update only connectStatus.text, as in the original, keeping
  the Ctrl cancellation hint until cancellation/connection changes the phase.
- Native handleConnect removes its original cached keyDown listener, which cannot
  remove the port's replacement. Explicitly detach the replacement at successful
  authentication. Teardown now restores the original keyboard listener only if
  still unauthenticated; otherwise it would reintroduce login handlers in-game.
- Source comparison and type-check/public build completed; no runtime login,
  keyboard or bitmap verification performed while tests remain paused.

### Login artwork resize and credit typography

- Original Login.scaleBackground fits artwork to stage width, caps it at native
  image width, centers it horizontally when capped, and vertically only when
  shorter than the stage. Current Haxe uses max(width ratio, height ratio), which
  enlarges/crops to fill. Added LoginArtwork to port the original sizing rule on
  initial attachment and subsequent native scaleBackground calls, with teardown
  restoring the native method/layout.
- LoginIdentity now uses original RussoBitmapFontRegistry.fontNameForSize(12)
  and disables pixel snapping rather than rendering credits with DAIDRR_16.
  Version 1.1.23 and Public/Private labels remain as original ClientVersion format.
- This establishes sizing semantics, not artwork pixel identity. Original uses an
  embedded astroflux_wide texture; comparison of that embedded asset with current
  upstream imagery remains outstanding. No runtime visual tests performed.
- Type-check and public bundle build pass.

### Exact original login background asset

- Resolved EmbeddedAssets.astroflux_wide to original assets/images/bg.jpg
  (1600x850). Copied byte-for-byte into src/assets/LoginBackground.jpg; SHA-256
  comparison confirms identity with the original source asset.
- Build embeds JPEG as a data URL in the existing single JS module. LoginArtwork
  decodes through native BitmapData, uploads a Starling texture and assigns it to
  the existing background Image, using its source dimensions for original sizing.
- Keeps the bitmap alive with its texture for native context restoration. Teardown
  restores the previous texture/dimensions before releasing owned GPU/bitmap data;
  late decode completion disposes its bitmap without touching a retired login.
  Decode/upload failure retains the upstream image and logs a noncredential error.
- This supersedes the prior unresolved original-artwork selection. It does not
  prove rendered parity: GPU upload, context restoration and visual comparison
  remain unverified while live testing is paused. Type-check/public build pass.

### User-functional-diff gate: beam resource ownership

- User clarified scope again: prioritize their functional changes, preserving
  updated vanilla behavior; stop cosmetic work. Future changes require evidence
  from vanilla-vs-client diff/history, then a check against current Haxe behavior.
- Beam emitter retention provenance verified: original commit c66e3a2 (`Fixed
  excessive particles and softened desyncs a little`) introduced createBeamEffect
  and retainUntilKilled. Existing current/diffs/core/weapon/Beam.diff confirms
  endpoint retention, first-shot play, line return, idempotent destruction and
  batch disposal are client additions, not merely old vanilla implementations.
- NativeBeamResources retains start/end emitters until explicit weapon release,
  plays first-shot start effects when fire was already enabled, kills/clears owned
  effects at destruction, returns line objects once, and disposes the mesh batch.
  Weapon is marked dead before releasing resources, matching source ordering;
  current Haxe destruction still runs. No firing, target, damage or shield logic
  is replaced. Emitter frame expiration respects retention and clears the flag on
  disposal so pooled objects do not inherit it.
- Source destruction is terminal; removed the invented reset of the destruction
  guard during init (the source never resets resourcesDisposed).
- Type-check/public build pass. Live beam firing/weapon-switch and GPU lifecycle
  checks remain unverified under the user's test pause. Factory-wide retention
  forwarding, notably teleport markers, remains a separate outstanding audit.

### Functional diff: teleport marker lifetime

- Source evidence: current/diffs/core/player/PlayerManager.diff adds retained
  destination markers and explicit cleanup on completion/cancellation. Current
  Haxe teleport still holds raw emitter references until delayed completion.
- Existing port tracked generations only through Emitter.reset; current native
  pooling retires emitters through dispose. Observe both available lifecycle
  methods, so stale delayed cleanup cannot kill a reused effect.
- Pin the returned destination markers with retainUntilKilled, using the source
  lifetime semantics already ported into EmitterFrames. Their particle bursts can
  finish without returning owned markers to the pool before transition cleanup.
- Current Haxe teleport packet headings, projectile retirement, cooldown and
  course application were inspected. This change does not modify those operations
  or add any server request; it fixes effect ownership in the existing port.
- Type-check/public build pass; gameplay testing remains paused. Long-channel,
  superseded-teleport and room-exit runtime verification remains outstanding.

### Functional diff: reflected render position and target-change interfaces

- GameObject.diff adds renderX/renderY/renderRotation and renderMirrored; Engine.as
  overrides render position with its interpolated ship mount. RenderPosition now
  installs those native-style getters, using the existing first-draw readiness
  tracking and source mount math. Existing own upstream getters are preserved.
  Cleanup removes only getters still owned by this installation.
- Callers already using read(..., 'renderX') (labels, aim indicator, map positions,
  torpedo cue) now receive the source interface rather than differing fallbacks.
  Emitter pose lookup uses the same engine override. Simulation positions/courses
  are not written. Actual high-refresh rendering remains unverified.
- Prior local target changes restore the custom game's targetSystem exposure,
  unit/oldUnit aliases and target_updated_event via native OpenFL dispatcher.
  Event target is the TargetSystem and clones retain targetSystem. Session cleanup
  releases listeners/restores any previous game property. Selection logic retains
  source cooldown, range, lock and priority rules.
- TargetInfo also now skips zero-row scans/collapsed-row updates, clears snapshots
  on row-count changes without resetting the scan budget, and skips recovery/exit
  updates, matching the user's TargetInfoElement (not a vanilla game rollback).
- Type-check/public build pass. Runtime tests remain paused; these changes do not
  establish completed gameplay or target UI parity.

### Functional diff: pooled render state and shared pose consumers

- GameObject.diff explicitly clears hasRenderPosition on removeFromCanvas, not
  only reset/add. Added missing removal hooks for base objects and projectiles.
- Restored source GameObject.get_lifecycleId: starts at zero, advances as unsigned
  32-bit on base reset. Preserves any existing native implementation. Engine's
  independent reset guards remain in their consumers, as its reset skips base.
- CombatTextFrames and BeamRenderGeometry now prefer restored render pose getters,
  retaining their previous coordinate fallbacks for other objects. Beam rotation
  follows the same getter. No simulation-coordinate writes introduced.
- Type-check/public build pass. No live rendering or gameplay tests performed;
  source alignment does not prove frame-rate parity.

### Combat-text source audit: anchor offsets and generic particle API

- Compared current CombatTextFrames/CombatTextLayout against original
  TextParticle.assignSourceOwner/followSourceRenderPosition, TextHandler.add,
  Ship.draw, Turret.drawAttachedCombatText and Spawner.drawAttachedCombatText.
- The standard draw anchors are constants: ship -15/-15, turret -20/-5,
  spawner -25/-10. Current combatTextAnchor matches all three. The missing
  dynamic anchor-offset field does not by itself prove a standard gameplay bug;
  do not add changing offsets based on lastDmgTextOffset/lastHealTextOffset.
- Remaining API gap confirmed: original TextHandler.add accepts maximumRise,
  sourceUnit and sourceSlot after noWrap. CombatTextLayout currently drops those
  arguments; CombatTextFrames only attaches via createDmgText with a hard-coded
  120 rise limit. Direct custom callers therefore cannot request the original
  bounded/owner-attached particle behavior. Port this generic path, including
  pool reuse and minimumY shifts, before claiming full TextHandler parity.
- Read-only source audit; no runtime tests or network requests. High-refresh
  visual parity remains unverified.

### Incoming echo response restored from the custom diff

- Source: current/diffs/core/hud/components/chat/MessageLog.diff, added
  writeChatMsg branch at lines 1121–1129; original ClientVersion.BUILD_LABEL.
- NativeChatPresentation now handles exact incoming `echo.` before display/team
  filtering, after the native scene/string/250-character guard. Requires a local
  player and a different sender ID. Global/private requests reply privately to
  the sender name; all other channels reply locally, using original argument order.
- ClientEcho shares the source-colored release label with local /echo, using
  requested version 1.1.23, compile-time build identity and current server version.
  IPC /spececho remains a separate protocol.
- TypeScript check, public build and formatting check passed. No live chat was
  sent and no runtime tests were run (tests remain paused). Other response
  handlers are not signed off by this change.

### Correction: preserve current vanilla login artwork

- User clarified the old background is a vanilla game-update difference, not
  a custom feature to port. Removed LoginArtwork and its embedded legacy JPEG,
  including the old scaleBackground override. LoginProfiles now leaves the
  current game texture, dimensions and resize behavior under native ownership.
- This supersedes the earlier “Exact original login background asset” entry.
  Account management, login version/credits and custom controls remain installed.

### Login pipeline: parallel startup and separate status lines

- Source evidence: Login.diff handleConnect/preloadComplete/onJoinedServiceRoom/
  tryCompleteLoginLoading, Preload.diff, LoadingBar.diff and JoinRoomManager.diff
  scanCurrentSolarSystem/deferred prepared room. The current Haxe client waits
  for preloadComplete before joining Service, then immediately tears login down.
- Added LoginLoading: asset requests overlap Service discovery; the joined
  returning-player snapshot starts native room selection while assets remain
  pending. createJoin is deferred until asset readiness and scan completion.
  Native selection criteria/session/protocol remain authoritative. Prepared rooms
  are consumed once instead of scanning twice; level-zero players wait for
  service/assets and enter native setup without an early game join.
- Added LoginLoadingStatus using native bitmap elements: source texture progress,
  network phase and retry-detail lines; original size/gap/centering rules. Removed
  the native 300 ms completion fade for managed preload and hidden the duplicate
  credential status. Native embedded-library readiness remains required.
- Remaining: native loadData still initializes the cache before dispatching its
  asset requests; the earlier QoLAF listener-before-request/cache-after-request
  ordering needs its own adaptation. Startup stale-account retry classification,
  cancellation, connection recovery and in-world readiness/watchdogs are not
  completed by this change. Full login flow remains unverified at runtime.
- Type-check and public build passed; tests remain paused. No login/network
  request initiated during implementation.
- Corrected echo receive reply ABI after inspecting local Haxe sendToServiceRoom:
  fields must be an array, preserving original payload ordering and routing.
- FriendManager diff review: current vanilla already supplies detached callback
  fan-out and a 3-second timeout. Keep those current implementations; remaining
  reconnect-specific behavior is not yet reconciled.

### Login pipeline follow-up: request/listener/cache ordering

- Applied Preload.diff's listener-before-download and request-before-cache order.
  Service discovery starts first; texture and current Haxe embedded-library
  requests start before cacheCommonData. Cache completion is now an explicit
  gate, so immediate Service/asset callbacks cannot scan uninitialized data or
  transition early. Supersedes the previous cache-ordering gap.
- Managed texture callbacks detach on completion, failure and plugin cleanup.
  Retained Haxe's embedded-library readiness and existing error policy.
- The Service joined listener is attached before manager.init, detached on its
  first response, and removed on cleanup. The native initializer attached it
  after init; that ordering could lose an immediate completion.
- Type-check, public build and formatting pass. No live account or gameplay
  tests. Startup retry/recovery and full visual parity remain unfinished.

### Startup retries and plugin typing requirement

- StartupServiceJoin ports the custom diff's temporary stale-account message
  normalization, three retries/2000 ms delay, candidate teardown, generation
  guards, terminal duplicate-login/kick/disconnect handling, and promotion only
  after a connected joined handshake. Current Haxe session/version fields and
  Service ping ownership are retained. Retry details update independently.
- User requires real typing across the entire plugin: no Raw/any escape hatches.
  Initial audit found 346 source files containing Raw, any or suppression.
  Generated Game.d.ts still has erased member types and must be strengthened;
  substituting its class names alone does not satisfy this requirement.
- LoginLoading, LoginLoadingStatus and StartupServiceJoin now use reflected
  named classes, typed instances/events/messages and GameReflection hooks instead
  of Raw and constructor-as-any casts. This is an intermediate migration, not
  a claim of complete typed member signatures or plugin-wide completion.
- Type-check passes; runtime tests remain paused. Startup retry behavior has not
  been exercised against live service connections. Recovery after entering the
  game remains unfinished.

### Declaration reconstruction: startup and SDK signatures

- Generator now preserves reviewed signatures in scripts/types/Signatures.json
  and rejects disappeared classes/members. Added 71 member signatures and
  constructor argument tuples covering startup room joins, SDK connections,
  messages, multiplayer requests, errors, preload and loading bitmap controls.
- Checked current Haxe wrappers (including real JS rest parameters, message
  arrays, callback shapes and optional bitmap constructor arguments) against
  original/vanilla SDK sources where present. No blanket AS3 signature copying.
- Declaration member names no longer have unnecessary quotes. Haxe constructor
  metadata no longer uses any; known constructors have named argument tuples.
  Unreconstructed fields/methods still remain and full typing is not achieved.
- Compiler check and public build passed; a standalone declaration check with
  skipLibCheck=false also passed before the final bitmap signature expansion.
- User requested a final familiarity pass after functional completion: compare
  labels, statuses, hints, tooltips, errors, punctuation, spacing and alignment
  against original QoLAF, preserving intentional current vanilla changes.

### Login state typing and explicit readiness checks

- Added ServicePlayerInfo from the actual joined-message decode order. Native
  login/manager snapshots are Partial until the handshake; LoadingAttempt stores
  the complete event snapshot before scanning or finalization.
- Added signatures for login lifecycle methods, nullable authenticated client,
  preload/managers, ConnectStatus, audio setters, texture progress, display
  getters/setters and arbitrary event data (unknown until its event contract
  narrows it). Login's joined event narrows data to ServicePlayerInfo.
- These types exposed missing client/snapshot assumptions in LoginLoading. Added
  explicit authentication/stage/service initialization checks and snapshot gates.
  New loading/status/startup join code now uses declared native getters instead
  of dynamic read() calls.
- Project type-check, standalone declaration check with skipLibCheck=false and
  public build pass. Runtime tests remain paused; complete typing and connection
  recovery parity are still outstanding.

### Reflection hook typing

- GameReflection no longer contains Raw, any, or callback-as-any casts. Method
  keys/parameter tuples/return values are preserved through typed API overloads.
  Metadata traversal inspects unknown values, and cached bind lookup narrows the
  cache entry to a callable before retaining the original method signature.
- Removed the unused dynamic class lookup escape hatch. Typed hooks deliberately
  reject open string-indexed objects; remaining legacy callers still use the old
  overload and must migrate before that overload can be deleted. APIScope and
  rich-input hook forwarding now declare their parameter tuples explicitly.
- Formatting, compiler check and public build pass. No runtime tests executed.
- Next login callback migration evidence: current RecoverDialog.onRecover calls
  QuickConnect.simpleRecoverPassword(gameId,email,success,failure); success has
  no arguments and failure receives PlayerIOError. RecoveryRequest still has
  variadic-any callbacks and LoginProfiles remains a legacy Raw caller.

### Typed password recovery callbacks

- RecoveryRequest now imports Login/PlayerIO and the native RecoverDialog type
  from game/Bindings.ts. It accepts the actual dialog instead of a Raw login
  container, uses typed reflection hooks and calls the declared visible getter.
- Replaced variadic-any callbacks with the current wrapper's exact contract:
  success() and failure(PlayerIOError). Preserved pending-request guarding,
  cancellation locking, disposed callback rejection and teardown behavior.
- Added preserved SDK/recovery-dialog/login-button/input signatures. Updated the
  existing LoginProfiles call to pass its recovery dialog. LoginProfiles and
  other callers still need migration; this does not establish full login typing.
- Project compiler check, standalone declaration check (skipLibCheck=false) and
  public build passed. No password-recovery requests or runtime tests were sent.

### Typed registration form and SDK request

- RegistrationRequest now accepts RegisterDialog2 and imports native classes
  from game/Bindings.ts. Typed LoginInput, Client and registration failure fields
  replace Raw; the last-child Cancel lookup is checked with runtime class
  reflection instead of assumed to be a button.
- Preserved the exact Haxe 12-argument simpleRegister contract, checked against
  the current wrapper and vanilla SDK parameter names. Current email validation,
  original all-field gate, in-flight guard and callback cancellation remain.
- Added declaration signatures for registration controls, SDK registration
  errors, Localize, Starling stage access and child lookup.
- Added errorMessage(unknown) to preserve messages on plain Haxe/SDK error
  objects in registration and startup join catch paths; instanceof Error alone
  would discard those messages.
- Formatting, project type-check, declaration check with skipLibCheck=false and
  public build passed. No registration requests or runtime tests performed.

### Typed saved-profile state

- Extracted Profile/provider normalization into LoginProfile.ts, retaining
  re-exports from LoginProfiles for existing consumers. Array entries are now
  narrowed from unknown instead of inheriting Array.isArray's implicit any[].
- LoginProfileState describes selected account, auto-login, Steam integration,
  normalized site profiles and Steam name cache. Both chooser and authenticated
  name persistence decode storage through that contract; no state:any or
  storage.get<Raw> remains on those paths.
- Login success/handleConnect/name-cache ownership use the declared Client type.
  Failure receives unknown and uses errorMessage; generation cancellation and
  30-second timeout behavior remain unchanged. Provider SDK channel wrappers
  and the rest of LoginProfiles still require typing migration.
- Compiler check and public build pass. No stored credentials inspected, login
  performed or runtime tests run.

### Provider channel declarations and authenticated name cache

- Verified channel.connect and channel.kongregateConnect argument order against
  the locally cached PlayerIO SDK. PlayerIOChannel.ts declares their conversion
  callbacks and authentication response; global channel construction no longer
  casts globalThis to Raw. QuickConnect and PlayerIOSDK use central bindings.
- The SDK client returned by convertFor is still opaque (unknown) at Client.wrap;
  this is an outstanding SDK declaration gap, not complete typing coverage.
- LoginProfileNames now uses GameScene, Client and PlayerManager declarations,
  native get_me/get_name/get_isLeaving, and a typed initPlayer hook. Central
  bindings initialize before this hook is installed. The authenticated client,
  user and profile ownership checks remain in place.
- Reviewed native initPlayer's message/optional offset/returned offset contract
  and the relevant player/scene getters in the current local Haxe bundle.
- Project type-check, standalone declaration check (skipLibCheck=false), and
  public build passed. No live authentication or runtime tests were performed.
- Final user-visible text comparison remains pending until the functional port
  is complete; do not treat the earlier text fixes as that final audit.

### TextHandler optional source/rise arguments (source port; live comparison pending)

- Compared TextHandler.diff and original TextParticle.assignSourceOwner,
  setMaximumRise, followSourceRenderPosition and releaseSourceOwner, plus
  Unit.followAttachedCombatTextAt and current Haxe TextHandler/TextManager.
- CombatTextFrames now consumes the original trailing add arguments: maximum
  rise, source unit and source slot. An unspecified/NaN rise remains unlimited;
  negative rise becomes zero. Ownerless text can also use a limit. The existing
  current-game damage adapter retains its original-client 120-unit limit.
- Source alignment happens on creation. Recognized damage/healing slots follow
  rendered poses and subclass anchors while preserving accumulated drift;
  unnamed source slots receive initial alignment only, matching the original
  Unit draw path. Reset removes both source and rise-limit state from the pool.
- Current-game zoom compensation remains. Native physics coordinate writes do
  not replace attached particles' saved render coordinates.
- Migrated CombatTextFrames to native bindings/getters and typed hooks; no Raw,
  any or dynamic read calls remain in this file. Added reviewed native member
  signatures; QoLAF's extra add arguments are a separate extended interface.
- Fixed declaration generator lookup of reviewed member overrides to use own
  properties: adding Unit/Point signatures exposed inherited toString being
  emitted as JavaScript instead of a TypeScript signature.
- Existing fixture types/getters updated for the typed boundary and central
  binding initialization. Tests were not executed, per the paused-test request.
- Project type-check, standalone declarations and public build passed. Runtime
  and refresh-rate visual comparison remain unverified. This does not finish
  the generic TextParticle method API, full text/render audit, or full port.

### Original TextParticle ownership/rise method API

- Added typed CombatTextParticle interface and installed the original seven
  ownership/rise methods on the native particle prototype: setMaximumRise,
  setMaximumRiseOrigin, shiftMaximumRiseOrigin, clampUpwardTravel,
  assignSourceOwner, followSourceRenderPosition and releaseSourceOwner.
- Methods share the frame updater's state. Reassignment releases the previous
  source slot with its lifecycle guard; release preserves rise limits; reset
  clears them. Reassignment shifts an existing limit rather than silently
  rebasing it to the already-risen particle. Explicit clamping updates saved
  render coordinates so the next frame cannot undo it.
- Explicit follow calls validate source identity/lifecycle and retain drift
  while applying changes in render pose and anchor. Automatic following stays
  restricted to current damage/healing slots for the original add API.
- Prototype descriptors are restored on plugin cleanup without overwriting
  another plugin's subsequent replacement. Existing mock API includes defer.
- Reviewed against original TextParticle.as and Unit.followAttachedCombatTextAt;
  project compiler/build verification only. Runtime tests remain paused, and
  full text/particle parity (including measurement APIs/debug counters) remains
  open. This is not proof of full rendering or client parity.

### Typed provider authentication and request cancellation

- Moved simple, Kongregate and Armor Games authentication out of LoginProfiles
  into LoginAuthentication.ts using central Login/PlayerIO/QuickConnect/SDK
  bindings and typed stage, profile, response conversion and Client callbacks.
- Reconstructed both native QuickConnect.simpleConnect call forms (with and
  without segments) from the local Haxe splitArgs implementation. The lower
  SDK client at Client.wrap remains an explicitly opaque declaration boundary.
- LoginAttempt now owns an AbortController. Retiring an attempt invalidates its
  generation before aborting, so synchronous abort listeners cannot revive it.
  Stale signal lookups return an already-aborted signal. Armor Games fetch and
  response-body consumption share the same cancellation/30-second timeout as
  the chooser; no independent HTTP timeout continues after Control/disposal.
- SDK calls do not expose transport cancellation here; their success/failure
  callbacks are gated by the retired signal and existing generation check.
  This is not a claim that PlayerIO's in-flight SDK request is aborted.
- Confirmed Control, failure, native handleConnect and profile disposal all
  retire the attempt. Existing login status strings and provider payloads are
  unchanged. Project type-check passed; no live authentication or runtime tests.

### Profile selection versus last authenticated account

- Compared Login.preferredProfileId, onProfileSelectionChanged,
  onAddCredentials, onRemoveLoginProfile and onSteamIntegrationChanged against
  the current chooser. Found the port persisted every highlighted/new profile
  as the next auto-login account, unlike the original lastLoginProfileId.
- Persisted selected now represents the last authenticated account. Highlighting
  another row only cancels countdown/clears status; adding credentials highlights
  the new row without changing auto-login. Editing the last authenticated
  profile carries its ID forward, matching the original. Deleting that profile
  clears the remembered ID rather than selecting a replacement for auto-login.
- Typed preferredProfileId selects the remembered enabled row, then the first
  enabled row, then the first row when all are disabled. Used on initial display,
  chooser return, Steam integration changes and profile removal.
- Auto-login toggles and selection clear prior errors. Selection listener is
  removed on disposal. Removal checks site/removable flags and stops countdown.
- Existing stored selected IDs are retained: the previous port did not record
  whether they came from authentication or selection, so history cannot be
  reconstructed. New writes follow the original semantics.
- Source/format/compiler/build checks only; runtime tests remain paused and UI
  selection/automatic-login behavior still needs live verification.

### Native login button typing and source comparison

- Compared Login.validateAddCredentials with LoginCredentialErrors: provider
  messages/length feedback and submitted-versus-live validation match. Changed
  its import to LoginProfile so pure validation no longer loads LoginProfiles
  and its UI/authentication dependencies through a circular import.
- NativeLoginButton now accepts the declared LoginButton instance and uses
  typed TextField/TextFormat/Quad/Sprite members and display getters. TouchEvent
  uses its actual getTouch return contract. No Raw/any/read calls remain in the
  adapter; the ported font-registry resolver is still a legacy boundary.
- Replaced manual hx__closures__/__id__ lookup and listener removal/restoration
  with GameReflection.replaceListener. The enabled setter hook is typed.
- Verified original LoginButton.as guard, touchability, cursor, alpha, label
  metrics and font selection against the adapter; preserved those behaviors.
  Verified current Haxe constructor and LoginInput.frame return shape for the
  native field declarations. Signature validation located useHandCursor on
  DisplayObject rather than assuming Sprite owns it.
- Project type-check passed. Runtime/UI tests remain paused; this source audit
  does not prove keyboard focus, alignment, or full login-screen visual parity.

### Native login input declarations

- NativeLoginInput accepts declared LoginInput instances and uses typed child,
  placeholder/error TextField, format and TextEntry access. Quad and the OpenFL
  NativeTextFormat constructor now come from game/Bindings.ts; removed both
  constructor casts and all Raw/read usage from this adapter.
- Reconstructed native LoginInput constructor fields, TextEntry.textFormat and
  setter return, Starling format cloning/alignment/color and child insertion
  from the current local Haxe bundle. Quad/OpenFL TextFormat constructor tuples
  retain the actual argument order (including native alignment enum value).
- Compared original LoginInput.as: underline, placeholder offset, font sizes,
  centered input/error formats, alpha and error casing agree with current
  adapter/native behavior. Current browser TextEntry focus listeners remain.
  Native setPrevious has no old Feathers nextTabFocus assignment; DOM keyboard
  traversal still needs the deferred live comparison, not an assumed match.
- Project type-check passed. Full declarations/build checked separately; no
  runtime tests or account requests. Legacy ported font resolver remains an
  outstanding typing boundary, and whole-plugin typing is not complete.

### Direct typed font registry imports

- Replaced the resolver-created font registry factory with exported
  RussoBitmapFontRegistry and VerdanaBitmapFontRegistry classes. Native login
  adapters now import Russo directly; their font-size selection no longer
  crosses the untyped ported resolver. Legacy reflected names resolve to these
  same exported classes for remaining callers.
- Both registration accessors return declared native BitmapFont instances using
  the central StarlingTextField binding. Added the current Haxe getBitmapFont
  contract (nullable compositor cast). Atlas installation remains loadFonts'
  responsibility, as before; this refactor does not claim the original embedded
  asset restoration pipeline is fully ported.
- Compared size thresholds, invalid/NaN/large-size fallbacks and atlas aliases
  against both original registry sources. No selection behavior changed.
- Removed obsolete FontRegistries factory and its references. Project type-check
  passed; standalone declaration/build verification performed separately. No
  runtime/font rendering tests were run while testing is paused.

### Parallel loader terminal texture failure

- Current Haxe onImagePreloadFailed removes texture listeners and shows a reload
  message; original QoLAF overlaps network discovery with assets. The port had
  no shared failed state, so its parallel network branch could keep scanning
  and replace the texture failure status after native asset loading stopped.
- Added attempt identity/failed guards shared by finish, scan, texture and
  embedded callbacks, joined events, service-room selection, retry creation,
  prepared-room completion and game-room handoff.
- Texture failure first marks the attempt failed, detaches joined notification,
  cancels startup retries/candidate callbacks, stops service ping and disconnects
  a service socket already promoted for that startup attempt. Late createJoin
  results are rejected by StartupServiceJoin's existing current-attempt guard.
- Synchronous texture failure prevents starting the later embedded/cache branch.
  Success keeps the parallel readiness gates and current Haxe embedded-library
  error policy. No changes to live-game mechanics or reconnect policy.
- Source review and project type-check passed; build verified separately. No
  runtime failure injection or account connection performed while tests are
  paused. General startup error recovery/reconnect parity remains incomplete.

### Initial service-list callback ownership

- Original JoinRoomManager.init checks startup generation and locator identity
  on both listRooms outcomes. Current Haxe init lacked those checks; port's
  parallel startup previously guarded joins but not the listing failure popup.
- Wrapped only the listRooms calls issued during managed native init. Both
  captured callbacks now require the same current, nonfailed loading attempt
  and manager locator. The temporary interception is restored in finally;
  subsequent gameplay listings retain their normal callbacks and behavior.
- Shared startup current-attempt checks now include JoinRoomLocator identity,
  preventing an old manager's response from continuing after replacement.
- Diff confirmed the old 40-user service auto-selection threshold was vanilla,
  not a custom feature. Kept current Haxe's 195-user threshold and stricter
  service-ID parsing. Existing NativeIPCAuthentication already excludes the
  reserved IPC service and blocks direct joins; no duplicate filter added.
- Project type-check and public build passed. No live listing/authentication or
  runtime tests performed. Full connection-recovery/warp transition parity is
  still open; these checks cover initial startup ownership only.

### Service RPC socket ownership

- Compared SceneBase.rpcServiceRoom/forgetPendingRpcHandler/clearPendingRpcHandlers
  with current Haxe. Native Haxe removes the one-shot reply from the current
  serviceConnection, not the original sender, and lacks the custom lifecycle
  guard. This could leave old socket handlers behind and invoke stale UI code.
- Added typed ServiceRPC per-session implementation using captured Connection,
  Message callback, generation and pending request records. Reply handlers are
  detached from their sending socket before user callbacks, and discarded on
  leaving, replacement, disconnection, disposal or generation mismatch.
- Pending requests are released on replaceServiceConnection/disconnect/session
  teardown. Handler-removal failures on a closed socket do not stop remaining
  cleanup. Duplicate queued replies cannot invoke a consumed request twice.
- Kept current Haxe's third-argument values array and native Message.add/send
  behavior. Installed beneath NativeConnectionHealth's outer wrapper to retain
  passive timing; leaving scenes no longer create a spurious health sample.
- This applies to requests made after game-session installation; preinstallation
  RPCs and the broader connection-recovery state machine still need auditing.
  Unavailable transport is skipped, without inventing a new recovery policy.
- Project type-check passed, with standalone declarations/build checked
  separately. No network calls or runtime tests performed while tests are paused.

### RPC protection before game readiness

- Inspected host lifecycle: onGame is emitted after runGameLoop, and HUD setup
  additionally waits for ensureFonts. The previous instance-level RPC hook was
  therefore too late for initialization requests.
- ServiceRPC now hooks the declared SceneBase prototype at classesReady and
  keeps independent typed pending/generation state per scene. Initial, loading,
  and post-ready calls use the same socket-ownership rules without a font wait.
- Base-scene and Game exit, scene disposal and plugin unload retire/clear owned
  handlers. A retired-scene guard prevents reentrant teardown from creating new
  requests before native _leaving is set. Disconnect/replacement clear pending
  requests while retaining the live scene's ability to reconnect.
- Moved passive NativeConnectionHealth installation to synchronous onGame before
  ensureFonts. Its instance hook wraps the prototype ownership implementation;
  neither install is duplicated in the later HUD installer. Health sampling
  still starts at gameReady; this change does not claim earlier latency samples.
- Project type-check/build verification performed; live startup/exit tests remain
  paused. Full recovery state-machine and whole-client parity remain incomplete.

### Persistent service subscription ownership

- Compared original SceneBase.add/removeServiceMessageHandler and
  replaceServiceConnection with current Haxe. Native replacement reattached
  callbacks without removing old message handlers; duplicate adds also retained
  the earlier callback. Ported source ownership via typed ServiceMessageHandlers.
- Captured wrappers check their registered socket, current subscription identity,
  connected state and scene lifetime. Same-type replacement removes the previous
  wrapper. Removal detaches from its actual source even after socket changes.
- Replacement detaches old wrappers, updates the Haxe callback map, lets native
  code own disconnect-handler rebinding, and updates serviceRoomId. Same-socket
  and disconnected/null replacements do not duplicate listeners. One-shot RPCs
  are not replayed; unchanged/rejected sockets no longer clear pending RPCs.
- Scene exit/dispose retire subscriptions. Plugin cleanup restores original
  callbacks for still-live scenes instead of silently dropping game handlers.
  NativeTraffic continues observing real Connection wrapper handlers.
- Installed at classesReady, before scene initialization. Native reconnect
  scheduling remains authoritative; full original recovery semantics are still
  outstanding. Compiler/declaration/build checks only, no runtime tests while
  paused, and no live service requests were made.

### Service disconnect listener ownership

- Compared original attachServiceDisconnectHandler with current native
  joinReady/replaceServiceConnection. Native registers a cached method closure
  with no source/generation guard; a queued old-socket event could therefore
  invoke recovery against the current service.
- Added typed ServiceDisconnect at classesReady. After native listener
  registration it replaces the cached Haxe closure with a captured socket/watch
  identity guard, checking scene retirement/leaving and one-shot delivery before
  invoking the current game's handleServiceDisconnect implementation.
- Valid socket replacement detaches the previous watch. Same-socket repeats do
  not duplicate it. Scene exit/disposal retire watches; plugin cleanup restores
  the original native closure on an active, connected socket.
- Current native recovery scheduling remains unchanged. Initial service loss
  before native joinReady registration and full original recovery orchestration
  remain open; this does not establish complete reconnect parity.
- Project compiler passed; standalone declaration/build checked separately.
  Runtime disconnect injection remains paused and no live requests were sent.

### Shared outbound message guards

- Original SceneBase.sendToServiceRoom strips Global chat HTML at the shared
  send boundary; current port only did so in individual composers. Added typed
  SceneMessages at classesReady so native/plugin sends receive the same guard,
  with empty stripped messages suppressed. Copies the Haxe values array before
  editing it because, unlike AS3 rest args, it belongs to the caller.
- Game/service send entry points now skip leaving scenes and disconnected/null
  sockets. Service sends also validate socket identity. A transport-race failure
  on a disconnected socket is suppressed, while a payload/programming failure
  on a still-connected socket is rethrown, matching source trySendServiceMessage.
- ServiceRPC shares this helper and removes its pending listener when a guarded
  send fails. Current Haxe array payload ABI and NativeTraffic's observation of
  actual Connection.sendMessage remain intact. No additional network probes.
- Current native disconnect recovery is preserved. Original onServiceUnavailable
  orchestration is not yet ported, so proactive recovery before native listener
  registration remains an explicit gap, not a completed recovery claim.
- Project compiler passed; declaration/build checks performed separately.
  Runtime tests remain paused; no chat messages or live requests were sent.

### Game-room and prebuilt-message RPC ownership

- Compared original SceneBase.rpc/rpcMessage with current Haxe and inspected the
  newer rpcServiceMessage API, whose returned function cancels the reply handler.
- Generalized ServiceRPC to SceneRPC with separate typed game/service request
  sets. rpc, rpcMessage, rpcServiceRoom and rpcServiceMessage now use captured
  socket/type/lifetime ownership, cleanup before callback, and stale/duplicate
  response rejection. The Haxe values-array ABI remains unchanged.
- Kept rpcServiceMessage's cancellation function, now idempotent and tied to the
  sending socket; it cannot accidentally remove a handler from a replacement
  connection. Game RPC sends still go through scene.sendMessage, while service
  RPCs use the shared service transport guard.
- Service replacement clears service RPCs only. Disconnect/exit/disposal/unload
  clear the scene's pending sets. No RPC is replayed and no speculative timeout
  or network request was added. Public request correlation remains vanilla's
  per-message-type behavior, not an invented protocol change.
- Removed old ServiceRPC module/import and installed SceneRPC at classesReady.
  Project compiler passed; standalone declarations/public build checked
  separately. Runtime RPC/reconnect tests remain paused and parity is unproven.

### Game-room persistent handler ownership

- Compared SceneBase.addMessageHandler/removeMessageHandler against the original
  client. Game-room registrations of the same type coexist; unlike service
  registrations, adding another must not detach the preceding callback.
- GameMessageHandlers now retains each typed subscription separately, captures
  its socket, ignores retired/leaving scenes and stale sockets, and removes the
  latest dictionary wrapper using the original removal semantics. Exit/disposal
  detach all tracked wrappers. Plugin unload restores all live callbacks.
- Installed at classesReady using central SceneBase/GameScene bindings. Native
  traffic observation remains responsible for accounting; no duplicate RX count.
- Project typecheck, standalone declarations and public build passed. Runtime
  tests remain paused. Original unreadyGameAbandoned/initialNetworkReady and
  observeGameJoinResponse recovery orchestration remain unported.

### Final familiar-text comparison — pending functional completion

- Required follow-up after the functional source port: compare client-added
  labels, button captions, login/connection statuses, errors, confirmation text,
  settings descriptions/tooltips, chat responses and help/version/credits with
  the original QoLAF source and screens.
- Check punctuation, capitalization, placeholders, numeric formatting, wrapping,
  alignment and truncation. Record the source location and port location for
  each discrepancy; fix accidental differences rather than rewriting copy.
- Preserve intentional current-game changes and browser-specific omissions
  already requested (including radio). Do not restore outdated vanilla text or
  mechanics merely because they appear in the old client.
- This is a pending acceptance pass, not evidence of completed visual parity.

### Typed connection-health integration

- NativeConnectionHealth now uses GameScene/Connection declarations, typed
  GameReflection hooks and the central MessageLog binding. Service callbacks
  use the actual Haxe message and values-array signatures rather than Function,
  variadic unknown arguments or Raw. The onGame boundary validates the native
  class before entering the typed module.
- Reviewed Clock.connection/latency, SceneBase.clock, Player.get_isWarpJumping,
  Game.noAutoReconnect and MessageLog.write directly in the local Haxe bundle;
  regenerated declarations from those signatures.
- Removed health checks of nonexistent native warpJoinPending and
  autoReconnectAllowed fields. Current native warp state and noAutoReconnect
  now gate observation. This does not implement the old client's pending-warp
  or recovery state machines; those remain separate outstanding work.
- Project typecheck, standalone declaration check and public build passed.
  No runtime tests or network probes were executed. ServiceGameReadiness and
  other remaining legacy modules still require their own typing pass.

### Service timing follows actual RPC ownership

- Original SceneBase.updateConnectionHealth reads pending service RPCs directly.
  The port's independent monitor hook tracked only rpcServiceRoom, missed
  rpcServiceMessage and could retain a sample after the real RPC was cancelled,
  rejected at send, or removed on disconnect.
- Moved timing into SceneRPC's service request lifecycle, shared with the monitor
  through typed ResponseSamples. Both service entry points register there;
  accepted replies record timing before the caller executes, and cancellation,
  failed sends, stale replies and disconnect remove the pending token. Scene
  replacement/clear/disposal reset the owned samples.
- The frame monitor only reads shared service samples. It no longer resets them
  when it observes a replacement on a later frame, which would erase requests
  already sent by the new socket. Clock samples retain their own ownership.
- Compared source expected-reply accounting (including error payloads) and
  oldest outstanding request semantics. No extra messages or retry policy added.
- Typecheck and public build passed. Runtime cancellation/reconnect checks remain
  paused; full initial-world/recovery orchestration is still outstanding.

### Loading-cover transition source port

- Compared original FadeScreen show/fadeIn/fadeOut/cancelFadeOut/completeFadeOut
  and repositionScreen with the local Haxe implementation. Added LoadingCover
  using typed native FadeScreen/Starling bindings, installed at classesReady.
- Cover placement now stays at the stage root/front, including before a
  synchronous fadeInComplete can trigger scene work. Repositioning no longer
  embeds the cover in a scene overlay where later UI could draw over it.
- Replaced native stepped fade-out with source 250ms Quad ease-out from the
  current alpha and a 500ms completion fallback. Repeated fadeOut is idempotent;
  show/fadeIn cancel it and dispatch fadeOutCancelled. Timer and frame ownership
  are released on cancellation, completion, disposal and plugin cleanup.
- Keep spinner/text visible through the fade; stop the hidden typewriter and
  native update listener at completion. Promotion overlay hides at fade start.
  Native completion still owns PvP-list cleanup and fadeOutComplete dispatch.
- Reviewed generated member signatures from the local bundle. Project compiler,
  standalone declarations and public build passed; no runtime tests executed.
- Not full initial-world parity: static-cover presentation acknowledgement,
  background readiness/timeout, recovered-game notification and the deferred
  initial-world reveal gates remain outstanding. Live transition/layering
  verification is pending, as are remaining native FadeScreen disposal changes.

### Loading-cover disposal

- Inspected the complete current FadeScreen constructor/prototype: zero
  assignments to tween/tween2, but two unconditional .kill() calls in dispose.
  Native disposal would throw before finishing its cleanup.
- Replaced that method with the original client's cleanup, adapted to typed
  Haxe objects and cached listener identities: stop/reset both timers, remove
  timer listeners, stop/dispose screen text, remove the cover and promotion,
  dispose the PvP list, remove frame/resize listeners and dispose the background.
  Repeated disposal returns without disposing the same resources twice.
- Source-only legacy tween calls are absent. Active custom fades are cancelled
  before native resources are released. Project typecheck, standalone
  declarations and build pass. Runtime checks remain paused.
- Static-cover render acknowledgement and its integration into room-transition
  teardown remain open; this change does not claim those are implemented.

### Typed service readiness and initial enemy synchronization

- Current Haxe tryRunGameLoop checks six initial-data flags, sends
  initSyncEnemies and starts the loop. Its update reveals the canvas only after
  synchedEnemies becomes true. The prior service-readiness fallback treated
  those six flags alone as a ready world and enabled dependent features early.
- Require the separate synchronization flag as well. Preserve explicit original
  initialWorldIsRevealed/recovery getters when available and the connection-only
  mode used by features that must attach before world reveal. This does not
  change native packet handling, game-loop startup or gameplay.
- ServiceGameReadiness now uses a typed structural view of GameScene/Connection
  and explicit source accessors, without Raw, dynamic property names or generic
  read calls. All seven native flags have reviewed boolean declarations.
- Updated the existing readiness fixture to include synchronization and removed
  its any declaration. Tests were not executed while paused. Project compiler,
  standalone declarations and build passed.
- Actual post-render reveal/fade completion and background readiness remain
  stronger conditions still to port; this fallback is not full reveal parity.

### Loading text resume and PvP replies

- Paired the source completion stop() with source show() play(): native
  ScreenTextField.start() does not clear stopPlaying, so stopping hidden work
  without explicit resume would suppress subsequent loading tips. Restore both
  spinner visibility/alpha values on show, preserving START_SETUP_IS_ACTIVE.
- Ported showHighscore's visible/attached/not-fading guards and corrected the
  random index to use textsPvp.length (current native uses texts.length). Late
  replies cannot restart hidden typewriter work after a cancelled transition.
  A replacement highscore list disposes the preceding list instead of leaving
  an unreachable child behind. Static-cover deferred highscore handling remains
  pending with that cover mode.
- Added reviewed native declarations and central TopPvPPlayersList binding;
  methods use existing game objects. Typecheck, declarations and public build
  pass; runtime tests remain paused.

### Static loading-cover API and presentation acknowledgement

- Added the original source methods to the native FadeScreen prototype:
  get_isCoverVisible, showStaticCover, showStaticCoverUntilPresented,
  cancelStaticCoverWait and resumeLoadingAfterTeardown. Their client extension
  declarations live separately from generated native ABI in game/LoadingCover.d.ts.
- Static mode stops typewriter/frame work, hides animated/loading/PvP/promotion
  elements and places an opaque cover at the stage front. PvP replies are held
  until resume; resume can suppress a new gameplay-tip sequence.
- CoverPresentation waits for Starling RENDER, yields out of the render callback,
  and verifies frameID advanced before permitting teardown. A 500ms fallback
  prevents stalled rendering from trapping the transition; missing context
  yields once. Replacement/cancellation/disposal invalidate old callbacks and
  remove timers/listeners. Plugin cleanup restores prior prototype descriptors.
- Verified current Haxe exposes contextValid/frameID/setRequiresRedraw; reviewed
  declarations added. Typecheck, standalone native+extension declarations and
  public build pass. Runtime tests remain paused.
- These source APIs are now available, but JoinRoomManager does not yet invoke
  the presentation wait before its room teardown. That integration and complete
  recovery ownership remain outstanding, not established by this API port.

### Room teardown waits for cover presentation

- Native joinGame closed the existing scene before discovering the destination.
  RoomTransition now suppresses that early close only within joinGame's native
  call, retaining the old scene until createJoin commits to a selected room.
- At commit, wait for the static cover presentation, validate manager/request/
  destination/current-scene identity, close the previous room, resume loading
  visuals and invoke the existing join path. Missing cover falls back to closing
  synchronously. Failed teardown blocks that transition and shows the original
  refresh message; it does not proceed or repeat a partial close.
- Room-list callbacks are scoped to the current discovery attempt. Replacing an
  attempt cancels its presentation wait; plugin cleanup cancels outstanding waits.
- Found FriendWarpCommand bypasses native createJoin for its join-only contract.
  It now uses the shared commit boundary, retaining its metadata and join-only
  send rather than closing early or recreating an invited room.
- Installed after LoginLoading/LoadingCover, preserving startup's prepared-room
  scan boundary. Reviewed native state-machine and manager signatures.
  Typecheck, declarations (before final error-signature addition), and build
  pass; runtime tests remain paused.
- Full recovery parity remains open: native createJoin retry/success callbacks
  still need complete request-generation ownership, stable allocated room IDs,
  initial synchronization watchdog and Service recovery coordination. This
  transition integration does not establish those guarantees or live parity.

### Native game-room request ownership and stable destinations

- GameRoomJoin replaces native createJoin's unowned timer/callback closures with
  one captured request per manager. New joinGame attempts cancel previous retry
  timers. Destination descriptors/payloads are copied; absent room IDs are
  allocated once with native GUID before the first send, then reused on retry.
- Success/failure validate request identity, current manager, source room and
  captured live Service socket. Stale success disconnects its returned socket;
  duplicate delivery of the already accepted socket does not disconnect it.
  Accepted room ID and descriptor are published before native handleJoin.
- This runs inside RoomTransition's committed send boundary, after presented
  cover/teardown, and inside LoginLoading's prepared-room guard. Friend warps
  continue their separate join-only send path and existing generation guard.
- Current Haxe retry count/backoff and user-facing busy/error messages remain
  intact. This is request ownership, not the complete source recovery policy:
  eight-second response/init watchdog, selective retry classification, Service
  recovery, session-release waits and rollback orchestration remain open.
- Added central Room/GUID/StartSetup bindings and reviewed native signatures.
  Project/compiler declaration checks and build pass; no runtime join tests or
  live requests were performed while tests are paused.

### Typed friend-room discovery and guarded join-only handoff

- Removed Raw/any, generic read calls and ad hoc api.cls lookups throughout
  FriendWarpCommand. Uses central Player/Room/RoomInfo/MD5/GUID/DataLocator/
  JoinRoomManager/MessageLog bindings, native getters and typed room validation.
  Current onlineFriends is an array of core.friend.Friend, verified from the
  Haxe fill/onOnlineFriends implementation; no speculative hash-map fallback.
- Reviewed declarations cover friend fields, callback, room listing metadata,
  warp signature and player fields. SolarSystems loadKey has a table-specific
  pvpLvlCap result; unreviewed tables return unknown rather than any.
- Friend join-only/create sends keep their resolved destination metadata and
  captured Service socket. Check it before sending and before native handleJoin;
  stale/duplicate sockets cannot replace the current scene. Accepted ID is
  published before native game construction. The command boundary validates
  the native game class before passing it into the typed module.
- Existing instance-selection rules, private compilation gate and command text
  remain. Cross-Service recovery coordination still needs the full source state
  machine; this does not claim that workflow complete.
- Project/declaration checks and public build pass. No runtime tests or live
  friend/room requests performed while tests are paused.

### Source connection-error retry policy

- Compared JoinRoomManager.isRetryableConnectionError, recovery delays and
  retryStaleAccountRecovery with both old SDK constants and current browser SDK.
  Ported the exact retryable IDs 2/7/13/17/19/40/130 and their verified names.
  Current Haxe wrap leaves errorID at -1, so a numeric-ID-only translation would
  incorrectly reject every browser SDK transport error.
- GameRoomJoin now uses source transport delays (2/4/8/15 seconds following the
  initial committed attempt), terminal handling for auth/unknown failures and
  the separate three-retry, 2-second temporary-session-lock budget. Exhausting
  that special budget is terminal, not another generic retry series.
- Extracted the existing exact transient-message normalizer for shared startup/
  game use. No broad permission-denial or substring matching was added.
- Typecheck and public build pass; matched all seven symbolic names against the
  local PlayerIO SDK. Runtime retries remain untested while tests are paused.
- Supersedes the prior note retaining native retry-all/jitter policy for Game
  joins. Full recovery orchestration, watchdogs, retry UI and Service switching
  still remain open; this policy does not implement those state transitions.

### Eight-second SDK join-response deadline

- GameRoomJoin now arms the source eight-second response deadline only when
  createJoinRoom is sent, after cover presentation and old-scene teardown.
  No SDK response schedules the source transport retry with the same captured
  room ID; exhaustion uses the original unresponsive-room status/message.
- Each send has an answered guard. Timeout settles that send before backoff,
  so late success disconnects its socket and cannot replace the accepted room
  or clear a newer attempt's deadline. Success/error/cancel/Service failure/
  synchronous throw/plugin unload clear owned deadline timers.
- Timeout and SDK transport errors share the source transport budget; temporary
  session-lock retries retain their independent budget. No probe packets added.
- Typecheck/build pass. Runtime timeout injection remains paused.
- This covers waiting for the SDK join response only. The original watchdog
  also tracks required initial Game replies after construction and abandons
  unready sockets during backoff; that post-join phase remains outstanding.

### Join-only destinations use the shared request pipeline

- FriendWarp now supplies its resolved descriptor to createJoin instead of
  maintaining a second socket/callback path. GameRoomJoin preserves joinOnly
  in the descriptor snapshot and uses SDK joinRoom for those destinations;
  retries cannot recreate a vanished invited room. Ordinary destinations still
  use createJoinRoom with one allocated ID.
- Exact invited-room IDs and destination metadata are validated before old-room
  teardown, then checked again at send. Missing IDs no longer receive a generated
  fallback for a join-only request.
- Source handleJoin semantics clear desiredRoomId and update desiredSystemType
  on accepting a join-only destination. The actual accepted ID is retained.
- Removed the now-unused exported commit helper. Friend joins share cover wait,
  Service ownership, response timeout, selective retry and cancellation logic.
  Their room-discovery/selection grammar and private gate remain intact.
- Typecheck, native/extension declarations and build pass; runtime tests paused.
  Cross-Service recovery, post-join synchronization and refresh preservation of
  invited descriptors still require the remaining original state-machine port.

### Explicit refresh preserves the current room contract

- Ported source createJoin's same-room metadata preservation before teardown:
  retain the active game's actual Service/system type and joinOnly contract when
  refreshing its connection ID, including an older sector after a Service switch.
- Added typed RoomRefresh around healthy-Service native reload. Its synchronous
  refresh path uses showStaticCover and marks the selected descriptor before
  createJoin; transition resume suppresses a new gameplay-tip sequence.
- Explicit refresh's recognized session-lock responses now use the source quiet
  one-second release check, without consuming the separate three-lock retry or
  transport budgets. Other joins retain their bounded lock retry behavior. New
  join attempts/plugin disposal cancel this request's timers as before.
- Source release polling has no fixed count; it remains pinned to the captured
  destination and live Service. Missing/dead Service reload still follows the
  native path pending the full Service-recovery port, not a claimed parity fix.
- Typecheck, standalone declarations and public build pass. Runtime refresh and
  invited-room verification remain paused and unproven.

### Clock lifetime and typed resync

- Compared original Clock.dispose/beginExit/Game-disconnect cleanup with current
  Haxe Clock, which has no disposal method. Installed typed dispose extension:
  detach the cached native serverTime handler, clear responsePending and remove
  clock event listeners once. Guard start/request/queued replies after disposal.
- Capture the Clock's socket disconnect listener on start; dispose immediately
  on that socket's disconnect. Scene exit/disposal also release its clock. Plugin
  cleanup detaches its watchers and restores the previous prototype descriptor.
- NativeClockResync now uses typed Clock/GameScene/Connection/Message bindings
  and native getters, with no Raw/any/ad hoc class lookups. Clock disposal drops
  its resync listener/pending queue synchronously instead of waiting for polling.
  Existing FIFO draining for timed-out batches and current Haxe slew remain.
- Updated the command boundary to validate the native Game class. Reviewed
  signatures and separate game/Clock.d.ts describe the runtime extension.
- Typecheck, standalone native/extensions declarations and build pass; runtime
  tests paused. Initial-clock FIFO/watchdog and post-join recovery orchestration
  remain unfinished; disposal is a prerequisite, not a claim of complete recovery.

### Post-join initialization watchdog and abandoned-scene guards

- Ported SceneBase.observeGameJoinResponse's exact reply allowlist and readiness
  rule (clockInitComplete plus initSyncEnemies). Persistent game handlers report
  progress only after native callbacks; clockReady reports serverTime progress.
- GameRoomJoin keeps ownership after SDK acceptance and renews the eight-second
  deadline only for those initialization replies. Network readiness clears the
  watcher/deadline. Live traffic cannot postpone an unready-room timeout.
- On timeout, present the static cover, detach the watcher, mark the scene
  abandoned, dispose its clock and disconnect its game socket during backoff.
  Native disconnect-popup recovery and queued message/frame/tick/clock-ready
  work are suppressed for that abandoned scene so they cannot race this retry.
- Retry shares the existing budget, waits for cover presentation before disposing
  the partial scene, retains the actual accepted room ID and changes subsequent
  joinData.warpJump to false. Refresh quiet-tip state follows the snapshot.
  Construction failure releases the owned socket and reports the source message.
- Extracted RoomDestination validation to avoid a circular module dependency.
  Typecheck, native/extensions declarations and build pass; runtime injections
  remain paused. Full 45-second visual-load deadline, initial-world reveal gates,
  server rejection recovery and cross-Service coordination remain outstanding.

### Initial world reveal gates

- Added InitialWorld using native Game/PlayState/LandedState and typed state,
  canvas and parallax fields. Prevent duplicate runGameLoop; source state
  loadCompleted now marks loaded before asking to reveal, rather than fading
  immediately while initial enemies/background are still pending.
- Require the started loop, initSyncEnemies, loaded active state and native
  parallax initialized flag (or source five-second optional-background timeout).
  Schedule reveal after the regular native Game update and recheck ownership.
  Existing native rendering remains in place.
- Welcome text is deferred to reveal; TOS/sale popups wait until fade completion.
  Hotkeys remain blocked until a valid fadeOutComplete. Cancellation releases
  fade listeners and waits for a state-ready signal; exit/dispose/abandon guards
  prevent queued work recreating discarded scene state.
- Installed typed get_initialWorldIsRevealed/tryRevealInitialWorld extensions.
  Service readiness can now use actual reveal completion instead of its fallback.
  Plugin cleanup releases listeners/timers and restores native accessors.
- Typecheck, native/extensions declarations and build pass; no runtime visual
  verification while tests are paused. Native initialized is the current build
  readiness signal; original background cache/preload/hidden-layer readiness
  still needs its remaining source port. Overall 45-second load recovery remains
  open, so this is not a full login/recovery or visual-parity signoff.

### Initial world loading deadline

- Source: JoinRoomManager.handleJoin starts a 45-second loading deadline;
  notifyGameJoinResponse clears only the eight-second response deadline, while
  notifyRecoveredGameReady completes recovery after world reveal.
- GameRoomJoin now retains request ownership after clock/enemy synchronization.
  Network readiness clears only the response watchdog; the separate loading
  deadline remains until InitialWorld reports a completed fade on the owned scene.
- A stalled initial world releases both watchers/timers, covers the scene,
  suppresses queued scene work and closes its socket before retry backoff.
  Retries share the transport budget and retain destination ID/warp semantics.
  Exhaustion uses the original "The Game room did not finish loading." text.
- This ports the deadline and reveal-completion ownership, not the still-open
  full Service recovery/switch/rollback UI. Runtime tests remain paused.

### Final familiarity review — pending functional completion

- Compare the original client changes against vanilla before choosing wording;
  retain newer vanilla gameplay and intentionally updated art.
- Compare login/account/recovery/registration screens, connection statuses,
  retry/Cancel states, settings and plugin entry, chat, target bars, inventory,
  inspection and client dialogs against the original client.
- Check exact labels, capitalization, punctuation, spacing, version/credits,
  tooltip text and wrapping, bitmap/HTML color spans, truncation, alignment,
  enabled/disabled states and keyboard hints, including error/empty states.
- Record screen/state plus original and port evidence for each discrepancy.
  A successful build is not visual parity; this review remains outstanding and
  follows functional implementation and the eventual resumption of runtime checks.

### Failed warp discovery and typed manager API

- Compared original Game.warpJump/cancelPendingWarpJoin and
  JoinRoomManager.handleGameRoomListError/cancelPendingGameJoin against current
  native methods. Native list failure only logs, after warpJump has removed the
  frame listener and disabled FPS tracking.
- Added WarpTransition: one pending warp per scene, preserved native bound update
  callback/FPS setting, static discovery cover, cancellation restores roaming
  ship/game state and frame updates. Exit drops ownership; unload cancels pending
  live warps. Synchronous failure also restores the previous room.
- RoomTransition now retires failed discovery, restores the still-live room and
  displays the original listing error. Destination validation also restores the
  retained room before reporting failure. Successfully committed transitions
  continue through the existing opaque-cover teardown path.
- Reviewed all remaining JoinRoomManager instance member types from current Haxe
  implementations, including discovery arrays, reconnect callbacks, variadic
  RPC arguments, timer, stage, data manager and target getters. Added typed
  RoamingState binding and the used PlayerShip/player/Game members.
- Declaration generator validates native member ownership; full typecheck,
  standalone declarations and build pass. Runtime tests remain paused. Prepared
  warp prefetch/consumption, full Service recovery and final visual comparison
  remain outstanding; this is not a complete warp/recovery parity signoff.

### Warp room preparation during animation

- Compared original PlayerManager.initWarpJump and JoinRoomManager's
  prepare/consume/complete/cancelPreparedWarpJoin methods. Added PreparedWarp
  at the native fadeIntoState(WarpJumpState) boundary, before the visual wait.
- Capture manager, live scene, exact Service socket/ID, destination, system
  type and level. Explicit instance IDs retain the native direct-join path.
  Otherwise list rooms during the animation and reuse the result at joinGame;
  if still pending, retain the committed callbacks until discovery resolves.
- Native joinGame builds current protocol/session data and native handleRooms
  applies current capacity, version and system rules. No game socket opens
  during preparation. Pre-commit failure falls back to normal discovery;
  post-commit failure uses RoomTransition's original error/restoration path.
- Interrupted warp state, scene exit, target mismatch and plugin unload discard
  preparations. Stale service replies cannot commit. Synchronous join exceptions
  now retire both prepared discovery and transition callbacks before rethrowing.
- Added reviewed WarpJumpState binding, fields and state-transition signatures.
  Runtime tests remain paused. Warp animation speed/visual cleanup and parallax
  prefetch still need their source port; this only implements room preparation.

### Warp timing and owned visual cleanup

- Ported original WarpJumpState's 10x speed change: constructor-relative 1000 ms
  speed fallback, threshold 800, and 0.1-second dark-overlay fade. Retains native
  ship warp entry, base PlayState drawing and loading callbacks; removes native
  white flash/stretch animation from this transition.
- Captures prior camera trackStep and ship filter. Adds only the owned glow,
  clears it before commit, restores the filter only while still owned, and
  disposes the owned glow. State exit/game exit/unload kill overlay tweens,
  remove overlays and restore camera tracking; cleanup is idempotent.
- Completed/cleaned/leaving/abandoned guards prevent native fallback or late
  tween completion from committing the same warp twice. PreparedWarp's existing
  state-exit hook cancels discovery if the transition never committed.
- Added reviewed native signatures and central TweenMax/GlowFilter bindings;
  generator, typecheck and standalone declaration check pass. Build checked
  separately. Runtime/visual tests remain paused, so appearance and actual
  animation timing are not yet verified. Parallax prefetch remains unported.

### Background cleanup before gameReady

- Source ParallaxManager.clear detaches only its own nebula container/star batch;
  native clear disposes every child of the shared target. Existing port protection
  was installed by onGame, after initial background refreshes could already run.
- Moved the reviewed clear implementation to typed ParallaxCleanup installed at
  classesReady. It now protects initial loading and intro backgrounds as well
  as live game refreshes. Reused containers remain alive; unrelated target
  children remain attached. Removed the later duplicate per-session override.
- BackgroundLayers now uses GameScene, Sprite, SceneBase and reviewed parallax,
  display and settings types through Bindings/GameReflection. No Raw/any or
  ad-hoc class lookup remains in that module. Native getters replace dynamic
  reads and the game boundary validates the class once before both installers.
- Source inspection/typecheck/standalone declarations pass; build checked
  separately. No visual claim while runtime tests are paused. Remaining readiness
  work includes optional-nebula failure, hidden-background fast path, serialized
  atlas loads and cache pins. Native loadData also registers its completion
  listener after starting loading; address this when porting that loader.

### Background atlas cache/loading primitives — integration pending

- Implemented typed BackgroundAtlasCache from TextureManager's original
  two-entry LRU and use counts, including idempotent pin releases, pin-aware
  eviction, atlas/XML removal and preserving cached entries around the native
  custom-texture disposal routine. Other texture disposal stays native.
- Implemented BackgroundAtlasLoads from the original serialized background
  request queue. Duplicate atlas requests share one batch; listeners precede
  loadTextures; matching preloadError marks failure without releasing the slot
  before preloadComplete. Consumers acquire before cache trimming. Cancellation
  removes only that consumer; late callbacks after disposal cannot progress.
- Callback failures do not prevent other consumers or queued batches from
  settling. Reviewed current native dictionaries and Event.data representation.
- These primitives are NOT yet installed or connected to ParallaxManager.
  The next required step is load-generation/visibility/readiness ownership,
  release on game/intro disposal and warp prefetch wiring. Do not count cache or
  prefetch as an active feature until that integration is complete.
- Runtime tests remain paused; compilation is not loading/memory validation.

### Parallax loading/cache/prefetch integration

- Installed ParallaxLoading at classesReady after owned-layer cleanup. Replaces
  native load/refresh with original layout generations, callback deduplication,
  server-settings visibility gating, idempotent display rebuilding and stars-only
  fallback when optional atlas loading fails. Uses native Image/Random/layout,
  current wrapping/update code and the original 40/70/25 star counts.
- Connected BackgroundAtlasLoads and BackgroundAtlasCache: live parallax loads
  acquire before trimming, replacement/exit/dispose release, and custom texture
  disposal preserves cached backgrounds while native handles other entries.
  Intro StartSetup.dispose retires its loading callbacks and releases its pin.
- Warp fadeIntoState prefetch warms shared textures only. Incoming load reuses
  the queued/cached atlas; generation and retired-manager guards reject callbacks
  after replacement or departure. Hidden backgrounds can build resident stars
  without waiting for optional nebula IO. Refresh still runs star-layer hooks.
- InitialWorld now reads actual parallax readiness rather than just initialized;
  original five-second optional-background timeout remains. Unchanged visible
  backgrounds avoid clearing/rebuilding on redundant refresh.
- Typecheck passes. Standalone declaration/build checks recorded separately;
  runtime tests remain paused, so cache eviction, intro overlap and GPU memory
  behavior still require runtime verification. Full original TextureManager
  parallel loading, pair-settlement and cancellation port remains outstanding.

### Background queue ownership correction

- Rechecked ParallaxManager.requestBackgroundAtlas/startNextBackgroundAtlasLoad:
  the original queue is global across texture managers. Corrected the integrated
  loader, which had mistakenly allocated one independent queue per manager.
- One shared queue now carries the owning manager on each batch. A replacement
  manager requesting the same atlas cancels the old consumers, retains the active
  slot until that old batch settles, skips cancelled queued batches and cannot
  delete the replacement request when the old completion arrives.
- Completion/error listeners are removed from their actual owning manager.
  The cache remains shared with the native static atlas dictionaries.
- Typecheck passes; build checked separately. Runtime tests remain paused.
  This corrects ownership under manager replacement; it does not implement the
  still-missing original parallel per-file TextureManager transport.

### Native terminal texture failure contract correction

- Current Haxe TextureManager.attemptFailed emits preloadFailed after its third
  failed attempt and stops the whole serial batch. It does not emit the original
  client's preloadError plus final preloadComplete. The integrated background
  queue previously listened only for the original events and could stay active
  forever after a native terminal failure; earlier fallback claims did not cover
  that actual current event path.
- Added a preloadFailed listener that settles the active background batch false,
  detaches every owned listener, delivers the stars-only fallback and advances
  queued work. Original per-file preloadError still retains its slot until
  preloadComplete, supporting the forthcoming parallel transport contract.
- Confirmed from native attemptFailed that the watchdog is stopped and active
  target cleared before terminal dispatch. Typecheck/build checked; no runtime
  failure injection while tests remain paused.
- Parallel texture transport is still unported. Source inspection additionally
  confirms deduplicated file progress, image-before-XML buffering, orphan bitmap
  cleanup, load replacement cancellation and per-item settlement requirements.

### Parallel texture batches and atlas pairing

- Installed TextureBatches at classesReady. Each loadTextures replaces/cancels
  the prior owned batch, deduplicates filenames and starts OpenFL requests in
  parallel. Disposal/unload detaches listeners, closes outstanding IO, clears
  watchdog/retry timers and disposes orphan bitmap/XML pairing state.
- TextureAtlasPairs ports image-before-XML buffering, failed-pair tombstones,
  atlas creation cleanup and temporary XML removal. Successful textures retain
  bitmap data for native graphics-context restoration. Typed OpenFL/Texture/
  TextureAtlas/Xml bindings replace reflective untyped IO in this path.
- TextureBatch ports monotonic aggregate per-file progress, exactly-once item
  settlement, preloadError filename events and final preloadComplete. Network
  requests retain current native textureUrl, retry query, retry count/delay and
  30-second watchdog. Decode/atlas processing errors settle the pair as in the
  original client; callbacks from replaced/cancelled batches are ignored.
- LoginLoading now listens for per-item preloadError as well as native terminal
  preloadFailed, preserving fatal treatment for required startup assets while
  background consumers can finish with resident stars. The background queue
  supports both the original per-file and native terminal event contracts.
- Full typecheck, standalone declarations and build pass. Runtime tests remain
  paused: actual parallel IO, cancellation during decode, retry timing, graphics
  context restoration and GUI/intro loading must still be verified. Original
  texture-vector cache and aura bitmap registration require separate reconciliation;
  this entry does not claim all TextureManager changes or visual parity complete.

### Texture frame-vector caching

- Ported TextureManager.getTexturesByTextureName's original weak atlas-identity
  cache and case-insensitive trailing png/jpg/jpeg normalization. Native atlas
  lookup/order remains authoritative; each call receives a copied array so
  MovieClip or other callers cannot mutate cached frame lists.
- Added typed HaxeIterable/HaxeIterator contracts and reviewed the current
  TextureAtlas.getTextures implementation, which returns an OpenFL vector with
  a Haxe iterator rather than a JS iterable. No speculative array casts.
- Successful atlas replacement invalidates the previous atlas's entry;
  TextureAtlas.dispose invalidates on native disposal and background eviction.
  TextureManager.dispose and plugin unload clear all cached vectors.
- Typecheck, standalone declarations and build pass. Runtime tests remain
  paused; actual animation reuse, atlas replacement and memory behavior still
  need verification. Aura texture registration and wider feature/screen parity
  remain outstanding.

### Initial Game join Service-disconnect ownership

- Added a captured Service disconnect watcher before sending the Game join.
  It remains through initialization/retry backoff/world reveal, closing the gap
  before native joinReady installs its established-room Service handler.
- Centralized request completion cleanup: detach initialization/reveal/Service
  listeners and clear response/loading/retry timers on success, cancellation or
  terminal failure. A departed/replaced request cannot report the old disconnect.
- Captures accepted Game socket before native handleJoin, so a Service drop during
  synchronous scene enter can abandon the published partial scene even before
  pendingGame assignment. InitialGameConnection also suppresses native Service
  recovery on abandoned scenes, avoiding competing partial-scene recovery work.
- Fully revealed rooms remain under the established Service handler; the initial
  failure path does not close a healthy revealed Game in that boundary race.
- Typecheck/declaration/build checks run; runtime tests remain paused. This is
  immediate detection and ownership cleanup, not full source recovery parity:
  bounded Service rejoin, recovery dialogs, rollback and service switching still
  require their coordinator implementation. Current initial failure reports the
  existing Service-lost error rather than claiming those retries are present.

### Service rejoin handshake and reserved destination guard

- Added typed ServiceReconnect around native reconnectServiceRoom, installed
  inside existing IPC authentication wrappers. Captures manager/live Game/old
  socket ownership, uses the source 15-second handshake deadline, disconnects
  stale candidates and commits only the requested room plus a validated account
  joined payload. Does not parse startup room choices or dispatch startup joined.
- Extracted source ServiceConnectionPool handshake validation into a shared typed
  function; pool message callbacks/joined storage now use native Message types.
  Terminal account/room/handshake rejections stop instead of scheduling another
  retry. Transient SDK/network failures use the existing native retry callback.
- Removes candidate listeners and timers on failure/replacement/exit/unload;
  committed sockets retain a guarded manager-level error handler and heartbeat.
  Live healthy Service reuse preserves its handler. Duplicate SDK replies cannot
  disconnect a committed candidate or remove its live handlers.
- Corrected reserved IPC room validation in RoomDestination before teardown/send.
  GameRoomJoin replaces native createJoin, so the later IPC createJoin wrapper
  was not sufficient. Reconnect also validates the reserved target explicitly.
- Typecheck/declaration/build checks run; runtime tests paused. This installs the
  handshake portion only. Native reconnect scheduling still supplies its existing
  retry series; original shared five-attempt coordinator, three stale-session
  retries, UI, pooled takeover and cross-Service rollback remain unfinished.

### Service stale-session retries and reply generations

- Ported retryStaleAccountRecovery's Service-specific three retries at 2000 ms,
  only for exact transientJoinRetryMessage matches. Releases the rejected
  candidate before backoff and retains the same target/protocol/session.
- Temporary locks no longer consume the native transport retry callback/budget.
  The stale budget survives intervening transport attempts for the same Game
  and Service target; success, terminal rejection or scene exit clears it.
  Exhaustion is terminal and does not fall into another generic retry series.
- Displays the original retry status/count via loading progress and blue chat
  connection notices. The full source login retry panel is still separate work.
- Each SDK send now owns a generation and one answer. Old joined/disconnect/error
  callbacks cannot cancel a newer candidate or commit after backoff. Duplicate
  SDK failures after acceptance cannot discard the accepted handshake.
- Typecheck/build pass; runtime tests remain paused. Shared five-attempt recovery
  coordination, dialogs, pooled takeover and cross-Service rollback remain open.

### Service-only bounded recovery

- Replaced native ten-attempt chat retry scheduling with the source five-attempt
  1/2/4/8/15-second series while the Game connection remains healthy.
- Uses original connection notices and native Retry popup wording. Terminal
  rejection suppresses automatic retries; explicit Retry resets the attempt count.
- Recovery owns timers/popups; stop, exit, disposal and unload remove them.
  Stopping recovery also cancels its uncommitted Service handshake, preventing
  late publication after cancellation. Committed sockets remain live.
- Typecheck and build validation only; runtime tests remain paused. Full shared
  Game/Service recovery, friend/queue refresh, switching and rollback remain open.

### Final familiarity review (required after functional port)

- Compare original QoLAF modifications against vanilla first, then check every
  ported screen/state against those source changes. Preserve newer vanilla art
  and gameplay instead of treating game updates as client regressions.
- Check exact wording, capitalization, punctuation, status sequence, labels,
  tooltips, chat/system responses (including echo), credits/version and errors.
- Check text alignment, wrapping, clipping, colors/HTML bitmap text, button
  placement, popup layering and login/account/cancel states against the original.
- This review is pending, not completed by the current static checks. Functional
  port completion precedes the final comprehensive visual/text parity pass.

### Friend and queue recovery parity

- Compared original FriendManager/QueueManager/QueueInfoHolder source with vanilla
  and current Haxe implementations. Added typed ServiceViews at classesReady.
- Friend snapshot requests now deduplicate callbacks, share one pending request,
  retain waiting views during Service loss and request a fresh snapshot after
  reconnect. Native parsing and detached callback draining remain in use; the
  native timeout that completed views without a reply is replaced by source
  pending-request semantics. Synchronous send failure clears waiting callbacks.
- Service loss resets queue waiting/in-queue/ready/accepted flags, timing and
  destination fields. Dismisses match popups silently, preserving removedFromStage
  cleanup rather than sending an action or changing another overlay's hotkey lock.
- Reconnect requests RequestQueueInfo, never replays queue actions. Unknown queue
  types in the snapshot are ignored as in the original modification.
- Queue timeout/update guards prevent dereferencing a popup dismissed by timeout;
  duplicate popups are suppressed. Accept/decline and asynchronous sound callbacks
  check the current popup and live Service. Native popup text/layout is retained.
- Scene exit/disposal clears queue UI and friend callbacks/timers. Recovery state
  is released before view refresh so a view callback exception cannot strand the
  completed retry series. Existing socket-owned RPC/message wrappers reject old
  replies after replacement.
- Reviewed signatures and centralized bindings cover the new integration without
  Raw/any casts. Typecheck, standalone declarations and build pass. Runtime tests
  remain paused: reconnect, multiple friend views, timeout, keyboard, popup
  teardown and queue snapshot behavior still require live verification. Broader
  shared Game/Service recovery, switching/rollback and full port remain unfinished.

### Lost Game with retained Service

- Added typed RecoveryRoom snapshots from original snapshotRecoveryRoom: actual
  assigned Game ID, original Game sector/join-only flag, scalar room/join data,
  current level/session/protocol and warpJump=false. Does not rediscover another
  Game room or overwrite its sector with the current Service sector.
- Added GameRecovery for a revealed Game that disconnects while Service is still
  healthy. Pauses its input/frame callback, shows static cover, closes the dead
  scene, then starts the owned Game join after the source initial 1000 ms delay.
  Existing GameRoomJoin supplies bounded transport/session-lock retries and
  initialization/load deadlines. Completion waits for world reveal and uses
  source exact `Room connected.` notice. Failure uses native source Retry popup
  or terminal `Reconnection stopped:` message; explicit Retry starts a new series.
- Added descriptor-owned GameJoinLifecycle callbacks for entered/replacing/revealed
  and terminal failure. Detached observers ignore late callbacks. Internal retry
  teardown does not cancel its recovery owner; unrelated joinGame/joinServiceRoom
  operations cancel it. Idle/explicitly suppressed disconnects do not auto-rejoin.
- Fixed GameRoomJoin retaining finished requests in its manager map, which blocked
  another direct createJoin/Retry. Removes only its own request and also cancels
  pending work when starting a different Service join. Native startup error dialogs
  remain unchanged when no recovery observer owns the request.
- Source inspection confirms native Game exit disconnects its Game socket and
  removes scene handlers, while retaining the manager's Service socket.
- Typecheck/build pass; runtime tests remain paused. This covers the retained
  Service branch only. Combined loss, Service loss during recovery, pooled takeover,
  shared retry budgeting, switching/rollback and cross-sector discovery still need
  unified coordinator integration. Native combined-loss behavior remains in place;
  this is not a claim of full connection-recovery or overall port parity.

### Combined Game/Service recovery ownership

- Extended GameRecovery beyond the retained-Service branch: captures Service ID
  before closing the dead Game and restores/validates that Service before each
  Game join. Missing/reserved/invalid destinations are rejected before teardown.
- Added explicit ServiceReconnect ownership for recovery descriptors whose Game
  has been disposed. Existing account/room handshake checks, reply generations,
  15-second deadline and bounded stale-session retries are retained. Cancelling
  the owner closes uncommitted candidates without closing committed Service.
- GameRecovery and GameRoomJoin now share one ConnectionRetryPolicy instance:
  Service transport failures and Game transport/initialization failures consume
  the same five-attempt series. Explicit Retry replaces that shared policy.
- Service loss while a replacement Game loads reports to its owning recovery,
  which reconnects Service before retrying Game. Service-only scheduling is
  suppressed while this owner is active, preventing competing reconnect loops.
- Failed initialization defers scene teardown until retry backoff completes;
  no disposal inside the native handleJoin initialization stack. Synchronous
  Service loss during scene entry first publishes that partial scene to the
  recovery observer so the failure is not dropped as an ownership mismatch.
- Initial standalone joins still use their existing path; pooled takeover,
  cross-Service switching/rollback, operator-kick discovery and complete recovery
  UI/status parity remain outstanding. This supersedes the previous retained-
  Service-only limitation for an established Game's disconnect.
- Typecheck, standalone declarations and build pass. Runtime tests remain paused;
  simultaneous loss, Service loss during initialization/backoff, exhausted Retry,
  cancellation and late replies remain live verification requirements.

### Clock watchdog and startup/refresh timing

- Ported original Game.updateClockResponseWatchdog: 10-second pending or freshly
  received overdue reply, foreground-only grace, focus/visibility event resets,
  >500ms/negative frame-gap resets, one trigger per Clock identity. Gated by revealed
  ready world, live Game+Service, current scene, loaded state, no recovery/warp/
  cover and permitted auto-reconnect. Uses the exact original red timeout notice.
- Watchdog runs around the native update before continuing gameplay. Disconnects
  the captured Game socket, explicitly notifies recovery if local close produces
  no event, and checks identity/leaving before notification. Never resumes that
  update after recovery can dispose scene managers.
- Added shared ClockResponseSamples from Clock.start through dispose. Records
  existing native/resync sends before dispatch and rolls back failed sends; FIFO
  serverTime replies feed both watchdog and existing health notices. No diagnostic
  probe traffic or duplicate health-only listener is introduced.
- Current original Clock.as has INITIAL_SYNC_SAMPLES=1 despite its stale comment
  about five. NativeClockTiming now uses that source value, starts once, maintains
  a pending reply queue, and refreshes without restarting initialization. Game
  refresh cadence is the source 25000ms rather than native 50000ms.
- RTT uses performance.now; native epoch-based offsets and monotonic slew remain.
  Live refresh applies the source 0.2 adjustment through the native target setter;
  replies taking >=10000ms update latency/observation but cannot shift time before
  the watchdog sees them. Parallel resync owns its replies separately, and pending
  shared samples prevent ordinary refresh from overlapping/draining its requests.
- Refresh completion uses a receiver-bound one-shot listener; cleanup covers send
  errors, Clock disposal, scene disposal and plugin unload. Source-clock identity
  and focus gaps reset watchdog observation rather than charging background time.
- Typecheck, standalone declarations and build pass. Runtime tests remain paused.
  Required live checks include login timing, scheduled refresh, resync overlap,
  tab switching, local stalls, late/absent clock replies and reconnect rendering.
  Full port/UI parity and outstanding switching/rollback work remain unfinished.

### Disconnect diagnostic command and owned close notifications

- Found /disconnect documented in help but absent from local command dispatch.
  Registered the built-in and ported original argument validation, notices and
  live-Game/Service/recovery guards. Chat input is cleared before socket close,
  since recovery can synchronously dispose the chat scene.
- Added GameDisconnect identity/lifetime wrapper alongside ServiceDisconnect.
  Native joinReady listeners are replaced after initialization; exit/disposal
  detaches wrappers. Each callback fires once for its captured socket/scene and
  rejects old instances. Plugin cleanup restores an unfired live native handler.
- Diagnostic captures the matching Game/Service notification before disconnect.
  Explicit notification handles SDK local close without an emitted event; the
  same callback absorbs a synchronous or later remote-close event. Watchdog now
  uses this source diagnostic path instead of its separate close/notify code.
- Added the original /listCommands description and reviewed SceneBase disconnect
  method signatures. Typecheck, standalone declarations and build pass. Runtime
  tests remain paused; both commands, duplicate close events, replaced sockets,
  unavailable-state notices and recovery rendering still need live verification.
- Remaining /reload mismatch confirmed: RoomRefresh still falls through to native
  login-style Service recovery when Service is lost. It should enter the shared
  source recovery owner instead. Full port/screen parity is not complete.

### Reload during Service loss

- Replaced the disconnected-Service reload fallback with the same GameRecovery
  owner used by unexpected disconnects. The native joinServiceRoom/startup event
  callback no longer owns this case; healthy-Service /ref behavior stays under
  RoomRefresh's explicit refresh/release polling rules.
- Refactored recovery entry for both triggers. A still-connected Game is paused
  and retained during Service retries. Once Service validates, waits for the
  opaque cover to be presented, verifies the target is still live, then closes
  the retained scene and joins its captured exact Game destination.
- A disconnected Game still closes immediately. Cancels pending cover waits on
  recovery cancellation and rechecks current ownership before deferred teardown.
  Notices describe actual loss: a retained Game does not claim it disconnected.
- Added cancelPendingGameRoomJoin and identity-guarded request cleanup. Recovery
  entry cancels any old join response/load/retry timers and Service watcher while
  retaining its scene; late SDK candidates cannot take over the recovery join.
- Typecheck/build pass; runtime tests remain paused. Requires live /ref during
  Service-only loss, retry exhaustion, cover presentation, cancellation and
  retained-Game loss during handshake checks. Source service switching/rollback,
  pooled takeover and overall feature/visual parity are still unfinished.

### Connection notices and unavailable-Service feedback

- Ported Game.writeConnectionStatus's bounded 12-message queue for gaps without
  a live chat view. Flushes a detached queue immediately before attaching the
  new MessageLog, with original HTML escaping and blue #82cfff formatting.
- Restored distinct roomTransitionNote behavior: purple #c6a0ff in a live chat,
  deferred blue status when no view exists. Recovery retry/failure/completion
  notices use this path; actual disconnect notices remain blue.
- Matched actual manager success call flow: retained-Game Service reconnect calls
  onServiceReconnected(false), so removed the extra success notice. A fresh
  Service restored without a source Game queues `Reconnected to Service room.`
  before the Game loads. Temporary account-lock notices follow the original
  blue active-room-only rule, independently of loading progress.
- Service sends/RPCs no longer fail silently on unavailable transport. Restored
  original one-time-per-scene notice, reset on successful Service replacement.
  Leaving/suppressed scenes remain quiet; connected-socket payload errors still
  propagate. Requests are never replayed by this feedback path.
- Typecheck/build pass; runtime tests remain paused. Exact ordering through real
  scene teardown/loading and repeated unavailable sends still needs verification.
  Login retry-panel wiring and broader source feature/UI parity remain open.

### Startup Service progress and callback ownership

- Compared Login.showRoomConnectionStatus/Retry, LoadingBar, startup Service join
  and automatic-login cancellation source. The separate network/detail lines and
  CTRL countdown cancellation already follow those source paths; no extra retry
  screen is needed after login loading completes.
- Restored StartSetup progress updates alongside the existing preload panel for
  `Joining <room>...`, stale-account retry detail, and localized `Joined service
  room`. Startup SDK errors now use the original Astroflux Discord support suffix;
  server handshake rejections keep their direct source messages.
- Startup createJoin now accepts one SDK answer per attempt. Duplicate success
  with the same candidate is ignored (including after commit); a different late
  socket is disconnected. A duplicate SDK failure cannot discard an accepted
  candidate. Exceptions raised after an accepted callback are not reclassified
  as failed SDK acquisition. Already-disconnected candidates fail immediately.
- LoadingBar texture progress restores texture-line visibility as the original
  updateTextureProgress does. Existing text sizes, gray detail color, centering
  and 6/4-pixel line gaps match source by inspection.
- Typecheck/build pass; runtime tests remain paused. CTRL/account overlays and
  startup retry rendering are source-reviewed, not visually verified. Full
  feature implementation, final text/layout audit and live comparison remain open.

### Typed shared Service pool and floating-chat transport

- Replaced Raw/read access throughout ServiceConnectionPool, ServiceConnectionLease
  and FloatingChatConnection with native GameScene/Client/Connection/Message types
  and explicit Haxe getters. Handoff now returns a typed Connection plus verified
  Message; handler signatures no longer use Function. No Raw/any/read remains in
  those three modules.
- Typed the floating-chat entry's Game boundary via GameReflection at GameSession,
  captured its actual composer, and propagated GameScene through the window owner.
  Reviewed group/player/chat signatures and declared the optional shared-send-slot
  extension instead of assuming it belongs to vanilla Haxe.
- Pool SDK replies now accept one answer per join: duplicate same-socket success
  is ignored; a different extra candidate is closed; post-acceptance SDK failure
  cannot discard the accepted lease. Existing primary-owned lifetime protection,
  deferred listener detachment, account handshake and per-socket bans are retained.
- Updated the existing ServiceRoom test fixture to expose native getter contracts
  and implement Connection; this is fixture compatibility, not a test run. Tests
  remain paused. Typecheck, standalone declarations and build pass.
- Primary handoff APIs are now typed but not yet wired into shared recovery or
  Service switching. Floating-window UI/formatting still has older dynamic types;
  this does not claim full plugin typing, runtime validation or complete parity.

### Shared Service pool handoff in recovery

- Registered the actual per-Game floating-chat pool through a typed weak registry;
  unregisters only that owner on cleanup. Recovery can now discover an existing
  auxiliary Service connection instead of creating another socket to that target.
- ServiceReconnect acquires an existing pool entry, transfers primary ownership,
  checks that handoff identity matches the acquired socket, then uses the same
  account/room validation and commit path with its verified joined Message. It
  does not wait for another joined event or replay startup destination state.
- Handles both synchronous ready reuse and asynchronous acquisition. Releases
  held leases after takeover; cancellation/timeouts release only their lease and
  uncommitted candidate. Transferred primary ownership protects the adopted socket
  from old-Game/floating-view disposal. Pool disconnect/timeout failures consume
  transport retries; pool validation/rejection remains terminal.
- Successful native Service replacement retires only a dead previous-primary pool
  alias, preserving unrelated auxiliary rooms. Live primary server errors now use
  the original HTML escaping before showing their native dialog.
- Typecheck/build pass; runtime tests remain paused. Ready/pending handoff, lease
  release, cancellation, old-scene disposal and pool error dispatch remain live
  verification requirements. Switching/rollback, operator-kick handling and full
  client parity are still incomplete; this wires the pool reuse portion only.

### Required final wording and presentation pass

User requirement: after implementing the functional port, compare the small
user-facing details so the client feels familiar. This remains pending; source
review or a successful build alone does not sign off visual parity.

- Compare original client changes against vanilla before changing text. Preserve
  updated upstream gameplay wording where it describes current game behavior.
- Review login/profile/autologin labels, cancellation hints, connection progress,
  retry and failure messages, and version/credits placement.
- Review settings categories, control labels, descriptions, tooltips, button
  captions, confirmation dialogs, empty states and validation errors.
- Review chat commands/help/autocomplete, `echo.` and other response paths,
  connection notices, channel labels, context menus and hover explanations.
- Compare punctuation, capitalization, spacing, line breaks, placeholders and
  dynamic values; keep localization and HTML escaping intact.
- Once testing resumes, compare the same screen/state in both clients for font,
  color, alignment, wrapping, clipping and visibility. Include loading, disabled,
  error and empty states, not just the successful path.
- Record each actual mismatch with its original source location, port location,
  correction and verification status. Do not treat different account data or
  newer vanilla art as a port regression.

This pass follows functional implementation and does not replace remaining
feature work or lift the existing pause on runtime tests.

### Retained Game Service commit and recovery rejection ownership

- Compared original JoinRoomManager.connectRecoveryService,
  watchRecoveryService and Game.onServiceReconnected. GameRecovery now replaces
  the retained scene's Service socket before Game teardown, verifies that the
  scene accepted it, resets its reconnect attempt and refreshes its room,
  friend and queue views without adding an extra success announcement.
- Validates the returned socket's live state and target before proceeding.
  Watches Service disconnection and terminal duplicateLogin/kicked messages
  while waiting for the transition cover. Failure cancels that cover wait and
  detaches the watch before scheduling another attempt or showing an error.
- Transfers watch ownership to GameRoomJoin immediately before createJoin.
  That existing initialization owner now handles duplicateLogin/kicked as
  terminal failures alongside transport loss, using its existing partial-scene
  cleanup and lifecycle notification. It removes all three subscriptions on
  completion/cancellation rather than leaving overlapping recovery owners.
- Typecheck and build pass; changed files formatted. Runtime tests remain
  paused. Retained-scene reload, rejection during cover/initialization and
  callback cleanup still require live validation. Indexed Service commands,
  target discovery/rollback and the full functional port remain incomplete.

### Service creation policy and synchronous recovery failures

- Compared original JoinRoomManager.changeService/connectRecoveryService:
  visibility and creation permission belong to the committed Service, and a
  switch/rollback attempt carries its own proposed policy until acceptance.
- Added typed, immutable per-manager ServicePolicy state. Startup resets to
  vanilla visible/create-allowed behavior. A recovery owner can provide its
  target policy; ordinary subsequent recovery inherits the committed policy.
  Successful matching reuse and verified handshakes commit it. Failed attempts
  leave the prior policy intact.
- ServiceReconnect now chooses joinRoom for join-only policies and createJoinRoom
  with the requested visibility otherwise. Both retain current Haxe session and
  protocol fields. Join-only has no listing or fallback creation path. Pool reuse
  remains subject to the same verified-handshake commit.
- Synchronously thrown SDK errors now use the source's transient-account retry
  rule and retryable-code classification. Unexpected exceptions are terminal
  with the original connection-could-not-be-started message; they no longer
  consume repeated generic network retries. Exceptions after accepted callbacks
  still propagate instead of being mistaken for acquisition failures.
- Typecheck/build pass; runtime tests remain paused. This implements the policy
  used by future switch/join/rollback orchestration, not those commands themselves.
  Indexed commands, confirmation expiry, sector-local Game selection and rollback
  are still unfinished. No private command is newly exposed by this change.

### Private indexed Service commands and sector discovery

- Implemented /switchservice and /joinservice from the original ChatInputText
  grammar and JoinRoomManager.changeService/confirmation/discovery flow. Decimal
  bounds, boolean flags, reserved IPC index, live-room/transition guards and
  PvE/PvP/own-clan restrictions use the original messages. Visible creation
  requires a single-use 30-second confirmation tied to the captured scene,
  connections and Room. Exit, disconnect, warp and reload invalidate it.
- Connected requests to the existing owned GameRecovery flow. Healthy Games
  remain running while switching; reconnect=false keeps the current Game.
  Pooled primary sockets can be demoted without closing another chat consumer.
  If the Game disconnects meanwhile, its update/input loop is paused and the
  same recovery owns rebuilding it.
- Failed pre-acceptance switches restore the previous Service and its creation
  policy after transport retries; rollback releases a different live socket
  first. Exhausted stale-session retries and duplicateLogin/kicked do not permit
  rollback. Accepted Service handshakes discard the old target before view
  refresh/discovery, so later Game failures stay in the newly committed sector.
- Game discovery filters by solar system and accepted Service. It preserves mode
  and PvP-cap filtering, avoids locked/closed/full instances, and selects only
  canonical or sector-specific own-clan IDs. Newly needed clan instances use the
  original sector-specific hash. Destination selection drops the old Game ID;
  subsequent Game retries retain the selected/allocated destination. Discovery
  has a cancellable 15-second deadline and ignores late replies.
- Same-Service switches update future creation policy without an unnecessary
  Service disconnect. Join-only requests use the prior ServicePolicy work and
  never fall back to Service creation during retries or later recovery.
- Added ServiceSwitch.ts to the public build's private-module exclusion check.
  Typecheck, formatting, public build and private build pass. No tests/live room
  switches were run: runtime tests remain paused. Confirmation, actual sector
  selection, pooled leases, failed switches and reload/warp cancellation still
  need runtime verification. Operator-kick recovery/invites and the broader
  functional/UI parity work remain unfinished.

### Service-switch room-change guards and clan release delay

- Compared rejectJoinDuringServiceSwitch, desired-room setters and the original
  clan-switch teardown path. Added an owned RoomChangeGuard that stays active
  through Service retries, discovery, incoming Game initialization and the Retry
  popup. It is removed on completion/cancellation/unload.
- Warp, reload, normal joinGame and joinCurrentSolarSystem now reject unrelated
  room changes before their side effects. The pending-join before-hook also
  respects the guard, so a rejected request cannot cancel recovery's own join.
  Desired-room/system setters preserve their current values while guarded; the
  transition writes its selected destination directly as the original does.
  The original wait message is emitted once per switch, and pending warp visuals
  are restored without closing the retained Game.
- Clan switches that actually tear down a retained Game wait two seconds before
  sending the new join. Ported both original status strings. The timer remains
  owned by recovery, is cancelled by failure/exit/unload, and rechecks Service
  identity/liveness. The Game response deadline starts only after this wait.
- Typecheck, formatting and both public/private builds pass. Runtime tests stay
  paused. Competing /ref/warp, Retry-dialog input, setter callers and clan release
  timing still need live comparison; this is source-reviewed implementation,
  not runtime sign-off or completion of the broader port.

### Published Service errors stop active transitions

- Compared original installServiceErrorHandler: an error on the committed
  Service stops active recovery instead of merely displaying a normal popup
  while discovery/join callbacks continue. Added typed ServiceErrors ownership
  shared by startup and reconnected sockets.
- The active GameRoomJoin gets first refusal so its existing partial-world,
  pending-socket and lifecycle cleanup runs. Otherwise the enclosing recovery
  consumes the error as terminal. Stable gameplay and exhausted Retry dialogs
  retain ordinary escaped error popups. A completed/revealed join does not
  swallow an error that belongs to its enclosing or normal handler.
- Published sockets have one error subscription even when a pooled primary is
  demoted and promoted again. Old cleanup cannot remove the replacement listener;
  disconnect detaches it. Owned error handlers unregister on join/recovery
  completion, cancellation and unload. Unpublished handshake errors retain
  their separate bounded transient-session handling.
- Initial Game-join error dialogs now escape server-provided text; owned recovery
  still receives the original string and performs its own presentation escaping.
- Typecheck, formatting and public/private builds pass. Runtime tests remain
  paused. Live error delivery during discovery, clan delay, initialization,
  pooled re-promotion and Retry-dialog ownership remain verification items.

### Room-operator completed-kick announcement receiver

- Read original ClientRoomControl.onKickNotice, Game.isRoomOperator and the
  SceneBase/manager operator recovery paths. Added the public announcement
  receiver to each native Game session using typed IPCMessage and Game bindings.
- Accepts only the two exact original operator IDs supplied by authenticated IPC,
  exactly two string fields, original target ID/name lengths and control-character
  checks. The existing IPC channel policy already restricts kickNotice to its
  broadcast channel. Account/scene/transport identity checks reject stale delivery;
  Game-session disposal unregisters the listener.
- Uses the original red notice, sentence and encoded-length-limited HTML/bracket
  escaping, preventing names from becoming rich markup or MessageLog color tags.
  The receiver is public as in the original; it sends no operator request.
- Typecheck, formatting and both builds pass. Runtime tests remain paused. This
  completes only announcement receipt: invite/kick requests, replay windows,
  replies, exact-destination invite acceptance, public-population recovery after
  kicks and private operator sending still need their functional ports.

### Typed room-control request protocol

- Added RoomControlProtocol from ClientRoomControl.validHeader/onRequest/onReply,
  validGameData and remember. Invitations, kicks and correlated replies have
  explicit discriminated types; no dynamic object/any transport contracts.
- Validation includes exact authenticated operator IDs for requests, recipient,
  uppercase 32-digit nonce, finite server time, five-second future skew, original
  30-second request/reply and three-minute invitation windows, exact field counts,
  known solar systems, PvE/PvP-only destinations and canonical non-IPC Service IDs.
  The recorded Game Service and inviter's primary Service remain distinct fields.
- Ported 30-code-unit normalized kick reasons with dangling-high-surrogate
  removal. Reply parsing permits only the original request/result combinations;
  outgoing-request correlation must still precede replay acceptance.
- Replay memory lives outside Game/composer instances, prunes all expired entries
  regardless of insertion order, caps at 512 and never evicts a live entry to
  accept another packet. Separate remember calls prevent invalid/unmatched
  responses from consuming replay capacity.
- Typecheck and formatting pass. This is the protocol layer only, not a wired
  invitation/kick receiver: pending invites, receipts, exact-destination joining
  and operator recovery remain to connect. Runtime tests remain paused.

### Invitation state and detached receipt lifetime

- Ported immutableReplySender/prepareReplySender as typed RoomControlReplies.
  Receipts capture the native authenticated client and primitive fields, never a
  Game/composer. Submission is single-use; transport/account/chat restriction
  checks run before queueing and again at send time. Timestamp advances from the
  captured server time by monotonic elapsed time while queued.
- Added RoomInvitations for original pending-invite expiry, replacement, deny,
  source Room/Service guards and accept semantics. It preserves exact native
  chat text/duration formatting. Acceptance temporarily removes the decline
  receipt before calling the join adapter, preventing synchronous Game teardown
  from sending a false decline. Rejected starts retain the pending invitation.
- Disposal declines a pending invitation through its detached receipt and clears
  the timer. Parsed destination data is copied before retention. No request is
  sent by these additions during development.
- Reviewed/generated numeric Clock.getServerTime and PlayerManager chat-ban
  declarations from the current bundle; new modules use centralized bindings.
- Typecheck and formatting pass. These components are not yet installed in the
  live receiver: the exact-room GameRecovery adapter and native command/receiver
  wiring remain next. Runtime tests stay paused; no invitation round trip or
  scene-teardown acceptance has been live-verified.

### New user-supplied upstream bundle — 2026-11-11

- Switched declaration generation to the new /home/raony/Documentos/astroflux.js,
  SHA-256 7c49ee6caf843c3b109ebb7a979bc443a16fd92c503cb4aa25e81138a3b1f10d.
  Generated 1,052 reflected classes; all reviewed signature anchors remain valid.
- Compared generated declarations to the previously installed local snapshot:
  upstream changes include group departure cleanup, tooltip image/wrapping APIs,
  stalled-frame/projectile handling, idle timers and purchase UI removals. Native
  Game.update still owns lastFrameTime; the port's running-frame hooks call through
  to it. No rollback of these upstream changes was applied.
- Host snapshot.py now accepts --client-file to use the user's exact local bytes.
  Final upstream-byte equality and SDK integrity checks still apply. Refreshed
  all 195 resources for asset version 258803471 (63,640,273 bytes) and verified
  the installed snapshot's client hash. This replaces the local preview snapshot.
- All three injection anchors match in both source and deployed-local patch.js;
  the patched JavaScript parses without executing the game. Typecheck and both
  public/private client builds pass. No live reload/tests were performed; actual
  gameplay behavior under the updated bundle still needs runtime comparison.

### Native invitation receipt, commands and exact-room acceptance

- Connected validated IPC invitations to RoomInvitations and native chat, and
  reserved/routed /roominvite accept|deny through the local command dispatcher.
  Replay acceptance follows shape/sender/destination validation. Disposal removes
  both receiver subscriptions and pending invitation ownership.
- Implemented RoomInviteJoin from acceptOperatorRoomInvite: revalidates operator,
  both live rooms, transition/warp state, exact Game ID, both non-IPC Service IDs,
  PvE/PvP mode and known solar system before any socket work. The detached Game
  descriptor carries joinOnly=true and current Haxe session/version/level fields.
  It preserves the Game's recorded Service independently of the invited primary.
- Generalized shared transition ownership for public invitation acceptance.
  The invited primary is always join-only, including recovery; exact Game joins
  cannot create a missing room. Pre-acceptance failures can restore the old
  primary/policy. Once the target commits, retries stay with the invited target.
  Existing Game retention, pooled primary handoff, guards and reveal completion
  remain shared with private indexed switching.
- Internal accepted join-only destinations now write their owned desired fields
  directly; external guarded setters cannot block that internal update. Private
  indexed switching/discovery remains compilation-gated; the public artifact's
  private-module exclusion check passes.
- Reviewed the SolarSystems.name declaration used by invitation presentation and
  regenerated against the new bundle. Typecheck, formatting and public/private
  builds pass. No invitations were sent or live tests run. Sender/reply-correlation
  UI, kick requests/public-population recovery, runtime acceptance/expiry/rollback
  and complete client parity remain unfinished.

### Private room-control sending and correlated replies

- Ported /invitetoroom and /kickfromroom sender paths from ClientRoomControl.
  RoomPeerTargets supports a single IPC peer, quoted/longest known names,
  roompeers/allpeers and deduplicated @-lists. Room-scoped queued requests recheck
  membership before sending. Operator authorization remains exact authenticated
  account ID, independent of display name or role.
- Invitation lookup uses the current room directly (including hidden rooms), or
  the source's five-page/8-second public Game scan. Captured Room/Service and lookup
  generation reject stale replies. Invites preserve recorded Game Service versus
  live primary Service and reject clan/non-PvE/PvP/IPC destinations.
- Outgoing requests are bounded to 64, carry source expiry windows plus queue
  allowance, and rebuild timestamps at actual queue send. The pre-send guard
  rechecks scene, both sockets, account authorization, world reveal, warp/recovery,
  chat restrictions, IPC identity and peer identity. Disposal invalidates pending
  lookup and replies; queued callbacks hold the Game weakly.
- Replies require matching recipient, sender, nonce and request type, valid
  result/time window and fresh replay identity. Only a correlated received-kick
  receipt emits/broadcasts the original completed-kick announcement. Arbitrary
  reply text never dispatches room actions.
- Added both sender modules to the public artifact's private-source exclusion
  gate and reviewed/generated PlayerManager.get_playersById's typed Haxe map.
  Typecheck, formatting and public/private builds pass. No invitations/kicks were
  sent and runtime tests remain paused. Incoming kick handling/public recovery,
  live sender/receiver round trips and full client parity remain unfinished.

### Public Service selection needed by operator recovery

- Ported the source's public Service listing/selection flow as
  PublicServiceSelection: excludes IPC, follows the source automatic single-room
  threshold, otherwise presents the native ServiceRoomSelector with the source
  backdrop, level/supporter inputs, resize layout and status text. Human selection
  suspends the network deadline; cancelled/duplicate selection callbacks cannot
  start another creation operation.
- Missing public rooms use create-only, never createJoinRoom. Verified against
  the local browser SDK that Multiplayer.createRoom returns the created ID and
  RoomAlreadyExists is code 15/string RoomAlreadyExists. Collisions advance to the
  next source index with a strict 16-collision limit; unexpected created IDs fail.
  Network work has owned deadlines, one-answer/generation guards and cleanup.
- Haxe omits createRoom from its Multiplayer wrapper. Added a typed SDK interface
  for that exact boundary and reviewed declarations for PlayerIOError.wrap,
  ServiceRoomSelector's constructor/statics and native Stage size getters.
  ServiceRoomSelector now resolves through game/Bindings.ts.
- Typecheck, formatting and public/private builds pass. This selector is not yet
  called by incoming kick handling: operator disconnect/recovery ownership and
  exclusion of the removed Game still need wiring. No rooms were listed/created
  during development; runtime tests remain paused.

### Operator recovery integration and source retry ownership

- Incoming authenticated kick requests now cancel pending invitations, close the
  requested socket(s), and acknowledge only actual closure. Coordinated closes
  defer ordinary automatic recovery while preserving server security handling.
- GameRecovery returns to the source public Service picker, captures level and
  supporter before Game disposal, excludes the removed Game from discovery, and
  preserves ordinary hostile mode or falls back to public friendly mode. There is
  no hidden-Service rollback. Discovery remains pinned after Service commitment.
- Shared the source room-change guard with operator recovery: selection, retries,
  and initialization reject competing room transitions until recovery releases
  ownership. The original one-time wait notice is preserved.
- Temporary account-lock retries now return to public selection before the first
  Service handshake commits, using the source 2-second delay and independent
  three-retry budget. Changing the selected Service does not reset that budget;
  after handshake commitment, retries remain pinned to the accepted destination.
- Published Service error listeners become inactive synchronously and detach in
  a microtask, avoiding mutation of the SDK's live callback array during dispatch.
- Reviewed Player.hasSupporter directly in the supplied bundle as boolean.
  Regenerated 1052 class declarations against SHA256
  7c49ee6caf843c3b109ebb7a979bc443a16fd92c503cb4aa25e81138a3b1f10d.
  Typecheck and both public/private builds pass. No live messages, room creation,
  browser reloads or runtime tests performed. Live reconnection parity and the
  broader functional/UI/text audit remain incomplete.

### Login controller source behavior and typed native boundaries

- Compared Login.failSiteAuthentication and connectWithSiteCredentials with the
  controller. Authentication failure now retains the failed profile selection
  rather than reverting to the last successful profile. The connection status
  uses Localize.t, matching the original client.
- LoginProfiles now accepts the reviewed native Login type; its caller verifies
  the Haxe class. Login, RymdenRunt, Starling and Localize resolve through central
  bindings. Native event handlers and hooks use reviewed signatures and typed
  GameReflection; cached keyboard closure lookup is centralized there.
- The declaration check exposed a nonexistent Rymden.controlKeyDown reference in
  countdown handling. Replaced it with the installed LoginControl tracker. Native
  Starling keyboard input uses get_keyCode(), verified in the supplied bundle.
- Reviewed Login's form constructors/fields, state methods and ConnectEvent
  callback against the current bundle. Registration's last button is verified as
  native LoginButton, and missing Starling/stage state now fails explicitly.
- Updated the existing status fixture to implement the visibility setter required
  by the actual UI helper. No tests executed. Typecheck and public/private builds
  pass. The legacy generated profile/provider panels and NativeUI still contain
  untyped internals; this change does not claim the whole login UI is typed or
  visually verified. Full functional and final wording/layout parity remain open.

### Steam integration across profile authentication

- Compared Login.loginWithProfile, connectWithSiteCredentials, onRegisterSimple,
  handleConnect and handleError with the port. A saved site login and a newly
  registered account now capture the enabled Steam-integration preference and
  enter the original Steam integration state at authentication. Native Steam
  profile login retains the newer Haxe session-ticket/Web-API-ticket fallback.
- Steam ticket/authentication failures now release in-flight state and restore
  the profile chooser with the original `Steam: ` message prefix. Synchronous
  ticket-start failures follow that same path. Previously native handleError
  kept the chooser hidden and left the port's inFlight flag set.
- Late authentication errors after a successful login no longer reopen the
  chooser. Profile identity commitment clears the pending profile as in the
  source, and duplicate handleConnect notifications cannot re-save that identity.
- Source review covers browser site login, desktop site login with integration
  enabled/disabled, Steam profile login and registration. Typecheck and both
  builds pass; these paths have not been exercised live. Full port and runtime
  comparison remain open, and runtime tests remain paused by user instruction.

### Login display teardown before native cleanup

- Compared original Login.removeLoginScreen with the supplied Haxe body. The
  Haxe implementation initializes themes/fonts and removes embedded assets before
  removing the login children; a failure there can leave the old background
  underneath the world. The original explicitly removes the display first.
- Added LoginTeardown around that native method: detach resize/keyboard listeners,
  stop effects with isolated error reporting, then dispose the Login root's
  children. The Game and loading cover remain on the stage outside that root.
  Native theme/font13 compositor initialization still runs, preserving the newer
  game's assets. Embedded-asset cleanup runs even if theme setup fails and its
  errors no longer abort the remaining normal native cleanup.
- Existing profile-controller cleanup runs before the wrapper through before-hook
  ownership. Temporary method hooks restore in finally; effect cleanup is not
  repeated after child disposal. Login container is cleared even on failure.
- Regenerated reviewed resize/key-up declarations. Typecheck and public/private
  builds pass. Runtime teardown/failure rendering has not been tested; some other
  native references can remain attached to disposed objects when native theme
  setup throws before its own field cleanup. Full functional/UI parity is open.

### Emitter pool and batch-limit source parity

- Compared Emitter.drawParticels/updateParticleCount/particleLimit against the
  current port and latest Haxe bundle. The port retained vanilla's 100-particle
  high-graphics pool and 800/400 vertex thresholds. Restored the source's
  300-particle pool and 2400/1200 thresholds; repeated native setHighGraphics
  calls retain the source limit, while low-graphics settings remain native.
- Restored the source canAddMesh check before batching and observing an aura
  particle, so incompatible particle styles do not enter the same mesh batch.
  Verified that the current native MeshBatch exposes that method.
- Emission now uses the source live particleLimit=min(authored maximum,current
  pool limit), including steady-stream rate. Existing emitters respond to a
  graphics-limit reduction rather than retaining their old emission target.
  Current native rainbow-column behavior remains unchanged.
- Reviewed combat-text frame dispatch in the new bundle: Game.update calls
  TextManager.update with actual frame seconds, and the existing port converts
  that to elapsed milliseconds. No additional tick-to-frame hook is needed on
  that path. This source inspection does not prove rendered smoothness.
- Updated existing emitter fixture contracts for native graphics reset and mesh
  compatibility. No tests executed. Typecheck and both builds pass; visual
  density, interpolation, thruster/aura behavior and full parity remain unverified.

### Combat-text layout bindings and disposed-state ownership

- Removed Raw/any declarations and ad-hoc class lookups from CombatTextLayout.
  Layout now imports TextHandler, TextManager, TextParticle and StarlingTextField
  from game/Bindings, uses GameReflection hooks and native typed property getters.
- Extracted the original QoLAF add() extension into game/CombatTextHandler so
  layout and frame animation share one optional-argument contract. Native reset
  versus reuse-without-geometry-release remains an explicit local extension.
- Reviewed native TextParticle construction, TextManager pool fields and
  TextHandler disposal against the supplied bundle. Disposed handler arrays are
  nullable in declarations; the port's cleared game reference is nullable too.
  CombatTextFrames now returns before accessing any disposed handler state, and
  adding to a disposed or empty pool reports an explicit lifecycle error.
- Updated existing layout fixture setup to initialize central bindings. These
  fixtures were not executed. Regeneration, typecheck and both builds pass.
  Source measurement/pivot/pooling behavior is retained; live visual parity and
  remaining untyped rendering modules are still open.

### Fixed-step timing source audit and typed implementation

- Traced installation of GameStateMachine.update/set_clock and Game.runGameLoop,
  camera updates through the cached native render callback, and Ship.draw's
  interpolation. Confirmed the fixed-step implementation was installed, with the
  source local elapsed clock, 33 ms ticks, 500 ms catch-up cap and start reset.
- Extracted that timing implementation into SimulationTiming with a typed state
  contract derived from reviewed game declarations. Native clock/state getters
  replace generic property reads; no Raw/any is used in this module.
- Added GameStateMachine to central bindings and reviewed its fields, IGameState
  update/execute/load getters, Clock.get_elapsedTime and io.InputManager.reset
  directly against the current bundle. Preserved updateSimulation's existing
  export for consumers and updated existing fixture contracts/binding setup.
- Source checks found no new timing-algorithm mismatch in this pass. Typecheck
  and both builds pass. Fixtures and live rendering were not run; high-refresh
  visual parity and remaining untyped interpolation code remain open.

### Native tooltip refresh and lifetime source parity

- Compared original ToolTip setters, refreshLabel, dispose, disposeType and
  disposeAll with the latest supplied Haxe bundle. Live text/color setters now
  update an already-open WrapText panel; empty text hides it. Inline image
  anchors and background extents follow the newer native line layout.
- Direct disposal now removes the tooltip from the registry and repeat disposal
  is harmless. Replaced the native group-disposal loop together with this change
  so its old extra splice cannot unregister an unrelated tooltip. disposeAll
  releases the scene reference once the registry is empty.
- Added typed hideTooltips (source hideType) and routed artifact context-menu
  hiding through it without unregistering hover targets. Reviewed all ToolTip
  fields, methods, constructor and static members against the current bundle;
  this class's generated declarations no longer contain any.
- Verified debuff duration formatting against source StringUtils.formatTime:
  current port matches its hour/minute/ceiling-second formatting.
- Type generation (1052 reflected classes), typecheck, public/private builds and
  diff whitespace check pass. Runtime tests remain paused. Original Russo 11
  custom target/debuff tooltip style remains unported; live popup geometry and
  full visual/functional parity are not verified by these build checks.

### Original target/debuff tooltip font style

- Ported AstroTheme.labelQoLAFTooltip: Russo atlas selected for size 11, left
  alignment and leading 4. Only AuraInfo and DebuffDisplay mark their tooltips
  for this style, matching the two original qolaf_tooltip call sites. Vanilla
  tooltip fonts remain native.
- Style is applied when the native panel is first created. Its WrapText layout
  is refreshed and native edge placement is repeated with the new dimensions;
  existing live-text refresh continues to use that same format.
- Confirmed NativeWrapTextMeasurement measures the actual registered bitmap
  font via a matching HTML Starling field, and RichBitmapFontTextRenderer passes
  format.leading into BitmapFontTextFormat. Source duration formatting already
  matched and is unchanged.
- Tooltip callers now use the central constructor/type and validate the legacy
  scene/display boundary with GameReflection. Reviewed WrapText.field/layoutText/
  measure and TextFormat.set_leading declarations against the supplied bundle.
- Typecheck and both public/private builds pass. No runtime tests or visual
  comparisons run; the earlier missing-style implementation gap is addressed,
  but rendered tooltip parity still needs comparison with the original client.

### Slow texture-download watchdog source parity

- Re-audited the installed parallel TextureBatch against original
  TextureManager.onInternalProgress/armLoadTimeout. Found that the port used a
  total-download deadline: progress did not reset its 30-second timer.
- Progress now rearms the inactivity watchdog, matching the source. Existing
  settled/cancelled guards and listener/timer cleanup remain in effect; current
  native retry count, delay and retry URL handling are preserved.
- Unsupported preload extensions now settle without preloadError, matching
  original loadOne. Previously a non-texture entry could trigger fatal required
  startup failure instead of allowing the batch to finish.
- Reviewed source detach/abort/pair ownership alongside current cancellation.
  Typecheck and public/private builds pass. Slow-network, cancellation and retry
  runtime scenarios remain unverified while runtime tests are paused.

### PlayerIO callback dispatch and cleanup ownership

- Inspected the actual snapshotted PlayerIO SDK: message dispatch loops over the
  live per-type array, disconnect dispatch loops over its live array, and both
  removal APIs splice those arrays. Synchronous self-removal therefore skips
  the next subscriber. This is a browser transport difference requiring explicit
  adaptation around the source's scene/request lifetime guards.
- SceneRPC now removes the pending request immediately but defers physical
  message/disconnect listener removal to a microtask. Other same-message replies
  and disconnect cleanup callbacks can run; the retired request cannot fire twice.
- StartupServiceJoin, ServiceReconnect, GameRoomJoin and GameRecovery invalidate
  their watcher flags immediately and defer physical detach. Repeated detach is
  idempotent. Persistent Game/Service message subscriptions use their existing
  membership/identity guards with deferred SDK removal as well.
- Rechecked ServiceConnectionPool and ServiceErrors: those paths already used
  deferred removal and synchronous invalidation. Kept original source semantics
  for selecting scene handlers rather than changing subscription ownership.
- Typecheck, public/private builds and diff whitespace check pass. No runtime
  network tests, messages or reconnect actions performed. Callback ordering under
  actual login/recovery and complete end-to-end parity still need verification.

### Chained RPC dispatch ownership

- Verified Haxe Connection.runMessageHandler wraps the incoming SDK message and
  invokes each subscriber directly, while the SDK iteration checks live array
  length. Deferring removals alone still permits a callback to append a new RPC
  subscriber that consumes the message currently being dispatched.
- Added a typed dispatch-depth hook at Connection.runMessageHandler. RPCs started
  inside any native message callback now defer registration and sending to a
  microtask. Ordinary RPC sends outside dispatch remain immediate. This covers
  calls from persistent handlers as well as chained one-shot RPC callbacks.
- Deferred sends recheck pending ownership, scene lifetime, socket identity,
  connectivity and generation. Cancellation before send prevents registration
  and sending. Response timing starts at the actual send boundary, and dispatch
  depth restores in finally even when a callback throws.
- Regenerated the reviewed Connection static signature; typecheck, public/private
  builds and whitespace check pass. Live chained-RPC/cancellation verification
  remains pending under the runtime-test pause. Full port parity remains open.

### Chat sender/clan snapshots at receipt

- Compared source writeChatMsg, findLivePlayer and resolvePersistentSenderId with
  NativeChatPresentation/NativeChatContext. Echo response channel/text and ordering
  match source. Found missing receive-time sender identity and clan snapshots:
  the port previously filled most metadata only when opening the context menu.
- Added typed ChatSenderSnapshot: exact room-player lookup first, otherwise a
  unique case-insensitive live-name match, then self/friend identity fallback.
  Trusted relay rows preserve the exact wire ID. Clan fields are copied only
  from the exact wire player, matching original writeChatMsg.
- Applied before native updateTexts publishes the row, so metadata remains with
  history after the room player disappears. No live player object is retained
  in the message and these fallbacks never authorize relay presentation/actions.
- Reviewed Player.clanName, PlayerManager.get_players and Game.playerManager
  against the supplied bundle. Updated existing chat fixture game-class identity
  and player-list contracts for runtime type validation; fixtures were not run.
- Type generation, typecheck, public/private builds and whitespace check pass.
  Live chat/context-menu parity remains unverified; this is not a claim that all
  chat typing or the full original client port is complete.

### Chat context metadata and action parity

- Fixed live-player context lookup to call native PlayerManager.get_playersById;
  the port had read an unavailable plain playersById field. Validates the native
  manager rather than requiring a primary Game, preserving floating-view contexts.
- ChatMessageContextData now has a typed message metadata contract and no Raw/any
  declarations. Its dynamic property boundary handles Haxe get_name-style
  accessors as well as ordinary BigDB/history string fields, with checked unknown
  values and the original empty-string failure behavior.
- Restored source auxiliary-context restrictions: no block handler means Block
  is disabled, including after metadata refresh. Optional onCopy callbacks now
  take precedence over browser clipboard transport. Live clan metadata populates
  the same clan-name cache used by asynchronous profile/clan lookups.
- Restored MessageLog.removePlayerMessages active-view refresh for every caller,
  through NativeAdvancedChat's existing refresh/batching path (or simple view's
  updateTexts). Removed the context-menu-only manual rebuild. Refresh cancels
  pending receive rows so removed history cannot return through the debounce.
- Typecheck, public/private builds and whitespace check pass. Runtime tests remain
  paused; context hit testing, browser clipboard and live removal/render behavior
  still require comparison with the original client.

### Simple-chat clear lifecycle

- Compared source ChatSimple.clearMessages with clearLocalChat fallback and the
  installed simple-view adapter. The fallback cleared only the text field; it
  left SimpleChatImages thumbnails and the adapter's pending refresh state alive.
- NativeSimpleChat now owns clearMessages, clearing pending refresh/deadline,
  expiry, text and vertical offset. SimpleChatImages.clear releases every
  thumbnail after detaching its size callback; dispose shares the same cleanup.
  The instance method is restored/removed on plugin cleanup.
- Existing /clearchat already empties the shared received queue in place and now
  reaches this method. Input/sent history remains independent and unchanged.
  Updated the existing simple-chat fixture's cleanup API contract; tests not run.
- Typecheck and both builds pass. Visual clearing, late image callbacks and
  view/room-switch behavior remain pending runtime verification.

### Typed WrapText measurement boundary

- Converted NativeWrapTextMeasurement to central WrapText/StarlingTextField
  bindings and GameReflection hooks. Removed Raw/any, ad-hoc class lookup,
  generic property reads and non-null assertions from this measurement adapter.
- Reviewed native TextField constructor/options setters, WrapText.measure/field
  and Rectangle dimensions against the current supplied Haxe bundle. Visible
  format/text and measured bounds now use their native typed getters directly.
- Preserved native text/color extraction, outline-font fallback, cloned format,
  HTML bitmap metrics, per-panel measurement-field reuse and cleanup ownership.
  This pass does not claim a new wrapping-algorithm or visual-parity fix.
- Updated existing measurement fixture to bind the central game classes. Type
  generation, typecheck, public/private builds and whitespace check pass; tests
  and live popup comparisons remain paused/pending.

### Target/debuff source audit and typed observation

- Rechecked target resource visibility, nearby scan budget/order, row layout and
  click selection, aura ellipsis/pulse and debuff stack/expiry rules against the
  original TargetInfoElement, NearbyTargetBar, AuraTextRoller and DebuffEffect.
  No new behavioral mismatch was established on those inspected paths.
- Converted DebuffTracker to central Unit bindings and GameReflection hooks,
  removing Raw/any from the observer. Observation uses a typed alive contract,
  object-identity storage and a typed game clock; it never changes native combat
  or regeneration state. Unit doDOTEffect, scene owner and optional destroy
  effects flag were reviewed against the supplied Haxe implementation.
- Updated existing debuff fixtures for central bindings and typed scene/image
  validation. Type generation, typecheck and public/private builds pass. Tests
  remain paused; this source audit does not prove stable target ordering or
  high-refresh visual parity in actual gameplay.

### Missing projectile thrust-anchor frame port

- Found a missing functional change in Emitter.hasStaleTarget and the original
  Missile/Boomerang constructors: source uses ProjectileThrustAnchor, while the
  Haxe states still create a plain GameObject and move it only during execute.
  Existing emitter frame updates therefore continued sampling tick-positioned
  missile/boomerang exhaust despite interpolated projectile drawing.
- Added typed ProjectileThrustAnchor integration. Before native state entry/
  execution, associates its existing engine dummy with the projectile lifecycle.
  Emitter pose reads sample the projectile's rendered x/y/rotation and subtract
  its radius along that rendered heading, preserving zero authored trail rotation.
- Added anchor validity to stale-emitter detection: dead projectiles, absent
  movie clips and pooled/reset generations invalidate the attachment. Existing
  emitter kill/cleanup then retires it. Native AI and course updates remain intact.
- Added Missile/Boomerang/Projectile central bindings and reviewed native state
  fields, projectile reset/alive and radius getter declarations. Updated existing
  emitter installer fixture binding/cleanup contracts; tests were not executed.
- Type generation, typecheck, public/private builds and whitespace check pass.
  Actual missile/boomerang trail smoothness and pooled-projectile cleanup need
  live verification; full rendering/port parity is not yet established.

### Attached-projectile render transform and typing

Compared `Projectile.drawAttachedTo` and `MissileStuck.draw` with the original AS3 source. Rotation about the host and fractional convergence correction match. The attachment path now calls the shared render-position accessors, preserving their pooled-clip readiness guard instead of duplicating it. Missing accessors fall back to simulation coordinates. Native collision and stuck-state execution remain unchanged.

Removed `Raw` and dynamic property reads from `ProjectileAttachments.ts`. Added central MissileStuck/ProjectileStuck constructor bindings and typed attachment hooks. Reviewed Heading position/speed/time/rotation, projectile convergence/error/scene/course, stuck-state projectile/host, and GameObject rotation signatures against the current local Haxe bundle; regenerated declarations.

Validation: TypeScript check and public/private builds passed. Runtime tests and visual comparisons remain paused; this does not establish live rendering parity.

### Projectile render bindings and server-course gap follow-up

Moved projectile draw/update/reset hooks and pool checkout to central Projectile, ProjectileManager and GameScene bindings with GameReflection. TorpedoFrames now stores Projectile/GameScene instances rather than Raw objects. Reviewed native projectile kind/weapon fields, Weapon.key, GameObject.draw and ProjectileManager.getProjectile declarations and regenerated Game.d.ts. The public draw helper reads the native rotation getter directly and uses the original Game.renderInterpolationAlpha fallback of 1 when no state machine exists. Existing synthetic fixtures were adapted to the typed boundary and binding initialization; tests were not executed.

The broader Xhersix gap is confirmed, not resolved: current Haxe ProjectileBullet.execute still applies the legacy integer convergence correction and advances heading before its old endpoint collision path. Original executeServerBullet instead catches up on server time and sweeps shot/target movement across the same short interval, with boost-transition guards. Current Haxe ProjectileManager.updateCourse still applies the legacy error/convergence branch for kind 3; original delegates eligible shots to applyServerBulletCourse. Completing parity requires the related spawn initialization, movement-only catch-up, snapshot adoption, collision sweep, hit observers and per-life reset as one coherent feature. The current display-only TorpedoFrames is not evidence those pieces are ported.

Also checked createSetProjectile in the new Haxe bundle: it already assigns nonzero Instant range before fastforward. That particular old-source fix must not be reimplemented as a missing feature.

Validation: typecheck, public build and private build pass. No runtime tests or visual parity claim.

### Xhersix server-course and collision path implemented

Implemented the connected original prediction path in `projectile/TorpedoCourses.ts` and `TorpedoTimeline.ts`, sharing TorpedoFrames' per-life setting/type eligibility. This supersedes the preceding entry's implementation gap for movement and collision (runtime validation remains outstanding).

- Eligible server spawns retain their server heading, use the normal collision radius, and catch up movement without historical collision checks. Lifetime ages once for the elapsed catch-up ticks.
- Server corrections replay movement to the existing course time without charging lifetime again, clear the legacy convergence offset and reset rendered angular delta. Mixed correction packets preserve native ordering, unknown-projectile early return, and current Haxe behavior for other projectile kinds.
- Fixed ticks sweep shot and target motion over the same bounded interval. Source guards reject discontinuities, stale headings and boost transitions; stable relative-circle geometry selects the earliest eligible hit. The projectile is destroyed at that impact point without applying the legacy sideways contact correction.
- Reset discards per-life timing. Both incoming-hit and personal-hit observers consume the explicit selected contact at destroy, avoiding duplicate explode attribution and the legacy last-scanned-candidate guess. Native damage/shield calculations and unrelated projectiles are retained.
- Newly reviewed game members live in Signatures.json/Bindings.ts. The new prediction modules contain no Raw or any declarations.

Source audit checked native Projectile.update/destroy, pool reset, createSetProjectile, updateCourse, GameObject coordinate setters and the host around-hook ordering. Original AS3 diagnostic contact snapshots/debug overlay callbacks are not implemented by this change; those remain a separate diagnostic gap. Runtime tests (especially delayed/reordered corrections, mixed packets, boost boundaries and high-refresh rendering) remain paused per the user. Typecheck and public/private builds pass; visual/behavioral parity is not yet verified.

### Login completion listener and artifact-link discoverability

Compared Login loading status text/layout with original LoadingBar and Login.as: the texture/network/detail wording, sizes, spacing and returning-player completion order match the implemented path. Restored removal of the Haxe-bound preloadComplete listener on completion; the port previously retained it until display teardown.

Found and ported MessageLog.showArtifactHoverTipAfter: the first new visible valid artifact link now receives the original gray system hint immediately after it, with a 60-second timeout and native extended queue cap. Muted source/system channels and malformed tokens do not consume the once-per-client hint. Existing queued rows are not treated as newly received messages. The insertion bypasses sender snapshot/message parsing hooks, preventing the system tip from inheriting the sender of the artifact message. Added typed ChatMessage queue declarations and a typed installer.

Typecheck, public/private builds and whitespace validation pass. Runtime tests remain paused; the new hint's live placement and login transition remain unverified.

### Emitter restart and prewarm timing mismatch

Compared Emitter.play/killEmitter/updateParticleCount/drawParticels with the original source. Found that the port only reset its emitted-particle sequence on dispose, and native play does not reset the fractional emission accumulator. Added source-equivalent restart resets on play and terminal resets on killEmitter/dispose. Terminal reset also clears pending fractional ages for pooled particles, so reuse cannot inherit an earlier emission's age.

Found a second integration gap: the display loop called EmitterFrames directly while native Emitter.fastForward still invoked the unpatched native update. The current bundle has a warp-effect caller using fastForward. Routed Emitter.update to the same elapsed-time implementation, with the source 33 ms default for calls without an argument; render-frame updates remain once per frame and native manager tick updates remain suppressed for the active session.

The adjacent combat-text review confirms the new Haxe Game/TextManager pass seconds, while original AS3 passes milliseconds. The existing CombatTextFrames conversion is therefore necessary and correct; no unit-conversion change was made.

Typecheck, public/private builds and whitespace checks pass. Existing installer fixtures now include the newly hooked native lifecycle methods. Tests and live high-refresh/warp comparisons remain paused and unverified.

### Shared particle geometry and room teardown

Ported the missing CollectiveMeshBatch.beginUpdate behavior before the display-frame emitter pass (and before native manager updates during initialization). Clears custom/shared effect geometry even if every owner stops or is culled before drawParticels. Includes Haxe's newer normal/rainbow batch; it remains a separate native batch.

Added typed EmitterLifecycle with original Emitter removal/disposal invariants: detach batch membership before resetting the emitter, clear the retained batch pointer, and make manager disposal idempotent. clean() now returns after manager disposal or when its active collection is null, matching the original guard for unit/projectile resets late in room teardown.

Also corrected native CollectiveMeshBatch.disposeAll's dependency on effectsBatch: custom batches are disposed even when no shared effects batch was created. Preserves newer rainbow disposal. Reviewed native fields and methods, added central bindings and generated signatures; inherited MeshBatch.dispose is declared at its actual owner.

Type generation against current astroflux.js, typecheck, public/private builds and whitespace checks pass. Tests remain paused. Live stale-particle and room-transition behavior is not yet verified.

### Typed shared rendered-position contract

Replaced RenderPosition's Raw receivers, read helper and ad hoc class lookups with GameObject/Engine/Projectile/Body central bindings and typed native getters. Confirmed current GameObject.get_hasImage is the same imgObj-presence check used by the previous readiness logic. Retained draw-readiness invalidation on reset/canvas changes and the original engine mount transform. Cleanup now restores hasRenderPosition only if this installer still owns its getter.

Added one RenderedGameObject extension interface for optional client-installed accessors. RenderPosition, attached-projectile rendering and combat text share it rather than independently declaring different subsets. Native signatures were regenerated from the current bundle; synthetic render fixtures now expose native getters explicitly.

Type generation, typecheck, public/private builds and whitespace checks pass. This is a typing/integration change, not proof that the pending visual comparison matches. Runtime tests remain paused.

### Scoped Haxe declaration discovery and static primitive inference

Found a generator correctness bug during the typing audit: the flat variable-name initializer map selected a different lexical binding for 178 reflected classes in the current minified bundle. Some selected nodes were unrelated function bodies or even expressions rather than constructors. Switched constructor, superclass, member-assignment and mutation resolution to TypeScript's symbol binder. Native Math/String/Array/Date metadata retains an explicit global fallback because those constructors have no local declaration. All 1,052 reflected classes remain available and every reviewed signature still resolves.

Added conservative static primitive inference: all recorded direct writes must have known primitive types; unknown/compound writes and computed dynamic writes prevent inference. Reviewed signatures take precedence. This recovers 2,274 static fields as number/string/boolean or explicit primitive unions instead of any. Constructor defaults alone are deliberately not used to assert lifetime types for instance fields.

Validation: generation against the current bundle, normal project typecheck, standalone declaration typecheck without skipLibCheck, public/private builds and whitespace checks pass. The broader project check with skipLibCheck disabled encounters linkedom's DOM declaration conflicts; the standalone game declaration check avoids that unrelated test dependency and passes. Runtime tests remain paused. Instance/method typing and full visual parity are still incomplete.

### Typed emitter target lifetimes

Removed Raw maps, any constructors, dynamic ID reads and a non-null assertion from EmitterTargets. Constructor types now come from central Engine/EnemyShip bindings; enemy identity uses the reviewed native get_id getter. The narrow EmitterTargetContext describes only the target/registry identity needed by both real emitters and delayed factory requests. Existing generation, engine ownership and projectile-thrust lifecycle semantics are retained. Missing enemy registries now invalidate the target instead of throwing during the stale-target check.

The adjacent EmitterFactory source review found additional unported behavior to address next: original create defaults missing positions to NaN, falls back to target rendered coordinates and rejects invalid coordinates; current Haxe defaults them to zero. Original delayed multiple creation retains canvasTarget and fractional positions, whereas the current native closure omits canvasTarget and truncates coordinates. The existing EmitterDelays wrapper protects target lifecycle but does not fix those argument differences. Do not count factory parity as complete.

Type generation, typecheck and public/private builds pass. Tests remain paused; no live lifecycle or delayed-effect claim.

### Emitter factory request semantics

Replaced EmitterDelays' untyped global timer interception with a typed EmitterFactory wrapper using central bindings. Missing/nonfinite positions now resolve from the target's rendered coordinates; invalid targetless positions return an empty result with the original diagnostic wording. Delayed multiple effects retain fractional coordinates, canvasTarget, play/render-list flags and the explicit lifetime flag. Their target generation and leaving-game guards remain; plugin unload cancels owned callbacks and invalidates late invocations. Unrelated TweenMax timers are no longer intercepted.

Beam initEffects now establishes the source retained-emitter lifetime while constructing its endpoint effects, including delayed children. Existing beam teardown still releases its referenced effects. Native emitter construction, textures and newer rainbow configuration remain in place. Effects metadata reads are local JSON-cache lookups (confirmed in current DataManager.loadKey); valid creation performs an additional cache lookup, not another network request.

Added reviewed factory/TweenMax declarations and the narrow EffectSequence data shape. Updated the existing fixtures for the changed factory contract and added assertions for fractional coordinates, canvas preservation, rendered-coordinate defaults and canceled callbacks; these assertions have not been run because tests remain paused. Typecheck and public/private builds pass.

Remaining factory source differences identified in the same review: per-emitter authored delay and pre-resolving every texture before taking emitters from the pool. These are not covered by the request wrapper and still need implementation/audit. Live effect parity is unverified.

### Emitter texture preflight and authored delay

Ported original EmitterFactory texture pre-resolution before any pool checkout. A scoped synchronous context supplies the resolved textures to native construction and invalidates reused emitter texture keys so a cached texture cannot bypass preflight. Nested factories restore their parent context in finally blocks; preflight itself runs outside the parent context. Returned emitters now receive their authored delay (default zero). The native factory still constructs emitters and handles newer rainbow fields. Added reviewed resolveTexture/getEmitter/oldImageKey/delay signatures.

Type generation, typecheck, public/private builds and whitespace checks passed. Updated synthetic fixture hook surfaces; tests remain paused and no live rendering comparison was performed. Full factory parity is not claimed: native singleUse offscreen culling remains, whereas the original client removed it; this needs reconciliation with effect timing before marking factory parity complete.

### Offscreen factory creation and typed emitter mirroring

The original EmitterFactory diff explicitly deletes singleUse camera rejection. Ported that deletion by supplying a shallow Effects record with singleUse=false only during synchronous native creation. The shared cache remains unchanged, nested contexts restore correctly, and native non-Effects lookups still run normally. Added central DataManager binding and reviewed loadKey overloads. Native construction now reuses the already-read effect record instead of performing a duplicate cache lookup. Existing offscreen emitter updates age the effect without spawning particles.

Converted EmitterMirroring to central Emitter/EmitterFactory bindings and typed native size/clip getters plus the shared RenderedGameObject accessor. Retained source unsigned hull scaling, authored negative sizes and separate vertical mirroring; updated its fixture to initialize bindings. Reviewed native size setter return values and regenerated declarations.

Type generation, typecheck, public/private builds and whitespace checks pass. Runtime tests and live comparisons remain paused/unperformed; fixture changes are not test results. Remaining source-order difference: native create invokes play before assigning followTarget.target and uses requested coordinates until the first update, while source assigns the rendered target coordinates before play. Audit this alongside camera-shake hooks.

### Followed emitter initialization before playback

Original EmitterFactory assigns followTarget.target and rendered posX/posY before play; current Haxe plays first. Added a scoped before-play hook for the current factory's game/key to initialize that target and rendered position without replacing native playback. The same initialization runs on returned effects, covering play=false beam effects. Reviewed Emitter game/key/followTarget/target/position/play signatures replace the relevant untyped fields. Existing tests' mock surfaces were updated but tests remain paused.

Audited original StarlingCameraFocus.update against updateCamera: elapsed tracking/zoom coefficients, focus bookkeeping, view update order and callback logic match at source level. Original shake is empty and installInterpolation already suppresses it per game session and resets its timer. No new shaking behavior was introduced. Runtime camera tracking and visual parity still require live comparison.

### Emitter pool return and disposal reset parity

Compared original EmitterManager/Emitter disposal with current Haxe. Native checkout already disposes before reuse, so that behavior was retained. Native removal returns the emitter to the inactive pool before disposal; changed removal to the source order: kill, remove from active array, dispose, then expose for reuse. Terminal managers ignore late removals, consistent with the existing terminal clean guard.

Added the source disposal resets missing from native code: timeElapsed, posX/posY, key/name and forceUpdate. Existing hooks already clear fractional emission state, target ownership, retained lifetime, mirror state and aura layers. The display-frame manager loop now removes stale-target effects immediately, matching the original manager instead of killing during update and deferring pool return to the next frame. Kept the stale guard inside direct update for callers such as fastForward.

Type generation, typecheck, public/private builds and whitespace checks passed. Fixture hook surfaces were updated without running tests. Live room-transition and pooled-effect verification remain pending. After the reported PC restart, verified the saved files and collected the successful completion of the build process.

### Chat echo and typed friend-mention snapshots

Rechecked MessageLog.writeChatMsg's exact echo. request handling against NativeChatPresentation: length validation precedes response; self requests are excluded; global/private requests reply privately to the supplied sender name and other channels reply locally. Release text is shared with /echo. This is source evidence, not a live network verification.

Found and corrected a friend snapshot lookup mismatch: original findLivePlayer resolves an explicit ID through playerManager.playersById before considering unique name matches. The port previously searched only the materialized players array. Friend ping snapshots now use the registry first and preserve the source own/online/offline precedence and unique-name fallback.

Removed Raw/read/ad hoc class lookup from ChatFriendPingTargets. Uses central Player and GameScene, native player getters, native activeSkin field, and typed FleetObj paint fields. Confirmed current native getActiveFleetObj calls getFleetObj(activeSkin), which returns a matching FleetObj or null. Added reviewed friend/skin/fleet signatures and solar-system name. Existing untyped presentation boundaries validate the game with GameReflection.cast before entering the typed snapshot function. Updated fixtures for native getters and bindings; tests remain paused.

Type generation, typecheck, public/private builds and whitespace checks passed. Main/floating chat live parity is still unverified; the surrounding presentation modules still contain older untyped code.

### Typed floating-chat projection and role helpers

Compared formatFloatingChatRow with the port: channel/text/sender identity/supporter/ping snapshot fields and relay handling match the source projection. Source floating rows deliberately retain the wire sender ID and do not use the primary-room persistent-identity fallback. Kept that distinction; no primary-room command or echo behavior was added to auxiliary chat.

FloatingChatPresentation now returns FormattedChatMessage, uses central MessageLog and reviewed colorRights/colorCoding/profanities declarations, and has no Raw/any. Its game entry remains an object boundary validated with GameReflection before the typed friend snapshot. ChatRoleTags now infers its class return type, describes player badges and the required style color explicitly, returns a non-null string when prepending tags, and uses typed DisplayObject parent getters/child indices for the original sibling-order coverage walk. This removes reliance on property aliases in this helper without changing its source ordering rule.

Type generation, typecheck, public/private builds and whitespace checks passed. Runtime tests remain paused; visual role-popup/floating-chat parity is still pending. No claim that the old property-alias path was observed failing live.

### Typed floating-chat model and transport source review

Audited original FloatingChatWindow receiveChat/sendText and FloatingChatConnection against the port. The reviewed paths retain isolated history/reply ownership, accepted channels, command aliases, malformed-packet handling, private/group targets, Global sanitization, artifact-channel restrictions, markup validation, primary/auxiliary chat restrictions, shared send slots, synchronous pool acquisition handling and generation-guarded teardown. This review does not establish runtime socket/UI parity.

FloatingChatModel no longer uses Raw: history and local status rows share ChatHistoryMessage, and receive accepts the exact length/getString/getBoolean packet surface from native Message. Formatted player rows refine that history shape. Whisper target normalization now calls the same ChatPlayerCommandNormalizer as the source rather than duplicating its expression. The window's model adapter uses central Player/MessageLog and native player getters for IDs, roles, known names and history limits.

Updated the packet fixture to expose typed primitive getters, including an explicit unreachable boolean getter on the malformed-row case. Typecheck, public/private builds and whitespace checks pass. Tests remain paused; these fixture edits are not executed test evidence. The surrounding floating window/view/composer still have untyped code and require further work.

### Ported /torptiming measurements and local reporter

Found /torptiming documented in the port's help/changelog but absent from command handling. Ported XhersixTorpedoSpawnTiming and XhersixTorpedoSpawnTimingReporter into typed TorpedoSpawnTiming/TorpedoTimingReporter, and added NativeTorpedoTiming integration, the reserved command, autocomplete and original help text.

Preserved exact numeric (owner,timestamp) volley deduplication, 256 recent entries, 64 LRU shooter baselines, unsigned arrival-clock wrapping including duplicate receipts, late-stamp reporting without baseline replacement, first-spawn zero anchor, spawn/arrival gaps, gap change, jitter and drift. Reporter retains source messages, 64 queued rows, batches of eight every 16ms, omitted-row counts, off flushing and reset/on clearing. Room manager disposal and plugin cleanup cancel reporters/timers.

Inspected current Haxe addEnemyProjectile and Heading.parseMessage: records are 17 fields, owner/weapon indices are offsets 1/2, and server time is offset 3. The early prototype hook reads incoming records before native culling/catch-up; native stall gates and movement remain untouched. Resolves enemy weapons or turret fallback as in source. Turret lookup uses the verified native silent boolean to avoid duplicate diagnostics from this observer. Current declarations now cover the packet hook, manager lifecycle, weapon collections and turret lookup. New modules contain no Raw/any/ad hoc class lookup.

Type generation, typecheck, public/private builds and whitespace checks pass. Tests remain paused; actual packet output and timer/room-transition behavior have not been run. /torpdbg's full recorder/overlay and /testchatspeed are still absent and are not covered by this implementation.

### Ported /testchatspeed and browser chat profiling

Ported original ChatPerformanceProfiler's session lifecycle, 20,000 raw-sample limit, aggregate counts/totals/maxima, exact nearest-rank p50/p95, quoted CSV fields, three-decimal numeric output, per-view sanitized filenames and frame-interval tracking. Browser memory is optional usedJSHeapSize, explicitly identified in the CSV; unavailable memory remains blank rather than fabricated AIR totalMemory.

Added ChatSpeedTest and command/autocomplete/help wiring. Generates the original 300 numbered local debug rows with progressively repeated i/m/W glyphs at a nominal 60 Hz, then allows the original 500ms render tail. Repeating while generating cancels and exports a cancelled capture; a command during the tail leaves the active capture alone. Session cleanup cancels owned timers and exports an active cancelled profile. Per-instance ownership prevents a stale session cleanup from finishing a newer session's profiler. Browser Blob downloads replace AIR Documents/application-storage writes; no network chat is sent.

Instrumented actual port paths: MessageLog.write; Simple enqueue/rebuild/frame and label layout; Advanced enqueue/flush/refresh/bottom-scroll/frame; virtual list layout; rich message renderer validation. Native Haxe layout/validate phases are named honestly in CSV instead of claiming to time the old Feathers draw implementations. Sampling clock/geometry reads in hot paths are gated by active profiling. Original snapshot values (queue/text length, rows, area, scroll bound) are retained where corresponding operations exist.

Type generation, typecheck, public/private builds and whitespace checks passed. New profiler/runner modules contain no Raw/any. Tests remain paused: /testchatspeed was not invoked, browser download delivery and live metrics have not been verified. The command is now implemented, but this does not resolve the remaining renderer-parity work or /torpdbg recorder/overlay gap.

### /torpdbg foundation: detached projection and bounded log

Started the full XhersixTorpedoDebug port (the source spans controller/details/log/overlay/projection). Added typed TorpedoDebugProjection with readonly scalar heading/physics inputs and explicit result validity/reason. Preserved the independent 33ms client-model operation order, acceleration clamp/friction, fractional render interpolation, 20-second/607-step replay limits, finite/magnitude guards, future/stale/wave rejection and original diagnostic reason strings. This module is diagnostic only and is not called by gameplay prediction/collision code.

Added TorpedoDebugLog's detached serialization and JSONL ring: 15,000 events, 8 MiB with header accounting, 64 KiB per record including newline, exact UTF-8 sizing with surrogate pairs, FIFO eviction, rejected/dropped counters, header/summary schema and non-destructive repeated snapshots. JSONL content is serialized at record time; live objects are not retained. Export snapshots return filename/content for a browser adapter instead of claiming an AIR filesystem write.

Typecheck and whitespace checks pass. No runtime tests were run, and these foundations are not yet connected to a user command or bundled runtime path. Full /torpdbg remains incomplete: typed detail snapshots, room controller, deferred history, event observations, overlay and browser save/error handling still need porting and verification. Do not count this as command availability.

### /torpdbg deferred tick-history queue

Ported the controller's history queue into typed TorpedoDebugHistory. Tick rows have named tuple slots matching the source player/projectile field order. Samples serialize at collection time, retain only ticks containing torpedoes, reject lines over 16,000 characters, and evict by 160-tick/512 KiB/5,500ms limits using unsigned receipt-clock differences. Serialized types account for non-finite numeric observations becoming JSON null.

Requests preserve reason, triggering sequence and receipt/server/simulation clocks, deduplicate by monotonically increasing tick ID, and only enqueue references to immutable serialized samples in the hot path. Pending output retains the source 160-entry/512 KiB limits with explicit per-drain and cumulative overflow events. Timer drains parse at most four samples per 1ms callback; save/stop can drain synchronously after cancelling the timer. Request grouping and sample clocks remain distinct from later event-export clocks. Reset invalidates timer generations and clears all queue/ring metadata.

Typecheck and whitespace checks pass. Runtime tests remain paused. This is another recorder component, not an exposed /torpdbg command: controller observations, detail snapshots, overlay and save adaptation remain to be integrated.

### /torpdbg bounded detail snapshots

Ported XhersixTorpedoDebugDetails to typed TorpedoDebugDetails. Preserved projectile/weapon/cache/owner/target fields, weapon damage and debuff snapshots, player health/resistances/movement/input/defense fields, faction lists, original uncertainty notes, 160-character scalar strings and bounded 16-item lists (five resistances). Lists retain total/truncated/limit metadata, non-finite numbers become null and unreadable optional fields remain null.

Added central PlayerShip binding for native class recognition. Reflection is confined to the bounded snapshot boundary and returns unknown until validated as a scalar; named field maps retain their key unions. Haxe getters are used before plain fields. Read-only damage summation and boost-history access remain guarded; cache access reads the existing Projectiles data table. No Raw/any or untyped constructor lookup in the new module.

Typecheck, public/private builds and whitespace checks pass. Tests remain paused. Recorder is still not exposed. Integration must explicitly bridge client-only course/render fields held in WeakMaps (serverBulletCourseEnabled, usesServerBulletCourse, spawn/collision/render timestamps); reflective nulls are not evidence that those runtime states are absent. Controller, event hooks, overlay and browser save/error handling remain pending.

### /torpdbg live course/render accessors

Bridged the five client-only fields previously inaccessible to detail snapshots. ProjectileDiagnostics defines optional typed, read-only Haxe-style accessors. TorpedoCourses exposes its existing WeakMap spawn/last-collision timestamps without allocating a timeline on read. TorpedoFrames exposes the setting captured for the current pooled life separately from actual server-course eligibility. ProjectileFrames records the course timestamp represented by the drawn pose before attached-state drawing and clears it on reset.

TorpedoDebugDetails now consumes those typed accessors directly. Non-finite/unavailable timestamps serialize as null. Checked original createSetProjectile: spawn time is assigned only for eligible server-course shots, matching the existing timeline path. Accessor installation preserves upstream own implementations and cleanup removes only methods still owned by this installer. Movement/collision algorithms were not changed.

Typecheck, public/private builds and whitespace checks pass. Tests remain paused; actual snapshot values have not been observed live. Remaining /torpdbg work: room-owned controller, event hooks, overlay and browser save/error handling.

### /torpdbg detached tracking and frame rows

Ported the original controller's ensure/spawn/course state, updateRow fields and cached shadow projection into typed TorpedoDebugTracker. Preserves FIFO 256-entry eviction, original generation increments, pooled-ID spawn reset, packet snapshot copies, correction counts, unsigned receipt/draw ages, frame-clock projection and visual-gap field aliases. Only heading-bearing course packets should call course; the future controller must preserve mode filtering. Model ticks are detached and invalidated by new raw snapshots, with the original 20-second window and cached partial-tick interpolation.

Typecheck and whitespace checks pass. Runtime tests remain paused. This module is not yet wired into the recorder: command/controller, observers, overlay and save adaptation remain incomplete. No new user-visible feature or live parity is claimed by this change.

### /torpdbg native snapshot overlay

Ported XhersixTorpedoDebugOverlay geometry, colors, captions, validity bounds, zoom behavior, per-frame position updates and 100ms text throttling into TorpedoDebugOverlay. Uses central typed native Mesh/MeshBatch/VertexData/IndexData/Text bindings. Native Text uses the existing bitmap bridge; no DOM overlay or substitute text renderer was introduced. Preserved 32-segment rings, 0.94 inner radius, velocity arrow dimensions, raw/projected/drawn/simulation markers, source uncertainty text, caption-slot identity checks, clear behavior and idempotent disposal.

Reviewed native constructors and mesh methods in the current astroflux.js before adding their declaration signatures. Typecheck and public/private builds pass. The overlay remains unconnected until the room controller and event hooks are ported; no runtime visual comparison has been performed and /torpdbg remains unavailable. Runtime tests remain paused.

### /torpdbg recording lifecycle and browser export

Added typed TorpedoDebugRecording to connect the log, history and tracker lifecycle. Preserves original command parsing/messages, unsaved-recording protection, metadata/tuple field descriptions, clock-stamped event envelopes, draw-age observations, clock-adjustment events, manual markers, stop/save flushing, delayed 750ms death saves and room-exit export/cleanup. Repeated death observations request newly captured history even while the existing save timer is pending; they do not postpone that timer. Observer failures stop collection while retaining the recording for manual export. Start/reset and disposal clear history timers and tracking state.

Added browser JSONL download adapter with temporary anchor removal and deferred object-URL release. Browser download handoff cannot confirm the user actually saved a file; this differs from the original local filesystem writer. The room adapter and packet/frame hooks are still missing, so the command is not exposed and no download/runtime behavior has been exercised. Typecheck and whitespace checks pass; runtime tests remain paused.

### /torpdbg typed native snapshots and sampling

Added TorpedoDebugSnapshots to read native heading/projectile/weapon/player state through typed game members and the existing optional rendered-position/course accessors. Raw player headings are detached on receipt and retained in the original 64-player FIFO, without refreshing order on replacement. Player snapshots retain simulation and render positions separately, raw server/receipt ages, health/shield and interpolation-time estimates. Reviewed current native owners before adding numeric/boolean/player declarations and the central Weapon binding.

Added TorpedoDebugSampling for source nearest-12 overlay selection at 100ms, per-frame selected projectile/player refresh, nearest-six player selection, per-tick nearest-24 torpedoes within 1200 units of nearby players, and damage candidate refresh/retention (2000-unit range, five-second stored-row age, nearest eight). Tick tuple order and omitted-shot count match the original controller. Existing tracker now exposes ordered iteration for stale candidate snapshots. No gameplay state is changed.

Typecheck, strict declaration check, public/private builds and whitespace checks pass. Runtime tests remain paused. Native packet/frame/contact hooks and the room adapter still need integration; these components do not expose /torpdbg yet, and full runtime parity remains unverified.

### /torpdbg packet observers and aligned contact bridge

Added typed TorpedoDebugObserver methods for spawn, activation, before/after course updates, client contacts, local/server removal, player raw-course receipts, damage and fatal packet snapshots. Preserved original event names/notes, bounded fatal text, course-mode distinction, raw heading capture, candidates without attribution, history requests and death-save scheduling. Observer exceptions stop diagnostics without escaping into native packet handling. Converted detached diagnostic data shapes to type aliases for structural log serialization; optional properties are explicitly permitted as omitted JSON object fields, without untyped casts.

Added a scoped subscription boundary in TorpedoCourses for the original aligned-contact snapshot: sweep interval/fraction, impact time/position, shot and target segment endpoints, combined radius and uncertainty note. It fires before applying the impact point. Native motion/contact selection and destruction order remain otherwise unchanged; snapshot allocation occurs only with subscribers. The future installer must unsubscribe on plugin cleanup and route these events to the matching room recorder.

Typecheck and public/private builds pass. Runtime tests remain paused. Observers are not wired into native handlers yet; current packet layouts and callback ordering must be verified during that integration. /torpdbg remains unavailable, and no live recording or visual parity is claimed.

### /torpdbg room composition and shared render clock

Added TorpedoDebugRoom to compose recording, native overlay, snapshots, sampling and packet observers for one GameScene. Uses typed get_me/player dictionary access, clock reads that do not write simulation time, matching frame interpolation, camera-centered selection, original frame/status events, overlay-specific failure text and idempotent room cleanup. Markers retain selected tracked entries and player snapshots; selection distance is now retained on tracker entries as in the original.

TorpedoFrames now exposes its per-game cached render timestamp to the room adapter so diagnostic projection and corrected drawing use the same frame clock. Added reviewed canvas/projectile-array/camera-center/system-type declarations. Typecheck, strict declarations and public/private builds pass; runtime tests remain paused.

Inspected current native ProjectileManager: course packets use 14-field records, kill packets list IDs, remove resets pooled state, and update performs projectile updates before removal. Integration must observe each course record before and after application, not bracket an entire multi-record packet: repeated IDs otherwise lose intermediate states. Native hooks and command exposure are still pending, so /torpdbg remains unavailable and live parity unverified.

### /torpdbg native wiring and command exposure

Wired /torpdbg into LocalClientCommands, help and autocomplete, with one lazily created TorpedoDebugRoom per GameScene. Installed typed hooks before native listener binding for activation, local destruction, manager simulation ticks, game draw, damage/death, player course/boost and disposal; plugin cleanup disposes all rooms and subscriptions. Spawn snapshots are captured after Heading.parseMessage within the scoped native addEnemyProjectile callback, preserving spawn/activation interleaving without rewriting native spawn or stall handling. Kill snapshots occur on each native ID read within killProjectile, preserving server-kill/local-destroy ordering for repeated IDs.

Added per-record observer subscriptions to the existing source-ported course application path. Active recording routes course packets through that path even without eligible corrections, preserving before/after states for repeated IDs and native first-unknown-ID early return. Inactive recording retains the previous native fallback. Verified current 14-field course, 17-field spawn, damage, death and player-heading layouts against astroflux.js. Fatal XP is read as the current numeric wire field and converted to the original string log representation.

Typecheck and public/private builds pass. Runtime tests remain paused; command, canvas integration, downloads and reload cleanup have not been exercised live. The corrected torpedo contact callback is wired before applying the solved impact point. Remaining known /torpdbg parity gap: legacy/non-corrected bullet contacts still lack the original pre-solver client_contact observation. Do not treat command exposure as proof of complete recorder or overall port parity.

### /torpdbg legacy pre-solver contact observation

Added LegacyTorpedoContacts and connected it to the room observer. The audited native legacy ProjectileBullet loop reads candidate get_pos().x and get_pos().y after eligibility and before its swept-box test/solver. The hook captures those two values, preserves the native rotated bounds and boundary comparisons, and emits the original null-alignedContact event when that same test succeeds. It does not invoke canBeDamage again, replace the native execute loop, or write movement/collision state. Corrected server-course shots continue through the existing explicit contact callback.

Snapshot reads and explode/destroy effects suspend observation so nested position reads do not become candidates. Bomb/one-hit branches close the scan at the first confirmed test. Nested execute calls restore previous scan ownership. Inspected current Haxe Unit inheritance: Ship is the only descendant that owns get_pos; the GameObject and Ship hooks cover the current hierarchy. Added reviewed isBomb/numberOfHits/explode signatures.

Typecheck and public/private builds pass. Runtime tests remain paused. This closes the known source implementation gap but is not runtime evidence: the read-pair observation relies on the current audited native loop and must be checked again when that loop changes. Full recorder behavior, canvas presentation, download and reload cleanup still need live verification, as does overall port parity.

### Network monitor typed native/SDK boundary

Reviewed the original loading-status and chat-history implementations against their existing port modules; absence of matching AS3 filenames in the inventory is not evidence those behaviors are missing. Continued the requested typing pass on NativeNetworkMonitor: removed Raw/read/NativeUI/ported constructor lookups, using central Sprite/Quad/Starling/TextField/MessageLog/Localize bindings, typed native frame events and typed chat input. Preserved dimensions, colors, font, explicit text flags, timing, receive deduplication, command text and unavailable-byte indication.

Added PlayerIOMessageSerializer/PlayerIOSDKMessage contracts against the locally cached SDK: serializeMessage reads type/length and private get-objects/get-types arrays and returns byte numbers. Extended the existing _pio declaration rather than casting globalThis. Added reviewed native chat-input/TextEntry and addChildToOverlay signatures (the latter's second argument is blockHotkeys:boolean). Older game-session and dynamic floating-chat display boundaries now use GameReflection validation before entering typed APIs.

Typecheck, strict declarations, public/private builds and whitespace checks pass. No runtime tests were run; NetworkMonitor capture plumbing still uses the older NativeTraffic module and that module remains untyped. This is a typing/source audit, not new evidence of live UI parity.

### Typed Game/Service traffic collection

Converted NativeTraffic to central Connection/GameScene bindings and GameReflection hooks. TrafficObserver now receives PlayerIOSDKMessage, underlying send subscriptions use PlayerIOSDKConnection, and session ownership is a typed per-game WeakMap. Preserved SDK message identity, current Game/Service handler membership, send synchronization before wrapper sends, immediate service-replacement synchronization, 250ms fallback synchronization and stale-subscription disposal. Raw casts and stringly typed Connection lookup were removed from this collector; existing callers validate their game at the shared boundary.

Reviewed native Connection.runMessageHandler, rawSend/send/sendMessage and message registration. Added exact wrapper registration-array and SDK-connection declarations, plus the SDK message getters used by packet decoding. NativePacketDebug.debugMessage now accepts the SDK contract. Updated the shared ServiceRoom fixture's native-shaped handler array and SDK send boundary while retaining its test-facing messages map; no fixture tests were executed.

Typecheck, strict declaration check, public/private builds and whitespace checks pass. Runtime tests remain paused. Profiler/debug-window presentation and other older modules still contain Raw/any, so the plugin-wide typing requirement is not complete. These checks do not prove live packet counting, reconnect behavior or full port parity.


### Typed profiler sampling and live native fields

Converted NativeProfiler to central bindings and GameReflection, with typed manager hooks and a typed ProfilerPanel factory boundary. Added reviewed manager fields/update signatures. Fixed RTT status to read clock.latency (the former networkLatency property does not exist in this Haxe build), state timing to use gameStateMachine, and frame sampling to listen to Game enterFrame rather than infer frames from parallax updates. Cleanup removes the frame listener. Heap metrics and the optional custom command registry retain bounded unknown validation.

Typecheck, isolated strict declaration check, public/private builds and whitespace checks pass. Runtime tests remain paused. ProfilerWindow internals still use Raw, and current per-method timing labels do not yet reproduce all original grouped phase measurements. No claim of full profiler or overall port parity; no deployment performed in this pass.


### Profiler original status header and equivalent timing captions

Compared original Game.getProfilerState and SceneBase.getProfilerState against NativeProfiler. Restored the missing Units / Projectiles / Emitters / Players header using collection lengths, with RECONNECTING driven by the existing game recovery state. Added the reviewed native emitterManager type. Restored original captions for equivalent ship, weapon, projectile, state, floating-text and total-tick measurements. Kept non-equivalent manager measurements labeled as such rather than relabeling them as original grouped phases.

Typecheck, strict standalone game declarations, public/private builds and whitespace checks pass. Original grouped CPU phases, complete frame CPU timing, native-window typing and live UI comparison remain unfinished. No runtime tests or deployment in this pass.


### Login connection-status entry points restored

Compared original Login.showRoomConnectionStatus/showRoomConnectionRetry and loading completion to LoginLoading. The preload had the correct separate lines internally, but the public source entry points were absent. NativeIPCAuthentication.reportReserved consequently fell back to updateStatus, targeting the old connect overlay instead of the preload network line. Added typed Login declarations and installed both methods against the current loading attempt. Completed, failed, replaced and disposed attempts do not receive updates; retry detail does not replace the phase. Cleanup restores prior descriptors only while these implementations still own the properties.

Typecheck, standalone strict declarations including the augmentation, public/private builds and whitespace checks pass. Runtime tests remain paused. Login screen appearance, actual reserved-room error presentation and complete original/port connection parity remain unverified in the browser.


### Typed IPC authentication and reconnect hook ownership

Replaced NativeIPCAuthentication Raw/read/class-string accesses with central bindings, typed GameReflection hooks, native connection getters, typed client ownership and a bounded registry dictionary. Reviewed current Haxe getServiceRoomID/isValidServiceRoomId and added precise static signatures. NativeMessage now accepts unknown and validates reflected SDK fields without coercing malformed packet values; it retains getter/property fallback, field-count checks, detached field arrays and failure isolation.

Source audit found installer ordering bypassed IPC reconnect success handling: installServiceReconnect replaces its next implementation, but was installed after the IPC wrapper. Install recovery first, then IPC. The outer IPC reconnect wrapper now reports a reserved destination but delegates rejection to recovery, retaining its failure callback and rollbackForbidden policy rather than silently returning. Direct joins and room listing filtering still reject reserved IPC destinations.

Typecheck, public/private builds and whitespace checks pass. Runtime tests remain paused. NativeIPCClient and other older modules still require typing; reconnect/restore behavior needs live verification. No deployment in this pass.


### Typed IPC client/socket adapter

NativeIPCClient now accepts the native Client identity/multiplayer surface and wraps typed Connection objects. Socket handlers carry native Message values into the validated NativeMessage decoder; connected/roomId use native getters. Removed Raw/read and non-null map assertions. IPC room/join data now uses the same string/number/boolean/null value contract as current Haxe Multiplayer rather than arbitrary unknown values. Existing connection lifetime, callback identity, duplicate registration suppression and deferred service-level socket teardown are preserved.

Typecheck, public/private builds and whitespace checks pass. Source scan finds no Raw/any in NativeIPCClient, NativeMessage or NativeIPCAuthentication. No runtime tests were run; this does not establish reconnect/chat parity or eliminate untyped code elsewhere in the plugin.


### Typed confirmed reward-notice hooks

Reviewed current Haxe PodState.createClickOpenPod, SkinItem.onBuy, CreditPackageItem.onClose, Player.loadArtifactsFromMessage and ArtifactFactory.createArtifact. Added central bindings and reviewed callback signatures, inherited credit-item game ownership, and artifact identity/uniqueness fields. NativeRewardNotices now uses GameReflection and typed Game/Player/Message/Artifact callbacks, including the native get_me/get_isLeaving/get_name/get_isUnique accessors. Preserved nested operation scopes, source return values, callback receivers, account ownership, authoritative reply checks and notification-error isolation. No payments or reward requests are initiated by this typing pass.

The reward fixture now initializes central bindings and uses object identity without a mismatched structural-type comparison. It was not executed. Typecheck, strict standalone declarations, public/private builds and whitespace checks pass. NativeFluxNotices remains untyped, and reward/chat runtime parity still needs live verification; runtime tests remain paused.


### Typed Flux purchase notification boundary

Reviewed original BuyFlux receipt proof/finalization and current Haxe PayVault wrappers plus the cached SDK readHistory/payVaultHistoryEntry implementation. Added central BuyFlux/PayVault bindings, reviewed native payment callbacks and the SDK-only PlayerIOPayVault.readHistory contract. NativeFluxNotices no longer uses Raw/any: native screen/vault/popup ownership, overlay children and Steam order keys are typed; unknown receipt entries are normalized at the SDK boundary. Numeric SDK timestamps are converted to Dates as required by source receipt validation. Observer skips an unavailable/non-Sprite overlay without interfering with native checkout. Success notifications still depend on new receipt proof or native Steam finalization, not on popup dismissal alone.

Updated reward fixture with inert purchase surfaces and before-hook support needed for central-bound observer installation. No purchase, checkout, runtime test or payment action was performed. Typecheck, strict standalone declarations, public/private builds and whitespace checks pass. Live reward/receipt presentation and other provider paths have not been verified for parity.


### Typed native QoLAF chat routing and corrected player access

NativeQolafChat now uses central MessageLog/PlayerManager/MD5/DataLocator bindings and typed GameReflection hooks. Added typed chat mode/parseCommand/tab contracts, queued-row QoLAF ownership and reviewed native writeChatMsg signature. Unknown data records and the optional custom command registry are checked at their boundaries. GameSession validates its older dynamic scene before calling the typed installer; affected chat fixture now initializes bindings and native-shaped getters.

Found concrete Haxe accessor mismatches: game.me and game.isLeaving were read as ordinary fields even though the game exposes get_me/get_isLeaving. This could lose the local sender name and permit delivery or tab cleanup during departure. Supporter lookup referenced nonexistent Player.isSupporter; it now calls native hasSupporter, preserving current eligibility/expiration rules. Inbox ownership, retained input on send failures, channel mute/ban checks and receiver detach remain intact. Native sendMessage is void, so interception now matches that contract rather than returning unused booleans.

Typecheck, strict declaration check, public/private builds and whitespace checks pass. Runtime tests remain paused. These are source-confirmed fixes, not proof of live chat appearance, delivery or full port parity.


### Artifact command cancellation and departure guards

Compared original ArtifactState2.enter and PlayState.cancelAllCommands: the source routes artifact entry through shared play-state cancellation. The port duplicated that logic and wrote autoCruise on the instance although current Haxe stores it statically. ArtifactMenu now calls cancelNativePlayerCommands. Corrected the shared helper to call native Weapon.set_fire(false), rather than creating an unused fire field, and resolve Game.me through its getter before restoring zoom. Preserved command IDs, held-axis checks, aim release and no shield/boost activation. Updated the existing fixture to model the native setter/getter; tests were not executed.

Audited direct Game.isLeaving reads in the nearby chat/telemetry paths. NativeChatImageViewer, NativeArtifactDraft, NativeChatPingPreview, NativeChatArtifactPreview, NativeChatRolePreview and DamageObserver now use the existing getter-aware boundary so departure guards see actual Haxe state. This is a functional accessor correction; these older modules are not yet fully typed.

Typecheck, public/private builds and whitespace checks pass. Runtime tests remain paused. Artifact-menu behavior, zoom reset, previews during warp and telemetry shutdown still need live comparison; no claim of overall parity or deployment.


### Expose the original game-recovery state to existing consumers

Original Game.isRecoveringGameConnection exposes the owned reconnect state. The current vanilla bundle has no such accessor and the port recovery implementation did not install one, although settings, release/welcome dialogs, visuals and readiness code consult it. Added a typed Game augmentation and installed both get_isRecoveringGameConnection() and the source-style property. Both read the active manager's existing recovery record and require that record to own this exact scene. No independent boolean can become stale. Teardown restores previous descriptors only if still owned by this installation.

Typecheck, public/private builds and whitespace checks pass. Runtime tests remain paused; actual recovery/UI interaction still needs verification.

Accessor-audit qualification: portedClasses.resolve calls aliasProperties on requested native classes and their ancestors. Therefore a direct AS3-style property may work after another screen has resolved its class. Earlier getter/setter corrections remove that initialization-order dependency; source-only inspection does not prove every direct property read failed in every live session. The missing recovery property is different: neither it nor its backing getter exists in vanilla, so the alias layer cannot supply it.


### Target switching source audit

Compared original TargetSystem and TargetInfoElement.refreshNearbyTargets/compareNearbyTargets against current TargetSystem, NearbyTargets, TargetPresentation, TargetPicking and GameSession frame dispatch. Source cooldown is 0.5 s; higher-priority auto-target candidates may bypass it, while locked selections cannot. Nearby snapshots refresh every 0.25 s and sort group/player/boss priority, descending level, distance, then unit ID. Current port follows those rules. Native UnitManager.remove removes the exact Unit then resets it; the port's before-remove hook increments lifecycle and clears locked selections before reset, while nearby rows validate captured lifecycle before display/click.

Adjusted TargetPresentation's final ID tie-breaker to use the getter-aware boundary: native GameObject exposes get_id(), and sorting should not depend on a previously resolved portable screen having installed the id alias. No priority, cooldown or gameplay behavior was deliberately changed. The source itself permits distance-driven list reordering; these inspections do not prove that the user's reported switching is resolved.

Typecheck, public/private builds and whitespace checks pass. Runtime tests remain paused. Need live comparison of row ordering, active-target changes and pointer selection under actual combat before closing the reported issue.


### Rendered world-text path audit

Traced current native Game.update: state update/draw precedes TextManager.update(event.get_passedTime()). The installed CombatTextFrames TextHandler override converts seconds to milliseconds once and follows rendered owner coordinates while preserving independent rise/lifecycle rules. Original EnemyShip.draw positions AFName at the drawn clip x/y minus 30; WorldLabels does the same after draw. Converted that hook to EnemyShip central binding/GameReflection and explicit clip getters, adding the reviewed AFName TextBitmap|null signature. Existing fixture initializes central bindings; it was not executed.

Typecheck, public/private builds and whitespace checks pass. This confirms the intended source path, not live high-refresh smoothness; the user's text-stutter report remains open. Browser-check resumption was asked asynchronously because runtime tests were previously paused; no reply or resumption assumed in this pass.


### Typed camera bounds and focus-change invalidation

Compared original StarlingCameraFocus.updateViewRectangle/isCircleOnScreen and source camera getters. Preserved four-corner inverse-transform bounds, finite/nonzero-scale guard, enclosing-circle overlap and portrait-aware world radius. Converted CameraView to central StarlingCameraFocus/Point bindings, typed native fields and narrow geometry contracts; removed Raw/any and unchecked corner assertions. Added reviewed native signatures and a separate augmentation for client metrics/getters.

Found source setFocusPosition increments viewSizeRevision even without a zoom/size change; the port only incremented when measured dimensions changed. Restored focus-position invalidation and uint wraparound. Added get_viewCenterX/get_viewCenterY/get_worldCullingRadius/get_viewSizeRevision, preserving an existing upstream implementation and restoring owned descriptors on cleanup. This makes delayed body visibility checks see focus/resize invalidation as in the source.

Typecheck, public/private builds and whitespace checks pass. Runtime tests remain paused pending the earlier question. Camera-follow, resize/zoom culling, sun visibility and high-refresh smoothness are not yet proven live.


### Typed body visibility and camera-revision consumption

Compared original Body.updateIsNear/updateBody with the port: source center offsets, 1.5x world radius plus maximum sprite/zone radius, distance scheduling, hidden/boss exclusions, and zoom/revision invalidation are retained. Converted BodyVisibility to central Body/GameReflection, typed native body/camera fields and explicit position/display accessors. Added a client-only body revision augmentation. Guarded missing/unsampled cameras; the installed hook still delegates to native updateIsNear before a valid camera sample. The earlier focus-position revision fix now has a typed consumer in this path.

Updated the existing camera fixture to provide native get_pos and central bindings. No tests executed. Typecheck, strict declarations including both camera/body augmentations, public/private builds and whitespace checks pass. Large-sun visibility and resize/zoom behavior remain open for live comparison; source parity alone does not resolve the reported runtime issue.

### Restart continuation: projectile frame declarations (2026-11-11)

- Rechecked the supplied `/home/raony/Documentos/astroflux.js`: Projectile and
  Ship inherit GameObject.draw. ProjectileFrames installs an after hook, so its
  predicted pose does not bypass RenderPosition's base readiness hook. This
  suspected explanation for attached-effect stutter is not supported by source.
- Native GameObject image initialization constructs starling.display.MovieClip;
  get_movieClip returns that same _mc. Narrowed both reviewed declarations from
  DisplayObject to MovieClip, retaining null before image initialization.
- Native ProjectileManager constructs starling.display.MeshBatch. Added its
  reviewed field type and removed Raw/getter-name reflection from the per-frame
  batch rebuild. Native get_hasImage/get_movieClip are now checked directly;
  missing clips are skipped instead of passed to addMesh.
- Preserved reverse projectile traversal and the alive/canvas/image/visibility
  gates from the original ProjectileManager.draw. No simulation changes.
- Typecheck and regenerated native declarations completed. Browser/runtime
  testing remains paused; this is not evidence that reported stutter is fixed.

### Remote movement bindings and missing course guard (2026-11-11)

- Removed Raw, untyped class lookup, and the `as any` converger cast from
  RemoteShips. ShipSync, Ship, PlayerShip, Heading and Converger now use central
  bindings and GameReflection hooks. The playback buffers consume an explicit
  native-state subset; correction uses a generic heading contract without
  copying/wrapping the native converger during a tick.
- Reviewed current Haxe members for Converger, Ship.getConverger/initCourse/
  set_course, PlayerShip command/landing/boost methods, StateMachine.inState,
  Engine.get_rotationSpeed, Command fields, and Player landing/warp state.
  Player.isLanded is a field; Player.get_isWarpJumping is an accessor. Updated
  existing fixture shapes accordingly, without running tests.
- Ship.get_course genuinely returns null when its converger/course is absent.
  Corrected the declaration. This exposed a missing source check in
  TorpedoCourses: original AIStates/ProjectileBullet.as skips candidate ships
  whose heading is null before accessing heading.time. Restored that guard.
- Native boost fallback has no arguments. Timestamp confirmation still goes
  through the room-installed syncBoost method when present, now represented by
  BoostedPlayerShip rather than an untyped property.
- Original Ship.draw and Game.update source ordering was inspected alongside
  current native Unit.draw, Game.draw and the port hooks. No additional ordering
  defect was proven in that inspection. Render stutter and full visual parity
  remain open pending runtime comparison; source/typing checks do not prove them.

### Boost reset and replay API audit (2026-11-11)

- Compared source Converger.run/calculateOffset and PlayerShip boost/syncBoost/
  reset against the supplied Haxe client and current hooks. Native Converger
  still calls get_usingBoost when selecting its speed cap, so the replay-time
  hook targets the live native physics path.
- Source PlayerShip.reset invokes stopSpeedBoost(false); native reset replaces
  speedBoostEffect with an empty array without killing its emitters. Restored
  the source behavior in the room-owned reset hook: stop the previous effects,
  clear the history, and leave boostEndedLastTick false for the pooled life.
- Converted NativeBoostHistory to central PlayerShip/Ship/Converger bindings,
  GameReflection hooks, typed scene/heading/emitters, and BoostedPlayerShip's
  optional plugin methods. No Raw/as-any remain in that module. Native entry
  from the remaining self-movement adapter validates the scene class.
- Plugin-method cleanup now restores descriptors only while it still owns the
  installed methods; a later method replacement is not erased on old cleanup.
- NativeSelfMovement fixture now initializes bindings and scene identity.
  Tests remain unexecuted under the user's pause. Typecheck, isolated strict
  declarations, public/private builds and whitespace checks passed.
- No live movement, boost trails, login, or visual parity claims are made from
  these source/build checks. The full requested comparison remains incomplete.

### Typed throttle and death-line hooks (2026-11-11)

- Converted NativeThrottle and NativeDeathLines from Raw/lookup-based hooks to
  central PlayState/PlayerShip/Converger bindings with typed GameReflection.
  Reviewed declarations now describe GameState's player/keybinds, key input
  methods, native commandability/zoom, camera zoomFocus, death-line collections,
  line endpoints, and engine accelerate/idle methods.
- Throttle receives the room adapter's typed command callback. This preserves
  the client's boolean acceptance result and forced boost-end boundary without
  pretending the native command method has the plugin's return contract.
- Compared PlayState.checkAccelerate with the original source. Preserved one
  throttle-axis transition per course tick, pending boost-end handling, and
  automation delegation. The latter is intentional: AutomationControls blocks
  physical input while maintaining automation steering with chat open.
- Compared Converger.preventLiveDeathLineCrossing with the source. Preserved
  full-step/replay sweep, local-player and warp exclusions, pre-step timestamp
  evidence window, and accepted authoritative course replacement. IncomingPlayer
  explicitly declares the optional telemetry method installed for the room.
- Existing self-movement/automation fixtures now expose the native getters and
  initialize central bindings. They remain unexecuted while tests are paused.

### Typed self-course replay adapter (2026-11-11)

- Converted NativeSelfMovement to central Ship/Converger/Heading/Command/
  Connection bindings and typed GameReflection hooks. Command creates native
  objects; native message/heading callbacks and the bound command echo handler
  now retain their types rather than using Raw/as-any.
- SelfCourseOwner/SelfCourseQueue and local correction are generic over their
  concrete heading type. Native Heading objects pass through unchanged; no
  cast, copied substitute object, or wrapper is used for reconciliation.
- Reviewed native Heading.copy/almostEqual/clone/runCommand and introduced
  HeadingState for the actual numeric/boolean fields they consume. Added reviewed
  command manager, ship synchronization, HUD cooldown and convergence signatures.
  SelfMovement.ts separately describes client-added replay methods and the
  plugin's changed return contracts instead of labeling them native methods.
- FIRE rejection now reads native Player.get_inSafeZone and PlayerShip.get_weapon
  directly. The prior safe-zone field depended on property alias installation;
  this source change removes that dependency, not proof of a universal live bug.
- Compared original CommandManager.addCommand/dispatchCommand/runCommand and
  ShipSync's pending/duplicate/stale self-course handling with the port. Preserved
  monotonic stamps, full timestamp buckets, self-echo suppression, correction
  replacement/reset, and delayed boost confirmation.
- Typed plugin extension cleanup restores only methods it still owns. Scene
  validation remains at GameSession's existing dynamic-to-native boundary.
- Current movement adapters (self, remote, boost, throttle, death-lines) have no
  Raw/any/direct api.cls use. Other modules still need conversion. Existing
  fixtures were adapted to native getter shapes but not executed. Typecheck,
  strict standalone declarations, both builds and whitespace checks passed.

### Native current-state cancellation and control cadence (2026-11-11)

- Found a concrete state lookup mismatch in NativeCommandCancellation: it read
  activeState without a fallback. The supplied Haxe GameStateMachine has only
  currentState; it has neither an activeState field nor a get_activeState method.
  No port code installs that alias. The helper could therefore exit before
  releasing input. It now uses currentState and checks the actual PlayState class.
- Cancellation keeps the source's axis-release order, firing release, static
  autoCruise reset, aim release and zoom reset. It takes the native scene directly
  (validated at this dynamic entry point); callers no longer pass an unused API.
- Converted NativeControlTiming to central PlayState bindings with native getters,
  typed game/commands and explicit optional automation/replay extensions. Preserved
  course-time turn/boost/channeling gates, backward-clock handling, and braking
  during channeling; original PlayState source was checked.
- Reviewed native control methods, fireWithHotkeys, PlayerShip channeling/shooting,
  and Ship.clearConvergeTarget declarations. Existing control/cancellation fixtures
  now initialize bindings and model currentState/native getters, rather than the
  nonexistent activeState accessor. These tests remain unexecuted under the pause.
- No Raw/any/direct api.cls references remain under src/movement. This is a scoped
  source audit, not a claim that the entire plugin or generated declarations are
  fully typed or that runtime parity is complete.

### State-name follow-up and typed ship pose sampling (2026-11-11)

- Audited remaining activeState/stateMachine/networkLatency references after the
  cancellation fix. Other activeState reads in LocalClientCommands,
  PortableScreens and XhersixTorpedoCue already fall back to native currentState;
  no equivalent missing fallback was found in those paths.
- Compared LoadingBar.diff with LoginLoadingStatus and inspected login Control
  cancellation/countdown ownership. No new discrepancy was established by this
  source pass; visual login parity remains unverified.
- Ship pose sampling now uses a typed numeric heading view and native
  get_course/get_landed/get_rotationSpeed methods. A missing course yields no
  render pose rather than dereferencing it. The installer already excludes that
  state, and now explicitly handles the nullable sample as well.
- Previous-pose storage is keyed by Ship, and ship draw/mini-bars use native
  course/position/bar getters. Haxe constructs hpBar/shieldBar as starling Image;
  reviewed those types plus numeric GameObject._rotation. Local extrapolation,
  remote interpolation and landing ownership formulas remain as in the source
  audit. The camera portion still needs its remaining Raw typing removed.
- Updated existing interpolation fixture shapes; no tests executed. Typecheck,
  isolated strict declarations, both builds and whitespace checks passed.
  This change does not establish that the reported frame stutter is resolved.

### Camera motion types and double-scaled parallax (2026-11-11)

- Moved the original camera frame algorithm into readable CameraMotion.ts with
  typed native state, focus points/display getters, events and bounds flags.
  Reviewed fields/methods against both StarlingCameraFocus.as and current Haxe.
  Interpolation now validates the native scene and installs typed session hooks;
  neither Interpolation nor CameraMotion contains Raw/any/dynamic read helpers.
- Found a functional frame-rate mismatch: source ParallaxManager.update consumes
  camera.speed directly as the frame displacement. Current native update multiplies
  that displacement by seconds * 60, while the port already computes camera.speed
  from the actual render duration. This applied frame duration twice and changed
  background scroll speed with refresh rate.
- The gameplay parallax wrapper still updates the camera with real seconds, then
  supplies 1/60 to native parallax (unit multiplier). Current native wrapping,
  star tiles and background coverage remain in use. This normalization is scoped
  to the connected gameplay manager, not the login background.
- Native update's seconds parameter is used only for that movement factor (plus
  its clamp/default). Audited host public/plugins/core.js: before hooks receive
  original args before around hooks, so EmitterFrames still receives real seconds.
  Profiler is the only other located parallax-update hook and only measures time.
- Existing interpolation fixture now models native camera fields and checks the
  separate emitter/native-parallax arguments. Tests were not executed under the
  pause. Typecheck, standalone strict declarations, both builds and whitespace
  checks passed. This is a source-confirmed cause of refresh-dependent background
  movement; live stutter and complete visual parity remain unverified.

### Emitter attachment and visibility contracts (2026-11-11)

- Resumed against the same supplied Haxe bundle (SHA256
  7c49ee6caf843c3b109ebb7a979bc443a16fd92c503cb4aa25e81138a3b1f10d).
- Compared Emitter.as elapsed-time emission, pending particle age, friction,
  central gravity, pool limits, dual-engine mount offsets and culling with the
  port. Native fastForward calls without a delta already use the original 33 ms
  default. No additional timing discrepancy was established in this pass.
- Extracted EmitterTargetPose.ts and EmitterVisibility.ts with typed native
  contracts; neither uses Raw/any/read. Transform sampling calls native or
  installed render getters directly and retains pooled-clip readiness checks.
  Reviewed emitter visibility fields and get_radius/updateOnScreen against the
  current bundle and regenerated declarations. The visibility hook now uses
  GameReflection and the central Emitter binding.
- Native Game.camera is nullable. World-emitter culling now defers and retries
  next frame while no camera exists; canvas effects still bypass the camera.
  This is a lifecycle guard, not a confirmed cause of the reported stutter.
- Updated existing fixture shapes without running tests. Typecheck, strict
  standalone declarations, public/private builds and whitespace checks passed.
  EmitterFrames emission/draw and other related adapters still contain untyped
  code; this pass does not claim complete typing or live frame-rate parity.

### Ribbon frame and pool audit (2026-11-11)

- Compared Projectile.positionRibbonHead/draw/updateRibbonTrail and RibbonTrail/
  RibbonTrailPool against the original diff and current supplied Haxe. The port
  already separates render-head updates from tick-owned history and writes
  reset geometry immediately. Engine trails in the original still advance in
  Engine.update; no unsupported extra engine-history updates were introduced.
- RibbonFrames and RibbonPool now use reviewed native fields/getters and central
  bindings through GameReflection, with no Raw/any/direct api.cls in either
  adapter. Added native RibbonSegment/RibbonTrail/pool contracts and projectile
  ribbon fields, including nullable arrays after native disposal.
- Corrected return handling: the old hook scanned activeRibbonTrails and reset
  the ribbon even if current native poolIndex validation rejected removal.
  It now resets only the trail actually appended to the inactive pool. Native
  indexed swap/removal and orphan reclamation remain in control, preserving the
  newer game's constant-time removal behavior.
- Updated existing fixtures to native getter/setTo2-alpha/indexed-pool shapes and
  added the rejected-removal regression. Tests remain unexecuted under the pause.
  Typecheck, strict standalone declarations, public/private builds and whitespace
  checks passed. This does not close live ribbon appearance or overall FPS parity.

### Monotonic local simulation clock (2026-11-11)

- Found a concrete semantic gap in the GameStateMachine/Clock diff: the original
  Clock.elapsedTime uses Flash getTimer minus its creation timer, but the supplied
  Haxe get_elapsedTime uses Date.getTime minus beginning. Choosing the elapsed
  getter alone therefore did not isolate simulation from system-clock changes.
- NativeClockTiming now anchors each clock's existing elapsed offset once, then
  advances it using performance.now through ElapsedClock. Clock.start anchors
  before network initialization; an already-running clock keeps its existing
  elapsed origin. The native serverNow/slew, epoch offset, server messages and
  simulation's 33 ms step/500 ms catch-up cap remain unchanged.
- Converted remaining Interpolation method hooks to GameReflection so their
  receiver and parameters use reviewed native types rather than API's legacy
  broad callback overload. Source formulas and execution order are unchanged.
- Added a regression combining the elapsed clock with simulation timing across
  backward/forward wall-clock jumps, a room-start timing reset and separate clock
  origins. It was not run under the user's test pause. Typecheck, both builds and
  whitespace checks passed; live timing/visual parity is still unverified.

### Warp transition connection observations (2026-11-11)

- Compared Game.update/warpJump/cancelPendingWarpJoin and SceneBase connection
  observation with the port. Recovery already removes the cached game-frame
  callback; no missing gameplay-loop suspension was established in that path.
- Corrected passive health gating to use isWarpJoinPending, matching the source
  connectionObservationActive condition. The ship's warp-animation flag is not
  the same lifetime as discovery/join and could leave notices active during a
  pending room transition. The watchdog retains its additional player-warp gate.
- Ported Game.warpJump's explicit resetClockResponseObservation call. The typed
  watchdog installer supplies a scene-specific reset callback to WarpTransition;
  it runs after transition guards accept the warp. Waiting for an inactive
  Game.update is insufficient because warp removes that listener. A quick
  cancellation could otherwise retain an almost-expired foreground timeout.
- Added the short-cancel regression (under 500 ms, with an outstanding request)
  without executing it under the test pause. Typecheck, public/private builds and
  whitespace checks passed. Runtime recovery/cancel comparison remains open.

### Warp cancellation during recovery and delayed discovery (2026-11-11)

- Original Game.cancelPendingWarpJoin restores FPS tracking and its frame listener
  only when not recoveringGameConnection. The port restored both unconditionally.
  It now reads the owned recovery accessor and preserves the stopped loop while
  recovery owns the scene; player roaming restoration and fade-out remain as in
  the source. Optional accessor lookup also tolerates plugin teardown ordering.
- Original JoinRoomManager.cancelPendingGameJoin invalidates prepared discovery
  along with cancelling the scene warp. The port's asynchronous preparation could
  still pass its scene/socket checks after cancellation. Consumed preparations
  now also require the scene's pending-warp ownership before accepting a result.
  Unconsumed background preparation remains valid during the warp animation.
- Ported joinServiceRoom's immediate prepared-warp invalidation. Waiting until
  the Service socket changes left a window for the abandoned room list to finish
  during the new Service join. Existing native room selection and opening of the
  Game socket at visual commit are retained.
- Typecheck, both builds and whitespace checks passed. Tests remain paused;
  source reasoning establishes these ownership gaps, not runtime cancellation
  parity or complete login/recovery fidelity.

### Pending join owns deferred room teardown (2026-11-11)

- Compared JoinRoomManager.cancelPendingGameJoin with GameRoomJoin and
  RoomTransition. Source cancels the static-cover presentation wait together
  with the request generation. The port cancelled transport requests but left
  a separate pending cover callback able to close the retained room later.
- Added an owned RoomTransition cancellation entry point. It marks discovery
  stale, cancels the cover wait and removes the commit owner. Both exported
  pending-join cancellation (used by recovery) and normal manager replacement
  cancellation invoke it, including when the transport request has not started.
- Deferred cover callbacks already check transition identity before closing;
  deleting that identity also prevents callbacks already queued from proceeding.
  Recovery retains control of showing/hiding its own cover and the retained room.
- LoginLoading status strings and its texture/network gates were also read
  against the source in this pass; no additional supported-path discrepancy was
  established there. This is not a claim of complete login visual parity.
- Typecheck, both builds and whitespace checks passed. Tests remain paused;
  late callback and recovery behavior have not been verified in a live session.

### Typed login identity and startup hooks (2026-11-11)

- Reviewed login countdown, Control cancellation, attempt retirement and status
  strings against Login.as. No new supported-path functional discrepancy was
  established in that pass; visual overlay/alignment parity remains unverified.
- Login startup hooks now use the central Login binding and GameReflection with
  a typed optional client Steam gate. The post-font stage check uses the native
  getter, and loginProfiles receives its already-typed Login instance.
- LoginIdentity now constructs StarlingTextField through its central binding and
  imports RussoBitmapFontRegistry directly. Removed its Raw receiver, NativeUI
  bridge and dynamic ported-class lookup. Font, size, alignment, coordinates,
  credits and version 1.1.23 retain the prior presentation contract. The label
  no longer instantiates unrelated ported UI factories merely to resolve a font.
- Reviewed TextFormat.set_verticalAlign and regenerated native declarations.
  Typecheck, strict standalone declarations, both builds and whitespace checks
  passed. No runtime/unit tests executed under the pause.

### Main composer markup guard and history ownership (2026-11-11)

- Original ChatInputText.sendMessage validates rich markup before command dispatch
  and history insertion. The port had the validator and used it for floating
  chat, but the main composer never called it at its send boundary.
- Added typed NativeChatValidation before other session composer hooks. Both
  direct submissions and toggle-to-submit reject malformed formatting with the
  source "Message not sent: " error, retaining draft/focus and the open composer.
  The toggle guard runs before native Haxe hides the editor; native toggle does
  not honor a sendMessage result. Valid input continues through existing dispatch.
- NativeChatHistory now uses native GameScene/TextEntry contracts and typed hooks;
  malformed drafts are excluded even though host before hooks run before around
  validation. Removed the separate prototype history from index.ts, which was
  shadowed by the session adapter and redundantly recorded into another history.
  Floating windows retain their separate histories.
- Reviewed native ChatInputText navigation/toggle/visibility method signatures
  and regenerated declarations. Added an unexecuted integration regression for
  rejected direct/toggle sends, retained draft/open state and corrected submission.
- Typecheck, strict standalone declarations, public/private builds and whitespace
  checks passed. Tests remain paused; complete chat interaction parity remains open.

### Artifact rejection keeps the main composer open (2026-11-11)

- Original toggleChatMode keeps the editor focused when permitsArtifactSend
  rejects. The port's send guard blocked transmission/history but native Haxe
  toggle still hid the composer. The pre-toggle validation now checks both
  markup and the source artifact-channel policy, preserving draft/open state.
- Direct send rejection now returns the source false result through the typed
  ChatSubmission adapter; native methods still have their reviewed void return
  declarations. Current native Private recipient and Clan channel argument shapes
  were verified in the supplied Haxe bundle before replacing the dynamic policy
  loop with typed hooks and central MessageLog access.
- NativeChatArtifactPolicy and its draft predicate no longer use Raw/any/read or
  direct api.cls. Private transport remains untouched because that destination
  is always permitted; explicit Local/Clan routing and forbidden direct sends
  retain the existing source restriction.
- Added the unexecuted toggle rejection/corrected-channel regression. Typecheck,
  strict standalone declarations, both builds and whitespace checks passed.
  Tests remain paused; other send-failure interaction paths and live chat parity
  still require comparison.

### QoLAF send rejection and source error wording (2026-11-11)

- Source sendQolaf returns false for unavailable IPC, bans, muted channel and
  rejected transport. NativeQolafChat previously returned undefined in every
  branch, so the caller could not retain the composer on rejection. It now uses
  ChatSubmission and returns the source acceptance/rejection result, with the
  current-scene guard retained at send time.
- Matched source ban duration, muted-channel and transport-error prefix strings;
  removed the extra literal [error] prefix. Transport reason escaping remains
  at the same boundary as the original escapeCommandText call.
- Composer toggle now submits while still open, honors false, then lets native
  toggle close only after acceptance. A scoped guard suppresses native toggle's
  second send invocation and history recording. Commands that already closed
  the composer are not toggled open again. History begins only on opening,
  rather than resetting navigation after a rejected submission.
- Updated existing regression cases for false/true QoLAF results, error wording,
  retained rejected drafts and exactly one accepted send. Typecheck, both builds
  and whitespace checks passed. Tests remain unexecuted under the pause; live
  composer focus, panel restoration and transport comparison remain open.

### Composer completion and history hook order (2026-11-11)

- Compared original ChatInputText key handling and previous/next directly.
  Friend completion now precedes emoji and command completion. Tab is consumed
  before synchronous completion restores focus, including when no suggestion
  handles it, preserving the composer instead of traversing browser controls.
- History navigation suppresses synchronous autocomplete refresh until text and
  selection have both been replaced, then dismisses suggestions and snapshots
  the new draft. Installed autocomplete before the history replacement: the
  host runs earlier around hooks outermost, and history intentionally does not
  invoke its inner native method.
- Updated the friend autocomplete fixture to use the real hook dispatcher and
  cover early Tab consumption, unhandled Tab and synchronous history changes.
  Typecheck, public/private builds and whitespace checks passed. Regression
  tests remain unexecuted under the user's pause; browser focus and rendered
  popup parity still require live comparison.

### Command-specific player completion sources (2026-11-11)

- Original ChatInputText.refreshAutocomplete/playerAutocompleteSource select IPC
  peers for /ssv and private room targets, and current-room/saved/disabled
  profiles for /ssv reset. The port previously suppressed all of these targets.
  Added typed source selection, source section titles and a scene-owned visual
  profile provider with identity-safe cleanup. IPC suggestions require the
  captured service to still be the connected singleton.
- Ported the original argument-position expressions, floating-composer
  exclusions and opening-quote replacement for explicit targets. Existing
  ChatFriendAutocompleteModel handles duplicate names, ID fallback and quoting.
  Ordinary friend completion keeps its original provider; independent floating
  composers now only read cached friends rather than issuing main-service RPCs.
- Private room-target expressions are compilation guarded. Inspected the built
  source selector: the public bundle omits the private grammar and the private
  bundle includes it. Radio remains unsupported.
- Added unexecuted source-selection, quote-boundary and visual-provider lifecycle
  regressions. Typecheck, both builds and whitespace checks passed after fixing
  a missing helper import. Runtime popup appearance, IPC lifecycle and live
  account comparison remain unverified; tests remain paused.

### Typed friend roster and preview lookup (2026-11-11)

- Compared knownFriendRecords, persistent identity lookup, live-player matching,
  preview paint hydration and texture caching against original ChatInputText.
  ChatFriendRoster now uses central Player/MessageLog/TextureLocator bindings,
  typed native getters and explicit paint fields; no Raw, any, read helper or
  direct class lookup remains in this adapter.
- ID matching uses the native playersById map before unique-name fallback.
  History identity fallback now uses the original propertyText semantics and
  never substitutes playerKey for the persistent account ID. Empty skin keys
  and unavailable data managers return before caching or requesting textures.
- Verified Friend.isOnline initialization and TextureManager's nullable texture
  array path in the supplied Haxe bundle, then regenerated declarations with
  those reviewed signatures. Updated both roster consumers to validate their
  scene boundary and adapted existing fixtures to real native field/getter
  shapes and class metadata. Added the empty-skin regression assertion.
- Typecheck, strict standalone declaration check, public/private builds and
  whitespace checks passed. Regression execution and live preview comparison
  remain pending under the test pause; these checks do not prove visual parity.

### Login loading review and teardown failure references (2026-11-11)

- Re-read original Login loading/room readiness and LoadingBar against
  LoginLoading, LoginLoadingStatus and StartupServiceJoin. The existing port
  already overlaps service discovery with textures/cache, waits for returning
  player room discovery, and preserves the newer Haxe embedded-library gate.
  This source review does not establish live timing or visual parity.
- Found a concrete teardown failure mismatch: original Login clears disposed
  display references before fallible theme initialization, while the port relied
  on the native cleanup statements after theme/font initialization. A thrown
  setup left background, dialogs, logo and container pointing at disposed nodes.
  The adapter now clears those references in its finally block while retaining
  the newer native font/theme setup and exactly-once asset cleanup.
- Added unexecuted success/theme-failure regressions for removed displays,
  keyboard/resize listeners, reference clearing and once-only asset/effect
  cleanup. Typecheck, public/private builds and whitespace checks passed.
  Tests remain paused; local login/game comparison remains outstanding.

- The teardown change exposed three over-narrow native declarations:
  recoverDialog, registerDialog and logoContainer are explicitly nulled by the
  inspected Haxe removeLoginScreen implementation. Corrected those signatures,
  regenerated Game.d.ts and made LoginProfiles validate/capture initialized
  form references. Strict standalone declarations also pass.

### Built-in command suggestion coverage and source wording (2026-11-11)

- Compared ChatBuiltInCommandSuggestions.as with port definitions and actual
  command handlers. Restored missing /ssv and /roominvite argument help plus
  network/profiler/socket/packet/heading/disposal diagnostics. This also restores
  passive command help above the newly ported explicit-target suggestion list.
- Restored source descriptions/usages for supported commands rather than the
  port's rewritten copy. Added private Service/room-control definitions and
  moved automation suggestions behind the compilation flag; public dispatch
  already rejects automation. Switch-instance wording now follows build mode.
- Radio/Discord integration remain excluded per platform scope. Source
  /qipc3dbg and /serverip still lack a matching port handler and remain gaps;
  /ssv all is also not advertised because the existing handler rejects it.
- Updated the stale assertion that resync was absent and added unexecuted
  coverage for public visibility, original wording and /ssv argument help.
  Typecheck, public/private builds and whitespace checks passed. Inspected
  compiled suggestion metadata to verify private automation/room help is absent
  publicly and retained privately. Runtime tests remain paused.

### QIPC diagnostic command restored (2026-11-11)

- Followed the previously recorded /qipc3dbg gap into original ChatInputText and
  core/ipc/ClientIpcService. The port already implements toggleDebug, bounded
  logical-message IN/OUT rows, peer escaping, packed-type summaries and debug
  routing through NativeIPCAuthentication. The missing command now invokes that
  existing service and matches source enabled/disabled/uninitialized messages.
- Reserved the command with the other local built-ins and restored its original
  autocomplete description. It is handled locally and clears the composer using
  the existing command path rather than forwarding to native server chat.
- Added an unexecuted regression for missing service, both toggle states, native
  transport exclusion and input/tab cleanup. Typecheck, public/private builds
  and whitespace checks passed. Tests remain paused; live logical-message
  diagnostics still need verification. /serverip and /ssv all remain open.

### Explicit visual broadcast and browser endpoint limitation (2026-11-11)

- Original private /ssv all calls the same coalescing logical LOCAL broadcast
  used by automatic visual changes. The port already had that transport but
  rejected the explicit command in both builds. Private commands now use it,
  preserving duplicate-pending suppression, before-send fresh state/generation,
  once-only completion and scene-owned status messages. Automatic changes remain
  silent and retain their pending/throttle guards. Transport owns frame cadence.
- Restored original private usage/help and manual busy/not-ready/encoding/queued/
  sent/failure feedback. Public builds still deny /ssv all. Added the private
  feedback module to the build's forbidden public contribution check and
  inspected the resulting artifacts: feedback exists only in the private file.
- /serverip needs a browser-specific implementation: original SceneBase reads
  Connection.remoteAddress, but inspected Haxe Connection only delegates to the
  JS SDK. The installed SDK keeps the selected endpoint and WebSocket in
  closures, with no corresponding exposed getter. Do not guess an IP from room
  IDs or assume a listed candidate endpoint was selected. This gap stays open.
- Typecheck, both builds and whitespace checks pass. Tests remain paused; actual
  manual/automatic queue overlap and live feedback remain unverified.

### Frame-rate path re-audit: source evidence, no new runtime claim (2026-11-11)

- Re-extracted current Haxe Game.update/draw, Unit.draw, GameObject.draw and
  TextManager/TextHandler.update from the supplied bundle. GameStateMachine
  executes the scene draw before Game.update calls parallax, trails and text.
  EmitterFrames intercepts the per-display-frame parallax call and suppresses
  only tick-time manager updates; interpolation's camera wrapper runs after
  that emitter before-hook. This matches original Game's draw/emitters/camera/
  parallax/trails/text order.
- Checked the render-position readiness concern directly: current native
  Unit.draw calls GameObject.draw, whose after-hook marks the clip ready. Ship
  interpolation then adjusts that clip before the emitter/text consumers run.
  EnemyShip.draw calls inherited draw, and WorldLabels' after-hook corrects
  AFName after that interpolation. No missing base draw call was established.
- Native TextHandler scales its seconds argument by 33*60, but the port replaces
  that method and converts seconds to milliseconds exactly once. Original text
  handler takes milliseconds. Emitter emission windows, post-emission aging,
  elapsed-time friction and dual-engine mount rotation were compared again to
  original Emitter; this review did not establish another new timing defect.
- The user's visible high-refresh-rate stutter remains OPEN. Source call order
  and builds are insufficient evidence that the installed runtime is invoking
  those hooks or rendering the expected frames. Do not mark it resolved without
  an actual live original/port comparison. No browser/tests were run under the
  continuing pause, and no speculative timing change was made this pass.

### Emitter ownership is independent of following (2026-11-11)

- Compared original Emitter.hasStaleTarget, EmitterManager.update and factory
  target assignment. Manager checks stale ownership for every emitter with a
  target, regardless of followTarget; updatePosition alone checks followTarget.
  Port EmitterTargets.stale incorrectly returned early for non-following
  emitters, allowing effects retaining a recycled target to survive.
- Removed that early return. Reset generations, projectile anchors, live engine
  mount ownership and enemy registry identity now apply whenever target is set.
  Detached effects remain independent when target is null, matching the source
  factory's non-following effect construction.
- Corrected a regression assertion that encoded the previous wrong behavior and
  added non-following removed-engine coverage. Typecheck, both builds and
  whitespace checks passed. Regression execution remains paused. This fixes an
  ownership mismatch; it is not evidence that high-refresh stutter is resolved.

### Target priority class checks (2026-11-11)

- Recompared TargetInfoElement nearby refresh, comparator, class predicates,
  lifecycle snapshots and selection with NearbyTargets/TargetInfo. The port
  retains the source 250 ms scan budget and only sorts when refreshing; cached
  invalid rows remain empty until the next scan. No evidence supports adding a
  different sticky-order rule, which would depart from source behavior.
- Corrected two broad structural predicates in TargetPresentation: same-group
  priority now requires PlayerShip, and the miniboss flag grants boss priority
  only on EnemyShip. Original TargetSystem.isSameGroupPlayer and
  TargetInfoElement.isBossOrMiniboss explicitly require those classes. Explicit
  isBossUnit and boss-parent identity remain supported for other units.
- Added an unexecuted regression distinguishing native unit classes from other
  units carrying similarly named fields. Typecheck, both builds and whitespace
  checks passed. The user's reported live bar swapping remains unverified;
  these predicate corrections are not proof of its root cause or resolution.

### Target row source audit after restart

- Compared `NearbyTargetBar.ts`, `TargetBossIcon.ts`, and `AuraText.ts` with original `NearbyTargetBar.as` / `AuraTextRoller.as`. Native display objects, text formats, glow, and boss color transform now use central typed bindings. Radar units enter the typed row through checked game reflection.
- Restored original initial hidden state and empty-row shield width reset. Retained original touch highlight, 300×27 geometry, distance alignment, Unicode-safe truncation, and unclipped glow.
- Reviewed current Haxe texture lookup nullability, color-matrix arguments, and touch phase accessor before updating declarations.
- Type-checking, strict generated declaration checking, public/private builds, and whitespace checks passed. Tests remain paused; no browser/rendering comparison performed. The reported live target switching and high-refresh rendering issues remain unverified.

### Typed target data path

- `TargetPresentation` now consumes native `Unit` instances and central Boss/Spawner/PlayerShip/EnemyShip bindings. Name, ID, HP maximum, shield maximum, and group reads use native getters; removed the player-name fallback absent from the source.
- `NearbyTargets` stores and accepts typed units; active/previous target fields are typed. `TargetSystem` still has untyped event and game integration pending conversion; this is not a claim of whole-plugin typing completion.
- Verified Group IDs come from `Message.getString`; typed its member list and length as well. Added an unexecuted fixture for native stat getters and aggregate boss health. Existing source sort priorities and scan timing remain unchanged.
- Typecheck, strict declaration check, both build variants, and whitespace check passed. Runtime tests and visual comparison remain paused/unverified.

### Target picking lifetime audit

- Compared selection/locking/cooldown and click binding with original `qolaf/target/TargetSystem.as`. Existing selection gates and priority rules match the reviewed source; this does not establish the cause of reported live target switching.
- Converted `TargetPicking` to typed game/unit/movie-clip/event access and typed native UnitManager hooks. Removed its NativeUI dependency and dynamic property reads.
- Fixed an old-clip click window: after replacing a unit's movie clip but before the 250 ms reconciliation, the old listener could select that unit. The handler now checks the current clip and target validity, matching the source's event-time clip lookup. Added an unexecuted regression assertion covering that gap.
- Typecheck, strict declarations, public/private builds, and whitespace check passed. Runtime tests remain paused; no live target-switching claim is made.

### Target change event fidelity

- Replaced dynamic OpenFL Event/EventDispatcher lookup and untyped target event callbacks with central native bindings and reviewed dispatcher signatures.
- Added `TargetUpdatedEvent.ts` preserving original payload and clone behavior. Previous closure recreated a fixed event name and default flags; clone now reads current type, bubbles, cancelable, and targetSystem, as the AS3 override does.
- Corrected login fade cleanup's timer-event generic inference after strengthening dispatcher signatures. Added an unexecuted event-clone fixture.
- Typecheck, strict declarations, public/private builds, and whitespace checks passed. Tests remain paused; no runtime parity conclusion.

### Target system typed integration

- Completed `src/target` removal of `Raw`, explicit `any`, and direct class-name lookups. Target selection, range, faction checks, group priority, pooled lifetimes, picking, presentation, and events now use reviewed native types/bindings.
- Removed the optional constructor's structural `player`-field fallback; player identity always follows native PlayerShip, matching AS3. Automatic targeting now explicitly rejects null candidates before faction access.
- Group comparison is shared between selection and presentation, using native player/group getters. The remaining untyped damage observer enters through a checked Unit reflection boundary; it is not claimed typed.
- Updated existing fixtures to use real getter conventions and class identity; added an unexecuted null-candidate/structural-field priority regression. Tests remain paused. Typecheck, strict declaration check, public/private builds, and whitespace check passed.

### Typed progress bars and source math

- `ProgressBar` now constructs native sprite/quad/text/bitmap/texture objects through central typed bindings. Device preference additions are represented as optional Settings augmentation; the compact-number toggle remains live.
- Restored source initial hidden glow, clamped narrow-bar multiplier placement, fractional ordinary-bar divisor, and eager next-layer color allocation. Preserved source per-frame interpolation, immediate healing, hidden statistics, font line-box sizing, and palette.
- Deliberately retain the bitmap until disposal: current Haxe Texture.fromBitmapData captures it in onRestore for WebGL context recovery. Disposing it immediately as in the Flash source would invalidate that callback.
- Updated existing fixtures and added an unexecuted fractional-maximum assertion. Typecheck, strict declarations, public/private builds, and whitespace check passed. Runtime tests remain paused; visual parity unverified.

### Target indicator rendering and bitmap lifetime

- Compared three-arrow radius, rotation, pulse rates, and rendered center with original TargetAimIndicator.as. Typed the native Sprite/Image/Texture path and rendered-position accessor fallback; source animation arithmetic remains unchanged.
- Fixed retained decoded bitmap cleanup: keep it alive for current Haxe texture.onRestore, dispose texture then bitmap on session cleanup, and release resources on failed attachment or late completion. Previous loader never released the successful bitmap.
- Added typed lime Future completion/error surface and updated existing fixtures plus an unexecuted success/failure resource-lifetime regression.
- Typecheck, strict declarations, public/private builds, and whitespace check passed. Tests remain paused. This audit does not verify the reported world-label/emitter high-refresh issues.

### Chat receive and echo source audit

- Converted NativeChatPresentation to central MessageLog binding, typed GameScene/player accessors, typed hook arguments, and explicit dictionary types. Removed its Raw/dynamic class access; retained native length/team validation and nested receive-context restoration.
- Rechecked original MessageLog.as echo behavior: exact `echo.`, ignore own sender ID, global/private whisper to sender name, all other channels local, before opposing-team suppression. No routing change was needed.
- Refreshed NativeChatWriter.js by extracting the current local astroflux.js function unchanged (SHA recorded in fixture). Added unexecuted cases for echo routing, exact matching, self suppression, wire-length gate, and response before team filtering.
- Typecheck, strict declarations, both build variants, and whitespace check passed. Runtime tests remain paused; fixture additions are not pass evidence.

### Local command help dispatch fix

- Fixed `/torptiming` help being supplied as the second (message-type) argument to MessageLog.write for `/torpdbg`. Local help now returns individual typed lines, each emitted separately with the default type.
- Restored original `/ref` Service-preservation explanation, `/resync` parallel/default-sample description, and supported command wording. Private service-switch/join explanations are included only in private builds; instance-switch help reflects public safe-zone versus private-anywhere behavior.
- Browser-specific launcher/download wording remains adapted to the actual browser implementation. Unsupported server-IP and excluded radio commands were not advertised.
- Typecheck, both builds, whitespace checks passed. Inspected compiled artifacts: private service help absent publicly and present privately. Added an unexecuted help-dispatch regression; tests remain paused.

### Chat clear preview lifetime

- Original ChatSimple.clearMessages closes its role card immediately, and ChatAdvanced.clearMessages closes hover previews while discarding pending rows. Ported preview adapters previously depended on the next frame or virtual-row release; Simple clearing could leave its card visible in the interim.
- Added a typed, view-owned clear notification shared by the batching adapters and role/ping/artifact preview adapters. It works regardless of installation order, unregisters with the session, and clears hover identity before late remote results can refresh a card. Fallback native-view clearing emits the same notification.
- Queue clearing still empties the existing shared array and preserves sent history/settings. Added unexecuted immediate-close and fallback notification assertions.
- Typecheck, public/private builds, and whitespace checks passed. Runtime tests remain paused; no live UI comparison performed.

### Chat rebuild preview invalidation

- Original ChatSimple.updateTexts closes its role card before rebuilding, including timeout/image-driven refreshes; the port previously waited for a later hover frame in those cases.
- Generalized the clear notification to `ChatViewInvalidation` and invoke it before both Simple and Advanced rebuilds as well as clearing. Existing role/ping/artifact adapters unsubscribe with their session.
- Audited SimpleChatImages release: it already nulls preview-size callbacks before thumbnail disposal, so no speculative image-cache change was made.
- Added an unexecuted expiry/rebuild ordering assertion. Typecheck, both builds, and whitespace checks passed; runtime tests remain paused.

### Typed Simple chat projection

- Converted NativeSimpleChat to typed GameScene, MessageLog, WrapText, ChatMessage, and reflection hooks; represented its optional installed clear method as a game augmentation.
- SimpleChatImages now has typed message identity, thumbnail lifetime, source-index layout, font metrics, and renderer accessor contracts. The old source-ported factories remain explicit type boundaries; this does not claim the large rich renderer itself is fully typed.
- Preserved source ten-row/100 ms batching, timeout scan order, image spacers and callback release. Updated existing fixtures for native bindings; tests remain paused.
- Typecheck, strict generated declarations, public/private builds, and whitespace checks passed. No runtime or visual parity claim.

### Rich-text model typing

- RichBitmapFontTextRenderer now imports typed markup, inline-atom, emoji-match, emoji-resolver, and parser classes directly instead of resolving them into any aliases. The native/Feathers portions of the renderer remain unfinished.
- RichBitmapMarkupParser has no explicit any or bare Function declarations. Artifact callbacks use a named argument contract and validate unknown boundary results into typed label/color output; string buffers are typed. Applied the callback contract through editor model/view, typed-markup conversion, and native bitmap-input installation.
- Artifact label object inspection uses own-property checks safely, including null-prototype results; existing fallback, control-character normalization, 128-character cap, color validation, and exception handling remain. Disposed renderer retains only the cleared markup object rather than assigning null to a live model field.
- Typecheck, public/private builds, and whitespace checks passed. Runtime tests remain paused; no claim of complete renderer typing or visual parity.

### Rich glyph and line records

- RichBitmapGlyph, RichBitmapLine, and JapaneseCachedGlyph are now exported typed data classes; compatibility factory functions return those classes with explicit constructor types. Renderer imports these directly rather than resolving any aliases.
- Glyph character metrics use a native BitmapChar type plus the property aliases actually installed by Registry.aliasProperties. Japanese glyph pages have an explicit resource/slot contract; their implementation and cache still need typing.
- Made absent Japanese fallback/caret predecessor states explicit and guarded empty pool pops. Source kerning, visual width, line wrapping, and pooling order are retained.
- Typecheck, strict declarations, public/private builds, and whitespace checks passed. Tests remain paused, and whole-renderer typing/visual fidelity remain incomplete.

### Typed Japanese glyph pages

- Compared `JapaneseGlyphPage` against the original AS3 and preserved its 1024px page, 56px cells, 324-slot capacity, dirty batching, and bitmap lifetime.
- Replaced the untyped page factory internals with an exported class using central BitmapData/Rectangle/Texture bindings. Upload uses the native `get_root()` accessor.
- Verified Rectangle.setTo, BitmapData.fillRect, and ConcreteTexture upload methods against the current game file. Upload's second argument is a texture-ready callback, not texture options; declarations reflect that.
- Updated the existing cache fixture to bind native classes and expose the native root getter. Tests remain paused and were not run.
- Type-check, strict declaration check, public/private builds, and whitespace check passed. This does not establish visual parity; remaining renderer/cache typing and live comparison remain open.

### Typed Japanese cache and rasterization

- Removed explicit any aliases from JapaneseGlyphCache and JapaneseRasterizer: central native bindings, typed cache dictionaries/slot allocations, nullable glyph lookup results, and concrete font-loader callback signatures.
- Compared eviction/reference handling with the original JapaneseGlyphCache.as. Referenced/protected glyphs remain excluded; normal page limit and exceptional growth remain unchanged.
- Browser kana font lookup now tolerates an unregistered atlas, returning null for the existing renderer fallback instead of throwing. Rasterizer temporary bitmap disposal now runs in finally after pixel copy.
- Verified native getChar/copyPixels/fromCanvas/fromTexture implementations and updated declarations; added BitmapChar central constructor binding. Existing test fixture now narrows nullable glyph results; tests were not executed.
- Type-check, strict declaration check, public/private builds, and whitespace check passed. Live rendering, cache/renderer visual parity, and remaining renderer typing are still unverified/incomplete.

### Renderer cache/font contracts

- Renderer now consumes the inferred JapaneseGlyphCache and ChatRoleTags factory types, native BitmapFont/Point types, central StarlingTextField binding, and directly imported Russo registry.
- Verified native font metric getters against current astroflux.js. Added their property-alias declaration; retained the explicit registry resolution that installs those aliases, so typing does not silently remove runtime initialization.
- Corrected roleTagAtPoint's declared result to string|null and measureText's optional output point to Point|null. Existing hover behavior remains unchanged.
- Updated the shared renderer fixture to initialize central bindings. Type-check, public/private builds, and whitespace check pass; tests remain paused. Remaining renderer any types and visual parity are still open.

### Typed bitmap text format

- Compared the adapter with vanilla/scripts/feathers/text/BitmapFontTextFormat.as: preserved NaN size, white color, left alignment, zero leading/spacing, and enabled kerning defaults. Restored the missing fontName getter using native BitmapFont.get_name.
- Extracted the concrete typed format into ui/BitmapFontTextFormat.ts, retaining the registry factory entry point. The format borrows native font/atlas ownership.
- Renderer imports the class directly and represents unresolved formats as nullable. Private line layout captures and validates the resolved format instead of accessing any fields; layout calculations remain unchanged.
- Updated the shared font fixture with get_name. Type-check, strict declarations, public/private builds, and whitespace check passed. Tests remain paused; no runtime/visual parity claim.

### Typed text adapter and native method declarations

- BitmapTextAdapter now extends the central typed Sprite binding, with typed font-style provider, native TextFormat, Rectangle/DisplayObject bounds, and matrix coefficients. Registry resolution still installs display aliases for source-ported subclasses.
- Corrected declaration generation for functions defined in native prototype object literals: emit method signatures rather than function-valued fields, enabling typed subclass overrides. Constructor-assigned callbacks retain property declarations. Function signature parsing uses TypeScript's AST to preserve nested callback returns and generic parameters.
- Verified getTransformationMatrix/setRequiresRedraw against current native code. Bounds math, validation flags, frame callback, and measurement behavior are unchanged; no frame-rate fix is claimed.
- Moved shared fixture binding initialization before adapter class creation. Type-check, strict declaration check, public/private builds, and whitespace check passed. Tests remain paused; visual comparison remains outstanding.

### Restore Feathers label hit areas

- Connecting RichBitmapFontTextRenderer to the inferred adapter type exposed that isQuickHitAreaEnabled was only being assigned dynamically and never implemented.
- Ported FeathersControl.hitTest and minimum-touch rectangle centering semantics into BitmapTextAdapter. Quick hits use the layout rectangle (including whitespace) with visibility/touchability/native mask checks; disabled quick hits delegate to native container behavior. This restores behavior missing when every glyph batch is untouchable.
- Verified native DisplayObjectContainer.hitTest and DisplayObject.hitTestMask; the latter returns true without a mask. Renderer stage checks now use get_stage directly.
- Added a regression case for whitespace/edges, minimum width, hidden/untouchable/masked labels, and native delegation. Tests remain paused: the case was not executed.
- Type-check, strict declaration check, public/private builds, and whitespace check passed. Actual browser hit testing and visual parity remain unverified.

### Native glyph image and texture contracts

- Compared renderer wrapping constraints and caret/hit coordinate calculations with the original RichBitmapFontTextRenderer.as; inspected paths match and were left unchanged.
- Replaced renderer Image/Texture/DisplayObject any aliases with central native types. Glyph image placement, texture selection, color, alpha, smoothing, and snapping now call native setters; texture emptiness/frame checks use native getters. Ancestor visibility checks use native getters as well.
- Verified native Texture accessors, Mesh/Image setters, and Quad.readjustSize against current game JS; recorded their signatures and updated the shared fixture to expose those native methods.
- Type-check, strict declaration check, public/private builds, and whitespace check passed. Tests remain paused. No claim that reported tooltip/layout or refresh-rate issues are resolved without runtime comparison.

### Typed glyph mesh batches and events

- Renderer now uses central MeshBatch/Event bindings. Primary batch lifetime and sparse Japanese batch slots are explicitly nullable; composition requires an initialized primary batch.
- Converted scrolling, external-composition offsets, touchability, snapping, batching, and vertex counts to native calls. Compared grouping and disposal against the original renderer; ordering and atlas ownership remain unchanged.
- Verified native batchable setter, vertex count getter, and vertex color setter before recording declarations. Updated the shared batch fixture to expose get_numVertices.
- Type-check, strict declaration check, public/private builds, and whitespace check passed. Tests remain paused; runtime visual parity remains unverified.

### Typed native text formatting inputs

- Renderer now consumes native TextFormat/TextOptions types and getters for size, color, alignment, leading, kerning, autosizing, wrapping, and autoscaling. Verified these getters against current game JS. Kept layout behavior unchanged.
- Removed untyped pulse-color factory results and renderer aliases by retaining inferred static class types; pulse internals still need further native typing. Regex match results now explicitly nullable.
- Existing RichColors fixture now asserts/narrows the pod-specific getter before access; tests were not run.
- Type-check, strict declarations, public/private builds, and whitespace check passed. Tests remain paused. Remaining renderer factory/style-provider types and browser parity are still open.

### Correct native HTML flag routing; concrete renderer return type

- Found actual runtime-name mismatch: NativeBitmapText and BitmapCompositionQueue read `isHTMLText`, and RichBitmapFontCompositor checked that property, while current native TextField/TextOptions expose `get_isHtmlText`. The reader performs exact-case lookup, and aliasProperties does not rename acronyms. Corrected all three routing checks to the native spelling/getter.
- This mismatch could bypass rich HTML composition and the deferred composition queue. The source-level fix is established; tooltip rendering is still not runtime-verified.
- Renderer factory now returns its inferred concrete class; its last style-provider any was replaced with the source applyStyles contract specialized to the renderer. No explicit any remains in RichBitmapFontTextRenderer.ts (comment occurrences are not types).
- Updated tests to inspect glyph batches via the display tree, construct typed points, and expose native format/options getters. Existing composition-queue test already used the correct getter and would catch the routing mismatch when tests resume.
- Type-check, strict declarations, public/private builds, and whitespace check passed. Tests remain paused and were not executed.

### Typed native composition queue and font batching

- Verified TextField recomposition flags, mesh batch, render/dispose/recompose methods, Starling.render, and Painter.excludeFromCache directly against current native JS. These field names match; no further rename was necessary.
- BitmapCompositionQueue now uses central TextField/DisplayObjectContainer/Starling bindings, typed pending fields, native get_isHtmlText, and GameReflection hooks. Removed Raw/any and direct class lookups from this module while retaining queue/cancellation order.
- BitmapFontBatching now uses the central BitmapFont binding and typed fillMeshBatch hook. Recorded the native compositor argument types; updated existing fixtures to bind their native classes.
- Type-check, strict declarations, public/private builds, and whitespace check passed. Tests remain paused; deferred rendering behavior still needs runtime verification.

### Typed native-font HTML compositor integration

- RichBitmapFontCompositor now extends the central typed BitmapFont and uses concrete MeshBatch/TextFormat/TextOptions and renderer types; its factory returns the inferred class. Scratch renderer state is declared explicitly for native font instances borrowing the method.
- NativeBitmapText uses central StarlingTextField and typed GameReflection hooks. HTML routing calls the native options getter; plain arguments continue to the original compositor. Cleanup disposes/deletes only the scratch renderer.
- Updated compositor fixture native bindings and typed sparse boundaries, retaining its geometry/layout/disposal assertions. The test remains unrun under the user's test pause.
- Type-check, public/private builds, and whitespace check passed. Runtime HTML/tooltip rendering remains unverified; this does not close visual parity issues.

### Native Text renderer/markup contracts

- Audited native Text alignment and content setters alongside the port's initialization bridge; native _hAlign/_vAlign survive initialization and source alignment calculations were retained.
- Source-ported Text now uses concrete renderer, markup/parser, bitmap format, and font registry types. Renderer lifetime is nullable; native setter calls replace dynamic visibility/position/filter properties. Disposed markup remains cleared rather than assigning null through an any alias.
- The native-instance initialization bridge, OpenFL format, and remaining display wrapper types are still incomplete; this is not a claim of fully typed Text.
- Type-check, public/private builds, and whitespace check passed. Tests remain paused; no live comparison performed.

### Fix OpenFL numeric alignment conversion

- Current game JS's TextFormatAlign conversion maps center/end/justify/left/right/start to 0/1/2/3/4/5. The port previously used String(format.align), producing "0"/"4" instead of center/right, so the source renderer fell through to left alignment.
- Added ui/TextAlignment.ts and used it in Text.applyFormat. Numeric values translate to the original names; existing string inputs pass through; null/default remains left. Container alignment and world coordinates are unchanged.
- Added a regression case that checks both resolved format and glyph positions for numeric center/right/left and legacy string input. Tests remain paused; this test was not executed.
- Type-check, public/private builds, and whitespace check passed. This is a source-verified mismatch fix, not proof that all reported tooltip alignments now match visually.

### Typed OpenFL Text format and label dependencies

- Text now uses central NativeTextFormat/Point/Event/GlowFilter bindings. Reviewed native format fields are explicitly nullable; alignment is numeric in the native declaration, and applyFormat translates it through the prior alignment fix.
- Captured format values in setters instead of dynamic access. Restored original Boolean(format.bold) comparison, so a null native bold field and false behave as in AS3 rather than triggering a redundant style update.
- Glow lifetime and optional clean event are explicitly nullable; cleared/disposed labels retain only their lightweight metrics point instead of forcing a typed reference to null.
- Type-check, strict declarations, public/private builds, and whitespace check passed. Tests remain paused; NativeTextBridge and native-instance initialization still require typing and live parity checks.

### Concrete Text class and typed native field handoff

- Text now extends the central typed DisplayObjectContainer and returns its inferred class. Pivot/touchability calls use native methods; original floored coordinates and alignment logic remain intact.
- initializeNative receives the installed Text shape plus its native OpenFL field/texture state instead of any. Verified and declared the native text/htmlText, dimensions, and wrapping getters used for handoff.
- Updated bitmap fixtures to access label renderers through the display tree and exercise numeric alignment using a native format instance. NativeTextBridge's dynamic descriptor installation remains a separate typing gap.
- Type-check, strict declarations, public/private builds, and whitespace check passed. Tests remain paused; no live login/gameplay comparison performed.

### Typed native Text bridge and restoration

- Removed Raw/any and bare Function from NativeTextBridge. It uses the central native Text binding, concrete installed-text/constructor types, typed tracking sets, and unknown arguments at the dynamic descriptor boundary.
- Moved unload-state restoration into Text.restoreNative, preserving the original restoration order: native methods first, scratch child disposal, wrap/dimensions/format/content restoration, then native draw. Format presence is checked before passing it to the native setter.
- Verified OpenFL field setters against current JS and recorded their signatures. NativeBitmapText now passes a concrete source Text class; updated the existing bridge fixture to bind native classes.
- Type-check, strict declarations, public/private builds, and whitespace check passed. Tests remain paused. Native bridge lifecycle behavior still needs runtime validation; no full parity claim.

### Current native frame-chain source audit

- Re-read current Game.update and GameStateMachine.update: execute/draw occurs every display callback after zero or more 33ms ticks; parallax and TextManager update follow that execution. EmitterFrames hooks the parallax before-phase and suppresses the session's old tick emitter update, so it sees this frame's ship pose.
- Current native TextManager forwards elapsed seconds unchanged to TextHandler. CombatTextFrames replaces the native handler and converts seconds to milliseconds exactly once. The native handler's old `33 * seconds * 60` movement factor is bypassed. No double conversion or tick-only callback was found in this chain.
- Original Emitter.as explicitly caps elapsed milliseconds at 500. The port's 500ms cap matches it and was retained. Engine render accessors override inherited GameObject accessors and derive the mount from the rendered ship, so the early accessor branch in emitterTargetPose is intentional.
- This source audit did not reproduce or resolve the user's visual stutter report. Remaining verification needs actual rendered labels/effects at different refresh rates. No runtime tests were run; the user pause remains in effect. Do not repeat these timing-path checks as a substitute for that comparison.
- Added reviewed native Particle lifecycle/motion/color fields and emitter particle-array types, plus a typed pending-particle-delta map. The rest of EmitterFrames still uses Raw and is explicitly unfinished. Type-check, strict declarations, builds, and whitespace check passed; no runtime tests were executed.

### Typed emitter frame-state inputs

- EmitterFrames update/reset/emission/draw methods now accept native emitter state with the existing optional retainUntilKilled/mirrorY extensions. Both bookkeeping maps have concrete particle/emitter keys. Native lifecycle hooks use GameReflection; collective batch lifetime is checked before drawing.
- Replaced dynamic constant-emitter, max-particle, emission-rate, and particle-coordinate reads with native getters. Verified get_ppms/get_constantEmitter/get_maxParticles directly; emission-rate math remains unchanged.
- Updated sparse emitter fixtures with explicit native-boundary casts. Constructor dependencies and some installer paths still use Raw/any; this is not fully typed emitter coverage.
- Type-check, strict declarations, public/private builds, and whitespace check passed. Tests remain paused; no frame-rate parity claim.

### 2026-11-11 — restart continuation: typed emitter frame path

- Confirmed local upstream SHA-256 remains `7c49ee6caf843c3b109ebb7a979bc443a16fd92c503cb4aa25e81138a3b1f10d`.
- Added central Particle/Color bindings and reviewed native particle/emitter signatures. EmitterFrames now uses typed constructor dependencies, native reset/factory hooks, checked game-session identity, and typed manager/parallax hooks. No explicit `any`, `Raw`, or dynamic class lookup remains in that module.
- Compared original Emitter.as updateParticleCount/add/drawParticels/ppms against the port: pending particle delta, uniform sequence, pool limit, friction and central gravity match the source formulas; newer native rainbow column behavior remains retained. No rendering parity claim follows from this source check.
- Updated sparse emitter fixtures to satisfy the native constructor/session boundaries; tests remain paused and were not run.
- Validation: project TypeScript check, strict generated declaration check, public build and private build passed. No commit, push, deployment, or live browser check in this continuation. High-refresh runtime parity and the remaining full-port audit are still open.

### 2026-11-11 — dedicated aura batch clearing mismatch

- Original `CollectiveMeshBatch.Create(emitter, true)` registers owner-scoped rarity batches in `meshBatches`; `beginUpdate()` clears them before emitter updates, including frames that exit before drawing. The port creates standalone MeshBatch instances for those layers, so its native-batch clearing loop did not reach them.
- Fixed the rarity preparation callback to clear its dedicated batch before synchronizing the layer. This callback runs before the frame update’s stale/stopped/culling exits. Parent synchronization after drawing remains non-clearing. This prevents old geometry surviving a skipped draw.
- Extended the existing layer fixture with batch geometry state and assertions for clearing during frame preparation and preservation during parent synchronization. Tests remain paused; these assertions have not been run.
- Compared aura soft-alpha and blue-breathing formulas plus sibling layer ordering against original source; no further source mismatch found in those specific methods. This is not evidence of complete visual parity.
- Project type check, public/private builds, and whitespace check pass. No browser/runtime verification, commit, or deployment performed.

### 2026-11-11 — login credential alignment mismatch

- Compared original LoginInput.diff with the current Haxe LoginInput constructor and TextFormatAlign conversion table. Original credentials use center alignment; native Haxe constructs the format with `0`. The port passed `1` (end alignment) in both the add/edit-account form and the adapter styling recovery/registration inputs.
- Corrected both paths to `TextFormatAlign.Center`. Added named OpenFL alignment values in game/TextFormatAlign.ts and shared them with the bitmap alignment conversion, avoiding ambiguous numeric constants. The custom form now constructs its format through the central NativeTextFormat binding.
- Checked original credential validation messages, profile provider labels, auto-login countdown/hint, and LoadingBar line spacing against these port paths; those inspected strings/formulas match. This does not establish complete login or connection parity.
- Project type check, public/private builds, and whitespace check passed. Unit/runtime tests remain paused; no live screen comparison, commit, push, or deployment in this continuation.

### 2026-11-11 — typed login button and provider chooser

- Compared LoginButton and LoginAccountTypePanel against their original source. Kept source dimensions, text, font selection, colors, enabled state and ended-touch behavior.
- Replaced their untyped native class aliases with central bindings, typed callback contracts and inferred factory return types. Removed bare Function/any/Raw declarations from both modules; renamed button and chooser arguments. Provider selection narrows to simple/kongregate/armor, and currentTarget is matched against the owned row list without an unchecked Sprite cast.
- Kept Sprite resolution for property-alias installation used by remaining source screens. LoginProfiles now retains the concrete button and chooser constructor types across registry resolution.
- Project type check, public/private builds and whitespace check passed. No tests or live browser comparison were run (tests remain paused). Profile-list internals and broader source parity remain unfinished; these changes do not establish complete screen parity.

### 2026-11-11 — profile chooser data/callback contracts

- Typed profile arrays, selection/lookup results, profile field access and action/toggle callbacks with the existing Profile contract. Factory return inference now reaches LoginProfiles through its typed registry boundary. Native display aliases in LoginProfilePanel remain untyped and are still pending.
- Preserved first-Steam-profile pinning, selected-profile identity and source callback arity handling. Restored explicit Boolean conversion for enabled/removable as in original LoginProfilePanel.as; former TypeScript assertions performed no runtime conversion. Own-property lookup now supports normalized/null-prototype objects without calling a potentially missing or shadowed hasOwnProperty method.
- Project type check, public/private builds and whitespace check passed. Tests remain paused; no runtime screen comparison or deployment was performed. Full parity remains unproven.

### 2026-11-11 — profile chooser native display typing

- Replaced LoginProfilePanel’s native class aliases with central Sprite/Quad/TextField/TextFormat/Point/Event/BlurFilter bindings; typed email-label, blur-filter and reveal-width maps. Display reads/writes now call native Haxe accessors; hover routing checks the row’s Sprite identity and uses native touch phase/cancellation methods. No explicit any or bare Function declarations remain in the panel.
- Added BlurFilter to central bindings and reviewed its constructor plus Touch.getLocation/get_cancelled against the current local game. Generated declarations and strict checking pass.
- Kept existing bitmap email-prefix measurement, hover reveal/remask, filter cleanup, and original page/control geometry. Updated NativeUI’s fixture context to bind native classes before constructing source panels; the test remains unrun.
- Project type check, strict declaration check, public/private builds and whitespace check passed. Unit/runtime tests remain paused; no login browser session comparison or deployment occurred. Full feature and visual parity remain open.

### 2026-11-11 — typed credential entries and obsolete clan lookup

- Added central TextEntry binding and reviewed constructor, DOM element nullability, focus, size, password/restriction/length/padding signatures against the current JS. LoginProfiles now uses that binding, native layout getters and direct Russo registry; typed panel data now flows into typed credential inputs.
- NativeUI class lookup now uses the known GameClassName/GameClasses mapping. Sprite/quad/text/image factories retain concrete types; required texture lookup fails explicitly if absent. Place/touch/dispose still use legacy Raw contracts and remain pending. Updated dependent marker nodes, texture fields and sparse fixture type boundaries.
- This exposed an actual missing feature: ClanLabel called DataManager.loadKeyFromBigDB, absent in the current Haxe DataManager. Original DataManager.as forwards that call to client.bigDB.load. Adapted the label to the current client BigDB API (verified current BigDB.load forwards the returned object unchanged), keeping identity/lifecycle guards, bounded retries, callback error containment and missing-logo text fallback. Updated the clan fixture to expose BigDB rather than the obsolete method.
- Project type check, strict generated declaration check, public/private builds and whitespace check passed. Tests remain paused; neither the clan fix nor login changes have been verified live. No commit/push/deployment performed.

### 2026-11-11 — chat metadata transport and clan identity cache

- Found the other obsolete loadKeyFromBigDB call in NativeChatContext. Its presence check silently disabled clan/player metadata lookups under current Haxe. Routed those lookups through the view’s account BigDB using ChatContextLookup; floating chat inherits that same client. Async/synchronous failures now release pending flags, and duplicate transport responses settle only once. No remaining calls to the old DataManager BigDB helpers were found in src.
- Compared original PlayerShip.refreshClanLabel/applyClanLabel/updateClanLabelVisibility. Restored the missing player-owned clan name/rank/color/logo cache and exact player/clan identity stamps. Cached rank/color updates refresh the label without a lookup; a new ship label can reuse that identity. Callback applies visibility/layout immediately, and matching parent/player/clan checks prevent display of stale labels.
- Added unrun ChatContextLookup assertions and extended the existing clan fixture with cache reuse/rank-color cases. Unit/runtime tests remain paused.
- Project type check, public/private builds and whitespace check passed. No browser comparison, commit, push or deployment; full feature parity remains open.

### 2026-11-11 — typed clan display and real lifecycle accessor

- ClanLabel now uses typed native Game/Player/PlayerShip/display objects, typed ClanRecord and client identity-stamp augmentation. Native clan fields, ship nameText and ClanState.getMemberRankName signature were reviewed against local JS. Hook registration uses GameReflection; GameSession provides a checked native game boundary. No explicit any/Raw remains in ClanLabel.
- Found lifecycle mismatch: RenderPosition installs get_lifecycleId, but the old label read a lifecycleId property which that installer does not define. Replaced it with the typed accessor in both request capture and stale-response checks. Native get_isLeaving/get_me and display accessors replace further property-name assumptions.
- Extended the unrun clan fixture to cover a response arriving after ship lifecycle change but before the next label update. Fixtures use native getters and sparse boundary casts.
- Project TypeScript check, strict generated declaration check, public/private builds and whitespace check passed. Tests remain paused; no runtime/session comparison or deployment. Full port parity remains unproven.

### 2026-11-11 — telemetry lifecycle sweep

- Searched direct lifecycle/render-position properties after the clan fix. RadarTelemetry also read lifecycleId instead of the installed get_lifecycleId accessor. Corrected its typed ship sampling and native landed getter; motion averages now detect native ship reuse as original RadarTelemetry.as requires.
- DamageObserver now prefers that same accessor for target ownership, retaining its locally tracked Unit.reset generation only when the accessor is unavailable. It no longer switches from a native lifetime to a local counter after the first observed reset.
- Existing radar fixture now exposes native lifecycle/landed methods. Added an unrun homing observation case where the native target lifecycle changes without a local reset notification; stale contact must remain uncounted and be marked partial.
- Confirmed RenderPosition deliberately defines hasRenderPosition as a property, so the inspected emitter/combat-text/beam checks using that property were retained. Snapshot renderX/renderY fields are data, not native accessor mistakes.
- Project type check, public/private builds and whitespace check passed. Tests remain paused, no runtime framerate comparison was performed, and full parity remains unfinished.

### 2026-11-11 — resumed after restart; shared native UI contracts

- NativeUI now accepts concrete DisplayObject/DisplayObjectContainer/TouchEvent contracts for placement, touch listeners and disposal. Placement preserves the child type; disposal uses the native get_parent accessor. No explicit Raw/any remains in this shared adapter.
- Propagated concrete Sprite, Quad, Image and TextField types into target/debuff/aura/radar displays and command autocomplete. Emoji autocomplete uses the existing ported Text factory type. These surrounding modules still contain other untyped contracts; this does not finish the repository-wide typing work.
- Updated sparse fixture boundaries for the now-typed nodes. Tests remain paused and were not executed. TypeScript checking and public/private builds passed; no live comparison, commit, push or deployment performed. Full functional and visual parity remains open.

### 2026-11-11 — restored radar service diagnostics and wrapped layout

- Compared original RadarTelemetry.refreshText/onFrame with the port. The original has six fixed telemetry labels, including Service IPC, and appends ServiceConnectionPool.connectedRoomIds to the primary service line. The port had only five labels, omitted auxiliary rooms/IPC, and allocated exactly 15px per visible row regardless of wrapping.
- Restored the sixth IPC status row, auxiliary rooms from the existing per-game registered service pool, stable setting-to-label indices, wrapping for both service rows, width constrained by stage/radar position, and cumulative measured heights for telemetry/boss placement. Hidden settings hide their own labels without repurposing another label. Radio stays excluded.
- RadarTelemetry now receives a checked native Game at the session boundary and skips updates while leaving, as original onFrame does. Verified original networkLatency simply returns clock.latency; retained that existing native calculation.
- Updated the radar fixtures for fixed row identities and IPC text; added an unrun case covering auxiliary rooms, narrow-stage wrapping, room removal and both service rows hiding together. Tests remain paused. Project typecheck, public/private builds and whitespace check passed; no runtime/visual comparison, commit, push or deployment occurred.

### 2026-11-11 — nearby target snapshot reset parity

- Compared original TargetInfoElement refreshNearbyTargets/compareNearbyTargets/updateNearbyTargetBars and NearbyTargetBar touch/layout code. Inspected priority ordering, boss identity deduplication, 250 ms snapshot interval, range checks and per-frame row presentation match; this source review does not resolve the reported runtime switching behavior.
- Found lifecycle coverage gap: TargetSystem snapshots only counted manager removals, while original cached rows compare Unit.lifecycleId. RenderPosition already installs get_lifecycleId at native GameObject.reset. TargetSystem now records that accessor and a monotonically advancing snapshot revision, invalidating on either native reset or explicit manager removal. Immediate removal invalidation remains intact even if reset follows later; existing callers still compare opaque numeric revisions.
- Added an unrun regression case for reset without manager notification, rejected stale click, fresh snapshot reuse, removal before reset and subsequent re-selection. Tests remain paused. Project typecheck and public/private builds passed. No runtime target-order comparison, commit, push or deployment occurred; full parity remains unfinished.

### 2026-11-11 — restored optional debuff texture fallback

- Compared TargetInfoElement active health/shield inclusion, header geometry and DebuffDisplay.addDebuff/resetImage with the original. Original missing debuff art leaves the pooled fallback texture intact.
- Found a regression from the earlier NativeUI typing change: texture() now requires a texture and throws, making DebuffDisplay's null-coalescing fallback unreachable. Added typed findTexture(): Texture | null and routed optional debuff art through it. Required texture() retains its explicit missing-asset failure. Clan-label optional art already catches the required lookup failure, so its current text-only fallback remains valid.
- Updated the existing debuff fixture to exercise missing optional icons; added an unrun shared lookup case for nullable versus required art and atlas argument forwarding. Tests remain paused. Typecheck and public/private builds passed; no live target UI comparison, commit, push or deployment occurred.

### 2026-11-11 — portable command entry rules

- Compared Game.openPortableRecycle/Upgrade/Hangar/PirateBay and source portable state classes. The shared port incorrectly applied the hangar/Pirate Bay roaming-or-real-landed restriction to recycle and upgrade, rejecting source-supported entries from other screens. Restricted that guard to hangar/Pirate Bay.
- Retained recycler pending/open state reuse and shared RPC ownership. Restored fresh upgrade-state construction on each request instead of reusing an open upgrade state. An already active native Pirate Bay now returns without an erroneous close-screen warning, matching source Game.openPortablePirateBay.
- Added an unrun transition fixture for these distinctions. Tests remain paused. Project typecheck and public/private builds passed. No screen runtime comparison, commit, push or deployment performed; source presence is not full parity proof.

### 2026-11-11 — hangar native sections and cleanup typing

- Reviewed original Hangar catalog selection, skin deep copies, verified purchase metadata and native Haxe SkinItem constructor/addBuy. Current Haxe still supports preview-only mode 2; the inspected port purchase/preview selection follows the source. This review is not proof of full hangar screen parity.
- Reviewed SkinItem section construction and disposal in the supplied game bundle. Added concrete native Sprite/Text/SkinItemBaseStats declarations for sections, nullable stats before construction, and typed scalar/disposal members. Regenerated Game.d.ts.
- HangarPreviewLifecycle now uses central SkinItem binding, typed reflection, a WeakSet<SkinItem> and Set<DisplayObject>, and native get_parent access. No Raw/any remains in that hook. HangarCatalog uses central SkinItem/Sprite/Text instead of local any constructor aliases; its remaining data/hook typing is still unfinished.
- Project and strict declaration checks, public/private builds passed. Tests remain paused; no runtime preview/disposal comparison or deployment occurred.

### 2026-11-11 — shared rendered engine mount cache

- Rechecked Body.updateIsNear against BodyVisibility and traced current native EnemyShip/PlayerShip draw calls through Ship.draw. The inspected culling predicate/extent and post-interpolation label order match source; this does not establish that the reported sun or full-refresh symptoms are fixed live.
- Found an omitted source optimization in core/engine/EngineRenderPose.as: original render coordinate getters share a pose cache keyed by ship x/y/rotation and mount x/y. Port getters independently recomputed mount trigonometry on every coordinate read.
- Added rendering/EngineRenderPose.ts and per-engine WeakMap cache in RenderPosition. Preserved source zero-X atan convention, rotation + PI, native validity fallback and rendered ship coordinates. All three getter results reuse the same calculation when inputs are unchanged. No simulation/mechanics changes.
- Project typecheck, public/private builds and whitespace check passed. Tests remain paused; no runtime performance measurement, visual comparison or deployment occurred. High-refresh parity remains open.

### 2026-11-11 — typed target detail views

- Removed explicit Raw/any and generic property reads from TargetInfo, AuraInfo and DebuffDisplay. TargetInfo receives the checked native Game at the session boundary and reads stage/leaving/recovery through native accessors. AuraInfo uses Unit identity and a bounded EnemyShip rarity-constant contract; DebuffDisplay takes object identity for tracker lookup and a concrete game for its clock/tooltip.
- Typed Sprite/Image/ToolTip objects now pass directly to their native APIs instead of repeated reflective casts. Layout, shield/health values, aura text and debuff calculations were retained.
- Updated sparse fixture boundaries and initialized central bindings in the aura fixture. Tests remain paused. Project typecheck and public/private builds passed; no runtime screen comparison or deployment performed. Remaining modules/declarations still need typing and full parity remains open.

### 2026-11-11 — typed radar display accessors

- RadarTelemetry now reads player/course/stage/radar geometry through native getters. EmperorRadarTelemetry uses concrete Game, TextureLocator and MessageLog bindings, native enemy/name/ID getters and typed label formats. BossTimerRadarTelemetry uses native format and textBounds methods. No explicit Raw/any or generic read calls remain in these three display modules; the secondary-timer preference still uses the existing dynamic client-settings bridge.
- Confirmed ShipManager constructs enemies as an array in the supplied game JS and declared EnemyShip[]. Declared Hud.radar as native Radar|null, preserving initialization nullability. Regenerated Game.d.ts.
- Updated radar fixtures to expose native accessors and bind central texture classes. Tests remain paused. Project typecheck, strict declaration validation and public/private builds passed; no runtime radar or high-refresh comparison performed and no deployment occurred.

### 2026-11-11 — cargo queue teardown and RPC contracts

- Traced added-source inventory candidates to their consumers. MessageRandom is seeded but no longer consumed by the original death selector; retained the existing event-hash DeathMessageSelection instead of adding unused RNG code. CargoReadQueueState is represented by inspect/CargoReadQueue.
- Compared cargo queue ownership/serialization against original state machine. Fixed installNativeCargoQueue's direct game.isLeaving read to the actual Haxe get_isLeaving accessor, so queued/late responses stop when the scene leaves even before API session cleanup.
- Typed queue request arguments from Game.rpc, responses as native Message, generic callback invocation and checked Game boundary in NativePlayerInspect. No Raw/any/bare Function remains in CargoReadQueue. Verified current Message exports length as a property (not get_length) from supplied JS and used that property directly; fixture messages now match it.
- Extended the unrun native queue fixture with a late reply while the native leaving getter is true. Tests remain paused. Typecheck and public/private builds passed; no runtime inspector comparison or deployment performed.

### 2026-11-11 — release popup native state checks

- Audited direct isLeaving/recovery reads. Compatibility aliasProperties can make some of them valid after source-class resolution; a direct property search alone is not proof that every listed path fails. The preceding cargo fix removes that installation-order dependency, rather than establishing failure in every running session.
- ClientReleaseSequence now accepts Game, uses native player/leaving/recovery accessors and checks concrete PopupMessage children through the native overlay getters. Removed Raw/any/read from the scheduler. NativeClientChangelog provides a checked Game boundary and uses its accessors when opening/closing around recovery.
- Verified SceneBase constructs overlay as a Sprite in the supplied JS and added that declaration. Updated release fixtures with native state/visibility getters and a leaving-scene case; tests remain paused and unrun.
- Project/strict declaration checks and public/private builds passed. No runtime login/release-popup comparison or deployment performed; full parity remains open.

### 2026-11-11 — typed welcome dialog and saved state

- Added central PopupConfirmMessage binding and reviewed native popup constructor/section types from current JS (Text, Box, Button); typed nullable Button callback for owned cleanup. Regenerated declarations.
- ClientHelpWelcomePopup now extends the typed native confirmation dialog, with typed Stage/KeyboardEvent, native setters/getters and inferred factory return. NativeClientWelcome retains the concrete popup type and uses native game/stage-parent/modal checks; NativeClientHelp supplies a checked Game boundary. No Raw/any remains in the welcome popup or scheduler.
- Replaced welcome persistence Raw contracts with ClientWelcomeStorage and Record<string, unknown>. Preserved data/get_data support for the shared state helper, pending/dismissed migration, storage-failure containment and deliberate dismissal semantics. Source text and button labels remain unchanged.
- Updated unrun welcome fixtures for native bindings/accessors. Project and strict declaration checks plus public/private builds passed. Tests remain paused; live login/welcome/reconnect comparison and full parity remain unverified. No deployment performed.


### Resume audit: tooltip bitmap line anchors

- Confirmed the current local game SHA-256 remains `7c49ee6caf843c3b109ebb7a979bc443a16fd92c503cb4aa25e81138a3b1f10d`. Regenerated native declarations from that file.
- Native WrapText.lineTop measured inline icon anchors with OpenFL even though the port uses bitmap geometry for text sizing. Rich bitmap composition now records line tops per destination mesh batch; WrapText uses its own measuring batch's positions, including wrapped lines and leading. Shared font scratch renderers cannot overwrite another field's saved positions. Native font and unavailable-line fallbacks remain.
- Added the native lastWrapWidth number signature. Extended the existing measurement fixture for bitmap anchors and native fallback; tests remain paused and were not executed.
- This addresses an identified measurement mismatch, not proof that all reported hover wrapping is resolved. Live tooltip comparison remains outstanding.


### Typed bitmap input geometry

Compared RichBitmapTextMetrics against the original core/hud/components/chat/rich/RichBitmapTextMetrics.as. Retained cluster navigation, password masks, atlas advances, kerning, fallback glyph order, emoji scaling and Japanese glyph acquire/release behavior. Replaced untyped class resolution with concrete local classes and native font/character types, including nullable missing glyphs and formats. Native property-alias setup remains explicit.

RichBitmapEditorView now uses the central Sprite/Quad bindings, concrete renderer and metrics types, and BitmapFontTextFormat; removed Raw from its viewport, caret, selection, clipping mask and prompt renderer. Updated fixture display access through a checked fixture helper. Tests remain paused; no live caret/selection parity claim.


### Native bitmap input contract and editing comparison

- Compared the original RichBitmapFontTextEditor replaceRange/commit pipeline and clipboard methods with RichBitmapEditorModel and RichBitmapInputBinding. The inspected paths preserve typed-markup promotion guards, command-prefix protection, insertion style inheritance, newline filtering, and clipboard plaintext/token behavior. This is a bounded source comparison, not whole-editor parity verification.
- NativeBitmapInput now accepts TextEntry, reads native getters/typed fields and constructs the concrete BitmapFontTextFormat. Removed its Raw/read dependencies. BitmapInputAdapter's native entry now uses the central TextEntry constructor and type. Null browser-element initialization is explicit.
- Checked TextEntry constructor and native methods in the current astroflux.js; added signatures for padding, maxChars, restrict, password flag, sanitize, selection, length and updatePlacement's boolean return.
- Project typecheck, standalone strict game declarations, public/private builds and whitespace checks pass. Tests remain paused. The wider BitmapInputAdapter and native placement helper still need typing; visual/input comparison remains outstanding.


### Typed popup input adapter

BitmapInputAdapter now extends the centrally bound Sprite, constructs native Quad/NativeTextFormat, and exposes concrete format and native-focus contracts. Its factory return type is inferred; the module no longer declares Raw or any. Retained native alias installation for the source popup's property reads. Source popup inspection confirms its focus bridge consumes keydown events and cancels Enter/Up/Down/Tab; the existing event-name mapping remains. Checked TextEntry enablement, background and padding methods against the current game and added their native signatures.

Compilation/build validation only; popup keyboard and visual behavior have not been runtime-verified. Tests remain paused.


### Login source recheck and native input placement types

Rechecked automatic profile cancellation/countdown and LoadingBar/parallel loading against Login.as and LoadingBar.as. Corresponding implementations exist; this bounded read did not identify an additional missing change. Runtime login timing and cancellation remain unverified for this worktree.

NativeInputPlacement now uses TextEntry getters, typed bounds and an InputOverlay contract instead of Raw/read. Verified DomOverlay.globalRect/toCss/place in the supplied game and added their signatures. NativeBitmapInput resolves that typed overlay once when binding. Updated sparse placement fixtures to expose native getters; tests remain paused. The excluded radio module received only the base TextEntry type annotation/null assertions required by the shared signature change; radio was not enabled or ported further.


### Rendering source audit: guarded tentacle lifetime

- Compared Emitter.update/updateParticleCount/drawParticels, Body.updateBody/updateIsNear and Instant/InstantSplitting.draw/releaseLines against the source. Inspected elapsed emission windows, post-emission particle age, fractional gravity/friction, uniform distribution, body view-revision invalidation and beam fade calculations. Those inspected expressions correspond to the port, while newer native rainbow behavior remains intentionally retained. This is not a full rendering sign-off.
- Verified current native Projectile inherits GameObject.draw; the render-position ready hook is reached before the port's predicted pose. No additional ready flag was added.
- Found the port-owned Nether tentacle execute branch only checked range != 0. Restored the source's finite/positive projectile and weapon range gates, including absent weapon handling. Valid shots retain Haxe integer TTL conversion; invalid geometry leaves initialization pending rather than corrupting the TTL.
- Added an unexecuted regression case for invalid ranges followed by valid initialization. Tests remain paused; high-refresh visual comparison remains open.


### Typed rich chat integration boundary

NativeRichChatInput now takes GameScene, uses the native TextEntry and central Localize binding, and keeps the absent-chat/element guards explicit. GameSession checks the native Game instance at this boundary. Verified current ChatInputText constructs core.hud.components.ui.TabBar; ChatTabs now extends that native type rather than omitting its event/display contract. Compared the original channel restriction assignments: Global excludes `^<>=&#[]{}`, other channels remain unrestricted. Retained that behavior and artifact-label refresh subscriptions. Updated fixtures for the concrete game boundary and localization binding.

Project and standalone strict declaration checks pass. Tests remain paused; this does not verify live channel switching or popup focus.


### Color popup keyboard boundary

Compared onHexNativeKeyDown/configureHexInputEditor against the original popup: Enter normalizes incomplete hex and collapses selection; Enter, numeric Enter, Up, Down and Tab prevent default and stop immediate propagation. The port retains those branches. BitmapInputAdapter now exports its concrete keyboard-focus bridge, and the source popup consumes browser KeyboardEvent instead of an any-typed Flash dispatcher/editor. Removed the unused Flash dispatcher/keyboard class lookups from this popup. Event naming remains keyDown at the source boundary and keydown on the browser input.

Source comparison and typecheck only; this is not proof of browser propagation/IME behavior. Tests remain paused.


### Formatting slider native types

Compared ChatSelectionValueSlider.as: the port retains minimum-relative step snapping, clamping, half-knob pointer offset, silent programmatic value assignment, drag-only change dispatch, and active/idle knob colors. The original slider has no keyboard handler. Replaced all any aliases in ChatSelectionValueSlider.ts with central Point/Quad/Sprite and native TouchEvent types; use native getters/setters instead of dynamic display properties. The factory now infers its concrete class type. A disposed scratch point is explicitly nullable.

Updated existing fixtures to use native touch/color accessors and inspect public display children rather than private fields. Project check, public/private builds and whitespace checks pass; tests remain paused and visual behavior is not newly verified. The surrounding source popup still contains untyped fields.


### Typed composer format buttons

Compared ChatComposerFormatButton.as: idle/hover/down/disabled colors, disabled label color, cancelled-touch suppression, touch isolation and triggered dispatch match the ported branches. Removed all explicit any declarations from the button factory/class in favor of central native bindings, the concrete Verdana registry, and native getters/setters. FloatingChatWindow now positions its Close/Reconnect buttons through the typed setters exposed by that factory. Updated formatting fixtures to bind their native classes and expose native touch/color accessors; fixtures remain unexecuted under the test pause.


### Typed game-session initialization

GameSession now accepts the GameScene checked once by the existing onGame boundary. Removed repeated Game casts throughout subsystem installation and the session entry's Raw declaration. Artifact construction and localization now use central bindings; Artifact was added to game/Bindings.ts. Session initialization checks HUD availability before installing feature hooks rather than failing at its final addChild calls. Verified Hud constructs core.hud.components.BossHealth in current astroflux.js, added its nullable signature, and use its native visibility getter for the client visibility override.

Dynamic frame-event reads and the client-settings lookup still remain in this module; this change does not claim those boundaries or the broader API have been fully typed. Tests remain paused.


### Host frame-event contract and session settings access

Inspected the host public/plugins/core.js: frame events forward `{ game: this, event }` after native Game.update. The game update accepts Starling EnterFrameEvent. Added an API frame overload with that payload and a numeric get_passedTime signature. GameSession, automation rendering and health/shield animation now read that getter directly instead of the dynamic read helper. GameSession uses its captured settings instance for disableSelectedTargetIcon rather than resolving the global SceneBase setting each frame.

Removed the settings factory's any return annotation so its existing typed getters/setters are inferred; adapted the settings-name assignment helper to the actual property types. Internal ClientSettings persistence and other host API events still require typing. GameSession no longer contains Raw, any, read() or cls() calls. Tests remain paused; this is contract/source validation, not a new frame-rate measurement.


### ClientSettings persistence types and malformed saved records

Removed explicit any from ClientSettings.ts: typed the storage and session identity interfaces, Point constructor, settings records, aim boolean defaults/range tuples, normalized music state and saved chat tab. Saved data enters as unknown and is narrowed to records. getPlayerSettings distinguishes creating writes from nullable reads; valid per-account values/defaults and persistence keys remain unchanged.

Fixed malformed saved account records being treated as settings objects, malformed private chat targets reaching string methods, and saved hasOwnProperty keys breaking ownership checks. Invalid records now fall back to defaults, while other accounts' records are retained. Added an unexecuted fixture for these cases. Typechecking/public/private builds/whitespace checks pass; tests remain paused. RuntimeSettings still has its older dynamic storage/bridge and needs its own conversion.


### Typed runtime settings bridge

RuntimeSettings now receives GameScene, obtains the account via get_me, uses central Point/SceneBase bindings and narrows unknown persisted records. It retains the session-bound identity facade so late settings writes cannot target another account. The HUD property mapping is checked for completeness and value-type compatibility against ClientSettings. Removed Raw/read/any from this module and Settings.ts; legacy normalization now narrows each boolean/numeric input before assignment. Existing persistence keys, one-time migration gate and settings setters remain unchanged. Updated the runtime-settings fixture to provide native getters and bindings; tests remain paused.


### Shared settings extension in central bindings

Added the inferred client settings instance type to game/Bindings.ts and declared SceneBase.clientSettings as the optional client-owned static extension (not an upstream game member). RuntimeSettings installs/restores that typed property. RadarTelemetry now reads the secondary boss-timer flag through the central binding; ProjectileFrames reads the typed torpedo flag while preserving its missing/non-boolean fallback and capture-on-checkout lifecycle. Removed those dynamic class/Reflect lookups. Other rendering/ship settings consumers still require conversion and corresponding fixture updates. Tests remain paused.

### Restart continuation: typed cloak and teleport transitions

- Verified the local game bundle still has SHA-256 `7c49ee6caf843c3b109ebb7a979bc443a16fd92c503cb4aa25e81138a3b1f10d`.
- Completed native bindings and typed hooks in `EnemyCloakPresentation.ts`. Compared reveal/fade and overhead opacity handling with original `EnemyShip.as`. Native GameObject.reset writes clip alpha directly, so the suspected setter/reset ordering failure is not present; no reset behavior change was needed.
- Converted `TeleportScaleAnimation.ts` from Raw/dynamic class lookups to concrete native types and centralized bindings. Added the Teleport binding and verified message/cooldown/shadow signatures. Expanded TweenMax.to typing to numeric target properties and update/completion callbacks, matching its native property iteration.
- Restored original PlayerManager teleport lifecycle and phase guards: callbacks must belong to the captured pooled life and expected phase; canceled/completed callbacks are inert. Marker cleanup remains isolated from authoritative movement. Native emitter reuse is tracked at its actual dispose boundary.
- Project typecheck, strict generated declaration check, public build, private build, and whitespace check passed. Tests remain paused at the user's request; no runtime parity claim, browser testing, push, or deployment in this continuation.

### Startup service selection parity

Compared original JoinRoomManager.selectInitialServiceRoom with the current Haxe handleServiceRooms and the port's startup/recovery paths. Recovery already used the original 40-user automatic-join cutoff; startup still delegated to Haxe's 195-user cutoff. Added a typed startup handleServiceRooms hook in LoginLoading: exclude the IPC room, retain native room-ID validation and supported-version filtering, choose the default when no eligible rooms exist, automatically join a sole room below 40 users, otherwise show the existing native selector. Selector callbacks reject retired/completed attempts and repeated selections. The current Haxe session/protocol handshake remains in StartupServiceJoin.

Also source-compared the independent loading status lines and MessageLog's exact echo request routing; no mismatch was found in those inspected branches. This is bounded source evidence, not proof of overall login/chat parity. Project check, public/private builds and whitespace check pass. Tests remain paused; no runtime comparison or deployment performed.

### Game-room response/rejection recovery parity

Compared original JoinRoomManager.sendGameJoin, armGameJoinResponseDeadline and retryStaleAccountGameJoin plus SceneBase.retryTemporaryJoinRejection against GameRoomJoin. Restored timeout notices to login retry status and room-transition chat. Synchronous PlayerIO join errors now enter the same bounded policy as callback errors; exceptions from an already answered callback are not reclassified as transport failures.

Added the missing accepted-socket stale-session path: typed SceneBase error/message hooks consume only recognized temporary join rejections belonging to the current pending Game. They share the SDK stale-retry budget (three retries, or the explicit /ref release loop), preserve original warpJoin data, abandon the unusable socket before backoff, and retire the rejected scene after the current callback stack. Readiness setup does not resume if rejection occurred synchronously inside handleJoin. Buffered callbacks from abandoned scenes are suppressed by the existing message ownership guards. Exhaustion is terminal; unrelated errors, duplicateLogin and kicked retain their existing behavior.

Project typecheck, strict declaration check, both builds and whitespace checks passed. Tests remain paused; this source port still needs live rejection/recovery verification and full client parity is not established.

### Recovery hook ordering after rejected-world disposal

Audited index.ts installation order and GameRecovery/ServiceRecovery against InitialGameConnection. Recovery wrappers install later than the original abandoned-scene wrappers, and ServiceRecovery replaces its method without calling next. Added abandoned-world guards directly at the outer Game disconnect and Service disconnect/scheduling entries, plus Service recovery callback validity. An intentionally abandoned pending Game must remain owned by GameRoomJoin's retry rather than emitting a second reconnect notice or allowing Service callbacks to act on its retired world. Kept GameRecovery's broader owner-current predicate unchanged: its recovery observer must still own the abandoned scene until controlled teardown.

Project typecheck, public/private builds and whitespace checks passed. No automated or live tests run under the user's test pause. The source audit confirms hook order and guard coverage, not complete runtime recovery parity.

### Typed Nexar world-label rendering

Compared NexarWorldLabel.as with the port. Kept the original option bitmask, native shield values, bar geometry, 100 ms numeric-text cadence, inverse world scale, cloak alpha, and render-position/headroom anchoring. Replaced Raw, read(), dynamic class lookups and untyped hook receivers in NexarWorldLabel.ts with central game/display/settings types and GameReflection. Health maxima and render/display coordinates now use explicit native/client getters; the optional rendered-position contract retains the existing clip fallback before render hooks are available. A missing canvas during teardown hides the label. Font selection now uses the shared Russo registry (all current label sizes still resolve to DAIDRR_16).

Updated the existing fixture's native accessors and central class binding setup without executing it. Typecheck, public/private builds and whitespace checks pass. This removes dynamic boundaries from this label module; it does not establish whole-game interpolation or visual parity.

### Combat-text frame audit and typed visual clock

Compared TextParticle.update/assignment/following and TextHandler.update/add with CombatTextFrames/CombatTextLayout. The inspected path already uses full fractional render duration, owner generations, independent rise offsets/limits and the original text padding/pool sizing. Current Haxe Game passes seconds through TextManager, so the port's single seconds-to-milliseconds conversion is appropriate; no timing rewrite was made based on the old SWF's millisecond argument alone.

Removed Raw/read from NetworkTime.ts. NetworkTimeSource specifies the native clock method and optional client observer getter/property. Getter precedence, lazy native fallback, valid zero, and NaN are retained, and no path calls SceneBase.getServerTime (which mutates simulation time). Existing callers and fixtures typecheck. Public/private builds and whitespace checks pass. Tests remain paused; the source audit does not establish measured refresh-rate parity.

### Target ordering and row presentation source comparison

Inspected TargetSystem.as, TargetInfoElement.refreshNearbyTargets/compareNearbyTargets/updateNearbyTargetBars/onNearbyTargetSelected, NearbyTargetBar.as and AuraTextRoller.as against TargetSystem.ts, NearbyTargets.ts, TargetPresentation.ts, TargetInfo.ts, NearbyTargetBar.ts, TargetPicking.ts and AuraText.ts.

The compared ordering is the same: same-group last, players first, bosses/minibosses first, descending effective level, ascending distance, then unit ID. The port retains the original 250 ms snapshot cadence, boss-identity deduplication, exclusion of the active target identity, range/hostility checks, per-life snapshot validation and forced selection plus locking on row clicks. Row dimensions, empty-row behavior, HP/shield ratios, name viewport spacing and scalar-safe ellipsis match the inspected source branches. Picking reconciles replaced native clips and clears removed selections.

No ordering change made: artificially freezing rows would diverge from the original distance-based snapshot sorting. The user's reported target-bar jumping is still an open runtime concern; source agreement alone does not prove it fixed. A live comparison must distinguish legitimate snapshot reordering, target reassignment, and display-layout movement. No tests/builds run for this documentation-only audit under the test pause.

### Typed observed Nether Blob beam countdown

Compared NetherBlobBeamCountdown.as and the current native ProjectileFactory.create signature. Converted the countdown and early packet-capture hooks to GameReflection and central bindings, adding ProjectileFactory to Bindings.ts. Declared its actual five-argument Haxe signature and Weapon.reloadTime. Cached weapon definitions enter as unknown and are narrowed before reading reloadTime. Removed Raw/any/read/class lookup boundaries from the countdown; native getters now supply hull radius, clip position/alpha/visibility and display parent. Reused the combat-font registry and inferred settings type.

Preserved source fresh-shot ordering, runtime-stat precedence, cached-definition fallback, fixed bitmap viewport, fractional simulation-frame countdown, estimated-ready wording and pooled-ship cleanup. Existing fixture setup now supplies the native getters and central bindings but remains unexecuted. Project/strict declaration checks, public/private builds and whitespace checks pass. No live timing claim or deployment.

### Typed native chat shortcut and wheel boundaries

Removed Raw/read and dynamic class lookup/casts from NativeChatShortcuts and ChatAutocompleteWheel. Central Bindings now includes ChatInputText and DomOverlay. Shortcut installation receives the actual chat type and safely skips an absent native input element; channel gating, composition/reentrancy protection, style-preserving replacement and focus remain unchanged. Autocomplete wheel routing uses native visibility/alpha/parent/stage getters and typed Point/DomOverlay methods, retaining CSS-to-stage coordinate conversion and the actual stage hit-test check for overlapping windows.

Adapted existing fixtures to central bindings and native accessors; they remain unexecuted. A fixture literal-inference error found by typechecking was corrected. Final project check, public/private builds and whitespace checks pass. This does not establish live chat/input parity; tests remain paused.

### Typed live chat preferences

Converted NativeChatPreferences to GameScene, central NativeTextFormat/DomOverlay and GameReflection. Removed dynamic read/class/Raw boundaries; input size, composer position, tabs, stage dimensions and resize hooks now use the native typed accessors. Kept the captured native format/dimensions/CSS restoration, draft and selection preservation, preference subscriptions and logical-to-CSS font scaling.

Compared ChatInputText.configureIntegrationMode/integratedEditorHeight/resizeForStage with the surrounding port: the fixed 39px row is deliberate original maximum-format-size accommodation, not evidence of a font-size bug. No geometry change was made on that basis. Updated existing preference/layout fixtures with native stage getters and central bindings; tests remain unexecuted. Project check, both builds and whitespace checks pass. NativeChatLayout and NativeChatMessages still contain untyped internals and require further conversion/source comparison.

### Typed chat layout and Advanced-view close parity

Converted NativeChatLayout from Raw/read/class casts to native GameScene/display getters, central Quad and GameReflection. Saved display geometry now uses a constrained numeric-property helper; mask and WrapText maxWidth restoration are typed explicitly. Added verified native ScrollBox/TabBar/ChatAdvanced/WrapText member signatures. Inspection of current Haxe MessageLog.toggleView showed its parameter is a view-name string; corrected the previous event declaration instead of casting callers around it.

Compared original MessageLog.toggleView/setActiveView and restored its missing close behavior: toggling an already open Advanced view closes the active composer; if composer cleanup already restored Simple, the outer toggle does not reopen Advanced. A reentrancy guard handles that nested restoration, and the chosen chat view returns to child index zero, matching original setActiveView's stacking order. Existing resize/reflow, scroll-position preservation and cleanup paths remain.

Updated the existing layout fixture boundary; tests remain paused. Project and strict declaration checks, public/private builds and whitespace checks pass. Runtime Advanced/composer interaction remains to be exercised; no deployment.

### Restart continuation: typed chat row ownership and virtual rows

- Rechecked `/home/raony/Documentos/astroflux.js`: SHA-256 remains `7c49ee6caf843c3b109ebb7a979bc443a16fd92c503cb4aa25e81138a3b1f10d`.
- `ChatRows` now stores typed `ChatRow` ownership (native `WrapText` plus `ChatMessage`), checks the reflected native row class when discovering existing rows, and uses native child/text accessors. Release, reuse, and chronological visitation share that ownership record.
- `VirtualChatList` now uses the central `WrapText` binding, typed messages, native advanced/scroll types, and native measurement/stage accessors. Removed its `Raw`, untyped constructor, and generic property reads. The adjacent batch queue now carries `ChatMessage` records. Floating chat's advanced-view field is typed with its installed clear operation.
- Verified current Haxe `ChatAdvanced.addText`, `WrapText.set_width`, `ScrollBox.contentBottom`, and scroll constructor fields before recording their declarations. Regenerated game declarations.
- Compared original `StableChatListDataViewPort.as`: recursive layout invalidation remains deferred to a subsequent frame; this pass does not change that algorithm or claim complete chat parity.
- Typecheck, strict generated-declaration check, public/private builds, and whitespace check passed. Tests remain paused; the existing advanced-chat fixture received the central constructor binding but was not executed. Browser behavior remains unverified.

### Received-image native contracts and source comparison

- Compared original `core/hud/components/chat/ChatImageThumbnail.as` with the thumbnail port: same loading/error strings and dimensions, 220×140 preview bounds without upscaling, synchronous-cache geometry priming, stale-generation release, frame-delay catch-up bound, and release/dispose ordering around reentrant size callbacks. No behavioral discrepancy established in those branches; runtime parity remains unverified.
- Thumbnail now extends the centrally bound native Sprite and uses typed Image, TextField, TextFormat and native accessors. Removed its dynamic resolver dependency and Raw fields. Font lookup uses the typed Verdana registry.
- `ChatImageAsset` now owns native Texture frames and an explicit disposable bitmap contract. The remote loader has explicit bitmap dimensions/disposal and Texture upload contracts. This removes Raw from both asset and remote-loader modules; decoding/platform internals still require further typing.
- Removed the unchecked thumbnail constructor assertion in `SimpleChatImages`; its constructor assignment is now checked against the actual returned class.
- Updated fixture native bindings and explicit texture fixture boundaries without executing tests. Typecheck, public/private builds and whitespace checks pass. Tests remain paused. `NativeChatMessages` and broader chat integration still contain incomplete typing; this is not a claim of full chat parity.

### Typed GIF decoder and browser upload boundary

- `ChatGIFDecodeTask`, `ChatGIFDecoder`, and `BrowserImagePlatform` now use native bindings rather than dynamic constructors. Removed their Raw/any declarations and unused resolver plumbing through callers. Bitmap lifetime is explicitly nullable; yielded frame bitmaps are native BitmapData. Interlace passes use numeric tables.
- Verified current Haxe BitmapData clone/getPixel32/setPixel32 implementations and dimension fields before adding concrete signatures; regenerated declarations. The browser upload boundary checks native BitmapData before passing it to Texture.fromBitmapData, without a cast.
- Source comparison against original `ChatGifDecodeTask.as` covered frame/canvas limits, disposal 2 (clear frame bounds), disposal 3 (restore pre-frame canvas), frame-delay conversion, and interlace starts/steps. Those inspected branches already matched and were retained. This does not establish runtime GIF parity.
- Existing GIF fixture now binds native stand-ins centrally and narrows fixture bitmaps for pixel/disposal inspection. Tests remain paused and were not run. Typecheck, strict declaration check and public/private builds passed.

### Received-chat rendering contracts and friend-ping fallback

- `NativeChatMessages` now uses typed native GameScene, WrapText, display objects, stage points and TextField, plus concrete rich-renderer/thumbnail instance types and ChatMessage ownership. Replaced dynamic reads with native accessors and prototype hooks with GameReflection contracts. Removed its unchecked SimpleChatRenderer assertion. The registered source-renderer constructor remains resolved at the explicit factory boundary with its actual return type.
- Reviewed native `MessageLog.getQueue` and WrapText constructor/layout implementation before recording queue and measured-layout fields in generated declarations. Non-row native scroll children are excluded with reflected class checks.
- Functional source mismatch fixed: original `ChatAdvanced.pingAtSourceIndex` falls back to the renderer's visible index when no source index is available. The port previously skipped those hits. It now retains that fallback, still rejects negative visible indices, and still gives parsed artifact tokens precedence over pings.
- Compared original ProfiledChatItemRenderer image body-source anchoring, escaped sender marker and bottom alignment against the projection path; retained these calculations. This bounded review does not prove complete rendering/hit-test parity.
- Existing fixture constructor bindings and native point boundaries were updated but tests remain paused. Typecheck, strict declaration check, public/private builds and whitespace checks passed. Static scan found no Raw/any declarations, double assertions or api.cls in NativeChatMessages. Browser comparison is still outstanding.

### Friend-ping popup and hover lifetime typing

- Typed NativeChatPingPreview with native scene, display, touch, stage-point and scroll access. The existing lifecycle checks still close on visibility/hit loss, changed scroll position, message update, view invalidation or row release. Late room replies recheck the current row/ping before repainting.
- ChatFriendPingPreviewPopup now uses central native display/text/texture/filter bindings and typed Verdana lookup. Added central ShipFactory binding and a signature verified against the current Haxe color-filter factory (the four ship paint fields; nullable ColorMatrixFilter result). Removed Raw/any fields and replaced generic display assignments with native setters.
- ChatPingRoomResolver now declares the exact Multiplayer.listRooms dependency instead of Raw. Compared original ChatAdvanced lookup behavior: exact room IDs, four pending requests, waiter coalescing, recognized system-type labels and thirty-second failed-lookup cooldown are retained. Popup constants/text and ship positioning were checked against original ChatFriendPingPreviewPopup.as.
- Existing fixtures received native binding/setup and typed boundary adjustments, without running tests. Typecheck, strict generated declarations, public/private builds and whitespace checks passed. These source/compile checks do not establish live hover or full-client parity.

### Emitter frame audit after live plugin controls

- Compared the current Haxe Game.update/tickUpdate and EmitterManager with the port: native tick emitter updates are suppressed, and parallax before-hooks advance emitters using the original render delta before camera normalization. Host dispatch executes before-hooks before around-hooks, so the camera's 1/60 argument does not replace the emitter delta.
- Focused emitter frame, target ownership, delay and mirroring tests: 19/19 passed. Corrected two stale fixtures: 100 particles / 1500 ms emits two particles in 33 ms; manager removal must kill/dispose the emitter, and native targets provide get_movieClip. No runtime behavior changed in this audit.
- Still open: reported low-FPS concussion spheres and flames require effect-specific runtime comparison; aggregate emission/travel tests do not prove visual parity.

### Concussion sphere travel clarification

- User narrowed the visible problem to concussion sphere travel, not its general particle animation. Investigate projectile pose/batch updates first; do not alter particle animation or native weapon physics to compensate.
- Original Projectile.draw and port drawProjectileFrame both predict course.pos + course.speed * (0.033 * interpolation alpha). Current native updateHeading retains the original acceleration, friction and 33 ms movement arithmetic. No demonstrated physics discrepancy in these methods.
- Five focused ProjectileFrames tests passed using the host dispatcher, including sub-tick vertex updates at 60/120/180 FPS, attachment cleanup and per-life torpedo timing. These fixtures do not identify the live concussion projectile's AI/course state, so its travel report remains unresolved.
- Isolated Cage browser is alive and renders the login/profile screen, but is not logged into a gameplay session.

### Native projectile-state declaration audit

- Verified Instant, InstantSplitting and BeamLinePool against current Haxe method bodies; generated concrete game/projectile/state-machine references, numeric fields, nullable owned lines, line arrays, lifecycle methods and pool signatures. Added InstantState and InstantSplitting to central Bindings.
- projectileRenderLifetime now accepts the native Projectile type and uses zero fractional elapsed time if the scene state machine has been torn down. Remaining InstantFrames Raw boundaries are not yet migrated.
- Updated the InstantFrames fixture to initialize central bindings and provide native hook methods; 15/15 focused instant/projectile frame checks pass. Public/private builds pass. This does not resolve the live concussion sphere travel report.

### Typed instant-projectile hook implementation

- InstantFrames now consumes central InstantState/InstantSplitting/Projectile/GameScene/Color bindings, typed state ownership and native position/rotation/parent/alpha getters. Removed its Raw/read boundaries. Typed the optional client tint and orbit extension separately from native state.
- BeamOrbitLightning uses central Mesh/VertexData/IndexData bindings with an inferred constructor type, replacing dynamic any-based inheritance. Verified and declared BeamLine geometry/color methods from current Haxe source.
- Updated focused fixtures to expose native getters. All 17 instant/projectile/orbit tests pass; typecheck, regenerated definitions, public/private builds and diff whitespace checks pass. No claim of concussion sphere travel parity.

### Private selected-endpoint command

- Ported original showServerIPs labels and local-only output. SDK constructor observers associate the exact selected WebSocket transport with its owning SDK connection when sending; failed candidate construction alone cannot set the endpoint. Disconnected or pre-observer connections report unavailable. Hostnames are reported as observed; no DNS-to-IP inference is attempted.
- Observer restores constructors and send hooks on unsafe unload. Public build excludes the module under the compiler flag, enforced by the build input-contribution check. Added private command reservation/help.
- Focused transport tests cover separate Service/Game endpoints, failed candidates, IPv6, original message identity, disconnection and cleanup. Live browser connection verification is still required.

### Actual SDK fallback and current help text

- Added a fixture extracted unchanged from the served PlayerIO SDK constructors. Its native timeout-to-next-endpoint path sends a join through the successful WebSocket; endpoint observation reports that socket only and becomes unavailable after disconnect. This proves SDK sequencing locally, not a live account connection.
- Current help command examples now use the supplied/active server version rather than obsolete hardcoded Service-1409 or fixed Service-1413 examples. Historical changelog text is unchanged.
- Twelve focused SDK, local-command and help tests pass.

### Live unsafe-toggle login cleanup (Cage)

- Reproduced a blank login after disabling QoLAF: profile teardown removed the replacement UI without restoring native loginContainer visibility. LoginProfiles disposal now restores native site state only for an attached, unauthenticated login; normal removeLoginScreen teardown explicitly skips that restoration.
- Re-enabling previously only installed a future Login.init hook. The plugin now locates an existing attached Login after binding classes, schedules its presentation after fonts, and deduplicates installations. A disposal flag prevents delayed font completion from mounting UI after unload.
- Exercised native Plugins button callbacks in the isolated Cage Firefox, across repeated disable/enable cycles without navigation. Vanilla email/password form is visible while disabled; profiles and credits return on enable. Display-tree counts are zero/zero when disabled and exactly one/one when enabled. Screenshots: /tmp/qolaf-native-login.png, /tmp/qolaf-login-toggle-audit.png. User desktop session was untouched.
- Typecheck and both builds passed before live verification. Gameplay/settings unsafe toggles and full source visual parity remain separate open checks.

### Native form state and format restoration

- Preserved registration/password-recovery state when enabling or disabling in place. Auto-login starts only from the profiles screen. Exercised both native forms in Cage without submitting any account requests; each stayed in its original state and visible across toggles.
- Found native LoginInput text reverting to a fallback font after unload. Current Haxe TextField.set_format calls _format.copyFrom, so a saved get_format reference was modified in place. NativeLoginInput now snapshots placeholder/error format clones.
- Fresh-browser verification shows placeholder font DAIDRR before enable, DAIDRR_16 while enabled, and DAIDRR after disable; recovery remains visible. Screenshot /tmp/qolaf-font-restore-verified.png. Both builds and typecheck passed.

### Integrated chat unsafe-unload geometry

- NativeChatTheme restored fonts/padding/skins but left themed tab widths/positions and DOM editor placement until an unrelated layout. Cleanup now removes its paint/layout hooks first, restores original properties, then calls native tab layout and editor placement. This avoids its own after-hook repainting during restoration.
- Regression uses the actual host dispatcher and disables while integrated styling is enabled; verifies native tab dimensions/positions, restored font, and applied input padding, alongside existing hover/focus/preference checks. Focused test, typecheck and both builds pass. Live gameplay chat comparison is still outstanding.

### Native chat theme type boundary

- Removed NativeChatTheme Raw/read/resolve class lookups; uses central Quad/PressButton bindings, native getters and a typed chat-input context. Updated main/floating chat callers.
- Verified current TabBar.rebuild constructs ToggleButton instances; declared that array accurately, plus the native PressButton skin/text/selection/layout members and ToggleButton label measurement.
- Three focused chat layout/theme checks pass; typecheck, strict standalone game declarations, public/private builds and whitespace checks pass.

### Artifact tooltip native field boundary

- ArtifactTooltip now takes a typed artifact/player/time context and uses central Localize/Util/ArtifactStat bindings and native restriction/unique-stat getters. No Raw/read/api.cls remains in that helper. Declared verified artifact restriction/upgrading fields and crew artifact upgrade references.
- Cargo and active-tooltip regressions pass for localized ordering, fitness, adequacy, restrictions and upgrade labels. Typecheck, standalone declarations and public/private builds pass. Tooltip geometry/live combat comparisons remain open; this change does not establish those.

### Artifact adequacy getter mismatch fixed

- Comparing native Player declarations exposed an AS3 field assumption: ArtifactOrder read player.activeArtifacts, but the current Haxe prototype has only get_activeArtifacts(), returning artifactSetups[activeArtifactSetup]. The optional-field fallback could silently produce zero adequacy without an independently installed property alias.
- Replaced the field read with the native getter and typed ArtifactOrder entirely against Artifact/Player, removing Raw and the fitness any cast. Added verified inventory/getArtifactById/get_activeArtifacts signatures. No remaining direct .activeArtifacts reads exist in src.
- Compared family weighting and revealed grouping to original refreshArtifactAdequacy/comparators. Six focused sorting/tooltip tests pass, including a getter-only player and setup-change recomputation. Typecheck, standalone declarations and both builds pass; no corrosion/stat arithmetic changed.

### Concussion sphere travel: bitmapless projectile render pose (2026-11-12)

- Read the current game cache in isolated Cage Firefox: Concussion Sphere uses the bouncing AI and has no bitmap. Its thrust effect contains a stationary trail and a `followEmitter=true` core, both following the projectile.
- Reproduced using the actual Haxe Projectile and Starling classes, without an account or combat: at 16.5 ms with speed 400, predicted clip x was 106.6 but get_renderX returned simulation x=100 because hasRenderPosition required an image.
- RenderPosition now recognizes a live projectile's drawn placeholder clip even without a bitmap. Generic undrawn objects still fall back to simulation position; reset/detach cleanup remains intact. No acceleration, bounce logic, velocity, or collision behavior changed.
- Regression failed before the fix and passes afterward, exercising inherited native-style draw with the host hook dispatcher at 60/120/180 FPS, pooling, detachment and unsafe cleanup. 20 focused projectile/emitter tests, typecheck, public/private builds pass.
- Repeated the same actual-class probe in Cage after rebuilding: clip=106.6, effect=106.6, hasImage=false, ready=true. Screenshots: /tmp/qolaf-sphere-before.png and /tmp/qolaf-sphere-after.png. Full live combat appearance still needs confirmation; this verifies the specific tick-position fallback, not every visual effect.

### Sphere particle path and rich-editor navigation follow-up (2026-11-12)

- Extended the Cage probe through actual Haxe Emitter, Particle and CollectiveMeshBatch instances. A followEmitter core with speed=0 and the sphere core size tracks the live projectile at x=100,102.2,104.4,106.6,108.8,111 over 5.5 ms steps without a simulation tick. Each sampled frame has four mesh vertices after the normal batch frame reset. Screenshot /tmp/qolaf-sphere-particles.png. This is a controlled native-class probe, not account combat or exact appearance comparison.
- Compared RichBitmapFontTextEditor.onStageKeyDown against RichBitmapInputBinding: source Up/Down map to start/end just like Home/End. Added those keys to the browser binding, preserving Shift anchor/direction and rich markup. Chat autocomplete/history continue consuming applicable keys at window capture before the editor listener.
- 29 focused input/native-composer/autocomplete tests pass; typecheck passes. The autocomplete fixture lacked native get_visible (two failures unrelated to navigation); added the getter and reran the same affected set. No player messages sent.

### Integrated composer Escape priority (2026-11-12)

- Compared original ChatInputText.onInputKeyDown: Escape closes chat before dispatching to friend/emoji/command suggestions. The port previously let a visible suggestion swallow Escape and only dismiss itself.
- Focused composer Escape now calls closeChat after dismissing all completion lists. Native main close clears the draft, hides chat, and restores focus; floating close retains its separate blur behavior. No sendMessage call is introduced.
- Keyboard completion now also checks the editor composition session, covering browsers where KeyboardEvent.isComposing is false during active composition.
- NativeFriendAutocomplete regression verifies close with and without active suggestions and IME Escape ownership. 22 affected tests and typecheck pass. This is source/hook verification; live account chat interaction remains open.

### Shared chat cooldown typing and held-key audit (2026-11-12)

- Current Haxe InputManager.keyDown only marks a new press when the key is not already down; keyUp releases it. No speculative repeat suppression was added to the native main-chat path. This is source inspection, not live submission verification.
- Compared source claimFloatingChatSendSlot: global/local timers, developer/moderator exemptions and private/group handling match. Migrated FloatingChatSendSlot from Raw/read to typed native getter get_me and typed composer clocks, with explicit structural context for isolated checks.
- Added native ChatInputText.g and numeric cooldown field definitions to Signatures.json and regenerated Game.d.ts. No Raw/any remains in this module or its focused test.
- Three focused cooldown/cleanup tests pass, including global/local shared limits, privilege exemptions and restoring the preexisting method. Typecheck, strict declaration check and public/private builds pass.

### Startup service callback races (2026-11-12)

- Compared StartupServiceJoin with JoinRoomManager.attemptStartupServiceJoin, handleJoinServiceRoom and retryStartupStaleAccount. Added direct coverage in tests/StartupServiceJoin.test.ts; this module previously had no direct test in the current tree.
- Verified cancelled SDK success disconnects its socket; duplicate success cannot replace or disconnect the accepted socket; duplicate joined messages publish once; service ping starts once. Retiring the manager blocks a late handshake.
- Temporary locks retry after 2000 ms, at most three retries after the first attempt. Duplicate-login rejection is terminal. Cancellation retires timers, while cleanup after publication leaves the game-owned connection connected and detaches its startup error handler. Current Haxe session/client_version fields are asserted.
- Nine focused startup/authentication-cancel/status tests pass, plus typecheck and whitespace check. No runtime edit was needed for these cases; no live authentication was sent. Parallel asset/service/room readiness still needs integrated runtime comparison.

### Native artifact adapter typing (2026-11-12)

- Replaced NativeArtifacts Raw/any/reflected class lookups with central ArtifactBox, ArtifactCargoBox and ArtifactOverview bindings and GameReflection hooks. Added native declarations for artifacts/player/game/tooltip fields, active/cargo arrays, ScrollBox container and sorting methods; verified constructor targets in current Haxe JS.
- Popup positioning and display ordering now call native setters/getters directly. Expanded-view extensions and sorting constructor contract are explicit types. Compared chooseSorting/onSort against original ArtifactOverview: centering, controls on top, reveal ordering and inventory scroll reset remain intact.
- Six focused sorting/tooltip checks pass, including dialog toggle/disposal and expanded placement; typecheck, strict generated declarations and both builds pass. ArtifactSorting factory and other artifact modules still contain untyped code; this entry does not claim the entire workflow is typed or visually signed off.

### Sorting dialog and artifact menu exit audit (2026-11-12)

- ArtifactSorting now uses central typed display bindings and native getters/setters, with explicit adapter contracts for Button and ScrollContainer. Compared source geometry, labels, stat grouping, tier exclusions, hover and close behavior against original ArtifactSorting.as. The loaded Cage cache probe contains 52 ArtifactTypes records and zero invalid type/name/bitmap records (/tmp/qolaf-artifact-types-audit.png).
- Found and fixed a source mismatch in ArtifactMenu exit: original ArtifactState2.exit disposes artifactBox tooltips; the port only cleared them on layout rebuild. Closing the overview now clears those tooltips before destroying the view, including the native close path used during unsafe disable.
- Added an exit regression to ArtifactMenu.test.ts. All eight focused menu/sorting/tooltip checks, typecheck, both builds and whitespace checks pass. Live logged-in inventory appearance and interaction comparison remain unverified.

### Artifact sharing installed independently of private inspector (2026-11-12)

- Found an integration mismatch: public ArtifactContextPopup offers Share on Chat, but NativeArtifactDraft was installed only inside compile-gated NativePlayerInspect. Public sessions therefore had no insertArtifactLink handler. Moved draft installation to GameSession after autocomplete setup, independent of inspector availability. The inspector remains private.
- Compared original ChatInputText.insertArtifactLink: it dismisses autocomplete after attempted insertion, including length-limit failure. Passed the session autocomplete close callback into the draft handler and call it after projecting the edited text, before returning focus. No message is submitted.
- Five initial affected sharing/context/autocomplete tests pass, plus the added overflow regression (four draft tests pass). Typecheck and both builds pass. Inspected both emitted modules: draft handler and session call exist in both; inspector exists only in private output, with the existing public private-source exclusion gate passing. Live account sharing remains unverified.

### Queued artifact share cleanup (2026-11-12)

- Audited the menu-close-to-draft microtask against unsafe unload. Previously it reread insertArtifactLink after teardown, potentially calling a removed handler or a replacement installation. Capture the composer, player and handler; require the same active game and installation before drafting. Plugin cleanup retires pending shares.
- Expanded the existing context-menu integration test with room replacement, handler replacement and unsafe-disable cases. Five affected draft/context tests, typecheck, both builds and whitespace checks pass. No live message submitted.

### Typed artifact context menu and pointer lifecycle (2026-11-12)

- Compared ArtifactShareContextPopup.as pointer handling and ported ArtifactContextPopup to central Sprite/Quad/TextField/TextFormat/Point bindings, typed Artifact and TouchEvent, and native display/touch accessors. Removed its resolver and all explicit Raw/any. Stage is checked before outside-touch lookup.
- Updated focused fixtures to native touch getters and public display-tree label inspection. Added coverage for inside versus outside presses, repeated-show listener deduplication, and silent removed-from-stage cleanup. Existing source dimensions, disabled share row, favorite toggle and cancelled/mismatched row press checks pass.
- Three affected popup/favorite integration tests, typecheck, public/private builds and whitespace checks pass. This is source/event verification, not a live visual signoff.

### Recycle selection and favorite storage audit (2026-11-12)

- Compared source ArtifactOverview selectAllForRecycle/onRecycle/purifyArts/onPurifyRecycle and ArtifactCargoBox favorite guards. Checked 40-item cap, setup/upgraded/upgrading/unique exclusions for Select all, unrevealed/favorite/unique/Recycle Generator exclusions for Purify, saved threshold semantics, pending guards and cargo-full handling. No mismatch found in these inspected filter paths.
- Removed Raw from ArtifactFavorites; browser storage crosses an unknown boundary with explicit record validation, while preserving account-prefixed keys, strict true favorites and in-memory fallback when persistence fails.
- Eight focused favorites/Purify/context integration tests, typecheck, both builds and whitespace checks pass. No live recycle request sent; server-side and live inventory interaction parity remain unverified.

### Missile and boomerang thrust anchor regression (2026-11-12)

- Compared original core/engine/ProjectileThrustAnchor.as with current ProjectileThrustAnchor.ts. Rendered tail offset and zero authored rotation match; original lifecycle validity deliberately prevents old effects following a reused projectile.
- Added direct hook coverage for both Missile and Boomerang. Tail coordinates change with render pose without AI execution; death, missing movie clip and reset generation invalidate old anchors; executing the old state cannot revive them; a new state captures the new life.
- All 16 focused projectile/emitter tests and typecheck pass. No runtime edit or rebuild needed for this test-only addition. Live weapon effect appearance remains open.

### Moving-text frame order against current Haxe bundle (2026-11-12)

- Inspected current native Game.update, GameStateMachine.update, PlayState.execute and Game.draw. PlayState draws the world on every execute after the fixed-step loop, including frames without a tick; Game.update calls TextManager.update afterward. Current CombatTextFrames therefore samples the current rendered pose, not necessarily the previous frame.
- Native TextHandler.update multiplies passed seconds by 33*60 and caps at 0.25 seconds; the installed replacement intentionally uses seconds*1000, matching original Game's millisecond handoff and full elapsed lifetime. Reviewed original TextParticle text setter and TextManager merged hits: preserving layout bounds on merged text is source behavior, not a missing measurement call. New Haxe zoom compensation remains retained.
- All 11 combat-frame/layout checks pass, including 30/60/120/180 FPS elapsed travel, tick-coordinate overwrite, pooled ownership, sustained-hit rise limits and complete-pool cleanup. No runtime edit needed from this source audit. This does not replace logged-in high-refresh visual comparison.

### Typed artifact draft handler ownership (2026-11-12)

- NativeArtifactDraft now uses GameScene, a typed ChatInputText extension and central MessageLog binding. Replaced reflected leaving-state read with native get_isLeaving. No Raw or explicit any remains in the handler or its focused test; partial fixtures use explicit unknown-to-native boundaries.
- Queued insertion now requires the original composer object as well as the active scene. Cleanup restores its saved descriptor only while its own handler is installed, preserving a newer replacement handler. Regression covers composer replacement and unload with a replacement handler.
- Six affected draft/favorite tests, typecheck, both builds and whitespace checks pass. Source spacing, destination selection, unsent-draft behavior and overflow handling remain covered.

### Parallel loading status layout and unsafe cleanup (2026-11-12)

- Compared original LoadingBar.as with LoginLoadingStatus: texture/network/detail sizes, centering, six/four pixel line gaps, texture-complete collapse and detail visibility agree. Added direct layout checks; late updates after disposal are inert.
- Fixed cleanup restoring status and percent visibility to unconditional true. Capture each native label's visibility before hiding it and restore that state on unsafe unload. Regression covers mixed native visibility and repeat disposal.
- Ten affected login status/Control/attempt/startup service tests, typecheck, both builds and whitespace checks pass. No live authentication or account mutation performed; parallel pipeline timing remains to be compared in a logged-in session.

### Inventory wiring batch and functional world zoom (2026-11-12)

- Completed typed ArtifactLayout/summary, ArtifactView shared client state, ArtifactRecycleProtection, NativeArtifactFavorites and ArtifactRecycleLayout. Added native frame/selection/control declarations after checking Haxe constructors; inventory totals use native level/limit/unique getters. Context shares verify artifact identity; recycle events validate cargo-box targets like the source cast. All 28 affected artifact tests and strict declarations/typecheck/builds pass.
- Found a functional gap by reconciling PlayState additions: cameraZoom existed in settings but no wheel listener or persistence consumer was wired. Added WorldZoom gesture controller and NativeWorldZoom integration in GameSession: source 1.08 bounded wheel steps, 0.98 keyboard steps, both-key reset, 0.25–2 clamp, saved zoom restore, shared keyboard/wheel gesture and 250 ms deferred flush. Exit/unsafe cleanup flushes and removes listeners.
- Native integration checks active roaming scene, connections, initial reveal, recovery/fade, hotkeys, player/ship state, DOM focus, stage coordinates, native hit target and radar region before consuming wheel input. Uses bubble phase so UI handlers take priority. Existing vanilla gameplay/boost remains unchanged.
- Eight affected zoom/control tests, typecheck and public/private builds pass. First native zoom fixture failed because global DOM teardown preceded plugin cleanup; fixed fixture cleanup order and reran successfully. Live logged-in zoom is not yet verified.

### Saved main chat channel persistence (2026-11-12)

Functional gap confirmed against original ChatInputText.restoreSavedChatTab and
rememberChatTab: ClientSettings already stored advancedChatTab, but no main
composer consumer existed. NativeChatTab now restores the selected channel and
private recipient after the QoLAF channel/editor installation. Restoration does
not focus the hidden native input or send a message. Tab events, updateTab and
private-recipient changes persist through the existing account-scoped settings.
Legacy/floating composers and stale scenes cannot overwrite the saved channel.
Unsafe enabling preserves the destination of an active draft; cleanup removes
listeners and its owned callback. Native savedPrivateTarget is now typed as
string | null in the reviewed generator signatures.

Validation: TypeScript check and 16 focused chat draft/channel, zoom and control
regressions pass. Logged-in runtime channel persistence remains to be verified.
Acceptance remains functional behavior, not pixel-exact layout.

### Functional chat draft and row-lifecycle batch (2026-11-12)

- Original ChatInputText.refreshArtifactChannelTabs/onTabChange select an allowed
  channel for artifact drafts and reject forbidden tab changes. Added main-chat
  draft listeners before rich input restrictions: pasted tokens select QoLAF;
  changing an artifact draft to Global/Local/Group restores its allowed channel.
  Hidden drafts do not take keyboard focus. Send-time guards remain outside the
  Global sanitizer. Cleanup removes listeners; stale scenes cannot edit drafts.
- QoLAF tab insertion now precedes an existing private tab during unsafe enable.
  Native sendPrivate only updates the last tab; appending QoLAF after it caused
  duplicate private tabs on subsequent messages.
- VirtualChatList now retires legacy player options before appending/recycling
  rows, preventing a popup from retaining an evicted message target.
- Expanded chat run initially found ten failures. Verified current Haxe has
  MessageLog.getQueue, ScrollBox.contentBottom and inherited Mesh.set_color.
  Updated test fixtures to supply these native contracts and real around hooks,
  dispatch view enterFrame events, and pass message objects to native addText.
  Virtual row checks now assert retained content/scroll position and materialized
  offscreen messages rather than requiring pooled rows to be destroyed.
- All 156 chat/draft tests pass after those corrections; public/private builds
  and whitespace checks pass. Cage screenshot confirms the login profiles page
  remains rendered, but this is not logged-in gameplay/chat validation.

### Unsafe disable restores visible native chat (2026-11-12)

Found VirtualChatList.dispose clearing the visible rows without recreating native
Advanced chat after unsafe disable. NativeChatRestore now captures scroll intent
before teardown, waits until session hooks are removed, and rebuilds from the
current filtered queue using native addText. It retains history-reading position
or follows the bottom, without native load's delayed scroll callback. Ownership
checks prevent an immediate re-enable from being overwritten; departed/replaced
or hidden views are not rebuilt. This is wired into NativeAdvancedChat cleanup.

Validation: 160 chat-related tests passed; strengthened restoration test separately
checks bottom-following when restored content has a different maximum. Eight
focused cleanup/batching tests and TypeScript check pass. Public/private builds
and whitespace checks pass. Actual logged-in unsafe-disable interaction remains
unverified; synthetic tests exercise the real host hook cleanup dispatcher.

### Gameplay source audit and typed respawn adapter (2026-11-12)

- Inspected original PlayState throttle transitions against NativeThrottle: the
  course-time gate, single transition per tick, boost-end boundary, cruise
  cancellation, and camera factors agree. The 94 existing movement/projectile/
  emitter/control/target tests pass; this does not prove live high-refresh parity.
- Replaced Respawn's Raw/reflection lookups with central RoamingState and
  KilledPlayerState bindings and reviewed native declarations. The generator
  confirmed isSystemTypeSurvival belongs to SceneBase, not Game; declared it on
  that owning class. Automatic preference comes from the session DeviceSettings.
- Manual respawn now delegates to vanilla updateInput, preserving upstream
  behavior instead of duplicating that branch. Automatic mode uses native
  respawnReady, then sends the existing respawn command. Source prompt texts,
  countdown threshold, survival exit, editor and remote-player exclusions remain.
- Added focused tests for readiness, preference switching, live-player input,
  prompts, other-scene isolation and hook cleanup. Typecheck and both builds
  pass; logged-in death/respawn remains unverified.

### Full-suite reconciliation (2026-11-12)

Full npm test initially: 812 tests, 797 passed, 15 failed. After reconciling
fixtures with current typed bindings and inspected source: 809 passed, 3 failed.
No production behavior was weakened or test skipped to obtain this result.

Updated fixtures for central class binding, native connection getters and Haxe
Game identity, native popup visibility getters, NativeUI.place, and the respawn
DeviceSettings dependency/manual native branch. IPC reserved-room recovery now
checks its failure callback, matching the real recovery implementation's ownership.
Background test now installs the actual global ParallaxCleanup hook as index.ts
does; without it the test bypassed the existing nebula ownership fix. Slider
expectations now match original AstroTheme.settingsSliderThumb: a single default
skin reused for press/hover/disabled states, not invented state colors/disposal.

Outstanding failures (not waived):
- Integration.test.ts: NativeGame registry lacks required ServiceRoomSelector;
  classesReady fails before the session assertions, followed by unbound world
  label classes. The full compiled-client fixture needs reconciliation.
- Interpolation.test.ts cached listener test: its minimal class registry lacks
  GameObject.reset required by the render-position lifecycle adapter. Camera
  assertions are not reached; this is not evidence of a live camera failure.
- NativeRadio.test.ts: optional radio fixture fails at an unbound LoginButton
  parent during native environment creation. Radio remains intentionally excluded
  from the browser product at the user's request, but its test remains failing.

TypeScript check and git diff --check pass. npm test rebuilt the public bundle.
This full-suite result does not replace logged-in runtime parity verification.

### Current-build Cage login lifecycle verification (2026-11-12)

Reloaded the existing isolated Cage Firefox once with explicitly released Ctrl+R.
The current public 1.1.23 build renders login art, profiles, credits and Plugins.
Used real native Touch/TouchEvent objects dispatched to displayed controls to
exercise Profiles -> Add account -> Simple credentials -> Back -> Profiles.
No credentials entered, account created, authentication attempted or messages sent.

Opened Plugins, dispatched Disable (unsafe), and observed the vanilla email/
password/Login/Register screen. Opened Plugins again and dispatched Enable
(unsafe); QoLAF profiles and credits returned without a page reload. Repeated
Add account -> Back after re-enable. Display-tree audit reports exactly one
qolaf.loginProfiles and one qolaf.pluginsButton, currentState=profiles.
Preview telemetry reported runtimeErrors=0, connected=false. The console retains
an initial browser warning/error badge; no new plugin exception appeared in these
steps. This is native event dispatch/runtime evidence, not physical pointer hit
accuracy or authenticated gameplay parity.

Screenshots: /tmp/qolaf-reload-audit.png, /tmp/qolaf-providers-audit.png,
/tmp/qolaf-simple-audit.png, /tmp/qolaf-plugin-panel-audit.png,
/tmp/qolaf-disabled-audit.png, /tmp/qolaf-reenabled-audit.png,
/tmp/qolaf-login-lifecycle-audit.png. Cage remains on the enabled profiles screen.

### Typed inactivity and Emperor coordination adapters (2026-11-12)

Removed Raw/read/dynamic class lookup from runtime/Inactivity and
ipc/NativeEmperorCoordination. Both use central bindings and GameReflection;
reviewed declarations cover Game.disconnectIfInactive/playerPerformedAction and
ShipManager.killed(message,start). AutomationGame now includes the existing
transientDontKickActive capability. Missing client settings no longer throw from
the inactivity setter; it reports false without applying or persisting a change.

Emperor fallback still sends ordinary selected-channel shorthand when IPC is
unavailable and schedules the original delayed notice. Added checks for single
notice delivery, scene departure, unsafe cleanup, floating/hidden composers and
unrelated messages. Sixteen affected inactivity/IPC/QoLAF/channel tests pass,
with regenerated declarations, typecheck, public/private builds and diff checks.
The previously recorded three full-suite fixture failures remain outstanding;
this targeted run does not supersede that full-suite result.

### Camera frame integration test restored (2026-11-12)

Moved the existing onGame camera/parallax hook block unchanged from Interpolation
into CameraFrames; Interpolation still invokes it. The focused cached-listener
test installs that same module and no longer requires unrelated render-position,
ship, projectile or body fixtures before reaching its camera assertions. This
narrows the test setup to its stated camera responsibility; it does not substitute
for the separate full compiled-client initialization test.

Nine camera/interpolation/view checks pass: cached bound listener movement,
emitter-before-camera ordering, true emitter delta, normalized parallax delta,
shake suppression, cross-refresh easing and culling. Typecheck, public/private
builds and whitespace checks pass. Full suite now 815 tests: 813 passed, 2 failed
(compiled Integration fixture and excluded NativeRadio fixture). No live camera
claim is made from these synthetic tests; login/runtime verification is separate.

### Failed initialization no longer cascades into partial session attachment (2026-11-12)

Investigating compiled Integration confirmed its registry predates many central
bindings, so adding only ServiceRoomSelector would not make it representative.
Source command-name reconciliation also confirmed /commands and /reloadtexts are
old vanilla features rather than absent QoLAF additions; /commands remains native
in current Haxe, while /reloadtexts was removed upstream. No old vanilla feature
was reintroduced based solely on a name scan.

The failing fixture exposed a real secondary failure: onGame still ran after the
classesReady setup threw. index.ts now marks initialization successful only after
all synchronous global installers complete, and refuses session attachment until
then. The original failure remains reported by the host; this does not claim to
roll back any global hooks installed before a later installer fails.

Added a separate compiled failure-path regression with an intentionally missing
ServiceRoomSelector. It asserts one setup error, unchanged HUD children/font,
and no targetSystem attachment. The test passes, as do TypeScript check, public/
private builds and whitespace checks. Original successful Integration test stays
unmodified and unresolved, as does excluded NativeRadio; this regression is not
a replacement for successful full initialization or logged-in runtime coverage.

### Registration and login functional audit (2026-11-12)

Compared RegistrationRequest with the original RegisterDialog2.diff. The port
retains all-field validation (including confirmation mismatch), in-flight
submission/Cancel locking, success handoff, and recovery after registration
failure while preserving newer native email validation. Added four focused
regressions using the actual host hook dispatcher: no SDK request for mismatched
confirmation; keyboard/pointer duplicate suppression and retry; successful profile
handoff with controls locked through login; unsafe cleanup restoring native
callbacks and ignoring late SDK results. No real account creation was performed.

All 23 registration/login/control/loading/service startup tests pass, as does
TypeScript checking. Preview status remains connected=false with the login profile
panel present; authenticated comparison is still outstanding. This audit found
no new registration behavior mismatch, so no runtime behavior was changed.

### Artifact draft channel controls restored (2026-11-12)

Original ChatInputText.isComposerTabEnabled/refreshArtifactChannelTabs disables
forbidden tabs while an artifact token is present. The previous port only repaired
the selected channel after a click, leaving forbidden controls active. The native
adapter now disables those ToggleButtons through the current Haxe PressButton
set_isEnabled setter (which updates touchability and skin), preserving each
button's previous enabled state. Clearing the draft, replacing tabs, and unsafe
cleanup restore the owned state. Rebuilt tabs inherit the active restriction.
Programmatic channel selection remains guarded by the existing fallback.

Reviewed the actual upstream TabBar.rebuild and PressButton setters and added
boolean declarations for the enabled getter/setter. Extended the regression to
cover allowed Private/Clan/QoLAF tabs, forbidden Global/Local, an independently
disabled tab, draft clearing, native rebuild and unsafe cleanup. All 155 chat
tests pass; typecheck and public/private builds pass. No authenticated live
artifact-sharing interaction has been claimed from these fixture tests.

### Floating artifact drafts and programmatic text changes (2026-11-12)

Compared ChatInputText.selectArtifactChannel: the original floating composer falls
back to Clan, keeping the selected Service scope, while integrated chat uses
QoLAF. FloatingChatWindow now installs the shared draft channel adapter on its
own native composer, before the rich editor restriction listener, using Clan as
the fallback and the primary Game only for lifetime validation. No IPC destination
is introduced and the main composer's selected channel is untouched.

The adapter now observes native set_text as well as change events: current Haxe
programmatic assignments do not emit change, so history restoration and clearing
a successful send previously left restrictions stale. Expanded the regression
for both fallbacks, independent primary/floating composers, assignment without an
input event, tab rebuild and cleanup. All 156 chat tests, typecheck, public/private
builds and diff checks pass. Authenticated live sending remains unverified.

### Native Haxe artifact-control probe and typed floating composer (2026-11-12)

Verified the draft adapter in the running isolated Cage Firefox using the actual
current Haxe TabBar and TextEntry constructors and the real host hook dispatcher.
For both QoLAF and Clan fallbacks, Local/Global enabled and touchable states became
false, allowed channel states stayed true, native rebuild retained the restriction,
and native set_text clearing plus hook cleanup restored all original states.
The separate primary chatMode remained Local. Screenshot evidence:
/tmp/qolaf-artifact-native-audit.png. No login, real chat message, or account
operation occurred. This is native-control evidence, not a full logged-in window
or physical pointer interaction test. Temporary served probe and source removed.

FloatingChatComposer now uses central ChatInputText/Quad bindings, typed native
TextEntry getters, an explicit floating extension interface, and nullable private
targets. Removed its Raw/any/read boundaries without replacing native instances.
Typecheck, public/private builds and diff checks pass. Other remaining untyped
modules and the previously recorded integration fixture failures are not closed.

### Frame-rate lifetime fixed across login and gameplay (2026-11-12)

The full suite before this frame-rate change reported 821 tests: 819 passed,
2 failed (the already recorded compiled Integration registry and optional radio
fixture). Settings-key reference reconciliation found mapped HUD keys and
ported aim-assist consumers rather than a missing implementation by name alone.

A concrete lifecycle mismatch was found: NativeSettings applied the saved frame
limit only inside a game session and restored it on room cleanup. Original
RymdenRunt applies the limit at startup and Settings applies the saved value across
login and gameplay. Added global rendering/FrameRate, installed at classesReady,
with delayed Starling.start/Login.init application, preference updates and game
entry verification. Room cleanup no longer owns/restores the cap. Unsafe plugin
unload restores the renderer's captured native frame rate and skip flag.

DisplayScale also now uses central typed StarlingStage/Starling/Login bindings
and reviewed native stage dimensions instead of dynamic read access. Four focused
DPI/frame-limit tests pass, covering absent/already-created renderers, saved caps,
unlimited mapping, transitions, unchanged-limit writes and unload restoration.
Typecheck, public/private builds and diff checks pass.

Actual isolated Firefox login before reload reported native frameRate=60. After
one explicitly released Ctrl+R, the latest build rendered the profiles screen
and reported frameRate=1000 (the source unlimited sentinel) and
skipUnchangedFrames=false. Screenshots /tmp/qolaf-fps-before.png and
/tmp/qolaf-fps-after.png. This measures the configured limiter, not achieved
1000 FPS; browser/display refresh still governs rendering. No login attempted.

### Command registration contracts and focus audit (2026-11-12)

Current Haxe RymdenRunt.focused/notFocused, like the original source, only update
the focus flag; neither overwrites frameRate. No extra focus hook was added.

Added shared ChatCommandDescriptor/ChatCommandArgumentDescriptor types for both
ChatCommandRegistry and EventBus. Callers now receive explicit description,
summary, usage, required/mandatory/optional argument and default-value contracts,
with the already typed invocation callbacks. Runtime validation remains for
JavaScript automation modules. Typecheck, both builds, diff checks and all 26
command/automation tests pass. This does not close remaining Raw/any elsewhere.

### HTML5 finite FPS caps and unsafe-cycle clarification (2026-11-12)

Live unsafe-disable restored native login and a 60 getter value. Investigation
of an apparent re-enable failure found that Lime HTML5Window.setFrameRate maps
all values >=60 to framePeriod=-1, and getFrameRate reports 60 for that unrestricted
RAF mode. Therefore a 60 getter alone is NOT evidence of a 60 FPS cap. Earlier
1000-sentinel observations describe configuration, not achieved refresh rate.

The same behavior did reveal a real gap: finite high-refresh settings such as
120/144 were being ignored. FrameRate now sets the existing typed HTML5Application
framePeriod to 1000/limit for finite settings and -1 for unlimited, after native
setter dispatch. Unload restores the exact captured scheduler period as well as
the native reported rate and Starling skip flag. Browser RAF remains the rendering
clock; this does not introduce extra timers or change simulation ticks.

Six focused frame-rate/DPI tests pass including the real Lime >=60 normalization,
startup and preexisting renderer paths, room callbacks, preference changes and
cleanup. Typecheck, both builds and diff checks pass. Live isolated Firefox with
a temporary saved cap of144 reported frameRate=144 and period=6.944444444444445.
Screenshot /tmp/qolaf-frame-144.png. The temporary storage value was restored to
its prior value and the plugin re-enabled using visible native manager buttons;
no account/network gameplay action was performed. Debug setter wrapper restored.

### Landed screen frame-rate resets removed (2026-11-12)

Original LandedState.diff removes native frameRate=30 on enter and60 on exit;
LandedHangar.diff and LandedLore.diff remove their60 writes too. Current Haxe
still performs all four. Added global LandedFrameRate adapter to suppress only
30/60 setter calls while those synchronous native methods execute. Existing
state setup, state-change completion, deliberate /lowerfps and idle limiting
remain in place. One guarded setter per native stage avoids accumulating hooks
on repeated menu visits; nested entries use depth with finally release.

New regression covers inherited/nested hangar entry, landed exit completion,
throwing lore load, deliberate3/idle1 limits, and native restoration on unload.
Seven focused frame-rate/DPI checks pass; typecheck, public/private builds and
diff checks pass. Logged-in station/hangar/lore navigation remains unverified.

### Remaining ScreenTextField lifecycle gap identified (2026-11-12)

Full suite after the frame-rate changes: 826 tests,824 pass,2 fail. Failures
remain the compiled Integration missing ServiceRoomSelector registry and optional
NativeRadio central LoginButton binding fixture. No new failing test appeared.
Browser-control inventory currently reports no enabled apps/browsers; isolated
Cage remains the available test session and has not authenticated.

Source ScreenTextField.as adds cancelPlayback, a playback generation, owned timers
and delayed calls, timing snapshots, late sound-cache callback rejection, and
stop-on-dispose. There is no corresponding ScreenTextField adapter in src.
LoadingCover currently calls play() after show and guards cover/highscore callbacks,
but that does not port the text object's own timer lifecycle. This is an unported
functional gap for loading/lore playback reuse, not merely pixel differences.
LandedLore also moves pageReadTime assignment before start, which must be preserved
when adding source timing snapshots. Next work should port the shared text-player
lifecycle and verify restart/stop/dispose with pending timers and sound callbacks.

### 2026-11-12: ScreenTextField owned playback port

Compared original `core/hud/components/ScreenTextField.as` with current Haxe.
Implemented typed `ui/ScreenTextPlayback.ts` and native `ui/ScreenText.ts` hooks:
owned timers and delayed fades, generation guards for late sound callbacks,
per-start timing snapshots, restart resets, disposal cancellation, terminal
stop()+doFadeOut(), and guarded event reentrancy. LandedLore's 180000ms page
read time is applied before start snapshots it, matching the original diff.
Bindings and reviewed signatures were extended; no new any/Raw access.
Six lifecycle/native-host-dispatcher tests pass; typecheck and Public/Private
builds pass. Full suite retains the prior Integration fixture missing
ServiceRoomSelector and excluded NativeRadio fixture unbound LoginButton failures.
Live local rendering still needs verification before deploying this new build.
The VPS currently serves the preceding verified Public build, not this change.

### 2026-11-12: VPS launch verification

raony.dev/astroflux now uses Caddy's fixed astroflux.net asset reverse proxy;
GitHub Pages retains snapshot mode. Deployed public plugin v1.1.23 and checked
login rendering in isolated Cage Firefox. Official proxied bundle SHA256
35c056ba87b1cc5f6d97f8a3066b103eb261ef42ca955efb0f7d9a94ee318427 matched
astroflux.net directly (upstream build 564). Proxy rejects non-asset paths and
POST requests; strips cookies and authorization. Screenshot:
/tmp/raony-web-first.png. No authenticated gameplay comparison claimed.

ScreenText follow-up: full suite 832 tests, 830 passing, same two fixture failures.
Native Haxe ScreenTextField probe completed two pages and emitted paragraphFinished,
beforeFadeOut/pageFinished for each page, then animationFinished, with empty text
and alpha zero. Probe muted its own sound dependency because SoundLocator has no
service at unauthenticated login; this does not verify game audio or landed lore
rendering. Screenshot /tmp/qolaf-screen-native-muted.png. Controller ownership uses
WeakMap/WeakRef so lore fields removed without dispose are not retained by the
plugin cleanup registry. Focused six tests and both builds passed again afterward.

### 2026-11-12: Mission viewed acknowledgement

Original MissionsList.trySetMissionsViewed changes rpc("setMissionsViewed", null)
to send("setMissionsViewed"). Current Haxe still uses the null-callback RPC.
Added typed MissionRead adapter scoped to the native method and native scene;
retains viewed flags and hint handling while sending without registering an RPC.
Unrelated calls retain their callback semantics. Host dispatcher test covers
single send, repeated view, native hint updates, scope cleanup on throw, and
unsafe unload restoration. Typecheck and Public/Private builds pass. No live
mission screen action or gameplay-network request was performed in this audit.

### 2026-11-12: Completed mission description formatting

Original MissionView.addDescription passes terminal completeDescription through
MissionView.fixText; current Haxe writes it directly. Added typed scoped text-setter
adapter so native localization/player/amount/highlight substitution happens before
native layout measurements. Chained-mission guidance and unrelated text remain native.
Host dispatcher tests cover formatted measurement, chained missions, unfinished
missions, exception cleanup and unsafe unload. Both mission tests, typecheck and
Public/Private builds pass. Runtime mission screens still require a signed-in test.

2026-11-12 VPS follow-up: screen-text and both mission adapters deployed in Public
1.1.23, SHA256 2eda3094bc35ff2c8778dab7faadc8680a8f4c58cd3c55e4a8a2240141c31390.
Prior module saved outside the web root at /srv/raony/backup/qolaf-client.previous.js.
Remote login rendered after deployment against live upstream build 564;
/tmp/qolaf-deployed-batch.png. Local pre-deploy status reported canvas/bridge/login
and Plugins present, zero captured runtime errors, connected=false. No signed-in
mission/gameplay parity claim. The earlier local-only status is superseded for
these three adapters.

### Friend refresh ownership across unsafe reload (2026-11-12)

- Compared original FriendManager updateOnlineFriends/onOnlineFriends/onServiceReconnected to ServiceViews and the current local Haxe bundle. Callback deduplication, coalesced requests, disconnected queuing, synchronous failure cleanup and detached native callback draining are covered. GroupManager findInvite/getGroupById differences inspected were AS3 local typing/formatting, not additional behavior to replace in vanilla.
- Fixed module-level pending friend request ownership surviving unsafe disable/re-enable. A response received while hooks are disabled previously left the manager permanently pending on reactivation. Unload now releases that activation's pending set without retaining manager instances.
- Added actual host-dispatcher regression covering shared consumers, disconnect/retry, send failure and response while disabled followed by reactivation. Fifteen related friend/service/startup checks pass; TypeScript check and Public build pass.
- This is local build verification; authenticated live gameplay and broad parity remain unverified. Not yet deployed in this batch.

### Login preparation and enemy interpolation (2026-11-12)

- Login.init was visible while ensureFonts resolved. The login display is now hidden until profile/identity controls are attached, and restored on failure or unsafe unload.
- Current vanilla EnemyShip convergence changes course position immediately in setConvergeTarget, between simulation ticks. Render interpolation previously consumed that mutable endpoint each frame. Enemy rendering now holds completed simulation endpoints until the next tick, leaving native convergence/gameplay calculations intact. Reset/set_course clears presentation history.
- Added a packet-between-frames regression verifying stable position/angle, next-step continuity and unchanged simulation position. Six interpolation/service regressions pass, TypeScript check and Public build pass. Authenticating for a live enemy-motion comparison remains outstanding; this is not evidence that every observed jerk is resolved.
- Host startup now uses game background artwork/Russo font and dark framed styling. Its audio policy disables Howler auto-suspend and attempts resuming an already-unlocked suspended context on focus/visibility/state changes without modifying volumes. Two audio regressions pass; browser/OS enforced suspension cannot be overridden by this policy.

### Render attachment follow-up and font binding cleanup (2026-11-12)

- Inspected RenderPosition, WorldLabels, EngineRenderPose, ProjectileAttachments and CombatTextFrames after the enemy endpoint change. AF/pet labels read the final clip after EnemyShip.draw; engine mounts and attached effects read render getters; combat text follows the displayed owner. No additional simulation-coordinate replacement was needed in those paths.
- Ran 31 focused interpolation/emitter/combat-text checks, all passing. This validates tested coordinate/lifetime ownership, not a live enemy combat comparison.
- Fonts.ts now uses central BitmapData/BitmapFont/Texture/StarlingTextField bindings and typed font/bitmap callback records instead of direct api.cls, Raw and explicit any. TypeScript and Public build pass. This follow-up build is local; previous deployed gameplay fixes remain live.

### Login async visibility ownership (2026-11-12)

- Extracted typed LoginPresentation controller from index initialization. Font completion/failure restores login visibility only while authentication has not completed. Successful autologin therefore cannot have its departed login view re-shown by the pending font promise. Unsafe disable restores the prior visibility once and cancels late client control attachment.
- Four regressions cover controls attaching while hidden, authenticated completion, unsafe disable with later visibility ownership, and font failure fallback. Typecheck and Public build pass.
- Re-ran the two known broad-suite failures: Integration still lacks core.login.ServiceRoomSelector in its synthetic registry; NativeRadio still fails on its unbound LoginButton superclass. Neither failure was suppressed or treated as live-game evidence. Radio remains excluded from the requested port.

### SoundManager stop and cache promotion parity (2026-11-12)

- Compared original SoundManager.stop/internalPlay with NativeMusicPlayback. Fixed protected manual-track stop returning without its callback. Source deliberately completes that callback while leaving playback protected.
- Fixed effect/precache objects promoted to music without stopping their previous channels. Promotion now stops multipleAllowed objects, restores the requested key, and then transfers ownership to the exclusive music map before playback.
- Added both source-behavior regressions; all ten MusicPlayer checks pass. TypeScript and Public build pass. Changes are built locally, not deployed in this batch.
- Historical gap, now resolved in current source: asynchronous effect playback is guarded by SoundRequestGuard through NativeMusicPlayback.getSoundObject/internalPlay. Rechecked 2026-11-12: tests cover stop(key), stopAll, service replacement, unload, late completion and intro cleanup. This establishes request cancellation behavior, not audible live-game verification.

### Startup cover handoff and immediate audio attempt (2026-11-12)

- Host no longer removes the cover merely because a canvas exists. It waits for the plugin's login presentation-ready event, a visible native login fallback, or an active game session; original/uninspectable fallback remains available.
- Added 450 ms opacity fade with reduced-motion support and delayed overlay removal. Cage reload screenshots /tmp/qolaf-fade-0.png through -5.png show the cover during startup and the prepared profile UI afterward; frame -3 exposed a blank viewport: the native-login fallback fired before the plugin presentation began. Added an early plugin presentation-supported handshake so native fallback cannot bypass that pending preparation. The initial screenshot set is failure evidence, not a sign-off.
- Removed the host's initial-interaction audio gate. It attempts resume immediately and watches for Howler's lazily-created context. Browser autoplay rejection is handled, not bypassed. Cage Firefox still explicitly reports its autoplay permission restriction; audible autoplay is not claimed verified.
- 23 host tests pass (one optional official-bundle test skipped); four login presentation regressions, client typecheck and Public build pass. Host and Public plugin changes deployed, including the prior SoundManager stop/cache promotion fixes.

### 1.2.0 TS identity, cover layering and embedded Plugins (2026-11-12)

- User requested display version 1.2.0 TS. Updated login, plugin descriptor, echo, help and diagnostic labels; package/IPC semantic version remains 1.2.0. IPC compatibility revision is unchanged. Echo palette remains violet/blue per the user's subsequent correction; source-color regressions pass.
- LoadingCover now keeps visible covers above newly appended HUD nodes at Starling render time. Initial show fades from transparent over 250 ms; opaque teardown covers remain opaque. Fade-in is cancelled by fade-out/static cover/disposal and cleaned on unsafe unload. Host-dispatcher regression covers late HUD insertion, half-duration alpha and release after fade-out.
- SettingsState exposes external category registration, and the host registers Plugins into its sidebar/content area. Removed the secondary popup/title/Close button in that mode; login and vanilla settings retain their existing host UI. Embedded pages inherit the settings layout and use its font. Tests cover category selection, disposal, reopen and absence of an extra overlay window.
- 24 host tests pass, one optional upstream bundle test skipped. Focused cover/settings/command tests pass, typecheck plus Public and Private builds pass. Live authenticated transition/settings comparison is still outstanding.
- Separate Steam patch files at /home/raony/Documentos/QoLAF-Steam/src now include one-shot official-site fallback for failed custom-host navigation or HTTP error. No installer/repack script or installed archive modification was made, per user request.

### Pending native effect cancellation (2026-11-12)

- Added typed SoundRequestGuard ownership for native effect loads and completion callbacks. stop(key) invalidates older playback for that key; stopAll and service replacement invalidate the service's queued effects; unsafe unload retires captured callbacks. Download/precache callbacks remain usable, and a later explicit play gets a fresh request.
- Native internalPlay still owns effect volume, channel creation and native completion-listener removal. The loader hook consumes its scope before executing native callbacks, avoiding accidental inheritance by synchronous nested precache work.
- stopAll now also stops cached sound objects, matching the original state cleanup before native SoundMixer.stopAll.
- Thirteen music/effect tests pass; TypeScript and Public build pass. This batch is local and has not been deployed. Original IntroState's separate stopEffects path remains to be audited/ported; do not treat this as complete sound-system parity.

### Direct Steam startup and opaque-frame handoff (2026-11-12)

- The direct game.html entry now includes the same startup bar as the iframe launcher. Only standalone reports update that cover; embedded mode hides it and retains the parent cover. Deployed game.html/game.js. Cage screenshot /tmp/qolaf-direct-loading.png shows the direct-page loading bar; /tmp/qolaf-direct-ready.png shows the 1.2.0 TS login afterward. This is browser verification of the Steam URL, not an Electron/Steam overlay verification.
- showStaticCoverUntilPresented now fades a newly visible cover to opaque before teardown. The presentation gate samples the frame ID when the opaque render begins, rather than before the animation. A regression first failed with the earlier implementation and now passes: prior translucent frames cannot satisfy opaque presentation.
- Targeted cover tests and typecheck/Public build pass; updated Public artifact deployed. Authenticated transition and gameplay comparisons remain open; isolated Cage still has no saved profiles.
- Prior pending-effect cancellation and IntroState adaptation are now deployed too. Intro's precache completion stops effects while respecting protected manual music. Fourteen music tests pass; broader audible runtime parity is unverified.
- Separate Steam patch now includes src/steam.js, replacing mirror creation's hardcoded 60 FPS with the display refresh rate while retaining vsync:true. No runtime FPS IPC or uncapping flags added. Installed files were not changed; native high-refresh performance remains unverified.

### Login cancellation/provider audit (2026-11-12)

- Compared original Login.as countdown/Control handling and JoinRoomManager.as startup service retry sequence with LoginProfiles, LoginControl, LoginLoading and StartupServiceJoin. Service begins before texture/cache work; current Haxe session/protocol fields are intentionally preserved. No new implementation mismatch established in this limited audit.
- Added direct LoginAuthentication regressions: cancelled Simple-provider success/failure callbacks cannot consume a later attempt; already-aborted requests never reach the SDK; Armor cancellation while response text is pending never accesses the SDK afterward. Both pass.
- Seventeen existing login/status/teardown/service-pool checks and four startup-service checks pass. Typechecking passes after correcting the test tuple to select the six-argument QuickConnect overload. These are lifecycle checks, not proof of full login, provider authentication, or gameplay parity against live accounts.

### Typed notification audio boundary (2026-11-12)

- ChatPingSound now uses central Sound/SoundTransform/URLRequest/SoundLocator bindings and typed SoundChannel ownership instead of Raw and per-call as-any class lookups. Removed its unused API constructor argument and updated GameSession.
- Reviewed OpenFL Sound.load/play/close, SoundChannel transform/position/stop and SoundTransform.clone against the local Haxe implementations. Added persistent generator signatures, including nullable play results when the native channel limit is reached, and regenerated declarations. This strengthens actual member typing rather than only renaming an untyped constructor.
- Converted the sound test fixture away from any/Function. Six sound/preview lifecycle checks and TypeScript pass; Public build passes. This type-boundary batch is local, not deployed. It does not verify audible output in Steam or complete the broader type migration.

### Projectile/emitter source audit (2026-11-12)

- Rechecked Projectile.draw prediction against the original Projectile.as: course position plus speed times interpolation seconds, source rotation delta, attached-state drawing and ribbon-head update remain represented. Current Haxe Game.update executes state-machine drawing before parallax.update, where the per-frame emitter adapter runs; the assumed ordering is present in the supplied bundle.
- Compared original Emitter.ppms/particleLimit and uniform emission rules with EmitterFrames. Finite effects intentionally retain native maxParticles/duration; steady constant streams use the capped particleLimit/ttl. No change was made to these formulas because the source supports the current adapter.
- Twenty-six focused projectile, particle, target-life, delay and mirroring tests pass, including bitmapless projectile poses and 30/60/120/180 Hz emission/travel. These do not settle the live conc-sphere/enemy-motion report. Requested authenticated Cage and original SWF sessions for that comparison; no saved profile was present at the last visual inspection.
- User subsequently declined the authenticated Cage/original comparison ("no need"). Do not keep requesting login or use that comparison as a required next step. Live gameplay observations above remain unverified evidence, not a new blocker imposed on the user.

### Full-pass restart and reported regressions (2026-11-12)

- Rebuilt original-vs-Preload inventory from authoritative source into /home/raony/Documentos/astroflux-port-audit/recheck. 722 current files: 356 changed, 288 added, 78 unchanged. Previous inventory had 10 changed hashes, nine current paths absent, and obsolete paths. FullPass.json tracks all 644 changed/added files with hashes, candidate paths and explicitly pending semantic review. Name matching/unmatched method names are navigation aids only.
- Confirmed missing radar boss/miniboss miniatures: Radar.as embeds RadarMiniature/RadarMiniaturePart, a masked display layer, lifecycle checks and ordinary-blip suppression. Map miniatures do not cover this feature. Also found missing PlayerClanLogo identity/cache isolation and deterministic Drop expiry pulse adaptations.
- Fixed numeric values reaching Text.escapePlainText from the PvP highscore handler: plain and HTML setters now coerce non-null values to strings. Regression exercises the real native bridge with numeric rank 42, zero and null.
- Ported PlayerShip name/level alpha=1, blendMode=normal and combat bitmap font. This had been absent, leaving vanilla 0.8/add. Native styles restore on unsafe unload/pool reset/destroy.
- Ported missing Drop.draw interpolation using per-tick speed and accumulator/33. Regression covers 60/120/180 Hz positions and unchanged pickup simulation coordinates/speed.
- User confirms all remote clan plates missing, including same-clan alt, with normal names visible. This is not the own-ship exclusion. Moved clan hook installation before optional session features and added bounded lookup/render error diagnostics. Actual cause remains unproven; passing synthetic clan test does not close it.
- Current text/name/loot changes pass focused tests, typecheck and Public build and were uploaded atomically. Plasma Blaster's bitmapless Fireball Blue trail identified from live cache; its visual refresh report remains open. Full semantic pass is in progress, not complete.

### Verified remaining sound-cache failure gap (2026-11-12)

Original SoundManager.getSoundObject delivers null for missing keys; loadSoundFromUrl removes completion/error/security listeners and delivers null on failure; cacheSound clears callbackQueue before notifying its consumers and catches synchronous load errors. Both supplied Haxe build 561 and captured proxy build 564 retain vanilla behavior: unknown keys silently return, ioError only logs, and queue removal happens after success callbacks. Current NativeMusicPlayback protects cancellation but does not port these failure-completion semantics. Failed downloads can therefore leave requests queued without completion; a throwing/reentrant consumer can prevent queue cleanup. Needs a typed cache/load adapter with regressions for error fan-out, retry and reentrancy; do not treat passing playback tests as coverage of this gap.

### Player-list labels and integration fixture — 2026-11-12

- Original PlayerListItem adds animated client-developer and custom-role labels before the level. Current player-list hook only handles ship previews; port the missing labels with developer/mod precedence and disposal.
- tests/Integration.test.ts currently fails before classesReady completes: fixture lacks starling.filters.FragmentFilter. Do not count its HUD assertions as verified. Direct BossVisibility.test.ts now covers the extracted existing visibility controller; this does not replace full-client integration.
- ButtonPlayers original changes counter height to16 and Russo size13; exact current mapping remains unverified.

Player-list label update: missing developer/custom-role rendering is now implemented in PlayerListRoles with focused lifecycle tests. Live row validation is still pending; the separate Integration fixture failure remains unresolved.

Player-list lifecycle follow-up: native build 564 constructs labels before its final update call; ordinary updates only refresh buttons. Role labels now retain their composed glyphs across those updates. The regression models the constructor call and confirms immediate labels, tint reuse, rebuild cleanup and unload restoration. Both build variants and typecheck pass. Steam currently reports no loaded game scene; live row rendering remains unverified.

### Player-list asynchronous lifecycle — 2026-11-12

Full diff exposed missing stale-friend-response guards and container disposal in native build 564. PlayerListLifecycle now ports those behaviors and restores system-list updates after leaving Friends. Uses native ScrollBox scrolling and bottom padding rather than legacy Feathers configuration. Focused fixture covers tab switches, overlapping replies, disposal, unload and scope restoration. Live rendering/scrolling still needs verification.

### Death-line reference and friend preview audit — 2026-11-12

Death-line collision/escape comparison executes the original AS3 methods against 7500 cases and matches the port. Eleven focused collision, movement integration and boost cooldown tests pass. This does not establish every native caller or live parity. FriendDisplayBox still lacks the original centered, bounded 40px ship preview fit; native construction is currently retained. Six nearby component diffs proved annotation/constant-only and are recorded as source-reviewed.

Friend-preview gap resolved in source: FriendPreviewLayout matches original centered pivot/40px fit and integrates with accepted friend-list replies. Tests verify orientations, no enlargement and hot-disable restoration through lifecycle hooks. Both builds/typecheck pass; live visual verification remains pending.

### Queue lifecycle diff audit — 2026-11-12

QueueManager/QueueInfoHolder changes traced to ServiceViews and recovery callers. Added actual-hook tests for silent disconnect dismissal, preserved stage cleanup, field resets, stale callback/sound rejection, read-only reconnect, accept/decline payloads and timeout clearing a popup during update. Both queue/friend service tests pass. No runtime code change or live matchmaking action in this batch; full live recovery remains unverified.

### Projectile course packet continuation — 2026-11-12

Fixed missing original behavior in TorpedoCourses: a removed/culled projectile ID now skips its 14-field record instead of aborting remaining course updates. The adapter handles this even with prediction disabled. Actual-hook regression covers missing first/middle IDs, later updates, native delegation for known ordinary packets and unload restoration. Nine focused projectile/contact tests, typecheck and both builds pass. Broader ProjectileManager/Factory mapping and live rendering remain incomplete.

### Delayed player projectile ownership — 2026-11-12

Confirmed missing original addPlayerProjectile behavior against Haxe build564. PlayerProjectilePackets uses the packet weapon slot without mutating selectedWeaponIndex, preserving native stalled-weapon behavior and complete packet fields. Regression covers holstered shots, mixed records, truncated packet, special effect sentinel and hook restoration. Live rendering remains unverified.

### Pooled ray range and catch-up — 2026-11-12

ProjectileRanges ports fresh finite range per checkout and prepares instant range/speed before catch-up, preventing build564 from using range as speed. Regression executes captured native initialization, including pooled reuse and invalid overrides. Sixteen related tests, typecheck and both builds pass. Remaining factory culling and manager mapping, plus live rendering, remain open.

### Instant-ray viewport culling — 2026-11-12

Ported original projectile-AI-based instant radius (weapon range plus half viewport diagonal divided by zoom). Native origin-only filter is bypassed only for a ray already accepted by this check, using a one-use camera-query override that ends before construction. Global limit/focused owner/native ordinary filtering remain. Captured native filter regression and 13 related ray tests pass, along with typecheck and both builds. Live visual verification and remaining factory mappings are open.

### Projectile retarget estimate lifecycle — 2026-11-12

Ported missing snapshot refresh after server bouncing/unit-target assignments. DamageObserver now accepts the new target lifecycle without resetting damage deduplication. Thirteen focused tests, typecheck and both builds pass. Changes affect local estimates only; live display validation and remaining manager diff are open.

### Projectile disposal counters — 2026-11-12

Fixed omitted created/grayscaleVertices provider values. Created now counts distinct objects seeded from current active/inactive pools and observes growth on checkout; repeated reuse counts only as checkouts. Separate grayscale vertices are zero because current port combines meshes. Counters remain session/activation observations rather than original static application totals; separate grayscale batching and full tint parity remain unverified. Eight pool/cue/warning tests, typecheck and both builds pass.

Counter follow-up: tracker is now shared across room managers, so room changes preserve cumulative created/checkouts. Plugin activation remains the beginning of observation; the earlier session-local limitation is superseded.

### Spawner lookup indexes — 2026-11-12

Ported missing lazy key/ID indexes from original SpawnManager, including native fallback, sync updates and disposal/removal cleanup. Provisional ID0 is not cached. Tests cover reuse/reassignment and native restoration; five index/catalog tests plus typecheck and both builds pass. This is a lookup optimization and does not close the reported origin-flash/live spawn-position issue. BodyFactory/BodyManager full mapping remains in progress.

### Body spawner table grouping — 2026-11-12

Ported shared per-table grouping from original BodyFactory/Body.addSpawners while retaining native spawner creation and Haxe radius arithmetic. Test verifies one scan across bodies, native order/count, zero-spawner preDraw, replacement/missing tables and unload restoration. Three related tests, typecheck and both builds pass. Hidden-anchor suppression, mission hints and body-parent indexing still require full mapping; live placement remains unverified.

### Body-manager key cache — 2026-11-12

Ported original lazy body-key lookup index with late-body native fallback, original duplicate precedence and per-room disposal. Five focused cache/body/zoom tests, typecheck and both builds pass. Current Steam runtime still has no loaded game scene. Full body-manager distortion mapping and live placement remain open.

### Shockwave source lifecycle — 2026-11-12

Fixed repeated image disposal, and typed the bomb hooks/game/filter ownership. Executed original AS3 updatePosition against the port across 252 timing/radius/speed/zoom cases, with additional culling, expiry and repeated-disposal assertions. Ten focused tests, typecheck and both builds pass. Ring source bitmap/centering formulas match on inspection; GPU composition and live output still need verification. Steam probe currently reports no loaded game scene, so this does not close live visual reports.

### Invisible body anchors — 2026-11-12

Ported BodyFactory fallback-sprite suppression together with the original Body radius (0.5) and lazy movieClip access. Excludes textured/interactive/effect/mission bodies and retains later native texture changes. Live deferred sprites are materialized during unload to restore native getter assumptions. Four focused body tests, typecheck and both builds pass. This supersedes the earlier missing-hidden-anchor note; parent indexing, mission hints and live spawning/position checks remain open.

### Body mission-marker presentation — 2026-11-12

Ported original combat atlas/pixel snapping after native initialization, with typed marker bindings and unload restoration. Five body tests, typecheck and both builds pass. Native eager marker allocation is retained because current Haxe draw paths assume a non-null marker; original allocation/null-guard optimization and parent indexing remain open. Live visual verification remains pending.

### Steam live initialization and chat verification — 2026-11-12

Selected the pending private prompt’s nonpersistent Use Public path; actual deployed client auto-logged in to RoamingState. Verified chat open/focus/close across nine screens, with expanded artifacts blocking chat and hiding the log as intended. Inspected settings screenshot to confirm actual chat layering. Live room has 111 bodies; observed hidden/boss anchors have no eager sprite and radius 0.5; both mission markers use DAIDRR_COMBAT with pixel snapping. ClientErrorDiagnostics snapshot empty. Returned to roaming with chat closed and no draft. Details: SteamChatVerification.json. Death overlay, SWF comparison and wider live feature coverage remain open. Node Integration.test.ts still fails at missing FragmentFilter fixture binding; no mock-only pass claimed.

### Enemy authoritative-heading ownership — 2026-11-12

Found original Converger.course.copy(target) ownership missing from native build564: native setConvergeTarget assigns shared position/speed then mutates position through aiAddError. Added typed EnemyCourseOwnership hook to detach only shared enemy points before correction. Retains newer native blend duration/velocity/lead behavior. Captured native fixture proves snapshot mutation before the hook and unchanged blended output after it; interpolation checks, typecheck and both builds pass. Steam CDP 9228 returned ECONNREFUSED before capture, so visual stutter remains unverified.

### Invisible planets report — 2026-11-12

User reports invisible planets. Found BodyVisibility accepts missing/non-finite zone extents, causing NaN radius and a NaN retry timer; native Haxe distance culling does not read these optional radii. Added finite nonnegative visual/zone extents and retry invalid timers. Regression cases cover undefined/NaN nearby planet radii; seven focused tests, typecheck and both builds pass. This is a confirmed code defect, but not yet a confirmed diagnosis of the user session: Steam CDP is unavailable, and a Steam launch attempt has not restored it. Do not mark the reported rendering issue resolved without live confirmation.

### World rendering diagnostic capture — 2026-11-12

Added /log World snapshot for the unresolved invisible-planets report. Captures nearest sixteen non-anchor bodies, texture/sprite presence, canvas attachment, visibility/alpha, dimensions/filter, culling timer/radii and camera bounds. Snapshot is local, read-only, taken on tab click and available through Copy; distinguishes missing/nonfinite fields rather than JSON silently converting them to null. Typecheck, existing client-log tests and both builds pass. No additional rendering fix claimed; awaiting affected-session evidence.

### Planet lifecycle verification — 2026-11-12

Replaced approximate BodyLifecycle test methods with captured actual build564 Body.addToCanvasForReal/removeFromCanvas implementations, injecting their external dependencies. Verified repeated cull/re-entry restores sprite parent, retains body-owned filter, clears stale canvas ownership and invokes native filter.cache on each re-entry. Eight related lifecycle/culling/zoom tests pass. This only rules out the tested normal re-entry path; does not verify GPU output or resolve the invisible-planets report. No additional production rendering change made in this pass.

### Null sound playback crash — 2026-11-12

User supplied get_originalVolume null trace through getSoundObject/internalPlay/update. Root cause: NativeSoundCache around-hook was registered before NativeMusicPlayback guard; production dispatcher runs earlier around-hooks outermost, so missing metadata invoked native playback callback with null without entering guard. Moved cache registration after guard. Replaced MusicPlayer test harness reverse-order wrappers with real HostCore Hooks and added missing-metadata regression matching native original-volume access. Twenty focused sound/music tests, typecheck and both builds pass. This fixes the demonstrated exception path; live missing-planet relationship remains unproven.

### Body mission-marker teardown — 2026-11-12

Restored original marker detach/dispose and cleared stopped hintTween on native Body.reset. Removed marker restoration state before disposal so later plugin unload does not access disposed text. Three focused lifecycle tests, typecheck and both builds pass. BodyHeading normalized diff is empty and source-reviewed. Invisible planets still require affected-session evidence; this teardown change is not claimed as that fix.

### Emoji send URIError — 2026-11-12

Traced original ChatInputText.sendPrivate/sendLocal: sends original text unchanged through chatMsg. Downloaded current PlayerIO SDK and reproduced bytesFromString calling encodeURIComponent per UTF-16 code unit, throwing for any valid supplementary emoji. Added scoped typed SDK encoder hook using UTF-8 TextEncoder, returning the SDK number[] contract; no chat rewriting/entity workaround. Captured actual SDK encoder/decoder regression proves original failure, exact emoji byte sequence, joined/skin-tone/flag/markup round trips, BMP/ASCII byte equivalence and unload restoration. Twenty focused Unicode/audio tests, typecheck and public/private builds pass; no real chat message sent during tests.

Audio typing follow-up: NativeMusicPlayback no longer uses Raw or direct api.cls lookups; centralized manager/object/channel bindings and nullable callbacks are used. Sound method signatures regenerated from current build. MusicPlayer remains partly legacy typed outside this boundary.

### Emoji framing follow-up — 2026-11-12

Verified complete message framing with captured current PlayerIO message, messageSerializer, byteWriter and binaryserializer code. Emoji/ZWJ/flag strings and a 255-character-prefix case round-trip alongside subsequent int/boolean fields without offset corruption. Editor source rejects over-limit commits, not partial truncation; seven editor tests plus two SDK codec tests pass. No transport was opened or real chat sent. No additional production change required.

### User runtime confirmation — 2026-11-12

User confirms sound, SDK and rendering seem to be working and requests no further changes to these working areas. Leave their implementations unchanged and continue the remaining functional source audit. This is user runtime evidence, not a claim of exhaustive visual parity or full-port completion.

### Functional chat source review — 2026-11-12

Compared the complete original artifact-channel policy, friend-ping formatter and image-shortcut store against their port implementations and traced their consumers. No behavioral discrepancy found in those three modules. Fourteen existing policy/ping/shortcut/picker checks pass. Marked only these source entries reviewed; broader chat integration and full-port completion remain unproven. Sound, SDK and rendering unchanged.

### Command autocomplete omissions — 2026-11-12

Restored /upstream autocomplete under the implemented refresh behavior, keeping only /restart as the plugin reload command per user instruction. Restored private-only /serverip metadata, which was implemented but missing autocomplete. Twelve autocomplete tests, typecheck and both builds pass; executed separately compiled Public and Private suggestion exports to verify serverip gating and refresh/restart descriptions. Registry suggestion conversion matches original source. No sound, SDK or rendering edits.

### Friend and shortcode autocomplete source review — 2026-11-12

Compared full original friend parser/model and emoji shortcode parser. Ranking, roster isolation, name/ID disambiguation, quotes, metadata, selection and token boundaries match. Six existing model/native editor/shortcut tests pass. Marked these three source modules reviewed without production changes. Existing registry/parser reviews remain valid; broader integration is still incomplete.

### Chat channel visibility refresh — 2026-11-12

Original MessageLog.toggleMuted refreshes the active view after saving; current build564 and the port omitted that refresh. Added the same scoped after-hook used for message removal. Regression verifies immediate removal/restoration of retained history, cancellation of pending batches without duplicate rows, and refresh of the active Simple view. Seven advanced/settings tests pass. This changes channel visibility only; history and sound/SDK/rendering implementations remain untouched.

### Artifact history prefetch — 2026-11-12

Restored the original MessageLog receive-time and newest-first Advanced-open token scans. Rows record only settled outcomes, so pending/load-shed lookups remain retryable and settled negative results do not repeat the eager scan whenever chat opens. Scoped hooks/listeners detach on unload. Seven history/resolver checks pass; full resolver source reviewed. Existing renderer/hover lookups and authorization checks are unchanged.

### User-reported KOS and tooltip overlap — 2026-11-12

Ported original PlayerShip KOS markers and soft severity, exact assignments and centering. Labels follow native rendered name positions, inherit visibility, and detach/dispose on removal, reset, destroy and plugin unload. Fixed NativeChatOverlays raising chat above hover tooltips by restoring shown native tooltip containers above chat. Regression checks assignments/colors, repeated centering, lifecycle and repeated overlay frames. Three focused tests, typecheck and both builds pass; live screenshot follow-up still needed.

### Steam update persistence investigation — 2026-11-12

Current installed resources contain extracted app/ and no app.asar. Verified Electron v39 source search order is app.asar, app, default_app.asar; earlier suggestion that app/ would override restored archives was incorrect and corrected to user. A Steam update restoring app.asar can bypass the extracted patch. User wants no manual repatching after updates. External bootstrap/automatic patch application remains to be designed and verified; do not claim a paste-only update-proof solution. No Steam files changed during this investigation.

### Packaged Electron startup-injection probe — 2026-11-12

Minimal packaged Linux Electron 43.8.7 app successfully paused before main, accepted a marker and Electron API access through Debugger.evaluateOnCallFrame, resumed, observed the marker and exited 0. Inspector used a loopback ephemeral port and detached after injection. Initial default_app ESM probe lacked lexical require; packaged CommonJS entrypoint succeeded. This establishes the mechanism only, not actual Windows/Proton Steam authentication, overlays, update survival or a completed distributable launcher. No installed game changes. Details: SteamBootstrap.json and /tmp/qolaf-startup-probe.

### Steam/browser clipboard — 2026-11-12

User reports copy failing in Steam. Shell explicitly denies all permission requests; copy buttons relied solely on navigator.clipboard. Added shared typed clipboard helper with native bridge, synchronous user-gesture execCommand copy fallback preserving focus/selection, and standards API fallback. Migrated log, clan member ID, player inspect, chat context and composer copy/paste. Added origin/top-frame-checked native Electron clipboard IPC to installed shell and QoLAF-Steam patch files; preload exposure verified for both file sets. Four client tests and one shell permission/type test pass, shell syntax checks and typecheck/public/private builds pass. Full OS clipboard behavior after restart remains unverified; no restart of user session performed. Clipboard shortcuts already using DOM clipboardData remain unchanged.

### Hidden-tab inactivity protection — 2026-11-12

Found native idleTimer.run retains the original bound disconnectIfInactive installed before session hooks. Patched existing timer dispatch through the protected method. Active checks refresh the activity timestamp and retain native timer setup rather than swallowing the initial timer creation. Scoped cleanup restores the original callback. Captured native build564 method verifies a simulated hour without frames/input does not kick when protected and normal ten-minute timeout returns when disabled. Three focused checks pass; actual long-duration hidden-tab run not yet observed.

## Weapon selection source audit (2026-11-12)

The original Player requestWeaponChange/resolvePendingWeaponChange state is not yet mapped in the port. It tracks request generations, the requested key, previous index, ship identity and lifecycle; noteWeaponChangeFailed restores the prior index. PlayerManager fire/status messages call acceptReceivedWeaponSelection to reject stale or holstered self selections while still applying authoritative HP/shield/energy. The current WeaponInput only gates requests on weaponIsChanging. Port these together and test delayed/out-of-order replies, send failure, ship reuse, remote loadouts and health/energy preservation.

The acknowledgement subset now stops actual live weapons and validates slots; late speed/landing guards are also restored. Focused tests pass, but neither closes the pending selection/snapshot gap.

Weapon selection follow-up: pending ownership/rollback and stale fire/status packet arbitration are now implemented in WeaponSelection, WeaponAcknowledgement and WeaponSnapshots. Ten focused regressions pass, including integrated hooks, ship lifecycle reuse, authoritative health/energy, beam packet boundaries and duplicate-fire suppression. The legacy reflective request/getter API is not exposed on Player; no current plugin caller uses it. Live combat under latency and full Player/PlayerManager source coverage remain unverified.

Weapon-selection API follow-up: the original Player methods and result getters are now exposed with typed declarations and Haxe get_ aliases. They share state with the native hooks and restore previous prototype descriptors on unload. Five focused tests pass, including direct API interoperability. The missing-API note above is resolved; live combat verification remains open.

### Queue action guards — 2026-11-12

Full source diff found missing disconnected/leaving guards in both ButtonQueue and ButtonPvPQuickMatch. QueueActions now guards join/leave/accept before native queue flags or sends change. Existing popup guards were insufficient to cover these buttons. Six action paths are exercised through real host hooks, including reconnection and unload; live service-loss interaction remains unverified.

### Tech icon disposal audit — 2026-11-12

Native elite/level icons retained their tooltip registry entries on disposal; elite number/icon tweens also survived. TechIconDisposal now releases those owned resources before native disposal. Two focused lifecycle tests and typecheck pass. Source font alias mapping, TechLevelIcon techBar getter and elite popup row spacing remain to review/port; live teardown not yet exercised.

Tech presentation follow-up: initial Verdana fonts, techBar accessor and elite popup row spacing are now mapped in TechPresentation. Native state-dependent font sizes remain intact. Regression verifies accessor cleanup and layout accumulation; typecheck and both builds pass. Live screen comparison remains unverified.

### Inactivity follow-up — 2026-11-12

User still reports misbehavior. Traced all audited Haxe references: one snoring-dialog branch in disconnectIfInactive, reached at native startup and via haxe.Timer.run; stopIdleTimer runs on kick/exit, focus handlers only set isInFocus. Original source explicitly gates on prevention and uses 30 minutes; previous port refreshed lastActive and retained native 10-minute threshold. Replaced timestamp-refresh protection with an explicit gate and original threshold, preserving native timer initialization and disconnect flow. All observed/recreated timers route through current guard and retired timer callbacks do nothing. Captured-native regression covers hour-long absence of frames, 32-bit timestamp arithmetic, timer recreation, transient protection and timeout with preference off. Four focused tests, typecheck and public/private builds pass. Current user-session cause is not confirmed; symptom clarification remains pending and live long-duration verification is open.

Inactivity installation follow-up: moved preference/timer hooks directly after session settings, before optional screen and music initializers. Extended actual sessionSettings persistence regression to verify dontKick survives room recreation and defaults independently for another account. Five focused tests, typecheck and both builds pass; user-session failure still not reproduced.

Disconnect-path follow-up: clock-response watchdog is a separate explicit reconnect path, gated by foreground/focus/readiness and reset on focus/visibility events. Added /log reason at that trigger. New regression covers both hidden inactive frames and a completely suspended frame loop: neither triggers reconnect on return; a fresh ten seconds of active unanswered traffic is required. This does not reproduce or identify the user-session inactivity failure.

Ship-selection teardown follow-up: ParallaxLoading now disposes owned nebula/star display containers and clears manager references when StartSetup is disposed, matching original cleanup beyond existing load cancellation. Shared textures are retained. Host-hook test covers repeated/partial disposal and detached ownership; four related tests pass. Source selection translations remain unmapped; live first-account flow not exercised.

### Full regression run — 2026-11-12

Ran npm test against the current compiled public client: 1069 tests, 1066 passing and three failures (no skips). InitializationFailure expected a missing FragmentFilter but failed earlier at missing SDK serializer. Updated it into two explicit negative cases using the captured SDK encoder for the native-class case; both now pass and verify no partial session/HUD or font installation. Integration.test.ts still lacks SDK initialization and its native registry also lacks FragmentFilter; it cannot substantiate full-client lifecycle parity until rebuilt against current dependencies. NativeRadio.test.ts fails in its old class fixture; browser radio is explicitly excluded from the port. These two failures are retained, not skipped or treated as product parity. No production code changed in this verification pass.

### Live login validation attempt — 2026-11-12

Browser-control inventory returned no apps or browsers. Tried cached Electron41.2.0 in a hidden offscreen window with a fresh /tmp profile, public endpoint only (no account/key reads). First run failed Chromium shared-memory allocation in /dev/shm and navigation ERR_FAILED. Retried with disable-dev-shm-usage, X11 and software ANGLE; Chromium then reported the same allocation errors in /tmp. Both processes terminated; no screenshot or client-startup result was produced. Logs: /tmp/qolaf-live-login.log; runner: /tmp/qolaf-login-check.cjs. This is an environment limitation, not evidence of a game regression or successful live validation. Existing user sessions were not touched.


Boss visibility source audit: implemented missing Boss camera-centered, zoom/resize-aware culling (BossCulling.ts), preserving player-relative radar fields. Focused tests and type/build checks pass; full suite 1070 pass / 2 existing fixture failures. Live boss zoom/resize and teleport comparison remains pending.


### Early inactivity protection — 2026-11-12

Fetched the currently served upstream game from raony.dev/astroflux/upstream/astroflux.js; its inactivity path still uses the native ten-minute timer and snoring dialog. Found another installation dependency: the session guard previously ran only after ensureFonts resolved and after checking for a HUD. Moved saved per-account settings and timer protection into synchronous onGame setup through SessionProtection.ts, before connection-health/background/font/HUD work. The HUD receives the same settings object rather than recreating it. Added a captured-native timer regression with real persisted settings and no HUD/fonts: protection survives one-hour idle periods, timer replacement and temporary automation ownership; switching it off retains the original thirty-minute threshold. Four inactivity/watchdog and four initialization/localization tests pass; typecheck and public/private builds pass. This closes an initialization gap but does not prove the reported live failure is resolved; focused/hidden long-duration verification remains open.


### Recovery and auxiliary chat source audit — 2026-11-12

Compared the original RecoverDialog changes and all FloatingChatConnection/ServiceConnectionLease members. Added a recovery regression using the actual host dispatcher for pending request/button/Enter suppression, Cancel locking, success dismissal, failure recovery, synchronous exceptions, disposal and late callbacks. No network recovery requests or chat messages sent. Ten focused recovery/auxiliary connection/pool tests and typecheck pass. Current served Haxe LoginInput already contains the original empty-error clearing behavior; no redundant hook added. Updated FullPass evidence and left live comparison and incomplete input/cross-room branches open. No production changes or deployment in this audit pass.


Login input/registration call-site follow-up: mapped 300px widths and provider prompts to LoginProfiles; reviewed full RegisterDialog2 delta and verified existing four request regressions. Fixed FloatingChatConnection acquisition diagnostics for SDK object errors, with a regression proving retry after failed acquisition. Nine focused tests pass. No real registration/chat calls performed; live screen comparison still pending.


### Service selector readiness — 2026-11-12

Restored original readiness-driven new-player auto-selection and immediate manual selection. Added typed ServiceRoomPreview binding and selector/preview signatures; preserve current upstream room capacities/ranking. Tests cover both response arrival orders, no selection before readiness, one automatic callback, immediate manual callback and unload restoration. Eight selector/registration/localization tests, typecheck and both builds pass. Regenerated game definitions successfully after removing plugin-created Localize EN_US/PT_BR constants from native-only Signatures.json. Preview disposal and late callback cleanup remain open and recorded in FullPass. Live multi-room picker validation is pending.


### Service preview lifecycle — 2026-11-12

Ported original preview disposal and late-response guards in ServicePreviewLifecycle.ts. Owns preview/friends/error handlers, clears/disconnects auxiliary sockets and cancels row tweens. Native join fields and validation remain intact. Pending callbacks are retired both on row disposal and plugin unload; duplicate ready replies do not close the active socket. Eight lifecycle/selector/pool tests, typecheck and public/private builds pass. No real account or room actions were performed; live picker verification remains pending.
