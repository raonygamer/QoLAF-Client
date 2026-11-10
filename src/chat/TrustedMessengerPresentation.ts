/** Source receive-side relay presentation. Only the authenticated wire ID authorizes it. */
export class TrustedMessengerPresentation {
  static readonly playerId = 'simple1788744659165';
  static readonly discordColor = 0xaa66ff;
  static readonly announcementColor = 0xe879d0;

  static format(playerId: string | null, source: string): string | null {
    if (playerId !== this.playerId || source == null) return null;
    if (source.startsWith('A:'))
      return (
        "<font color='#e879d0'>[announcement]: " +
        this.escapeText(this.bodyAfter(source, 2)) +
        '</font>'
      );
    const match = /^D\(([^()\r\n]+)\):/.exec(source);
    if (!match || /^\s*$/.test(match[1])) return null;
    return (
      "<font color='#aa66ff'>[discord]</font> " +
      this.escapeText(match[1]) +
      ': ' +
      this.escapeText(this.bodyAfter(source, match[0].length))
    );
  }

  private static bodyAfter(source: string, start: number): string {
    if (source.charAt(start) === ' ') start++;
    return source.slice(start);
  }

  private static escapeText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
