/** Original mention notation for commands whose first argument is a player. */
export class ChatPlayerCommandNormalizer {
  private static readonly playerTargetCommands = new Set([
    'ssv',
    'warptofriend',
    'i',
    'inv',
    'invite',
    'm',
    'w',
    'whisper',
    't',
    'tell',
    'private',
    'ignore',
    'mute',
    'unignore',
    'unmute',
    'ban',
    'unban',
    'kick',
    'getid',
    'warptoid',
    'silence',
    'silenceall',
    'sil',
    'silall',
    'report',
  ]);

  static normalizeArguments(commandName: string, rawArguments: string): string {
    if (
      commandName == null ||
      rawArguments == null ||
      !this.playerTargetCommands.has(commandName.toLowerCase())
    )
      return rawArguments;

    // Preserve quotes and message bodies; only the leading target loses its @.
    return rawArguments.replace(/^\s+/, '').replace(/^(["']?)@(?=\S)/, '$1');
  }
}
