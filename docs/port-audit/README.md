# Full port audit — work in progress

The requested target is **all original client features and screens**, retaining their appearance and behavior, adapted to the Haxe runtime. The former DOM-panel release did not meet that target. This directory records coverage against the supplied vanilla `Preload.swf`; it must not be used to claim completeness while items remain pending.

Explicit exception requested by the user: the server's corrosive-percent bug has been patched. Do **not** carry over `Weapon.addCorrosiveArtifactDamagePercent`'s `hasCorrosiveEliteTech ? Damage.CORROSIVE : Damage.ALL` workaround, its call from `Player`, the gold `(all%)` artifact tooltip annotation, or the obsolete changelog claim. Corrosive-percent bonuses must affect corrosive damage only, including weapon debuff estimates, regardless of corrosive Elite Tech. Preserve the upstream corrected calculation when integrating damage estimates. The current TypeScript port does not override that calculation or add that annotation. Artifact fitness weights are separate scoring coefficients, not damage multipliers; they already distinguish `corrosiveMulti` from `allMulti` and need no change for this exception.

The SWF was decompiled with JPEXS 26.3.0. `source-inventory.json` contains every AS3 source file from the client, its SHA-256, and a comment/whitespace-insensitive comparison with the corresponding decompiled file. There are 722 client files: 288 not present in the baseline, 356 with token differences, and 78 with identical tokens. Decompiler changes can produce token differences without a behavioral difference; changed methods need individual review. The baseline, full original sources and raw diffs remain outside the port repository.

Active integration work:

- Host event hook arity: fixed and tested using the actual upstream Starling event dispatch method.
- Native display/property adapter and original embedded bitmap font atlases.
- Source ports of login profile/provider panels and buttons, login identity and credits.
- Native target information, progress bars, nearby-target rows and text/aura components.
- Native radar telemetry and artifact tooltip/sorting integration.
- Native Plugins manager in the separate host; default external client URL.

These are **not full parity sign-offs**. Remaining source features include the full settings pages, rich/advanced chat and composer, command registry, artifact sharing and expanded overview, aim assist, debuff tracking, boss/map/timer systems, rendering changes, loading/reconnect flows, radio, Discord/native integration and platform packaging. Every modified source in the inventory must be reviewed, including modifications outside named QoLAF namespaces. Original native/private-build functionality needs an actual browser or desktop bridge implementation, not a disabled control or a substituted visual.

No generated or simulated test can establish real browser visual parity. An authenticated rendering check is still required; no controllable browser is available in the current tool session.
