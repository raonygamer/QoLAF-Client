import { CLIENT_BUILD, CLIENT_VERSION_LABEL, SOURCE_VERSION } from '../login/LoginIdentity';
import type { CommandHelpEntry, CommandField } from '../chat/ChatCommandRegistry';
export interface ClientHelpPage {
  label: string;
  content: string;
}
/** Original client guide and running client version. */
export class ClientHelpContent {
  constructor(
    private readonly serverVersion: string,
    private readonly automationsSupported: boolean,
    private readonly commandEntries: CommandHelpEntry[] = [],
    private readonly clientVersion = `${CLIENT_VERSION_LABEL} (${CLIENT_BUILD})`,
  ) {}
  createPages(): ClientHelpPage[] {
    const pages = [
      { label: 'Start', content: this.overviewContent() },
      { label: 'Commands', content: this.commandsContent() },
      { label: 'Targeting', content: this.targetingContent() },
      { label: 'Aim Assist', content: this.aimAssistContent() },
      { label: 'Ship visuals', content: this.shipVisualsContent() },
    ];
    if (this.automationsSupported)
      pages.push({ label: 'Automations', content: this.automationsContent() });
    pages.push({ label: 'QoL / settings', content: this.settingsContent() });
    return pages;
  }
  private overviewContent(): string {
    return (
      this.title('QoLAF client guide') +
      "You are running <font color='#03b1fc'>v" +
      this.clientVersion +
      '</font> for server ' +
      this.serverVersion +
      '.<br><br>' +
      "<font color='#ffcc00'>Port in development.</font> This guide describes the original client. " +
      'Some features are still being ported; automation examples use the browser module API.<br><br>' +
      this.heading('Where to find things') +
      'Settings open in a centered, artifact-style dark window with gray borders and matching controls. ' +
      'The window stays bounded and scales down to fit smaller displays. ' +
      'Your last selected Settings category is remembered locally per account across restarts.<br><br>' +
      this.item(
        'Settings &gt; General',
        'Music and effect volume, mouse steering, firing and respawn preferences, timed missions, and inactivity protection.',
      ) +
      this.item('Settings &gt; Graphics', 'Frame-rate limit, DPI scale, and high-graphics mode.') +
      this.item(
        'Settings &gt; Cosmetics',
        'Background visibility, nebula opacity, star brightness, distortion effects, and optional shrink/grow teleport animation.',
      ) +
      this.item(
        'Settings &gt; HUD',
        'Radar telemetry, world labels, number formatting, nearby targets, multibars, target-panel placement, compact warp map, and the expanded artifact-screen toggle.',
      ) +
      this.item(
        'Settings &gt; Combat',
        'Automatic targeting, target search distance, boss spawn markers, miniboss heatmaps, Xhersix torpedo warnings, rhythm rings and positioning, and Nether Blob beam countdowns.',
      ) +
      this.item(
        'Settings &gt; Aim Assist',
        'Open the dedicated left-side category for optional NPC-only steering assistance and its detailed controls.',
      ) +
      this.item(
        'Settings &gt; Chat',
        'Choose visible channels, adjust Legacy chat font size, and toggle the default-on integrated Advanced chat composer. The integrated composer includes channel tabs, bitmap emoji, slash-command, colon-emoji, and @friend suggestions, Tab completion, history, and clipboard shortcuts.',
      ) +
      this.item(
        'Typed chat formatting',
        "Outside Global, complete valid HTML fragments convert as you type or paste. For example, &lt;font color='#ffcc44'&gt;gold text&lt;/font&gt;. Incomplete or unsupported tags stay literal; the existing renderer supports font color, size and line breaks.",
      ) +
      (this.automationsSupported
        ? this.item('Settings &gt; Automations', 'Import and control optional automation modules.')
        : '') +
      this.item(
        'Login profiles',
        'The startup chooser stores separate Simple, Kongregate, and Armor profiles and pins the current Steam session when available. Optional auto-login waits three seconds; press CTRL during startup to cancel it for that launch.',
      ) +
      this.item(
        'Chat commands',
        'Use the Commands and Ship visuals tabs in this guide for client-only commands.',
      ) +
      this.item(
        '/changelog',
        'Opens the archived v1.0.55-v' +
          SOURCE_VERSION +
          ' client history with a scrollable release list.',
      ) +
      "<br><font color='#aaaaaa'>Use the tabs above to browse. Scroll inside a page when needed. " +
      'Press Esc or the Close button to leave this guide.</font>'
    );
  }
  private commandsContent(): string {
    return (
      this.title('Client commands') +
      this.item('/chelp, /clienthelp', 'Open this tabbed guide.') +
      this.item(
        '/clearchat',
        'Clear Simple and Advanced chat locally, including rows retained across room changes. Sent-message history (Arrow Up/Down) and chat settings are preserved. Nothing is sent to other players.',
      ) +
      this.item(
        '/timers',
        'Show or hide secondary boss and miniboss timers above the radar. Primary bosses, including Admiral Zhersis, stay visible. Secondary timers are off by default; your choice is saved per account.',
      ) +
      this.item(
        '/floatingchat &lt;int&gt;',
        `Join an existing Service room in Advanced chat by index, for example /floatingchat 0 joins Service-${this.serverVersion}_0. Accepts indices 0-2147483647, not full room IDs. Never creates rooms or falls back to another room. If joining fails, the window shows the error. Drag its title to move it and its bottom-right corner to resize. Local is temporarily enabled through that Service connection. Closing releases its connection; other users of that connection keep it open. Repeating the command brings that Service's window forward.`,
      ) +
      this.item(
        '/rec',
        'Open the portable artifact recycler from anywhere it is safe to change state.',
      ) +
      this.item('/upg', 'Open the portable weapon upgrade screen.') +
      this.item(
        '/hangar',
        'Browse the DB-backed player-ship catalog from roaming or a real landed screen.',
      ) +
      this.item('/piratebay', 'Open the Pirate Bay from roaming or a real landed screen.') +
      this.item(
        '/music',
        "Open the local music player: 14 tracks from cached metadata, with readable titles and known system associations. Uncheck the default-on 'Let the game drive the songs' checkbox to enable manual play, pause/resume, stop and loop controls; checking it again returns to automatic music. Mode, selected track, loop and playing/paused/stopped state are saved locally per account across restarts. Restored playback starts from the beginning; paused/stopped music stays silent. Manual loops survive room changes, and closing the window does not stop music. The existing music-volume setting still applies.",
      ) +
      this.item(
        '/ref, /refresh, /upstream',
        'Refresh the current Game room through the existing authenticated Service connection, rebuilding the system state while keeping QoLAF and its plugins loaded.',
      ) +
      this.item(
        '/resync [1-10]',
        'Resynchronize the game clock using 1 to 10 samples (default: 1). Requests are sent together and the combined estimate is applied after all replies arrive. Reports adjustment and latency locally. Cooldown starts when requests are sent and lasts the sample count in seconds: /resync 5 waits 5 seconds before another resync.',
      ) +
      this.item('/echo', 'Show the server and QoLAF client versions.') +
      this.item(
        '/spececho',
        "Ask connected IPC clients which QoLAF version and Public/Private build they use. Each reply uses the same pulsing echo style as /echo, prefixed with that player's name. Only you see the replies; other clients respond silently. Available in public builds, with a five-second cooldown and one check at a time.",
      ) +
      this.item(
        '/qolaf &lt;message&gt;',
        'Send a message to QoLAF members through the dedicated IPC Local channel, or use the QoLAF chat tab. Artifact links may be sent only in QoLAF, Private or Clan. When a link is in the input, other destinations are grayed out; ordinary chat without links is unchanged.',
      ) +
      this.item(
        '/serverip',
        'Private build only: show both connected PlayerIO endpoints locally as Service IP and Game IP, without sending them to chat.',
      ) +
      this.item('/network', 'Toggle the live RX/TX network statistics display.') +
      this.item('/profiler', 'Toggle the local performance profiler.') +
      this.item(
        '/disconnect &lt;game|service&gt;',
        'Close only the selected room socket to exercise automatic reconnection. A Service-only disconnect keeps the live Game room running; a Game disconnect pauses it until the room is rebuilt. Wait for recovery before running another disconnect. This command is local and sends no chat message.',
      ) +
      this.item(
        '/pktdbg',
        'Toggle a movable, resizable packet inspector with RX/TX, pause, clear, and type/text filters. It defaults to command and player-course traffic; clear the filter to inspect everything and prefix a token with ! to exclude it.',
      ) +
      this.item(
        '/headingdbg',
        'Open the packet inspector in heading mode. It compares the live local ship against a ghost of the replayed server course, draws velocity and correction vectors, and records the raw, replayed, and local reconciliation values.',
      ) +
      this.item(
        '/torpdbg [on|off|save|mark description]',
        'Record local Xhersix torpedo diagnostics. Purple is a CLIENT projection, not a server correction or live server position; white is drawn and blue is the raw packet position. Both torpedo outlines use the same frame clock. Captures include raw source, received correction count, exact draw timestamps, local contact estimates, fatal packet headers and bounded recent 33 ms history, queued outside collision callbacks. Deaths automatically save JSONL under Documents/QoLAF/torpedo-debug after a short delay; off or save also exports. Server packets do not expose the authoritative impact position/time or projectile attribution.',
      ) +
      this.item(
        '/torptiming [on|off|reset]',
        "Print local Xhersix volley timings without enabling the full recorder. First newly received spawn is 0 ms; exact same-shooter/timestamp siblings are grouped. Stamp is elapsed raw spawn time; gap/change show that shooter's interval and its change from the prior interval. Receive is its packet-arrival interval; jitter is receive minus spawn gap, while drift compares total arrival/spawn elapsed time. Positive jitter means later arrival, not necessarily a changed firing cadence. Out-of-order timestamps are flagged and excluded from cadence baselines. Run again to reset; off stops. Stops on leaving the room.",
      ) +
      this.item(
        '/disposedbg',
        'Open a native draggable live diagnostics window for TextParticle, emitter, particle, CollectiveMeshBatch, projectile, damage-flash filter, vertex, memory, peak, and lifetime activity counters.',
      ) +
      this.item(
        '/testchatspeed',
        'Locally write 300 progressively wider debug messages over five seconds to benchmark the active chat view without sending network chat. Downloads a CSV profile with separate timings for each active chat view.',
      ) +
      this.item(
        '/discordpresence [on|off|status|app &lt;application ID&gt;]',
        'Control Discord Rich Presence in the patched Steam or itch launcher. Shares your current location, player name and level, or nearby boss status. Changed activity updates every five seconds. The General settings toggle saves your preference; ordinary browsers report that the native host is unavailable.',
      ) +
      this.item(
        '/aimdebug, /aimassistdebug',
        'Toggle the Aim Assist diagnostics panel and angle rays.',
      ) +
      (this.automationsSupported
        ? this.item(
            '/script',
            'Show which imported automation is currently running. Its command form remains available for legacy modules; new modules register direct namespaced commands.',
          )
        : '') +
      this.item(
        '/dontkick',
        'Toggle persistent protection from the inactivity disconnect. The same setting is available in Settings &gt; General.',
      ) +
      this.item(
        '/restart',
        'Reload QoLAF and its plugins through the launcher.',
      ) +
      this.item(
        '/tptodeath',
        'Immediately ask the server to teleport you to your last death location, without a client-side death-history check or confirmation.',
      ) +
      this.item(
        '/warp &lt;system&gt; &lt;pve|pvp|ci&gt;',
        'Warp to a solar system in a private build.',
      ) +
      this.item('/switchinstance &lt;pve|pvp|ci&gt;', this.switchInstanceDescription()) +
      this.item(
        '/switchservice &lt;int&gt; [visible=false] [reconnect=true]',
        'Private build only: switch Service rooms using a decimal index from 0 to 2147483647. Optional flags accept true or false, case-insensitively; defaults are visible=false and reconnect=true. With reconnect=false, only Service changes and the current Game keeps running. With reconnect=true, find a Game in the target Service for the same solar system, preserving PvE, PvP or clan-instance mode. Clan instances remain specific to your clan. Queued match rooms reject reconnect=true before switching; leave the match first or use false. Visibility applies only when creating a Service room; existing rooms are unchanged, and recovery preserves this creation preference.',
      ) +
      this.item(
        '/switchservice confirm | cancel',
        'Private build only: visible=true first warns that it could create a Service room visible to all players, without opening or closing rooms. Run /switchservice confirm within 30 seconds to execute that exact pending switch once, or /switchservice cancel to discard it. A new indexed switch/join replaces the pending request. Room or recovery changes invalidate it, and confirmation rechecks that the original rooms are connected and no transition is active. Visible=false remains immediate.',
      ) +
      this.item(
        '/joinservice &lt;int&gt;',
        `Private build only: join the existing Service-${this.serverVersion}_&lt;int&gt; using a decimal index from 0 to 2147483647, with no optional flags. Hidden rooms can be joined by index. Always reconnect to a Game in that Service for the same solar system, preserving PvE, PvP or your own clan-instance mode; leave queued matches first. Never create the target Service, including retries or later automatic recovery. A failed transition before Game teardown restores the previous Service using its previous creation policy. Joining the current Service also enables join-only recovery. Use /switchservice to explicitly allow Service creation again.`,
      ) +
      this.item(
        '/warptofriend @friend [pve|pvp|ci]',
        "Warp to an online friend's current room in a private build, preserving its actual room mode and flags. An optional mode selects a matching instance in that friend's Service instead. If the room metadata is unavailable, the warp stops rather than guessing its mode. Type @ to pick a friend.",
      ) +
      this.item(
        '/privatewarp &lt;system&gt; &lt;pve|pvp|ci&gt;',
        'Create a fresh private room in a private build.',
      ) +
      this.item(
        '/changelog',
        'Open the archived v1.0.55-v' + SOURCE_VERSION + ' changelog popup.',
      ) +
      '<br>' +
      this.heading('Regular chat help') +
      "Use <font color='#ffff88'>/help</font> or <font color='#ffff88'>/commands</font> for the " +
      'short command list, including normal chat, group, whisper, ignore, and report commands.' +
      this.customCommandsContent()
    );
  }
  private customCommandsContent(): string {
    if (!this.automationsSupported) {
      return '';
    }
    let entries: CommandHelpEntry[] = this.commandEntries;
    if (entries.length == 0) {
      return '';
    }
    let result: string = '<br><br>' + this.heading('Custom commands');
    for (const entry of entries) {
      let separator: number = entry.fullName.indexOf(':');
      let localName: string = entry.fullName.substring(separator + 1);
      let spelling: string = entry.ownsBareName ? '/' + localName : '/' + entry.fullName;
      if (entry.ownsBareName) {
        spelling += ' (also /' + entry.fullName + ')';
      }
      result += this.item(
        this.escapeHelpText(spelling + entry.usage),
        this.escapeHelpText(entry.description) + this.commandFieldHelp(entry),
      );
    }
    return result;
  }
  private commandFieldHelp(entry: CommandHelpEntry): string {
    let mandatory: CommandField[] = entry.mandatory;
    let optional: CommandField[] = entry.optional;
    if (mandatory.length == 0 && optional.length == 0 && !entry.allowExtraArguments) {
      return '';
    }
    let result: string = "<br><font color='#aaaaaa'>Arguments:</font> ";
    let details: string[] = [];
    for (const field of mandatory) {
      details.push(this.commandFieldLabel(field, true));
    }
    for (const field of optional) {
      details.push(this.commandFieldLabel(field, false));
    }
    if (entry.allowExtraArguments) {
      details.push('extra arguments allowed');
    }
    return result + details.join('; ');
  }
  private commandFieldLabel(field: CommandField, mandatory: boolean): string {
    let label: string = mandatory ? 'required ' : 'optional ';
    label += this.escapeHelpText(field.name);
    if (field.hasDefault) {
      label += ' (default ' + this.escapeHelpText(field.defaultValue) + ')';
    }
    if (field.description.length > 0) {
      label += ' - ' + this.escapeHelpText(field.description);
    }
    return label;
  }
  private escapeHelpText(value: string | undefined): string {
    let escaped: string = value == null ? '' : value;
    escaped = escaped.replace(/&/g, '&amp;');
    escaped = escaped.replace(/</g, '&lt;');
    escaped = escaped.replace(/>/g, '&gt;');
    escaped = escaped.replace(/\"/g, '&quot;');
    escaped = escaped.replace(/'/g, '&#39;');
    return escaped;
  }
  private targetingContent(): string {
    return (
      this.title('Custom targeting and target UI') +
      this.item('Click targeting', 'Click a valid ship or enemy in range to select it.') +
      this.item(
        'Auto target',
        'Selects valid targets hit by your locally simulated weapons; manual target locks are never replaced.',
      ) +
      this.item(
        'Target lock',
        'Click the lock icon beside the target name to keep the current target from being replaced or cleared by normal selection.',
      ) +
      this.item(
        'Nearby targets',
        'The configured number of nearby candidates appears under the main bars; click a row to select it and use +/- to collapse or expand the list.',
      ) +
      this.item(
        'Target information',
        'Shows true name, level, boss marker, health, shield, and available status information.',
      ) +
      this.item(
        'Debuffs',
        'Icons track remaining duration and stacks; press an icon to inspect its description.',
      ) +
      this.item(
        'Multibars',
        'Splits large health and shield pools into readable chunks using the configured dividend.',
      ) +
      this.item(
        'Target indicator',
        'Marks the selected unit in the world; it can be disabled independently.',
      ) +
      '<br>' +
      this.heading('Settings &gt; Combat / HUD') +
      'Combat contains auto targeting and target search distance. HUD contains 0-10 nearby target rows, ' +
      'AF-faction radar exclusion, the native boss bar, the selected-target icon, multibars, ' +
      "and the target panel's X/Y position."
    );
  }
  private aimAssistContent(): string {
    return (
      this.title('Aim Assist') +
      "<font color='#ffcc55'>Aim Assist is experimental, opt-in, and disabled by default.</font> " +
      'It steers only; it never fires a weapon for you.<br><br>' +
      this.heading('Getting started') +
      this.item(
        'Enable it',
        'Open Settings &gt; Aim Assist in the left-side category list and enable Aim Assist. Mouse aim may be on or off: both mouse aim and normal left/right keyboard steering are supported.',
      ) +
      this.item(
        'Use an eligible weapon',
        'Fire a projectile or smart-projectile weapon at a hostile NPC. Beams and missile weapons are excluded.',
      ) +
      this.item(
        'Confirm a target',
        'Normally the local projectile simulation must have recently hit the NPC. With Require active target enabled, that NPC must also be your selected target.',
      ) +
      this.heading('When it acts') +
      this.item(
        'Mouse aim',
        'Move the cursor slowly toward the eligible target while firing. The assist engages only inside its acquisition cone and corrects toward the direct or predicted lead angle.',
      ) +
      this.item(
        'Keyboard steering',
        'Press the left or right turn key that reduces the angle to the eligible target. A key that turns away does not acquire the assist and immediately restores normal manual steering.',
      ) +
      this.item(
        'Stationary tracking',
        'After acquisition, releasing the mouse or turn keys can keep following the same NPC after the configured delay. Turn-step settle/restart hysteresis prevents shaking around the final angle.',
      ) +
      this.item(
        'Locked targets',
        'Pin locked target keeps an eligible manually locked NPC as the assist target until it is unlocked. It still obeys firing, distance, angle and player-input rules.',
      ) +
      this.heading('When it releases') +
      this.item(
        'Manual override',
        'Moving the mouse too quickly, steering away, leaving the release cone, changing the confirmed target, stopping fire or losing target eligibility releases control immediately.',
      ) +
      this.item(
        'Hard exclusions',
        'The assist never acts against player-controlled ships and cannot shoot in a safe zone.' +
          (this.automationsSupported
            ? ' It never acts while an automation owns the controls.'
            : ''),
      ) +
      this.heading('Tuning and diagnostics') +
      this.item(
        'Settings',
        'The Aim Assist page exposes acquisition, correction, tracking, locked-target, hit-memory and projectile-lead controls. Mouse-speed sliders apply to mouse aim; turn keys provide keyboard intent directly.',
      ) +
      this.item(
        '/aimdebug',
        'Toggle the black diagnostic panel and rays. White is raw input, yellow the visible target, cyan predicted lead and green the applied aim. The Reason line explains why the assist is active or rejected.',
      )
    );
  }
  private shipVisualsContent(): string {
    return (
      this.title('Experimental local ship visuals') +
      this.item(
        '/sv &quot;name or key&quot;',
        'Replace your ship appearance locally with a ship, enemy, turret, spawner, or complete boss. Successful changes automatically broadcast to IPC peers and start a two-second command cooldown. /ship and /shipvisual also work; exact names avoid ambiguous matches.',
      ) +
      'Short option aliases are shown below; all original long option names remain valid.<br><br>' +
      this.item(
        '/sv reset [ship|weapon] (r)',
        "Reset both ship and weapon visuals, or specify ship to keep custom weapon colors, or weapon to clear all custom weapon colors without changing the ship. /sv wc reset still clears only the selected weapon's color.",
      ) +
      this.item(
        '/sv scale &lt;float&gt;',
        'Set a visual size multiplier from 0.1 to 5; 1 restores normal size. Saved and shared with compatible clients. Hitboxes and weapon range are unchanged.',
      ) +
      this.item(
        '/sv al (align)',
        'Recalculate the visual pivot and remember automatic alignment for later visual changes.',
      ) +
      this.item(
        '/sv em (emitters)',
        "Toggle use of the selected visual's thrust and weapon emitter positions.",
      ) +
      this.item('/sv sp (shooting-point)', 'Cycle the available weapon mount positions.') +
      this.item('/sv ds (disable-shadow)', "Toggle the experimental visual's local shadow.") +
      this.item(
        '/sv oc (original-color)',
        "Toggle the source visual's original color instead of your normal ship tint.",
      ) +
      this.item(
        '/sv au color (aura)',
        'Apply the matching enemy blue, red, green, orange speed, golden, or rainbow aura. Rainbow uses one layer slightly larger than red, auras return after teleporting, and multipart visuals glow on every component; use /sv au off to remove it.',
      ) +
      this.item(
        '/sv wc (weapon-color)',
        'Configure the selected weapon with RGB sliders, exact values, a preview, and optional grayscale. /sv wc r (or /sv weapon-color reset) restores its normal coloring; the client-developer rainbow then resumes and always grayscales weapon textures before tinting.',
      ) +
      this.item(
        '/ssv @player',
        'Send YOUR visual to an online IPC peer; this does not request theirs. Includes per-weapon colors and grayscale choices. Discovery also checks saved hashes and privately sends missing or changed visuals. Incoming shares apply automatically unless you have disabled that sender. Client-developer shares are always accepted. Both players need the dedicated IPC protocol.',
      ) +
      this.item(
        '/ssv reset &lt;@Player|playerId&gt;',
        "Restore that player's default local appearance and forget their saved shared visual, without changing whether you allow future shares. Saved player names can also be resolved while they are offline. Client developers cannot be manually reset.",
      ) +
      this.item(
        '/ssv disable &lt;@Player|playerId&gt; [now=true]',
        'Block future visual shares from this player. By default, also reset their current local appearance. Use false to keep their current appearance. This choice is saved locally. Client developers cannot be blocked or reset.',
      ) +
      this.item(
        '/ssv enable &lt;@Player|playerId&gt; [now=true]',
        "Allow this player's future visual shares again. By default, also reset their current local appearance; use false to leave it unchanged. This does not request a new share. This choice is saved locally. Client developers are always enabled and cannot be reset.",
      ) +
      this.privateVisualShareContent() +
      "<br><font color='#ffcc00'>These are cosmetic and local.</font> They do not change your ship's " +
      'stats or what the server considers you to be. Saved options are restored on later sessions.'
    );
  }
  private privateVisualShareContent(): string {
    let content: string = '';

    return content;
  }
  private automationsContent(): string {
    return (
      this.title('Importable automation modules') +
      'Automations are optional JavaScript modules that subscribe to client lifecycle events. Open ' +
      "<font color='#ffff88'>Settings &gt; Automations</font> to manage them.<br><br>" +
      this.heading('Installing and operating') +
      this.item('Add URL', 'Download and install an automation module from a direct URL.') +
      this.item('Add File', 'Import an automation module already stored on your device.') +
      this.item(
        'Metadata',
        'The details panel shows the script ID, version, authors, minimum client version, website, status, file, and description.',
      ) +
      this.item(
        'Start / Stop',
        'Start or stop the selected module. A stopped module receives no update events and receives render events only when it explicitly enables background rendering.',
      ) +
      this.item(
        'Remove',
        'Stop, dispose, unload, and delete the selected module after confirmation.',
      ) +
      this.item(
        '/script',
        'Show active automations. The /script &lt;id&gt; &lt;command&gt; form remains available for legacy modules; structured commands use /namespace:command.',
      ) +
      "<br><font color='#ff5555'>Security warning:</font> automation modules run as trusted client code. " +
      'They can do anything the client can do. Install modules only from authors and URLs you trust.<br><br>' +
      this.heading('Authoring: module and lifecycle') +
      'Export the script class as the default export of a single .js or .mjs module. ' +
      'Bundle dependencies into that file; imported files are loaded from a temporary blob URL. ' +
      'Use a stable, unique SCRIPT_ID and accept the script-scoped EventBus in the constructor.<br>' +
      this.codeBlock(
        'export default class AutomationScript {\n' +
          '    static SCRIPT_ID = "example";\n\n' +
          '    constructor(bus) {\n' +
          '        this.bus = bus;\n' +
          '        bus.subscribe("initialize", event => this.onInitialize(event));\n' +
          '        bus.subscribe("start", () => this.onStart());\n' +
          '        bus.subscribe("update", event => this.onUpdate(event));\n' +
          '        bus.subscribe("render", event => this.onRender(event));\n' +
          '        bus.subscribe("stop", () => this.onStop());\n' +
          '        bus.subscribe("dispose", event => this.onDispose(event));\n' +
          '    }\n\n' +
          '    getInfo() {\n' +
          '        return { name: "Example", description: "Lifecycle example",\n' +
          '            version: "1.0.0", authors: ["Author"], minClientVersion: 76 };\n' +
          '    }\n\n' +
          '    onInitialize(event) { this.game = event.game; }\n' +
          '    onStart() {}\n' +
          '    onUpdate(event) {}\n' +
          '    onRender(event) {}\n' +
          '    onStop() {}\n' +
          '    onDispose(event) { this.game = null; }\n' +
          '}',
      ) +
      this.item('initialize', 'Runs once when the game is ready. Cache event.game here.') +
      this.item(
        'start / stop',
        'Match the settings Start and Stop controls. Stop movement, firing, aiming, and other held state before returning from stop.',
      ) +
      this.item(
        'update',
        'Runs every fixed 33 ms simulation tick while started. Use this for gameplay decisions and commands.',
      ) +
      this.item(
        'render',
        'Runs once per rendered frame while started. Use event.deltaTime and reserve it for visual overlays or interpolation.',
      ) +
      this.item(
        'dispose',
        'Runs before module removal or client teardown. Detach native overlays and release external resources here.',
      ) +
      this.heading('Module commands') +
      'Register structured commands on the script-scoped bus so they remain available while the module ' +
      'is stopped and are removed automatically when it unloads. A descriptor supplies help and validates ' +
      'required/optional fields before the immutable invocation reaches the callback:<br>' +
      this.codeBlock(
        'bus.registerCommand("example:debug", {\n' +
          '    description: "Configure diagnostics",\n' +
          '    mandatory: [{name: "enabled", description: "on or off"}],\n' +
          '    optional: [{name: "level", defaultValue: "brief"}],\n' +
          '    allowExtraArguments: false\n' +
          '}, onDebug);\n\n' +
          'function onDebug(command) {\n' +
          '    const enabled = command.getArgument("enabled");\n' +
          '    const level = command.getArgument("level");\n' +
          '    const game = command.game;\n' +
          '    // Apply the validated command here.\n' +
          '}',
      ) +
      "The equivalent client-level API is <font color='#9ee6b2'>ChatCommandRegistry.registerCommand" +
      '(fullName, descriptor, callback)</font>. The first successful registration for a local name owns ' +
      'the bare alias (for example /debug); every registration remains reachable as /namespace:command. ' +
      'Built-in aliases stay reserved. If the winner unregisters, the oldest surviving registration is ' +
      'promoted. Descriptor fields accept strings or {name, description, defaultValue}; ' +
      "<font color='#9ee6b2'>required</font> is accepted as an alias for mandatory.<br><br>" +
      "Legacy compatibility: <font color='#ffff88'>/script &lt;id&gt; &lt;command&gt;</font> still emits " +
      "<font color='#9ee6b2'>AutomationEvent.COMMAND</font> for older modules. New module commands should " +
      'use the structured registry above.<br><br>' +
      this.heading('Controls and aim ownership') +
      'Only one running module may own gameplay controls. Claim before issuing commands, verify ownership ' +
      'when needed, then clear automation aim before releasing ownership:<br>' +
      this.codeBlock(
        'const scriptId = AutomationScript.SCRIPT_ID;\n' +
          'const manager = game.automationManager;\n' +
          'const play = game.gameStateMachine.currentState;\n\n' +
          'if (manager.claimControls(scriptId) && play != null) {\n' +
          '    play.setAutomationAimAngle(scriptId, angleRadians);\n' +
          '}\n\n' +
          'if (play != null && manager.ownsControls(scriptId)) {\n' +
          '    play.clearAutomationAimAngle(scriptId);\n' +
          '}\n' +
          'manager.releaseControls(scriptId);\n\n' +
          '// Temporary and automatically cleared when the module stops.\n' +
          'manager.setTransientDontKick(scriptId, true);\n' +
          'manager.setTransientDontKick(scriptId, false);',
      ) +
      "The aim setter accepts radians and uses PlayState's normal turn-command throttling. It rejects " +
      'invalid angles and any script ID that does not own controls. Forward, backward, firing, and abilities ' +
      "should use the client's normal command paths. Transient no-kick requests do not modify the user's " +
      'saved /dontkick preference and are cleared on stop, error, removal, or client teardown.<br><br>' +
      this.heading('Background diagnostics and cleanup') +
      "Set <font color='#9ee6b2'>bus.renderWhileStopped = true</font> only when an overlay must remain " +
      'visible while stopped. Disable or remove that overlay during dispose. Lifecycle errors stop the ' +
      'running module so controls can be released; structured-command callback errors are contained and ' +
      'reported without breaking chat dispatch.'
    );
  }
  private settingsContent(): string {
    return (
      this.title('Quality-of-life and settings') +
      this.heading('Configurable') +
      this.item(
        'FPS limit',
        'In Graphics, choose a fixed render cap or unlimited FPS; high-FPS movement, rotation, bars, projectiles, and trails are smoothed by the client.',
      ) +
      this.item(
        'DPI scale',
        'In Graphics, resize the interface, especially useful on Android and high-density displays.',
      ) +
      this.item(
        'Space backdrop',
        'In Cosmetics, adjust nebula opacity and star brightness independently. Stars stay visible when the nebula background is disabled.',
      ) +
      this.item(
        'Graphics',
        'High-graphics mode is in Graphics; background and black-hole distortion options are in Cosmetics.',
      ) +
      this.item(
        'Shrink / grow teleport animation',
        "In Cosmetics; disabled by default and saved locally per account. After the server's channel deadline, off preserves the legacy 240 ms wait before the position jump. On shrinks the ship for 120 ms, jumps to the server-supplied destination, then grows for 120 ms: the same 240 ms animation window, with the jump at its midpoint.",
      ) +
      this.item(
        'Legacy chat font size',
        'In Chat, choose 12-24px, default 14px. The existing live font-size preference is unchanged.',
      ) +
      this.item(
        'Formatted values',
        'In HUD, choose compact k, M, B, and T notation independently for damage/healing text, the player HUD, and active-target health and shield bars. Target-bar compacting starts disabled.',
      ) +
      this.item(
        'Radar and enemy labels',
        'HUD contains the frame-rate, latency, DPS and speed telemetry toggles, speed units, and individual important-Nexar faction, name, bar and value toggles.',
      ) +
      this.item(
        'Clan identification',
        'In HUD, show or hide clan-colored icons, clan names, and member roles above remote player nameplates. Clan identification starts enabled.',
      ) +
      this.item(
        'Compact warp map',
        'In HUD, switch between the redesigned compact route layout and the original map.',
      ) +
      this.item(
        'Combat warnings',
        'Combat contains boss spawn markers and miniboss heatmaps, Xhersix torpedo collision circles and corrected positioning, and the Nether Blob beam countdown. Existing saved preferences are retained.',
      ) +
      this.item(
        'Xhersix torpedo rhythm rings',
        'Enabled by default; use the account-local Combat toggle to disable. Red contracts over a 2.5-second cycle and yellow pulses outward. Fresh volleys realign drift of 50 ms or more; smaller drift is ignored, and an existing yellow pulse keeps its age rather than restarting. A server-reported target change or more than 3 seconds without a fresh volley clears the rings until a new volley arrives. Visual rhythm only: actual torpedoes and hit timing are unchanged. Existing saved off preferences are retained.',
      ) +
      this.item(
        'Mouse aim',
        'In General, toggle mouse steering; recent synchronization work greatly reduces turning and forward-movement desync.',
      ) +
      this.item(
        'Inactivity protection',
        'Enable the persistent /dontkick preference in General.' +
          (this.automationsSupported
            ? ' Running automations may request their own temporary protection without changing it.'
            : ''),
      ) +
      this.item(
        'Aim Assist',
        'The dedicated Aim Assist category offers optional NPC-only steering assistance for mouse aim and keyboard steering, with projectile lead, locked-target and stationary-tracking controls.',
      ) +
      '<br>' +
      this.heading('Always-on client improvements') +
      this.item(
        'Cleaner combat',
        'Cloaked enemies remain visible at half opacity, including their overhead labels. Screen shake is disabled, with reduced excessive particles and visual clutter.',
      ) +
      this.item(
        'Faster presentation',
        'Upgrade animations are shortened and 10x warp is faster without the bright flash.',
      ) +
      this.item(
        'Artifacts',
        'The expanded overview adds inline strength, potential, fitness, line, upgrade, name, and stat-type sorting; inventory summaries; explanations; safer purification filters; and an in-screen Classic view switch.',
      ) +
      this.item(
        'Rendering and sync',
        'Smoother unit/projectile motion, bars, rotation, boost visuals, collision handling, and more efficient packet usage.',
      ) +
      this.item(
        'Mobile',
        'Experimental Android support is available; normal gameplay still requires suitable input such as USB OTG.',
      )
    );
  }
  private switchInstanceDescription(): string {
    let result: string =
      'Switch the current system between PvE, PvP, ' +
      'and clan instances while inside an active warp-gate safe zone.';

    return result;
  }
  private title(value: string): string {
    return "<font color='#03b1fc' size='16'>" + value + '</font><br><br>';
  }
  private heading(value: string): string {
    return "<font color='#ffcc00' size='13'>" + value + '</font><br>';
  }
  private item(label: string, description: string): string {
    return "<font color='#ffff88'>" + label + '</font> - ' + description + '<br>';
  }
  private codeBlock(value: string): string {
    let escaped: string = value == null ? '' : value;
    escaped = escaped.replace(/&/g, '&amp;');
    escaped = escaped.replace(/</g, '&lt;');
    escaped = escaped.replace(/>/g, '&gt;');
    escaped = escaped.replace(/ /g, '&nbsp;');
    escaped = escaped.replace(/\r?\n/g, '<br>');
    return (
      "<font color='#52635a'>----------------------------------------</font><br>" +
      "<font color='#9ee6b2' size='11'>" +
      escaped +
      '</font><br>' +
      "<font color='#52635a'>----------------------------------------</font><br><br>"
    );
  }
}
