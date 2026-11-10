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
panel as the necessary trigger. Painter.cacheEnabled was already false; explicitly
setting false did not resolve it (CacheBefore/CacheDisabled screenshots).
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
