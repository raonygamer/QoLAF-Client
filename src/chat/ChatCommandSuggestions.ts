import { ChatCommandSuggestion } from './ChatCommandSuggestion';
import type { ChatCommandRegistry } from './ChatCommandRegistry';

// Original command wording for implemented handlers; unsupported integrations
// stay absent and private operations are removed at compilation.
const definitions: readonly (readonly [string, string, string])[] = [
  ['log', '', 'Open local client and plugin diagnostics'],
  ...(typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__
    ? ([
        ['warp', ' <system> <pve|pvp|ci>', 'Private build only: warp to a solar system'],
        ['serverip', '', 'Private build only: show the connected Service IP and Game IP locally'],
        [
          'switchservice',
          ' <int> [visible=false] [reconnect=true] | confirm | cancel',
          'Private build only: switch Service; visible=true needs confirmation within 30 seconds',
        ],
        [
          'joinservice',
          ' <int>',
          'Private build only: join an existing Service, never create it; reconnect same-system Game',
        ],
        [
          'invitetoroom',
          ' <@Peer|roompeers|allpeers|[@a,@b,@c]> [gameId|current]',
          'Invite IPC peers; roompeers selects your current Game room, allpeers selects everyone on IPC',
        ],
        [
          'kickfromroom',
          ' <@Peer|roompeers|allpeers|[@a,@b,@c]> <reason>',
          'Kick IPC peers; roompeers selects your current Game room, allpeers selects everyone on IPC',
        ],
        [
          'script automation',
          ' [automation-id command [arguments]]',
          'Show or invoke automation commands',
        ],
        [
          'warptofriend',
          ' @friend [pve|pvp|ci]',
          "Private build only: warp to an online friend's room using its actual mode and flags",
        ],
        [
          'privatewarp',
          ' <system> <pve|pvp|ci>',
          'Private build only: create a fresh private room',
        ],
        ['listrooms', ' <service|game>', 'Private build only: inspect PlayerIO rooms'],
        [
          'inspect',
          ' <@PlayerName|player_id>',
          "Private build only: inspect a player's ship and inventory",
        ],
        ['listsystems', '', 'Private build only: list solar systems usable by /warp'],
      ] as const)
    : []),
  [
    'switchinstance',
    ' <pve|pvp|ci>',
    typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__
      ? 'Switch instances from anywhere (private build)'
      : 'Switch instances from a warp-gate safe zone',
  ],
  ['rec', '', 'Open the portable recycler'],
  ['upg', '', 'Open the portable upgrade screen'],
  ['hangar', '', 'Open the portable all-ships hangar'],
  [
    'roominvite',
    ' <accept|deny>',
    "Respond to a trusted operator's room invitation within three minutes",
  ],
  [
    'ship sv shipvisual',
    ' <name|key|option>',
    'Cosmetic appearance; reset [ship|weapon] resets only that part (no option resets both). scale <0.1–5> resizes the visual. Changes sync over IPC with a 2s cooldown. Aliases: wc, oc, ds, sp, em, al, au, r',
  ],
  ['echo', '', 'Show the client version'],
  ['spececho', '', 'Check connected QoLAF clients over IPC; only you see the replies'],
  [
    'qolaf',
    ' <message>',
    'Chat with QoLAF members over IPC; artifact links also remain allowed in Private and Clan',
  ],
  ['chelp clienthelp', '', 'Open the client guide'],
  ['changelog', '', 'Open the client changelog'],
  ['clearchat', '', 'Clear both chat views locally; keep sent-message history and settings'],
  [
    'timers',
    '',
    'Toggle secondary radar boss timers; primary bosses and Admiral Zhersis stay visible',
  ],
  [
    'resync',
    ' [1-10]',
    'Resync the clock; default 1 sample, parallel requests, sample-count seconds cooldown',
  ],
  [
    'floatingchat',
    ' <int>',
    'Join an existing Service by index in floating Advanced chat; never creates rooms',
  ],
  ['aimdebug aimassistdebug', '', 'Toggle aim-assist diagnostics'],
  ['dontkick', '', 'Toggle inactivity protection'],
  [
    'discordpresence',
    '[on|off|status|app <application ID>]',
    'Control desktop Discord Rich Presence',
  ],
  [
    'refresh ref upstream',
    '',
    'Refresh the current Game room through the existing Service connection',
  ],
  ['restart', '', 'Reload the launcher and plugins'],
  ['y yes', '', 'Accept a group invitation'],
  ['tptodeath', '', 'Teleport to your last death location'],
  ['i inv invite', ' @player', 'Invite a player to group'],
  ['g grp group', ' [message]', 'Switch or send to group chat'],
  ['go', ' <message>', 'Send a moderator chat message'],
  ['m w whisper t tell private', ' @player <message>', 'Send a private message'],
  ['r reply', ' <message>', 'Reply to the last private message'],
  ['l local', ' [message]', 'Switch or send to local chat'],
  ['global', ' [message]', 'Send to global chat'],
  ['c clan', ' [message]', 'Switch or send to clan chat'],
  ['modchat', ' [message]', 'Switch or send to moderator chat'],
  ['leave', '', 'Leave the current group'],
  ['help commands command', '', 'List available commands'],
  ['list', '', 'List players in the system'],
  ['msgstats', '', 'Show message statistics'],
  ['network', '', 'Toggle network statistics'],
  ['profiler', '', 'Toggle the local performance profiler'],
  ['disconnect', ' <game|service>', 'Close one room socket to exercise automatic reconnection'],
  ['qipc3dbg', '', 'Toggle QIPC3 incoming/outgoing logical-message diagnostics'],
  ['pktdbg', '', 'Toggle packet diagnostics'],
  ['headingdbg', '', 'Toggle heading diagnostics'],
  [
    'torpdbg',
    ' [on|off|save|mark description]',
    'Record local Xhersix headings and purple/white position circles',
  ],
  ['torptiming', ' [on|off|reset]', 'Compare Xhersix spawn intervals and arrival jitter from 0 ms'],
  ['disposedbg', '', 'Toggle disposal diagnostics'],
  ['testchatspeed', '', 'Run or cancel the chat stress test'],
  ['ignore mute unignore unmute', ' @player', 'Change the local/player chat filter'],
  ['ban unban kick', ' @player [reason]', 'Run a moderation command'],
  ['getid warptoid', ' <@player|id>', 'Resolve or warp to a player ID'],
  ['silence silenceall sil silall', ' @player', 'Run a chat-silence command'],
  ['showbans showbanhistory onlinestats', '', 'Show moderation information'],
  ['eventurl eventimage', ' <value>', 'Set event presentation data'],
  ['lowerfps', '', 'Lower the client frame rate'],
  ['stats', '', 'Show display-object statistics'],
  ['report', ' @player [reason]', 'Report a player'],
  ['showquality', '', 'Show the current quality settings'],
  ['setquality', ' <level>', 'Set rendering quality'],
  ['myid', '', 'Insert your player ID'],
  ['profile', '', 'Show the active Stage3D profile'],
  ['next', '', 'Skip to the next music track'],
  ['music', '', 'Open the music player: choose and loop tracks, or let the game choose'],
  [
    'ssv',
    typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__
      ? ' <@player|reset player|disable player [now=true]|enable player [now=true]|all>'
      : ' <@player|reset player|disable player [now=true]|enable player [now=true]>',
    "Send YOUR visual, reset a player's appearance, or allow/block their automatic shares; now=true also resets their appearance. Client developers cannot be blocked or reset" +
      (typeof __QOLAF_PRIVATE__ !== 'undefined' && __QOLAF_PRIVATE__
        ? '; all broadcasts to everyone on IPC, with Local frames queued one second apart'
        : ''),
  ],
  ['piratebay', '', 'Open the portable Pirate Bay'],
];

export function builtInCommandSuggestions(): ChatCommandSuggestion[] {
  return definitions.flatMap(([aliases, usage, description]) =>
    aliases.split(' ').map((name) => {
      const nativeName = name === 'getid' ? 'getId' : name === 'warptoid' ? 'warpToId' : name;
      return new ChatCommandSuggestion(name, usage, description, `/${nativeName} `);
    }),
  );
}

export function registryCommandSuggestions(
  registry?: ChatCommandRegistry,
): ChatCommandSuggestion[] {
  return (registry?.getHelpEntries() ?? []).flatMap((entry) => {
    const bare = entry.fullName.slice(entry.fullName.indexOf(':') + 1);
    const names = entry.ownsBareName ? [bare, entry.fullName] : [entry.fullName];
    return names.map((name) => new ChatCommandSuggestion(name, entry.usage, entry.description));
  });
}
