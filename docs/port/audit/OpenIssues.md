# Open port issues

This ledger tracks user reports and source/runtime evidence. A code change or
passing test alone does not close a visual parity issue. Completed work and
screenshots are recorded in [LiveComparison.md](LiveComparison.md).

| ID | Issue | Status and evidence | Next verification / work |
| --- | --- | --- | --- |
| UI-01 | Target bars switch as nearby units appear | Fix pushed in `981af14`: removed radar-driven automatic selection absent from original. Integration regression passes; personal weapon/pet hits still select. | Observe multiple nearby units without firing, then compare actual hits and manual lock against original. Nearby rows retain source sorting. |
| UI-02 | Mission XP reward renders one character per line | Autosized HTML fix pushed in `981af14`. Haxe passes stale hit-area width to HTML compositor; regression covers narrow prior width. | Reopen the reported mission reward screen and inspect XP text, width, placement and colors. Not yet visually closed. |
| UI-03 | Hover tooltips clip text, including artifact descriptions and Players label | User confirms still broken after the first text fix. Native WrapText measures with OpenFL but paints with bitmap fonts. Adapter now measures using the same Starling HTML compositor; verification in progress. | Recheck artifact multiline tooltip and short Players tooltip at current DPI, screen edges, and after reopening. Preserve inline colors and image extents. |
| FX-01 | All emitters/thrusters look stepped below display FPS | Frame-delta adapter implemented with rendered engine mounts, fractional emission, lifetime and friction/gravity scaling. Live probe observed particle advances across 1,618 frames without simulation ticks. | Compare thruster appearance against original during movement; audit remaining visual limits and fast-forward setup. Current native rainbow effects retained. Simulation unchanged. |
| FX-02 | Moving world text looks stepped | AF/pet labels now follow ship draw: live probe checked 10,147 positions with zero mismatches. Combat text now tracks rendered owners with independent rise, fractional lifetime and owner-reuse guards; tests cover 30/60/120/180 FPS. | Live combat-text verification pending. Compare turret/spawner anchor offsets, rise limits, and all other world labels; this issue remains open for full visual parity. |
| CHAT-01 | Actual chat renderer/composer is incomplete | Rich markup models exist; native chat projections and input remain substantially unported. User explicitly reiterated full chat requirement. | Port source composer, formatting controls, links/artifact tokens/images, Simple and Advanced views, sizing and interaction. Preserve current game's messaging rules. |
| CHAT-02 | Slash command autocomplete absent | Model/suggestion metadata files in worktree; no popup integration yet. | Native Starling popup, arrows/Tab/Escape, passive argument help, scrolling/click completion, custom registry updates and cleanup; compare original UI. |
| CHAT-03 | Remaining source commands absent | Local `/timers`, `/clearchat`, `/echo`, automation commands and custom help ported. `/resync` lacks native parallel-resync API. | Audit command inventory and implement supported client features honestly; do not advertise unimplemented commands. |
| MAP-01 | Orbit colors differ from original | Native/source orbit drawing both request blue; port displays yellow. Cache-key parity implemented but did not resolve color. | Trace bitmap/vector rendering and color transform separately; verify against original Fulzar map. |
| PORT-01 | Other full-port gaps | Full parity remains incomplete: aim assist, additional projectile/boss presentation, reconnect/loading, desktop/IPC features and broader settings audit. | Continue requirement-by-requirement source diff and live comparison. This ledger is not a narrowed completion definition. |

## Gameplay invariant

Preserve the current Haxe game's gameplay, especially shields and corrected
corrosive percentages. Port client features and presentation around it. Do not
restore old gameplay workarounds to make the visuals match.
