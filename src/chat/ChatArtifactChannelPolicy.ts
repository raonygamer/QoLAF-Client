/** Source policy shared by artifact composer affordances and send boundaries. */
export class ChatArtifactChannelPolicy {
  static readonly restrictionMessage =
    'Artifact links can only be sent in QoLAF, Private, or Clan chat.';

  static allows(channel: string | null | undefined): boolean {
    switch (channel?.toLowerCase()) {
      case 'qolaf':
      case 'private':
      case 'privatesaved':
      case 'clan':
        return true;
      default:
        return false;
    }
  }

  static defaultDestination(channel: string | null | undefined): string {
    return channel != null && this.allows(channel) ? channel : 'qolaf';
  }

  static commandChannel(command: string | null | undefined): string | null {
    switch (command?.toLowerCase()) {
      case 'qolaf':
        return 'qolaf';
      case 'c':
      case 'clan':
        return 'clan';
      case 'm':
      case 'w':
      case 'whisper':
      case 't':
      case 'tell':
      case 'private':
      case 'privatesaved':
      case 'r':
      case 'reply':
        return 'private';
      default:
        return null;
    }
  }
}
