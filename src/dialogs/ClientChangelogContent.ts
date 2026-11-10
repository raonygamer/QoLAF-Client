// Release text ported verbatim from the original AS3 changelog. These are source release notes.
import { SOURCE_VERSION } from '../login/LoginIdentity';
export interface ChangelogRelease {
  label: string;
  content: string;
}
export class ClientChangelogContent {
  constructor(
    private readonly sourceVersion = SOURCE_VERSION,
    private readonly includePrivateHistory = false,
  ) {}
  createReleases(): ChangelogRelease[] {
    return [
      {
        label: 'v' + this.sourceVersion,
        content: this.latestContent(),
      },
      {
        label: 'v1.1.21',
        content: this.version1121Content(),
      },
      {
        label: 'v1.1.20',
        content: this.version1120Content(),
      },
      {
        label: 'v1.1.19',
        content: this.version1119Content(),
      },
      {
        label: 'v1.1.18',
        content: this.version1118Content(),
      },
      {
        label: 'v1.1.15',
        content: this.version1115Content(),
      },
      {
        label: 'v1.1.14',
        content: this.version1114Content(),
      },
      {
        label: 'v1.1.13',
        content: this.version1113Content(),
      },
      {
        label: 'v1.1.12',
        content: this.version1112Content(),
      },
      {
        label: 'v1.1.11',
        content: this.version1111Content(),
      },
      {
        label: 'v1.1.10',
        content: this.version1110Content(),
      },
      {
        label: 'v1.1.9',
        content: this.version119Content(),
      },
      {
        label: 'v1.1.7',
        content: this.version117Content(),
      },
      {
        label: 'v1.1.6',
        content: this.version116Content(),
      },
      {
        label: 'v1.1.3',
        content: this.version113Content(),
      },
      {
        label: 'v1.1.2',
        content: this.version112Content(),
      },
      {
        label: 'v1.1.1',
        content: this.version111Content(),
      },
      {
        label: 'v1.1.0',
        content: this.version100Content(),
      },
      {
        label: 'v1.0.91',
        content: this.version91Content(),
      },
      {
        label: 'v1.0.90',
        content: this.version90Content(),
      },
      {
        label: 'v1.0.89',
        content: this.version89Content(),
      },
      {
        label: 'v1.0.88–v1.0.80',
        content: this.recentReleasesContent(),
      },
      {
        label: 'v1.0.79 and older',
        content: this.olderReleasesContent(),
      },
    ];
  }
  private latestContent(): string {
    return (
      this.title("What's new in QoLAF v" + this.sourceVersion) +
      this.item(
        'KoS severity',
        'The assigned Soft KoS player now has a blue-cyan (Soft KoS) nameplate marker. The two hard KoS players retain their red (KoS) marker.',
      )
    );
  }
  private version1121Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.21") +
      this.item(
        'KoS nameplates',
        'Assigned players show a red (KoS) marker beside their level. The complete name, level and marker row stays centered over the ship.',
      ) +
      this.item(
        'Smoother remote movement',
        'Remote accelerate, stop and brake transitions use a short ordered playback buffer, reducing high-ping stop-and-pullback rubberbanding without changing your own controls.',
      ) +
      this.item(
        'Cleaner reconnection',
        '/ref once again uses the fast room-transition path: it keeps the authenticated Service connection and replaces only the Game room. Disconnected and rejected Game scenes are fully destroyed before retrying, preventing stale-state rollback.',
      ) +
      this.item('Tree badge color', 'The [tree] player badge now uses #2bba00.')
    );
  }
  private version1120Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.20") +
      this.item(
        'Discord Rich Presence',
        'Shows Logged as with your in-game player name on its own line above your current location. Native Windows presence now uses full-duplex pipe I/O so activity updates reach Discord reliably.',
      )
    );
  }
  private version1119Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.19") +
      this.item(
        'Player badges',
        'Added the colored [pest], [killer], [tree], [cute], [menace] and [circle] badges for their assigned players. All custom badges, including [grinder] and [cheater], now also appear in the player list.',
      ) +
      this.item(
        'Online friends',
        'The online-friends list keeps a small bottom spacer so the final row can scroll fully into view.',
      )
    );
  }
  private version1118Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.18") +
      this.item(
        'Nether Blob danger boundary',
        "An outer circle at ??? miniboss spawns marks the surrounding black hole's ship-pull boundary, alongside the existing spawn marker.",
      ) +
      this.item(
        'Bomb shockwaves',
        'Stronger distortion returns for Nexar and Shadow Bomb blasts only. Sun and black-hole distortion remain disabled.',
      ) +
      this.item(
        'Room refresh',
        '/ref disconnects both the Game and main Service rooms, waits one second, then reconnects to the same destinations.',
      ) +
      this.item(
        'First-use guide',
        'New users get a one-time invitation to read the client guide, with an Open client help button and a reminder that /clienthelp opens it anytime.',
      ) +
      this.item(
        'Landed artifacts',
        'The artifact menu uses Classic view while landed. Your preferred in-space layout is kept unchanged.',
      )
    );
  }
  private version1115Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.15") +
      this.item(
        'Clan player IDs',
        'Each clan member now has a Copy ID button below their ship icon. Copy IDs for offline members too, without needing a clan-management rank. Uses the chat clipboard path with Copied/Retry feedback.',
      )
    );
  }
  private version1114Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.14") +
      this.item(
        'Radio',
        'Open /radio to listen together in optional shared groups. Queue songs by name or YouTube link, with synchronized playback, seeking, shuffle, repeat and saved-in-queue tracks. Media tools download only when you choose Set up Radio.',
      ) +
      this.item(
        'Radio groups',
        'Group passwords, DJ roles, song-request approval, player invitations and peer removal. Leaders can hand over the group; the first connected DJ can take over on logout. Radio information and a smooth spectrum appear above the radar.',
      ) +
      this.item(
        'Boss timers',
        'Radar telemetry shows alive bosses and estimated spawn windows, skipping windows less than a minute after an observed death. Miniboss countdowns start after an observed kill. Admiral Zhersis stays in the primary list; /timers toggles the others. Unknown or random timing stays unknown; predictions are experimental.',
      ) +
      this.item(
        'Aura details',
        'Smoother flowing borders with bubbliness fixed at 500%, lightning frequency at 300% and 8 arcs; their sliders have been removed. Jagged bolts connect points inside the aura and fade smoothly. Outline-crawling bolts remain at 16x lower frequency. Golden, green and rainbow lightning is toned down to just above the other auras. The vanilla-aura toggle remains.',
      ) +
      this.item('Weapon loadouts', 'Removed loadouts as a request from players!') +
      this.item(
        'Visual resets',
        'Use /sv reset ship or /sv reset weapon to reset only that part of your custom visuals.',
      ) +
      this.item(
        'UI fixes',
        'More reliable clan/nameplate text, scrolling long Radio labels, and stable Radio volume during game refresh. Projector mode now shows an unsupported-runtime warning at login.',
      )
    );
  }
  private version1113Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.13") +
      this.item(
        'Corrosive artifact damage',
        'Corrosive damage percentages show a gold (all%) note. Weapon damage estimates treat them as all-damage bonuses to match the current server bug, except on weapons with an active corrosive Elite Tech.',
      )
    );
  }
  private version1112Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.12") +
      this.item(
        'Ship visual scale',
        'Use /sv scale with a multiplier from 0.1 to 5; 1 restores normal size. Scaling is saved with your visual and shared with compatible QoLAF clients. Hulls, shadows and auras resize without changing hitboxes or weapon range.',
      ) +
      this.item(
        'Phase blade mounts',
        "Kinetic Phase Blade follows the displayed hull's weapon mounts and scale. Single-anchor ships show one merged blade; blade hulls retain their twin mounts. Damage and range stay unchanged.",
      ) +
      this.item(
        'Rapture hull colors',
        'Client-developer visual patterns now support Rapture alongside Nexar and Crystal hulls.',
      )
    );
  }
  private version1111Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.11") +
      this.item(
        'Smoother auras',
        'Smoother silhouette edges and flowing borders on all rarity auras. Blue auras now breathe slowly with a small change in size and brightness instead of pulsing.',
      ) +
      this.item(
        'Aura controls',
        'Cosmetics offers 0–300% aura bubbliness (300% default), lightning count and frequency sliders (4 arcs and 300% by default), and Disable remastered auras to restore the original look and pulses.',
      ) +
      this.item(
        'Aura and beam details',
        'Golden, green and rainbow auras spark around their edges and closer to the ship. Chrono and Nether Blob beams have small orbiting lightning arcs; damage and hitboxes are unchanged.',
      )
    );
  }
  private version1110Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.10") +
      this.item(
        'Hull color studio',
        'Client developers can open /sv devvis for a live preview with wave, ring and uniform patterns; spectrum, two-color and solid palettes; direction, color phase, cycle time, density and reverse controls. Apply saves and shares the settings; Cancel leaves the ship unchanged. Existing mode shortcuts still work.',
      ) +
      this.item(
        'Matching phase blades',
        'Kinetic Phase Blade continues the Nexar/Crystal hull pattern smoothly along the entire blade, using the same server-time animation. Twin blades retain their colors when overlapping, with a smaller, softer outer glow. Other beams keep their existing rendering.',
      ) +
      this.item(
        'Relic finds',
        'Newly collected relics now announce at every level: below level 76 uses a cyan/teal pulse, while level 76 and above keeps magenta/red. Inventory reloads and repeated callbacks stay quiet.',
      ) +
      this.item(
        'Shared colors',
        'Color settings persist through ship and room changes and synchronize to updated clients. Both players need this version for the expanded palette controls.',
      )
    );
  }
  private version119Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.9") +
      this.item(
        'Rare finds',
        'Rare and legendary pod rewards and newly collected level 100+ unique artifacts are shared with connected QoLAF players through local IPC, with a red/magenta chat pulse. Duplicate pod items announce only the Flux actually received; artifact finds have their own wording. Nothing is posted to global game chat.',
      ) +
      this.item(
        'Jaws visual freeze',
        'Fixed Jaws freezing the game when used with the Judicator visual. Visuals without bite frames now stay unchanged, and melee animations restore their original playback speed safely.',
      ) +
      this.item(
        'Purchase celebrations',
        'Confirmed ship and Flux purchases are announced to connected QoLAF players through local IPC, using the same red/magenta chat pulse as rare finds.',
      ) +
      this.item(
        'Developer hull visuals',
        'Client developers can use /sv devvis rainbowwave, rainbowcircle, rainbow, or default for Nexar and Crystal hulls. The effects follow server time, persist locally and synchronize with other updated clients.',
      ) +
      this.item(
        'Discord Rich Presence',
        'Share your system and instance type, nearby boss HP/shields, or all three Emperor statuses on Argon. Changed telemetry refreshes every five seconds. Enabled by default; saved off preferences are respected. Disable it in General settings or with /discordpresence off; /discordpresence status checks the connection. Helpers are bundled inside the SWF, and presence failures do not interrupt the game.',
      ) +
      this.item(
        'Chat image reliability',
        'Shared image loads no longer lose their textures when an earlier consumer releases them. Images and GIFs retain restoration pixels for graphics-context recovery, downloads have size and time limits, and recycled chat rows finish updating before notifying layout.',
      ) +
      this.item(
        'Mouse aim and teleport',
        'Delayed movement echoes no longer overwrite newer local steering, and fire commands retain their order after course corrections. Mouse aim has a small center dead zone and a restart band to reduce jitter. Teleport is excluded from aim assist; its destination and existing animation timing remain server-driven.',
      ) +
      this.item(
        'Release history',
        "Login, echo, IPC and help share the same release identity. The release counter now advances correctly so What's New can appear after older versions. Released versions stay in separate archive pages.",
      ) +
      this.item(
        'Emperor radar',
        "Reconstruction follows the server's reconstruction state, repeated reports no longer restart its countdown, and stale status reports no longer overwrite a current local observation.",
      ) +
      this.item(
        'Enemy shields',
        'Shield regeneration prediction stops when enemy resource updates go stale, preventing distant shield bars from refilling on outdated debuff information.',
      )
    );
  }
  private version117Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.7") +
      this.item(
        'Chat images',
        'QoLAF, Clan and Private chat can embed direct image links in both Simple and Advanced views. Saved image shortcuts use :name: aliases. Small GIFs animate from the shared image cache; larger GIFs fall back to a static native-decoded frame to protect game frame time. Loading and failure states stay as compact text.',
      ) +
      this.item(
        'Client details',
        "Public /spececho asks connected QoLAF clients for their version and build. Replies now match /echo's pulsing presentation and include the responding player's name. Only the requester sees them; responding clients stay silent.",
      ) +
      this.item(
        'Reliable client IPC',
        'The hidden QoLAF connection now tracks peers with lightweight presence leases and graceful leave messages, batches compatible queued messages onto the same destination, and keeps visual synchronization cached across ordinary room changes.',
      ) +
      this.item(
        'Emperor coordination',
        'Inside the Argon Emperor arena, three icon rows above the radar show Xhersix, Yhgvis and Zharix as unknown, not ready, ready, or reconstructing. Reconstruction uses a yellow ten-second countdown; an authoritative alive-again observation cancels every pending reconstruction row. Ready HP snapshots are synchronized through QoLAF IPC at a slow five-second cadence while local observers update immediately. Ready means zero shield and HP below 3,000,000 for Xhersix, 2,000,000 for Yhgvis, or 4,000,000 for Zharix. Xhersix requires normal world visibility plus server aggro on the observing player; Yhgvis and Zharix use close-range observation. xr / yr / zr (with or without a slash) publish an immediate eligible snapshot; when the requirements are not met, the shorthand continues to ordinary chat and a gray local warning explains why it was not used for Emperor status. A chat ping plays once on each transition into ready; the old ready/not-ready chat spam is removed.',
      ) +
      this.item(
        'More accurate enemy resources',
        'Enemy HP and shield prediction now respects healing and regeneration disabling effects even when visuals are culled, while authoritative zero-shield updates restart the normal shield-regeneration delay.',
      )
    );
  }
  private version116Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.6") +
      this.item(
        'Three Emperors completion',
        "After Xhersix, Yhgvis and Zharix have all been observed, removal of all three actual Emperor ships shows a local gold/red 'Three Emperors were defeated!' chat notice. Local HP alone does not count as defeat.",
      )
    );
  }
  private version113Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.3") +
      this.item(
        'Dedicated client communication',
        'Ship-visual sharing now uses a separate hidden IPC Service connection instead of the main chat. Compact, versioned binary messages replace visual JSON; small messages fit one chat frame and larger ones are split and paced. Peer discovery retries missed handshakes, and older transfers cannot overwrite newer visuals. The Service IPC line above the radar shows its status. Both players need the updated protocol; old visual-sync messages are unsupported.',
      ) +
      this.item(
        'Automatic visual sharing',
        'Successful /sv changes broadcast to IPC peers automatically, with a two-second command cooldown. Incoming visuals apply automatically. Peers compare saved hashes and privately send missing or different visuals. Use /ssv disable or enable with an IPC player or player ID to control future shares locally; the optional true/false flag defaults to true and also resets their appearance. Client-developer visuals cannot be blocked or manually reset.',
      ) +
      this.item(
        'QoLAF chat',
        'Added a dedicated QoLAF chat tab and /qolaf command for talking with other IPC members. Artifact links are now restricted to QoLAF, Private and Clan; other destinations gray out while a link is in the input.',
      ) +
      this.item(
        'Client details',
        'Public /spececho asks connected QoLAF clients for their version, build and protocol details. Only the requester sees the replies; responding clients stay silent.',
      ) +
      this.item(
        'Floating chat',
        "Use /floatingchat &lt;int&gt; to open a movable, resizable Advanced chat for another Service. Enter its numeric index, such as /floatingchat 0 for Service-1409_0. Only existing rooms can be joined. Local chat is temporarily enabled through the window's Service connection.",
      ) +
      this.item(
        'Shared Service connections',
        'Chat windows reuse existing Service connections where possible. The Service display above the radar includes additional connected rooms.',
      ) +
      this.item(
        'Clock resync',
        'Use /resync [1-10] to refresh the Game clock with one to ten parallel samples, defaulting to one. The cooldown matches the sample count in seconds.',
      ) +
      this.item(
        'Clan instance transitions',
        'Changing Services now leaves a short delay after disconnecting the old Game before joining a clan instance.',
      ) +
      this.item(
        'Changelog browser',
        'Release versions now appear in a scrollable list on the left. Long entries render in smaller blocks to prevent text-rendering failures, with a separate scrollbar for the release notes.',
      )
    );
  }
  private version112Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.2") +
      this.item(
        'Release accent',
        'The client and echo replies now show v1.1.2. Echo labels pulse between sea green and cyan, keeping the server-synchronized one-second cycle.',
      ) +
      this.item(
        'Pod animation timing',
        'Pod sliding and opening animations now take four times longer than the previous accelerated timing. Purchases and rewards still wait for server acknowledgment.',
      ) +
      this.item(
        'Pod recovery',
        'Stalled requests let you close the screen after eight seconds without repeating purchases or openings. Pod counts refresh from the server, and reward-preview errors no longer leave the opening stuck.',
      )
    );
  }
  private version111Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.1") +
      this.item(
        'Release label',
        'The client and echo replies now show v1.1.1 without the FINAL suffix. Echo labels retain their synchronized red-and-gold pulse.',
      ) +
      this.item(
        'Connection handling',
        'Fixed Service disconnects during room changes. Reconnection keeps the selected Service and Game destinations, including their room settings, instead of reusing startup defaults.',
      ) +
      this.item(
        'Join retries',
        'If a room says the account is still in the game or joining is not allowed yet, retry up to three times with two seconds between attempts before showing the error. Login shows the target Service room with retry progress underneath.',
      ) +
      this.item(
        'Stalled Game joins',
        'A Game-room join or required initialization reply that stays silent for eight seconds now retries the same destination, with bounded attempts and loading-screen progress.',
      ) +
      this.item(
        'Clock timeout recovery',
        'An active Game clock request taking ten seconds triggers a reddish notice and automatic Game reconnection. Overdue refresh replies no longer shift the clock estimate. Loading, focus changes and local frame stalls are excluded from timeout evidence.',
      ) +
      this.item(
        'Smoother remote turns',
        "Other players' rotation now buffers short packet bursts and eases corrections, preventing rapid direction changes from producing large snap-back turns. Your own input prediction is unchanged.",
      ) +
      this.item(
        'Weapon selection',
        'Late projectile arrivals no longer change your selected weapon. Switching clears old firing flags, and holstered weapons cannot keep simulating shots or draining displayed energy.',
      ) +
      this.item(
        'Chat editing',
        'Use /clearchat to clear both chat views locally without losing sent-message history. Completed, valid HTML formatting typed or pasted into the composer converts in place; unfinished markup stays editable. Global chat remains plain text.',
      ) +
      this.item(
        'Online friends',
        'Compact ship previews and a vertical scrollbar keep long friend lists easy to browse.',
      ) +
      this.item(
        'Map navigation',
        'Drag system maps to pan and use the mouse wheel to zoom. Center resumes following your ship. Wheel zoom also works over the normal game view and saves your camera zoom locally.',
      ) +
      this.item(
        'Service telemetry',
        'The connected Service room is shown above the radar, with its own default-on HUD toggle.',
      )
    );
  }
  private version100Content(): string {
    return (
      this.title("What's new in QoLAF v1.1.0") +
      this.heading('Highlights') +
      this.privateHistory(
        "<font color='#ff6666'><b>Automations tab suspended at moderation's request.</b></font><br>" +
          'The tab is hidden and automation loading and execution are disabled in all builds. Installed automation files are preserved.<br><br>',
      ) +
      this.item(
        'Final release label',
        'The client is now v1.1.0, with v1.1.0 FINAL in echo replies. Echo labels pulse smoothly between red and gold in a server-synchronized one-second cycle.',
      ) +
      this.item(
        'Client developer tags',
        'Client developer tags cycle through a server-synchronized rainbow every 10 seconds in chat and player lists. Message text and player levels keep their normal colors.',
      ) +
      this.item(
        'Synchronized weapon colors',
        'Client developer weapon and effect rainbows now complete a slower 10-second cycle, synchronized to server time rather than login time or frame rate.',
      ) +
      this.item(
        'Death-message variety',
        'Randomized death messages use a generator seeded from synchronized server time when entering a room, while retaining immediate-repeat protection.',
      ) +
      this.item(
        'Visual sharing controls',
        "Received visuals now wait for /ssv accept, except shares from verified client developers. Use /ssv reset @Player to restore one player's normal appearance and forget their saved override. Short /sv option aliases are available; all existing option names still work.",
      ) +
      this.item(
        'Chat role explanations',
        'With chat open, hover [client_dev], [mod], or [dev] for a short explanation of the role. Client developers are identified separately from Astroflux game staff.',
      ) +
      this.item(
        'Shadowflame colors',
        "Custom weapon colors now tint Shadowflame's visible flame particles correctly, preserving their brightness fade and optional grayscale textures.",
      ) +
      this.item(
        'Thank you',
        "A farewell to the community marks this final client release after What's New. Its permanent-dismiss button unlocks after three seconds; dismissal is saved locally for your player account.",
      ) +
      this.heading('Other updates') +
      this.item(
        'Connection recovery',
        'Unexpected Service and Game room disconnects now show blue chat notices and retry automatically. Service-only recovery keeps the current game running; game recovery rejoins through the normal room-loading path. Retries stop for intentional exits, kicks and rejected logins. Lost requests are not replayed; friends and matchmaking state refresh after service recovery.',
      ) +
      this.item(
        'Artifact summary totals',
        'Corrected Omni damage totals in both classic and expanded artifact overviews: Omni Enhancer contributes 0.375 times its value to each damage type, and Omni Amplifier contributes 1.5 times. Omni resistance and other stat totals are unchanged.',
      ) +
      this.item(
        'Nearby target scanning',
        'Nearby-target discovery and sorting use a strict 250 ms interval, with no full scans while the list is collapsed. Health and distance displays still update every frame; invalid or recycled target entries hide immediately until the next scan.',
      ) +
      this.item(
        'Live diagnostics',
        'A movable, resizable performance panel shows frame times, memory, traffic and CPU timings by subsystem. Intentional single-room disconnect diagnostics can exercise automatic reconnection.',
      ) +
      this.item(
        'Connection health notices',
        'Repeatedly delayed replies or an overdue response produce a blue chat warning labeled Game or Service, with possible causes. Warnings are rate-limited and suppressed during loading, backgrounding and reconnection; no extra probes are sent.',
      ) +
      this.item(
        'Pod animations and reliability',
        'Pod slide and opening animations run ten times faster. Rewards still wait for server acknowledgment. Fixed overlapping slides, repeated readiness callbacks, failed-open handling and animation cleanup when leaving.',
      ) +
      this.item(
        'Automatic upgrade pacing',
        'Upgrade to ET waits 50 ms after each successful acknowledgment before sending the next upgrade. Closing the screen cancels further steps.',
      ) +
      this.item(
        'Roomier chat',
        'Advanced chat is wider and slightly taller, with Simple chat using the same text width. Chat fits smaller windows without changing the font size.',
      ) +
      this.item(
        'Artifact capacity count',
        'The storage-upgrade button and maximum-capacity label stay current after inventory changes in both artifact layouts. Pod and exploration rewards update the local count, and capacity purchases no longer duplicate the inventory grid.',
      )
    );
  }
  private version91Content(): string {
    return (
      this.title("What's new in QoLAF v1.0.91") +
      this.item(
        'More colorful death messages',
        'Added randomized lines for the Emperors, Aureus, Nexar, Nezerians, ???, common weapons and environmental deaths, with military-style Nexar officer messages. Missing NPC causes can use recent observed contacts or an unambiguous cached attack family. Single-attack profiles also use their attack lines for nonempty unrecognized causes, including Nexar Blades, Stealth Bombers, Xhersix and Yhgvis. Ambiguous attacks use general enemy flavor. Local self-suicide reports after a recent matching wall collision display as Death Line deaths in chat and the popup. These are presentation estimates, not changes to server damage or death attribution.',
      ) +
      this.item(
        'Emperor map and radar markers',
        'Xhersix, Yhgvis and Zharix now use the existing miniboss markers on the map and radar, including ship miniatures. Each Emperor replaces its ordinary enemy blip rather than adding a duplicate.',
      ) +
      this.item(
        'Zoomed-out visibility',
        'Fixed boss structures and landing stations disappearing while still in view when zoomed out. Visibility now follows the displayed camera scale and viewport, including zoom transitions and window resizing.',
      ) +
      this.item(
        'Recycle Generator sorting',
        'Added Recycle Generator beside Omni Enhancer in the artifact stat-type selector, sorting by highest recycle bonus first.',
      ) +
      this.item(
        'Off-screen shield suppression',
        'Received regeneration-blocking debuffs now apply even when an enemy is off-screen, preventing missed suppression from falsely regenerating its shields locally. Server health and shield updates remain authoritative.',
      ) +
      this.item(
        'Remembered settings tab',
        'Settings reopen on your last selected category, saved locally per account across room changes and game restarts.',
      ) +
      this.item(
        'Settings categories',
        'Settings now use a centered, bounded artifact-style window with black panels, layered gray borders and angled category buttons with a yellow selection marker. Tighter page insets, smaller slider handles and compact volume rows leave more room for controls. Graphics holds FPS, DPI and high-graphics mode; Cosmetics holds backgrounds and teleport animation; HUD holds radar, labels and number formatting; Combat holds targeting and boss warnings. Aim Assist opens directly from its own category, and Legacy chat font size is now in Chat. Existing settings and defaults are preserved.',
      ) +
      this.item(
        'Teleport timing and animation',
        "Added the account-local Cosmetics setting 'Shrink / grow teleport animation', disabled by default. After the server's channel deadline, off keeps the legacy 240 ms wait before jumping. On uses 120 ms of shrinking, the position jump, then 120 ms of growing: the same 240 ms animation window. The destination still comes from the server.",
      ) +
      this.item(
        'Music player',
        "Added public /music with 14 cached track entries, readable titles and known system associations. Uncheck the default-on 'Let the game drive the songs' checkbox for manual play, pause/resume, stop and loop; recheck it to disable manual controls and restore automatic music. Manual loops continue across death and room changes, and closing the player does not stop playback.",
      ) +
      this.item(
        'Remembered music',
        'Music mode, selected track, loop and playing/paused/stopped state now persist locally per account across restarts. Playing tracks restart from the beginning; paused/stopped tracks stay silent until resumed. Room changes do not reload manual playback, and unavailable saved tracks safely fall back to automatic music. Existing music volume remains unchanged.',
      ) +
      this.item(
        'Xhersix torpedo refinements',
        'Aligned Emperor Xhersix torpedo drawing and warning circles to the estimated server clock, removing extra frame prediction. Local contact checks compare short, same-time movement segments and no longer test historical spawn catch-up against current players. Damage and death remain server-controlled. A default-on Combat setting applies this correction to newly spawned torpedoes; disable it for legacy positioning.',
      ) +
      this.item(
        'Torpedo diagnostics',
        'Added opt-in /torpdbg recording: purple is a client projection of a server snapshot, not an actual server correction; white shows the drawn position. Labels follow each frame. Captures include raw headings, draw timestamps, aligned contact estimates and recent 33 ms history. History export is queued in small batches outside collision callbacks. Fatal packets are recorded before cleanup and automatically saved locally. Projections and nearby-hit candidates are estimates, not authoritative hit attribution.',
      ) +
      this.item(
        'Torpedo spawn timings',
        'Added /torptiming to compare Xhersix volley timestamps and packet-arrival intervals from a fresh zero point, highlighting cadence changes and arrival jitter without the full debug recorder.',
      ) +
      this.item(
        'Torpedo rhythm rings',
        'Added default-on rhythm rings around Xhersix: red contracts over 2.5 seconds, then yellow pulses outward. Fresh volleys realign drift of 50 ms or more, ignoring smaller drift without restarting the current yellow pulse. Rings follow the boss each frame and reset on server-reported target changes or more than 3 seconds without a fresh volley. Controlled in Combat settings; visual rhythm only, with actual torpedoes and hits unchanged.',
      ) +
      this.item(
        'Release accent',
        '/echo and compatibility echo replies now use a golden accent for v1.0.91.',
      )
    );
  }
  private version90Content(): string {
    return (
      this.title("What's new in QoLAF v1.0.90") +
      this.item(
        'Xhersix torpedo positioning',
        'Fixed arrival/position corrections causing torpedoes to visually lag behind their server-timed path. Warning circles now follow the corrected position too. A default-on General toggle lets you keep the old positioning if preferred.',
      ) +
      this.item(
        'Release accent',
        '/echo and compatibility echo replies use a commemorative magenta accent for v1.0.90.',
      )
    );
  }
  private version89Content(): string {
    return (
      this.title("What's new in QoLAF v1.0.89") +
      this.item(
        'Artifact favorites',
        'Right-click an artifact to favorite or unfavorite it. Favorites have a gold outline and are saved locally per account, without changing artifact sets or sorting. They cannot be selected for recycling and are skipped by Select Max and Purify. Unfavorite an artifact first to recycle it.',
      ) +
      this.item(
        'Important Nexar labels',
        'Nexar bosses and minibosses, including Nexar Commander and the Emperors, can show overhead faction badges, names, and compact shield/health bars with values. The bars show numbers without redundant S/HP prefixes. Ordinary elite ships stay uncluttered. Separate General toggles control each element.',
      ) +
      this.item(
        'Messenger chat formatting',
        'Messages from the verified TheMessenger account now display Discord relays with a vivid purple [discord] tag and announcements in softer magenta in both chat views. These formatted messages omit the redundant [global] label. This is local presentation only; outgoing Global chat remains sanitized.',
      ) +
      this.item(
        'Smarter chat filtering',
        'Common swear words and their usual variants are no longer censored. Remaining entries match whole words or phrases in the visible text instead of parts of ordinary words, with Unicode-aware boundaries and preserved formatting, spacing, emoji, and artifact links.',
      ) +
      this.item(
        'Remembered chat tab',
        'The new chat remembers its selected channel locally per account across room changes and restarts, including the recipient of a private-message tab. Sending to Global no longer switches the new chat back to Local.',
      ) +
      this.item(
        'Spawn-location markers',
        'The world and system map now mark known boss and hidden miniboss spawn locations and areas. Boss spawn markers hide while their boss is alive. Physical-spawner minibosses use a subtle heatmap of potential spawn areas instead of individual pins, with stronger shading where areas overlap. Markers and heatmap have separate General toggles.',
      ) +
      this.item(
        'Combat warnings',
        'Emperor Xhersix torpedoes now have collision-sized red circles with a faint fill and stronger border, enabled by default. An optional countdown above ??? (Nether Blob) resets on each observed beam using its weapon reload time. Both warnings can be toggled in General settings.',
      ) +
      this.item(
        'Visible Nether attacks',
        'Fixed enemy instant attacks disappearing because of stale range data or network catch-up consuming their brief lifetime. Blob tentacles now keep an independent 350 ms player-style flash even when their projectile is removed before the first frame. Nether beams use the Chrono Beam appearance. Actual ranges and combat timing stay unchanged; ray visibility also accounts for the viewport and zoom.',
      ) +
      this.item(
        'Cloaked enemy appearance',
        'Revealed cloaked enemies now render at half opacity, with their overhead names, faction labels, icons and bars following the same fade.',
      ) +
      this.item(
        'Smoother attached effects',
        'Ship and missile exhaust now follow rendered movement every frame. Instant weapon traces and attached projectile effects also update between simulation ticks, without changing combat or network timing.',
      ) +
      this.item(
        'Compact radar telemetry',
        'Four optional lines above the radar show measured frame rate, latency, estimated five-second personal direct-hit DPS, and current speed, with extra space between the text and radar. DPS is marked with ~ because server damage updates do not identify the attacker; damage-over-time and server-only modifiers are not included, and incomplete weapon coverage is marked partial. Each line starts enabled and has its own General setting; speed can be displayed in km/h or mph with a ten-times display scale.',
      ) +
      this.item(
        'Music playback',
        'Fixed overlapping music after room changes, delayed loads, and repeated playback requests. Stopped tracks cannot restart from stale callbacks, and adjusting the music volume no longer restarts the playlist.',
      ) +
      this.privateHistory(
        this.item(
          'Instant automation recycling',
          'Automations can now complete safe portable recycling in the background and leave the recycler immediately, without waiting for its visual animation.',
        ),
      )
    );
  }
  private version88Content(): string {
    return (
      this.privateHistory(
        this.item(
          'Stable automation room changes',
          'Installed automation SWFs now keep their Loader and child application domain for the whole client session instead of unloading and rereading every file on each room change. Running modules are stopped, disposed, and stripped of their old room runtime during the handoff; the next room creates a fresh script instance and event bus against its new Game, with every module left stopped. Removing a module and /upstream remain full unload boundaries.',
        ),
      ) +
      this.item(
        'Clean room handoffs',
        'Room exit now rejects late game messages, unregisters outstanding one-shot service callbacks, releases settings and star-map references, and clears the global Game pointer during the asynchronous join gap. Responses from the next room can no longer wake callbacks owned by the disposed one.',
      ) +
      this.item(
        'Resilient room snapshots',
        'A player caught between ship and landed-body states in the initial room snapshot now remains a shipless placeholder until a complete roaming update arrives. The client no longer assigns a null course to a pooled ship and breaks PlayerIO message dispatch while changing rooms.',
      ) +
      this.item(
        'Smooth attached combat text',
        "Damage and healing values attached to moving targets now follow only the target's interpolated render delta every frame instead of stepping with the 33 ms simulation tick. Their own rise remains smooth, and the original offsets, aggregation, lifetime, and pooling behavior are unchanged.",
      )
    );
  }
  private version87Content(): string {
    return (
      this.item(
        'Artifact links',
        'Right-click a revealed cargo or equipped artifact and choose Share on Chat to insert a compact, artifact-colored link at the composer caret. Both chat views resolve its name through a cached, ownership-checked lookup; opening Advanced chat and hovering it shows the color-coded name, owner and player level, artifact level, strength, fitness, upgrades, icon, and modifiers. The wire token stays intact through editing and copying, and a one-time hint explains the hover interaction.',
      ) +
      this.item(
        'Space backdrop controls',
        'Nebula opacity and star brightness now have separate sliders, and stars remain visible when the nebula background is disabled.',
      ) +
      this.item(
        'Friendlier command entry',
        'Player-targeting commands now accept @player names from chat completion. Successfully submitted commands share the normal Up/Down message history, including consecutive recalled slash commands without autocomplete stealing the navigation keys.',
      ) +
      this.item(
        'Safe-zone instance switching',
        "Added /switchinstance &lt;pve|pvp|ci&gt; to move between the current system's PvE, PvP, and clan instances while inside an active warp-gate safe zone.",
      )
    );
  }
  private version86Content(): string {
    return (
      this.item(
        'Daily Reward layout',
        'Restored the natural spacing between reward cards after the bitmap-font conversion. Day labels stay on one line below their cards, while Flux and pod amounts are centered beside their icons instead of overlapping them.',
      ) +
      this.item(
        'Fleet slot interaction',
        'Empty unlocked weapon, artifact, and crew slots retain their complete frame and clickable area, so an item can be placed into them normally.',
      ) +
      this.item(
        'Chat completion navigation',
        'Long command, emoji, and friend result lists now reach their true first and last rows with either the mouse wheel or draggable mini scrollbar, without snapping back to the keyboard selection.',
      ) +
      this.item(
        'Emoji shortcodes',
        'Typing a colon at a word boundary opens searchable emoji suggestions backed by Unicode CLDR English short names and keywords. Keep typing to filter, choose with the mouse or Up/Down, then type the closing colon or press Tab to replace the shortcode with the selected emoji. Canonical names and familiar thumbsup, +1, thumbsdown, and -1 aliases are supported.',
      ) +
      this.item(
        'Chat emoji sizing',
        'Emoji render at the surrounding text size in Simple chat, Advanced chat, and the integrated composer, with matching line, wrap, caret, and input-height measurements.',
      ) +
      this.item(
        'Friend pings',
        'Typing @ opens searchable online-friend suggestions with miniature painted current-ship previews and consistent Online, full Level, and persistent player-ID details; overflowing metadata ends in an ellipsis and raw clan keys stay hidden. Recognized pings render blue; hovering one in Advanced chat shows its painted ship and player details, while an incoming ping of your own name plays a notification at the current effects volume. Sending /w player with no message now sends @player so the recipient is pinged automatically.',
      ) +
      this.item(
        'Message actions',
        'Right-clicking an Advanced-chat message now opens a compact menu to copy its visible text, block its sender, or copy the available persistent player ID, clan name, and clan ID. Transport/session keys remain internal. Ordinary left clicks no longer open the old action strip.',
      ) +
      this.item(
        'Portable all-ships hangar',
        'Added /hangar for browsing the DB-backed player-ship catalog from roaming or a real landed screen. Valid store entries retain the normal server-authoritative purchase path, while catalog-only entries remain previewable.',
      ) +
      this.item(
        'World-name readability',
        'Remote player and clan names now use genuinely solid full-opacity blending in the world for clearer identification, while level, role, and status labels retain their softer presentation.',
      )
    );
  }
  private version85Content(): string {
    return (
      this.item(
        'Shared bitmap-font UI',
        'Non-editable interface text keeps its original Verdana or Russo One typeface while using reusable bitmap atlases instead of per-label TrueType textures. Fixed Russo UI selects a non-mipmapped bilinear 8, 16, 24, 32, 48, or 56px atlas by rendered size, while camera-scaled combat text keeps its separate mipmapped 64px atlas with trilinear filtering. Ordinary fixed Verdana UI selects an emoji-free 8, 16, 24, or 32px atlas; the rich 48px Verdana/Noto atlas remains dedicated to chat and direct HTML/emoji surfaces. Remaining display labels no longer bypass the shared primary-font selectors, while native editable fields remain native.',
      ) +
      this.item(
        'Target-label readability',
        'Active and nearby target levels size to their rendered text, with explicit spacing after the lock icon and between the level and name. Long names end with an ellipsis instead of scrolling, while rare-aura glows may feather outside the name viewport without being clipped.',
      ) +
      this.item(
        'Interface reliability',
        "Fixed Enter occasionally becoming unable to reopen the integrated chat when a native editor swallowed its key press or release, or after a window focus change. Bitmap tooltips and other auto-sized labels now fit their content again instead of inheriting Advanced chat's fixed wrapping width.",
      ) +
      this.item(
        'Reload and changelog reliability',
        "Upstream client teardown now treats every cleanup step as best-effort and explicitly detaches terminal input listeners, so an already-disposed resource cannot leave an old Enter handler behind during replacement. The release archive is split into bounded pages so its bitmap text stays within Starling's per-mesh vertex limit.",
      ) +
      this.item(
        'Long-fight combat stability',
        'Terminal turret removal and room teardown now release Beam lines, pinned endpoint emitters, weapons, and private batches. Damage, healing, and kamikaze flashes use direct mesh effects instead of repeatedly creating and purging cached filter render targets, reducing resource churn during extended fights.',
      ) +
      this.item(
        'Hangar resource stability',
        'Hangar and Fleet tech-level labels now share a reusable bitmap-font atlas instead of allocating a separate TrueType texture for every label. Partially constructed previews, their tooltips, and owned UI resources are released deterministically, preventing Context3D resource-limit error #3691.',
      ) +
      this.item(
        'Canonical echo accent',
        "Local /echo output and compatibility echo replies now use QoLAF's canonical cyan theme color.",
      )
    );
  }
  private version84Content(): string {
    return (
      this.item(
        'Integrated Advanced chat',
        'Pressing Enter opens the 555 by 450 Advanced chat on roaming, landed, Settings, and other in-game pages except Artifacts, and immediately seeks its newest message without flashing the top of history. Its translucent charcoal bitmap-font composer stays synchronized with chat visibility. The default-on Chat setting adds styled channel tabs, a blackish scrollbar, command and usage suggestions after typing /, Tab completion, message history on Up/Down, clipboard shortcuts, and Escape-to-close. Clicking outside the editor restores page or ship controls while keeping the composer open, Enter focuses it again, and closing Advanced closes it too; disabling the setting restores the legacy floating composer.',
      ) +
      this.item(
        'Rich message composer',
        'The bitmap composer shows parsed rich text instead of raw tags. Copy and Paste are available directly in the editor and its right-click menu. Color and Size buttons beside the emoji picker apply to the selected text, or the whole message when nothing is selected; live RGB sliders, a manual hex field, and a 12-48px size slider provide a live preview below the input. Unfinished, unbalanced, malformed, or unsupported formatting tags cannot be sent.',
      ) +
      this.item(
        'Safe Global messages',
        'Rich-format controls are disabled for Global chat, and all outbound Global text has HTML tags and malformed angle-bracket remnants stripped again at the final send boundary, keeping pasted and programmatically inserted text away from ChatDaemon formatting enforcement.',
      ) +
      this.item(
        'Smoother rich chat',
        'Simple chat now reuses one text display, while the larger 555 by 450 Advanced chat virtualizes its full 300-message history. Both views render color and size markup with reusable batched Verdana bitmap glyphs, batch display updates during bursts, and coalesce repeated filtering and scroll work to avoid long-message stutters.',
      ) +
      this.item(
        'Legacy chat size',
        'Added a live 12-24px Legacy chat font-size slider under General settings, defaulting to 14px for Simple chat, Advanced chat, and their bitmap-font composers.',
      ) +
      this.item(
        'Fast color emoji',
        'Chat now renders 1,391 stand-alone Noto Color Emoji glyphs from the same reusable bitmap atlas as Verdana, preserving full color and bitmap performance without runtime TrueType rasterization. The compact picker exposes them through eight paged categories with a small draggable scrollbar and mouse-wheel scrolling. Skin-tone, flag, keycap, and ZWJ sequences are not included.',
      ) +
      this.item(
        'Supporter badge',
        'Supporter chat names now use the full-color star emoji with clean spacing before the player name.',
      ) +
      this.item(
        'Death teleport command',
        'Added /tptodeath to request the existing server-side last-death teleport immediately, without a client-side death-history check or confirmation.',
      ) +
      this.item(
        'Chat stress test',
        "Added /testchatspeed, which locally writes 300 progressively wider messages over five seconds without sending network chat, profiles the active view's queue, rendering, validation, scrolling, and frame intervals, and saves a per-view CSV in Documents. Run it once in Simple and once in Advanced to compare them.",
      )
    );
  }
  private version83Content(): string {
    return (
      this.item(
        'Text disposal fix',
        'Fixed a text disposal bug that could cause freezes over time.',
      ) +
      this.item(
        'Floating combat text',
        'The shared floating-text pool now holds 80 labels for crowded loot and combat scenes. Damage and healing values retain their original font and timing, follow the affected unit, and stay within 120 map units above it.',
      ) +
      this.item(
        'Independent target values',
        'Compact k/M/B/T formatting for target health and shield bars now has its own setting and starts disabled, independently from the player HUD health and shield option.',
      ) +
      this.item(
        'Clan identity',
        'Clan member ships keep their correct proportions in the clan overview. Remote ships show a clan-colored icon, clan name, and member role above the player nameplate by default, with a new General setting to hide them.',
      ) +
      this.item(
        'Map miniature readability',
        "Raised miniboss miniatures from 0.2 to 0.25, retained regular bosses at 0.1 with smooth hostile-red outlines, and balanced Advectorian's unusually large multipart miniature at 0.075 so it remains readable without overwhelming the radar and open system map.",
      )
    );
  }
  private version82Content(): string {
    return (
      this.item(
        'Fast Elite Tech preparation',
        "The upgrade screen can now purchase a selected tech's remaining normal levels in one automatic sequence until Elite Tech unlocks. Each level is still confirmed by the server, the sequence stops cleanly if a requirement or resource is missing, and cargo refreshes only once when the sequence finishes.",
      ) +
      this.privateHistory(
        this.item(
          'Structured automation commands',
          'Automations can register documented /namespace:command handlers with required and optional arguments. The first registrant receives the bare /command alias, registered commands appear automatically in /help and /chelp, and callbacks are removed safely when their module unloads. Legacy /script dispatch remains available for older modules.',
        ),
      ) +
      this.item(
        'Simple account passwords',
        'Saved Simple-account profiles and the Add/Login form now accept any non-empty password up to the existing safety limit, including legacy passwords shorter than four characters. Kongregate and Armor credential rules are unchanged.',
      )
    );
  }
  private version81Content(): string {
    return (
      this.item(
        'Prepared world reveal',
        'The rotating loading logo now remains above the game scene until enemy synchronization and the active state are ready, the solar-system background has settled, and one complete populated-world frame has been prepared. It then fades over the prepared scene while gameplay input stays blocked, eliminating the empty-background flash on fast joins without hiding later room-error dialogs.',
      ) +
      this.item(
        'Reliable system warps',
        'System changes now scan the destination room and warm its background during the warp animation while keeping the current room alive, then release it immediately before the sole destination connection. Stale room callbacks are ignored, failed room scans return safely to roaming, and stalled optional backgrounds or interrupted loading-screen fades can no longer leave the game locked behind the rotating logo.',
      ) +
      this.item(
        'Smoother warp handoff',
        'Old-world teardown now begins only after a static opaque cover has reached the screen, then the rotating loading logo starts after cleanup instead of freezing through it. Animation and emitter cleanup use single room-wide passes, and warp flight keeps the ship at its normal proportions while moving at full speed.',
      ) +
      this.item(
        'Smoother movement reconciliation',
        "Late local course packets now inherit the final predicted throttle and steering state, then use a capped velocity correction instead of snapping at ordinary movement-sized disagreements. Local boost prediction now matches the server's accelerate-without-brake state. Acceleration and braking transitions are serialized across simulation ticks, and an explicit post-boost throttle boundary is sent even when held input is unchanged, preventing both brake corrections and repeated-boost forward jumps. Remote ships retain their original authoritative snap threshold, explicit course replacements still apply immediately, and only very large local errors trigger an emergency snap.",
      ) +
      this.item(
        'Distortion maintenance',
        'Nexar and Shadow bomb shockwaves, sun heat haze, and black-hole distortion are temporarily disabled while the shared renderer undergoes maintenance. The existing preference is preserved, and its grayed setting remains locked until the effects return.',
      ) +
      this.item(
        'Faster background readiness',
        'Solar-system backgrounds reuse the two most recent atlases from a bounded session cache, coalesce equivalent requests, serialize different texture batches safely, and finish through direct readiness callbacks instead of 300 ms polling. Failed, malformed, duplicated, or stalled texture pairs now settle cleanly instead of poisoning later loads or waiting indefinitely.',
      ) +
      this.item(
        'Faster room entry',
        'Returning players begin the room connection before login-theme teardown, room initialization overlaps the remaining clock samples, and final enemy synchronization overlaps HUD construction. The loading interval is no longer replayed as a burst of simulation ticks on the first frame, while repeated room loads skip unchanged display reconfiguration and redundant settings-disk flushes.',
      ) +
      this.item(
        'Instant system refresh',
        'Both /ref and its new /refresh alias now reconnect to the current game room immediately, removing the previous half-second client-side pause without restarting QoLAF.',
      ) +
      this.item(
        'Faster system construction',
        'Embedded data uses native parsing and reusable lookup indexes instead of repeatedly scanning complete body, spawner, and synchronization tables. Animation-frame lookups are cached per atlas and prefix, duplicate turret registrations and empty weapon draw calls are removed, generated zone textures are reused, and nonvisual body anchors, mission hints, unit mini-bars, damage-flash filters, glow helpers, and distortion scratch data avoid unnecessary eager or repeated allocations.',
      ) +
      this.item(
        'Lighter background traffic',
        'Concurrent Flux refreshes now coalesce into one request, loading-screen promotion data is fetched only once, critical room initialization is queued before cosmetic sales traffic, and reused loading tips no longer compound their animation timing or leave stale timers and sounds behind.',
      ) +
      this.item(
        'True radar rim',
        "Boss and miniboss miniatures now reach and clip cleanly at the radar's real circular rim. Visibility and fading follow target distance instead of being pulled inward by oversized boss radii, transparent texture margins, or glow padding.",
      )
    );
  }
  private version80Content(): string {
    return (
      this.item(
        'Login profiles',
        'The login screen now opens with a saved-profile chooser. Saved credentials from QoLAF 79 and older are imported once and identified as Simple, Kongregate, or Armor accounts. Add, edit, remove, or launch those profiles; the available current-session Steam profile is pinned and cannot be edited or removed. The add flow now has a provider selector, a dedicated Add action, provider badges, and a separate Create new simple account option.',
      ) +
      this.item(
        'Credential validation',
        'Simple e-mail format and provider-specific User ID/Auth Token lengths are validated live while editing. The Add button remains disabled until the selected account type is valid; Kongregate tokens require 64 characters, while Armor IDs and tokens require 32.',
      ) +
      this.item(
        'Profile privacy',
        'The private part before @ in saved Simple e-mail addresses and the full Kongregate/Armor user IDs are blurred, revealing on hover while Simple domains stay readable. Rows show the cached authoritative player name after a successful login, or Uncached player name until then; Steam keeps its current-session identity and cached game name on separate lines.',
      ) +
      this.item(
        'Automatic login and Steam',
        'Optional last-profile auto-login uses a three-second countdown without flashing the chooser and can be cancelled with CTRL. A persistent Steam-integration toggle enables Steam services for saved profiles and disables the pinned Steam profile when switched off.',
      ) +
      this.item(
        'Upstream refetch',
        'When running through QoLAF Thin Wrapper, the login screen now shows an UPSTREAM button above EXIT to recheck upstream and reload the active client.',
      ) +
      this.item(
        'Faster image loading',
        "GameFS texture metadata and atlases now load concurrently from Player.IO's existing disk/CDN cache instead of waiting for all eight files serially, while updated GameFS URLs retain automatic cache invalidation.",
      ) +
      this.item(
        'Faster world loading',
        'Texture loading now runs in parallel with service-room discovery and the initial game-room scan, with both activities shown on the loading panel. The initial solar-system and game-state requests share the ordered game-room handshake instead of waiting for an extra client/server round trip behind the rotating loading logo. Clock calibration uses a five-measurement ordered burst instead of sequential round trips, while regular in-game refreshes use one request every 25 seconds. Fixed post-load fades and service-room selection pauses no longer hold up entry; new accounts select a usable room from actual preview readiness instead of a two-second timer.',
      ) +
      this.item(
        'Larger miniboss miniatures',
        "Miniboss textures on the radar and open system map now render at 0.2 scale for better recognition. Multipart bosses remain at 0.1 scale, and radar fading and edge clamping account for each miniature's real transformed radius.",
      ) +
      this.item(
        'Target-panel readability',
        'Active- and nearby-target names use more of the health-bar width with tighter level spacing. Long names roll discretely one character at a time while preserving adjacent controls and distance text.',
      ) +
      this.item(
        'Compact target values',
        'Active-target health and shield bars now follow the compact-value setting in normal and multibar modes. The shared formatter now supports trillion values without displaying a rounded 1000B.',
      ) +
      this.item(
        'Release accent',
        'QoLAF compatibility echoes use a commemorative magenta accent for the 1.0.80 release.',
      )
    );
  }
  private version79Content(): string {
    return (
      this.item(
        'Per-weapon colors',
        "Added /sv weapon-color with RGB sliders, exact numeric inputs, a live preview, and optional grayscale-first tinting for the currently selected weapon. /sv weapon-color reset restores that weapon's normal ownership; the client-developer weapon rainbow always uses grayscale source textures.",
      ) +
      this.item(
        'Visual synchronization v3',
        'QoLAF 79 peers now synchronize per-weapon colors and grayscale choices through /ssv v3. Clients 69-78 continue receiving the unchanged v2 extended packet, while clients 61-68 retain the original legacy packet.',
      ) +
      this.item(
        'Particle capacity',
        'High-quality emitters can now retain up to three times the original particle count, with proportional safety thresholds and unchanged low-quality fallbacks.',
      ) +
      this.item(
        'Painted ship animations',
        'Animated ships with custom paint colors now resume their animation correctly after damage and healing flashes.',
      ) +
      this.item(
        'Rarity aura smoothing',
        'Scaled ship-shaped rarity auras now use an adaptive smoothing pass to reduce visible source pixels while respecting constrained Stage3D texture-read limits.',
      ) +
      this.item(
        'Artifact setup controls',
        'Inactive artifact setups now use compact numeric buttons while the selected setup retains its full name. Overflowing setup rows gain a small horizontal scrollbar.',
      ) +
      this.item(
        'Artifact adequacy',
        'Artifacts now show how closely their modifier families match the currently equipped setup. The expanded inventory explains the metric and provides high/low adequacy sorting alongside the existing sort controls.',
      ) +
      this.item(
        'Persistent inactivity protection',
        'The /dontkick preference is now persistent and available in the QoLAF General settings.' +
          this.privateHistory(
            ' Automations can request temporary inactivity protection without changing the saved user preference, and those requests are cleared safely when the automation stops.',
          ),
      ) +
      this.item(
        'Frame-smooth animations',
        'Boss-mounted turrets, components, and spawners now render from one interpolated parent transform instead of stepping on 33 ms simulation ticks. Player landing tweens render directly at the display frame rate, and boss teleports now move the boss and its parts atomically without a stray intermediate position.',
      ) +
      this.item(
        'Live map miniatures',
        'The radar and open system map show minibosses as frame-updated 0.1-scale copies of their real ship texture with a white or hostile-red outline. Miniatures use localized 2x supersampling, multipart bosses include available destroyed-part textures, newly spawned bosses appear while the map is already open, and radar fading uses the true radial size of every transformed part without inflating circular bosses through rectangular bounds.',
      ) +
      this.item(
        'Target panel names',
        'Long nearby-target names stay inside their own clipped column without covering the distance. Nezerian Regius uses the compact Exterminatore label.',
      ) +
      this.item(
        'World marker stability',
        'Player markers use authoritative world coordinates, pooled boss and miniboss miniatures retire with their owner lifecycle, and off-screen ships keep exposing their live Heading transform instead of jumping radar and system-map markers to world origin.',
      ) +
      this.item(
        'Emitter lifecycle',
        'Attached effects remember the lifecycle of their target, stop before recycled objects can inherit them, and continue following the live transform of ships culled from the world canvas instead of jumping to world origin.',
      ) +
      this.item(
        'Exploration map generation',
        "Fixed exploration-map generation getting stuck on some Durian-system planets. Invalid shell searches now retry across frames with a Calculating exploration map status instead of freezing until Flash's script timeout.",
      )
    );
  }
  private version78Content(): string {
    return this.item(
      'Password autofill',
      'The login screen now remembers the last submitted password locally and fills it automatically on the next launch.',
    );
  }
  private version77Content(): string {
    return (
      this.item(
        'Artifact sorting',
        'Unrevealed relics now participate in artifact sorting within their own group instead of all comparing as equal.',
      ) +
      this.item(
        'Artifact guidance',
        'The expanded artifact inventory now shows the optimal drop level for the current player level, capped at 150 (Max).',
      ) +
      this.item(
        'Mine targeting',
        'Player-owned mine explosions now register their nearest simulated blast hit for automatic active-target selection.',
      ) +
      this.item(
        'Simple chat',
        'Moved the compact chat feed to a variable-height list renderer so multiline messages keep their intended layout.',
      ) +
      this.privateHistory(
        this.item(
          'Automation chat control',
          'Automations that own ship controls now keep steering and sending commands while the chat input is open; physical gameplay keys remain suppressed while typing.',
        ),
      ) +
      this.item(
        'Packet diagnostics',
        'Added /pktdbg with a movable, resizable and filterable RX/TX packet inspector. /headingdbg preserves received snapshots while displaying the live local course and active correction target, correction vectors, input state, reconciliation result, course-state echo latency, and packet age.',
      ) +
      this.item(
        'Throttle synchronization',
        'Rapid accelerate and deaccelerate changes now share their actual fixed-step timestamp and replay together instead of being serialized across extra simulation ticks.',
      ) +
      this.item(
        'Course reconciliation',
        'Delayed self headings retain the latest locally predicted state of every movement axis and accept changed equal-timestamp server revisions. Hard corrections preserve current throttle and steering, while teleports and course replacements reset replay history safely.',
      ) +
      this.item(
        'Death-line collision',
        'Swept death-line collision now constrains local prediction and its reconciliation replay without rejecting authoritative positions. Ships corrected inside a boundary can move strictly outward on the same side, but cannot accelerate along or through the line.',
      )
    );
  }
  private version76Content(): string {
    return (
      this.privateHistory(
        this.item(
          'Automation steering',
          "Added exclusive control ownership and an automation aim-angle API. A running module can steer through PlayState's normal turn controller while other modules, mouse input, and Aim Assist remain safely excluded.",
        ),
      ) +
      this.privateHistory(
        this.item(
          'Automation development',
          'Expanded the public/private client SWC build flow and documented module roots, metadata, lifecycle events, commands, background rendering, cleanup, control ownership, and aiming in /chelp.',
        ),
      ) +
      this.item(
        'Client error visibility',
        'Uncaught client failures are contained and shown as short red chat messages, with repeated copies throttled.' +
          this.privateHistory(
            ' Automation failures remain isolated to their module and are reported in chat with their lifecycle stage.',
          ),
      ) +
      this.item(
        'World mouse input',
        'Clicking a target or another gameplay-canvas object no longer consumes Mouse 1, so normal firing and steering input can continue through world interactions.',
      ) +
      this.item(
        'Turret synchronization',
        'Stopped recurring server snapshots from briefly fighting the local turret controller, and kept fixed-angle boss components such as blades rigidly attached to their intended angle.',
      ) +
      this.item(
        'Effect lifecycle',
        'Prevented rare-enemy auras and hardened-shield effects from accumulating duplicate emitters across damage, cloak, visibility, removal, and object reuse.',
      )
    );
  }
  private version75Content(): string {
    return (
      this.privateHistory(
        this.item(
          'Background diagnostics',
          'Automations can opt into render events while stopped, allowing module-owned diagnostics to stay visible without changing lifecycle behavior for other modules.',
        ),
      ) +
      this.privateHistory(
        this.item(
          'Automation disposal',
          'Added a dispose event so automations can reliably detach native overlays and external resources when removed or when the client shuts down.',
        ),
      )
    );
  }
  private version74Content(): string {
    return (
      this.privateHistory(
        this.item(
          'Automation commands',
          'Extended /script so chat can dispatch named commands and arguments to installed automations while retaining its status-only form.',
        ),
      ) +
      this.privateHistory(
        this.item(
          'Automation command API',
          'Added the command lifecycle event, immutable command arguments, and explicit handled acknowledgement for module-owned command handlers.',
        ),
      )
    );
  }
  private version73Content(): string {
    return (
      this.item(
        'Aim Assist',
        'Added an opt-in steering assist for eligible hostile NPCs. It supports both mouse aim and keyboard steering, predicts projectile lead, includes smart projectile guns, and is explicitly disabled against player-controlled ships.',
      ) +
      this.item(
        'Acquisition and tracking',
        'The assist follows locally simulated weapon hits, player intent, distance and angle limits. Move the mouse slowly toward a valid target or press the turn key toward it to acquire; optional locked-target pinning and stationary tracking can keep following the same target.',
      ) +
      this.item(
        'Aim Assist settings',
        'Added a dedicated QoLAF settings page with enable, lead, tracking, locking, target-validation and diagnostics toggles plus detailed acquisition, correction, hysteresis, timing and lead sliders. Aim Assist remains disabled by default.',
      ) +
      this.item(
        'Steering stability',
        'Added fixed-turn-step settle/restart hysteresis to prevent stationary tracking from alternating left and right around the desired angle while preserving manual override behavior.',
      ) +
      this.item(
        'Aim diagnostics',
        'Added /aimdebug and /aimassistdebug with input, target, hit, lead, correction and turn rays. The native debug display is now a single owned overlay and removes duplicate instances across state changes.',
      ) +
      this.item(
        'Nearby enemy radar',
        'Added a 0-10 nearby-enemy-row setting and kept the active target panel pinned to its configured position while rows are added, removed or collapsed.',
      ) +
      this.item(
        'Artifact interface',
        'Rethemed the expanded artifact overview with a black translucent background and refined its fullscreen layout, panel spacing, sorting controls and classic-view behavior.',
      ) +
      this.item(
        'Safe zones',
        'Stopped all held weapon fire on safe-zone entry and rejected new fire-on commands for as long as the player remains protected.',
      ) +
      this.item(
        'Target readability',
        'Kept nearby unit names white while coloring only their levels, added matching rare-aura glows to active and nearby names, corrected text and no-target alignment, and matched the clipped damage feather to the current bar-layer color.',
      ) +
      this.item(
        'Aura reference',
        'Added a ? control for rare active targets with the exact blue, red, orange, green and gold aura bonuses. Aura and debuff descriptions now use native cursor tooltips with corrected dynamic height and QoLAF font rendering.',
      ) +
      this.item(
        'Aura rendering',
        'Preserved the vanilla rarity-emitter size, opacity, timing and pulse while converting the source ship texture to grayscale before tinting, preventing hull colors from poisoning the intended aura color.',
      ) +
      this.item(
        'Ship aura polish',
        'Changed /sv rainbow to one hue-cycling layer only 12% larger than red and restored synchronized local or remote player auras after teleport cleanup. Multipart auras remain applied to every visual component.',
      ) +
      this.item(
        'Client reload',
        'Added /restart as an alias for /upstream when reloading QoLAF through the Thin Wrapper.',
      ) +
      this.item(
        'Settings and help',
        'Aligned popup and QoLAF tab buttons, moved the QoLAF sub-tabs below the main Settings menu and Close button, and expanded /chelp with a complete Aim Assist guide.',
      )
    );
  }
  private recentReleasesContent(): string {
    return (
      this.title('QoLAF recent releases') +
      this.heading('v1.0.88') +
      this.version88Content() +
      '<br>' +
      this.heading('v1.0.87') +
      this.version87Content() +
      '<br>' +
      this.heading('v1.0.86') +
      this.version86Content() +
      '<br>' +
      this.heading('v1.0.85') +
      this.version85Content() +
      '<br>' +
      this.heading('v1.0.84') +
      this.version84Content() +
      '<br>' +
      this.heading('v1.0.83') +
      this.version83Content() +
      '<br>' +
      this.heading('v1.0.82') +
      this.version82Content() +
      '<br>' +
      this.heading('v1.0.81') +
      this.version81Content() +
      '<br>' +
      this.heading('v1.0.80') +
      this.version80Content()
    );
  }
  private olderReleasesContent(): string {
    return (
      this.title('QoLAF older releases') +
      this.heading('v1.0.79') +
      this.version79Content() +
      '<br>' +
      this.heading('v1.0.78') +
      this.version78Content() +
      '<br>' +
      this.heading('v1.0.77') +
      this.version77Content() +
      '<br>' +
      this.heading('v1.0.76') +
      this.version76Content() +
      this.privateHistory('<br>' + this.heading('v1.0.75') + this.version75Content()) +
      this.privateHistory('<br>' + this.heading('v1.0.74') + this.version74Content()) +
      '<br>' +
      this.heading('v1.0.73') +
      this.version73Content() +
      this.privateHistory(
        '<br>' +
          this.heading('v1.0.72') +
          this.releaseItem(
            'Automation filesystem',
            'Scoped automation storage and file importing to runtimes that provide AIR filesystem APIs. Legacy Flash projectors skip automation initialization, lifecycle hooks, storage access, and related settings/help UI.',
          ),
      ) +
      '<br>' +
      this.heading('v1.0.71') +
      this.releaseItem(
        'Ship visuals',
        'Added spawners and complete multipart bosses to /sv, including animated, layered, offset, and rotating components.',
      ) +
      this.releaseItem(
        'Ship auras',
        'Added the matching enemy blue, red, green, orange speed, golden, and rainbow auras. Multipart visuals apply the aura to every component.',
      ) +
      this.releaseItem(
        'Multipart rendering',
        'Aligned aura rotation and reflection with each rendered component and preserved the boss-specific visual offsets used to arrange multipart artwork.',
      ) +
      this.releaseItem(
        'Visual synchronization',
        'Extended /ssv with spawner, multipart, and aura data for v1.0.69+ while preserving the original packet format for v1.0.61-v1.0.68 clients.',
      ) +
      '<br>' +
      this.heading('v1.0.69') +
      this.releaseItem(
        'Auto target',
        'Now follows hits resolved by your local weapon simulation instead of unrelated nearby damage packets. Weapons owned by your ship are supported and manual target locks still take priority.',
      ) +
      this.releaseItem(
        'Target multibars',
        'Full shield and health layers now start blue and red, retain stable layer colors through damage and healing, and compact when a target only has one resource.',
      ) +
      this.releaseItem(
        'Damage trail',
        'Reworked the delayed-value tip into a softer white feather driven by the absolute value delta and clipped it to the bar bounds.',
      ) +
      this.releaseItem(
        'Artifact layout',
        'Kept the expanded artifact stats and inventory panels inside their separator and corrected their available height.',
      ) +
      '<br>' +
      this.heading('v1.0.68') +
      this.releaseItem(
        'Client updates',
        "Moved /changelog into a tabbed popup and added a once-per-version What's New prompt when entering the client.",
      ) +
      this.releaseItem(
        'Rendering',
        'Bound beam origins, endpoints, chained targets, and beam emitters to interpolated render positions so lasers stay attached while ships move and turn.',
      ) +
      this.releaseItem(
        'Skeletor Lightning',
        'Added visual aim hysteresis and brief packet-dropout retention to prevent reconnect flicker after small turns. (Mostly a fluke.)',
      ) +
      this.releaseItem(
        'Beam synchronization',
        'Prevented player snapshots from unnecessarily stopping and restarting the active beam.',
      ) +
      this.releaseItem(
        'Projectile spread',
        'Fixed certain weapons having their projectiles clumped up in a line.',
      ) +
      this.releaseItem(
        'Course controls',
        'Throttled acceleration, boost, channeling resets, and turning/mouse-aim updates to the fixed 33 ms simulation cadence.',
      ) +
      '<br>' +
      this.heading('v1.0.67 — changes since v1.0.61') +
      this.releaseItem(
        'Targeting',
        'Added click and automatic targeting, target locking, configurable range, and a nearby-target list.',
      ) +
      this.releaseItem(
        'Target UI',
        'Added movable target information, boss indicators, health/shield multibars, and detailed debuff displays and tooltips.',
      ) +
      this.privateHistory(
        this.releaseItem(
          'Automations',
          'Added importable automation scripts, lifecycle events, per-script controls, metadata, and an Automations settings page.',
        ),
      ) +
      this.releaseItem(
        'Ship visuals',
        'Expanded local visuals with alignment, emitters, shooting points, shadow and color options, and QoLAF 61+ synchronization.',
      ) +
      this.releaseItem(
        'Client tools',
        'Added Public and Private build variants plus ' +
          this.privateHistory('/script, ') +
          '/dontkick, /upstream, /changelog, and the tabbed /chelp guide.',
      ) +
      this.releaseItem(
        'Artifacts',
        'Added an expanded artifact overview with inline sorting, inventory summaries, fitness explanations, safer purification, and a classic-view toggle.',
      ) +
      this.releaseItem(
        'Synchronization',
        'Improved fixed-step simulation, interpolation, movement and projectile synchronization, recycling flow, and packet usage.',
      ) +
      this.releaseItem(
        'Mouse aim',
        'Fixed nearly all turning and forward-movement desynchronization while using mouse aim.',
      ) +
      this.releaseItem(
        'General',
        'Added persistent QoLAF settings and numerous targeting, rendering, UI, stability, and performance fixes.',
      ) +
      '<br>' +
      this.heading('v1.0.61') +
      this.bullet('Added experimental local ship visuals through /shipvisual, /ship, and /sv.') +
      this.bullet(
        'Added saved visual options and player-to-player ship-visual synchronization through /ssv.',
      ) +
      '<br>' +
      this.heading('v1.0.59') +
      this.bullet(
        'Expanded Portuguese settings, chat-filter, control, and keybind translations; added formatted-text controls.',
      ) +
      this.bullet(
        'Fixed black fleet previews for Pixi, Transmitter, T1 Winger, and Aerodeck on localized clients.',
      ) +
      '<br>' +
      this.heading('v1.0.58') +
      this.bullet(
        'Added compact k, M, and B formatting for combat, health, shield, and power values.',
      ) +
      this.bullet(
        'Improved Skeletor Lightning targeting and fixed missing or incomplete chained-lightning connections.',
      ) +
      '<br>' +
      this.heading('v1.0.57') +
      this.bullet(
        'Added experimental Android support, DPI scaling, a black-hole-effects toggle, and more precise mouse aim.',
      ) +
      this.bullet(
        'Reduced particle clutter and improved boost, movement, and high-speed death-line synchronization.',
      ) +
      this.bullet(
        'Fixed persistent beam and particle effects, boost cooldown visuals, and incorrectly displayed levels.',
      ) +
      '<br>' +
      this.heading('v1.0.56 + AFP1.2') +
      this.bullet(
        'Merged AFP1.2 features, Brazilian Portuguese localization, language selection, and expanded localized game text.',
      ) +
      this.bullet(
        'Added network statistics (/network), portable upgrades (/upg), and updated command help.',
      ) +
      this.bullet(
        'Added black-hole, star, and stealth-bomb distortion effects; improved boost and high-FPS projectile rendering.',
      ) +
      '<br>' +
      this.heading('v1.0.55') +
      this.bullet(
        'Added portable recycle (/rec), refresh (/ref), echo (/echo), artifact fitness, and artifact purification.',
      ) +
      this.bullet('Disabled enemy cloak and screen shake; reduced upgrade animation time by 85%.') +
      this.bullet(
        'Improved artifact overview, cargo, unique-crate visibility, and paint-shop test drives.',
      ) +
      this.bullet(
        'Added unlimited and adjustable FPS and background opacity with smoother high-FPS movement, bars, and rotation synchronization.',
      ) +
      this.bullet(
        'Added faster flash-free warping and an optional compact warp-gate layout; fixed settings freezes and projectile trails.',
      )
    );
  }
  private title(value: string): string {
    return "<font color='#03b1fc' size='16'>" + value + '</font><br><br>';
  }
  private privateHistory(value: string): string {
    return this.includePrivateHistory ? value : '';
  }
  private heading(value: string): string {
    return "<font color='#ffcc00' size='13'>" + value + '</font><br>';
  }
  private item(label: string, description: string): string {
    return "<font color='#ffff88'>" + label + '</font> - ' + description + '<br><br>';
  }
  private releaseItem(label: string, description: string): string {
    return "• <font color='#ffff88'>" + label + '</font> - ' + description + '<br>';
  }
  private bullet(description: string): string {
    return '• ' + description + '<br>';
  }
}
