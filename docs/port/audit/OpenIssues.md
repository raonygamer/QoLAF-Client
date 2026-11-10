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
| MAP-01 | Orbit colors differ from original | Native/source orbit drawing both request blue; port displays yellow. Cache-key parity implemented but did not resolve color. | Trace bitmap/vector rendering and color transform separately; verify against original Fulzar map. |
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
