# Open port issues

This ledger tracks user reports and source/runtime evidence. A code change or
passing test alone does not close a visual parity issue. Completed work and
screenshots are recorded in [LiveComparison.md](LiveComparison.md).

| ID | Issue | Status and evidence | Next verification / work |
| --- | --- | --- | --- |
| UI-01 | Target bars switch as nearby units appear | Fix pushed in `981af14`: removed radar-driven automatic selection absent from original. Integration regression passes; personal weapon/pet hits still select. | Observe multiple nearby units without firing, then compare actual hits and manual lock against original. Nearby rows retain source sorting. |
| UI-02 | Mission XP reward renders one character per line | Autosized HTML fix pushed in `981af14`. Haxe passes stale hit-area width to HTML compositor; regression covers narrow prior width. | Verified the exact reported timed mission locally: XP 2093 (+628) and boost icon render horizontally. Screenshot `/tmp/QoLAF-TimedText.png`. Reported vertical-letter defect closed; general UI parity still tracked separately. |
| UI-03 | Hover tooltips clip text, including artifact descriptions and Players label | User confirms still broken after the first text fix. Native WrapText measures with OpenFL but paints with bitmap fonts. Adapter now measures using the same Starling HTML compositor; verification in progress. | Players tooltip verified after reload at screen edge: full text, green shortcut P, matching measured/rendered bounds. Also verified Armorlock Protocol and Recycle Generator multiline tooltips: title, stats, wrapped effect text and Fitness are readable within their backgrounds. Exact Phase Nullifier sample and broader DPI/image cases remain open. |
| FX-01 | All emitters/thrusters look stepped below display FPS | Frame-delta adapter implemented with rendered engine mounts, fractional emission, lifetime and friction/gravity scaling. Live probe observed particle advances across 1,618 frames without simulation ticks. | Compare thruster appearance against original during movement; audit remaining visual limits and fast-forward setup. Current native rainbow effects retained. Simulation unchanged. |
| FX-02 | Moving world text looks stepped | AF/pet labels now follow ship draw: live probe checked 10,147 positions with zero mismatches. Combat text now tracks rendered owners with independent rise, fractional lifetime and owner-reuse guards; tests cover 30/60/120/180 FPS. | Live native-particle probe passed 360 frames (298 without simulation ticks), zero mismatches. Source turret/spawner offsets and 120-unit rise cap ported. Newest-slot ownership now matches source: replaced numbers keep independent rise and cap, while healing follows its own slot. Regression passes. Real combat comparison and other world labels still require audit; full parity remains open. |
| CHAT-01 | Actual chat renderer/composer is incomplete | Rich document, browser input transport and bitmap editor are now active on native TextEntry. Live formatted draft, Ctrl+A selection, pointer drag and command Tab completion verified. Source offsets, global restriction, serialized limits and font changes covered by native-hook tests. | Original Color/Size toolbar and popup are active, including bitmap hex input. Live FF6600 and 24px selection changes verified; original color popup visually compared. Context-menu/clipboard interactions and resize/focus cases need broader verification. Port original integrated Simple/Advanced panel, links/artifact tokens/images and sizing. Word navigation/double-click selection, live IME and full original comparison remain open. Preserve current game messaging rules. |
| CHAT-02 | Chat autocomplete parity incomplete | Native command popup integrated with source model, supported command metadata, Tab/arrows/Escape, passive argument help, row clicks and scrolling. Live prefix and Tab completion verified; pooled-row anchor bug found and corrected. | Corrected anchor and drawing order verified after reload. Wheel scrolling and row-click completion verified live; clicking fills the editor without submitting. Verify scrollbar dragging, resize and custom registry updates live; compare original. Emoji/friend preview autocomplete remains unported. |
| CHAT-03 | Remaining source commands absent | Local `/timers`, `/clearchat`, `/echo`, automation commands and custom help ported. `/resync` lacks native parallel-resync API. | Audit command inventory and implement supported client features honestly; do not advertise unimplemented commands. |
| MAP-01 | Orbit colors differ from original | Fixed canvas-backed vector texture channel swap via DisplayTexturePixels. Live Fulzar map now renders blue orbits matching SWF; safe-zone ring tint also corrected. | Color defect verified in OrbitBefore/OriginalOrbits/OrbitCorrected screenshots. Actual graphics-context restoration still needs live verification; restoration draw path is regression-tested. |
| PORT-01 | Other full-port gaps | Full parity remains incomplete: aim assist, additional projectile/boss presentation, reconnect/loading, desktop/IPC features and broader settings audit. | Continue requirement-by-requirement source diff and live comparison. This ledger is not a narrowed completion definition. |

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


Incremental GIF decoder and synchronous facade ported from ChatGifDecodeTask /
ChatGifDecoder. GifBytes adapts browser Uint8Array responses to the source's
ByteArray read operations; compressed sub-blocks are assembled once. Restored
AS3 zero-filled fixed vector sizes for LZW prefix/suffix/stack/output, corrected
converter shift syntax, and preserved interlace passes, transparency, disposal
2/3, frame delays, source dimension/frame-count/total-pixel limits. Incremental
nextFrame still returns at most one composited bitmap per call.

Independent Pillow-generated fixtures exercise interlaced local/global palette
and LZW behavior plus four animated disposal/transparency frames. Every decoded
RGBA frame matches the independent hash. The facade test checks ownership of
successful frames and disposal of all partial resources on a late stream error.
Fixtures can be regenerated with scripts/GenerateGifFixtures.py (Pillow 13.0.0).
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
on the following line. Screens: /tmp/QoLAF-SimpleGifOne.png and
/tmp/QoLAF-SimpleGifTwo.png. Switching to Advanced retained the cached image;
clicking opened the source viewer, whose actual playback showed both frames
(/tmp/QoLAF-GifViewerThree.png and /tmp/QoLAF-GifViewerFour.png). This verifies
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
in Private/Clan. The port has no ClientIpcService or ClientQolafChat integration;
therefore adding only the sharing controls would not reproduce that flow.
Original service uses a dedicated invisible Service-1409_24 room, not the gameplay
connection. Authentication owns its lifetime; scenes only attach/detach receivers.

Ported ClientIpcCodec, ClientIpcAssembler and ClientIpcMessagePack into src/ipc.
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
using the unchanged original ClientIpcCodec compiled at /tmp/QoLAF-IpcOracle.
The installed AIR runtime exited without producing its expected output.json;
its commercial-license notice was the only output after resolving local runtime
library loading. Do not treat the compiled oracle as a successful runtime test.
The new protocol modules are not yet wired into the client bundle's runtime.

Next required work: port ClientIpcService connection generation guards, authenticated
receive envelope, discovery schema 4/presence, paced queue (Local 1s, Private 200ms),
reconnect/expiry/cleanup and message-pack dispatch; then ClientQolafChat receiver,
channel tab/send integration, reward notices and artifact sharing controls. Keep
new gameplay connection semantics intact and verify actual interop before claiming
QoLAF chat or artifact sharing complete.


## Dedicated IPC Service transport and native ABI (2026-11-10)

Ported the original ClientIpcService into typed browser code, with its send queue
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
NativeIpcClient adapts the inspected Haxe wrappers. Haxe Message has no getObject;
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
`npx tsx scripts/CheckIpcInterop.ts /path/to/PlayerIOClient.minified.js`.
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
NativeIpcClient per native authentication owner, attach service lifetime to auth/host
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
