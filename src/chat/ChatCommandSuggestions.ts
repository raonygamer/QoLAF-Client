import { ChatCommandSuggestion } from './ChatCommandSuggestion';
import type { ChatCommandRegistry } from './ChatCommandRegistry';

// Original descriptions for commands actually implemented by this runtime.
const definitions: readonly (readonly [string, string, string])[] = [
  ['inspect', ' <@PlayerName|player_id>', 'Open read-only player inspection'],
  ['echo', '', 'Show the client version'],
  ['chelp clienthelp', '', 'Open the tabbed client guide'],
  ['changelog', '', 'Open the original client release history'],
  ['clearchat', '', 'Clear both chat views locally; keep sent-message history and settings'],
  [
    'timers',
    '',
    'Toggle secondary radar boss timers; primary bosses and Admiral Zhersis stay visible',
  ],
  [
    'script automation',
    ' [automation-id command [arguments]]',
    'Show or invoke automation commands',
  ],
  ['dontkick', '', 'Toggle inactivity protection'],
  ['y yes', '', 'Accept a group invitation'],
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
