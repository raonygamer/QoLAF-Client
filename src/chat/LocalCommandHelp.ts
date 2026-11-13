import { ClientIPCService } from '../ipc/ClientIPCService';

/** Original command explanations, limited to supported browser handlers. */
export function localCommandHelp(): string[] {
  const lines: string[] = [];
  if (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__) {
    lines.push(
      "''/serverip'' shows the connected Service IP and Game IP locally (private build only)",
      "''/warp <system> <pve|pvp|ci>'' warps to a system (private build only)",
      "''/privatewarp <system> <pve|pvp|ci>'' creates a fresh private room (private build only)",
      "''/warptofriend @friend [pve|pvp|ci]'' warps to an online friend's current room (private build only)",
      "''/listrooms <service|game>'' lists detailed PlayerIO room diagnostics (private build only)",
      "''/listsystems'' lists every solar system accepted by /warp (private build only)",
      "''/switchservice <int> [visible=false] [reconnect=true]'' switches Service rooms (private build only; index 0-2147483647, flags true/false)",
      '/switchservice: reconnect=false keeps the current Game running; true finds a same-system Game in the target Service, keeping PvE/PvP/CI mode and your own clan for CI (queued matches must use false or leave the match first). Visibility applies only to Service creation, not existing rooms; recovery preserves the creation preference.',
      '/switchservice: visible=true only prepares a switch and warns about creating a publicly visible Service. Use /switchservice confirm within 30 seconds to proceed, or /switchservice cancel. A new indexed switch/join or a room/recovery change invalidates the pending confirmation.',
      `''/joinservice <int>'' joins an existing Service-${ClientIPCService.serverVersion}_<int> (private build only; index 0-2147483647; no optional flags)`,
      '/joinservice: always reconnects to a same-system Game preserving PvE/PvP/CI and your own clan for CI; leave queued matches first. Never creates the target Service, including later recovery. Failure before Game teardown restores the previous Service with its own creation policy.',
      "''/switchinstance <pve|pvp|ci>'' switches the current system instance from anywhere (private build)",
    );
  } else {
    lines.push(
      "''/switchinstance <pve|pvp|ci>'' switches the current system instance from a warp-gate safe zone",
    );
  }
  lines.push(
    "''/log'' opens local client and plugin diagnostics",
    "''/discordpresence [on|off|status|app <application ID>]'' controls Discord Rich Presence in a patched desktop host",
    "''/aimdebug, /aimassistdebug'' toggles the aim-assist diagnostics",
    "''/restart'' reloads QoLAF and plugins through the launcher",
    "''/resync [1-10]'' resynchronizes the game clock (default: 1 sample); parallel samples, cooldown equals sample count in seconds",
    "''/disconnect <game|service>'' closes only that room socket to exercise automatic reconnection",
    "''/echo'' shows the client version",
    "''/testchatspeed'' locally writes 300 progressively wider messages over five seconds and downloads a per-view CSV profile",
    "''/torpdbg [on|off|save|mark description]'' records local Xhersix torpedo diagnostics with purple/white position circles",
    "''/torptiming [on|off|reset]'' prints Xhersix spawn intervals versus packet-arrival jitter, starting at 0 ms",
    "''/spececho'' checks connected QoLAF client versions over IPC; replies are shown only to you",
    "''/ref, /refresh, /upstream'' refreshes the current Game room while keeping the same Service connection and loaded plugins",
    "''/tptodeath'' immediately requests a teleport to your last death location",
    "''/yes'' or ''/y'' accepts the current group invitation",
    "''/clearchat'' clears both chat views locally; keeps sent-message history and settings",
    "''/timers'' toggles secondary boss timers on the radar; primary bosses and Admiral Zhersis remain visible",
  );
  return lines;
}
