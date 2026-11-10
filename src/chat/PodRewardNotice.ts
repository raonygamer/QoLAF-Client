import type { IpcServerMessage } from '../ipc/ClientIpcService';

/** Source reward labels: converted duplicates disclose Flux, not the old item. */
export class PodRewardNotice {
  static readonly type = 'qipc3.pod.rare';
  static validLabel(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 140 &&
      value.replace(/\s/g, '').length > 0 &&
      !/[\x00-\x1f\x7f\u2028\u2029]/.test(value)
    );
  }
  static fromReply(reply: IpcServerMessage | null): string | null {
    if (!reply || reply.fields.length < 7) return null;
    const [success, table, rawName, , converted, count, quality] = reply.fields;
    if (
      success !== true ||
      typeof table !== 'string' ||
      typeof rawName !== 'string' ||
      typeof converted !== 'boolean' ||
      typeof count !== 'number' ||
      typeof quality !== 'string'
    )
      return null;
    if (
      (quality !== 'rare' && quality !== 'legendary') ||
      !Number.isFinite(count) ||
      count < 0 ||
      count !== (count | 0)
    )
      return null;
    if (converted) return count > 0 ? `${count} Flux` : null;
    const name = rawName.trim();
    if (!this.validLabel(name)) return null;
    const label = ['Skins', 'Ships', 'Weapons', 'Artifacts'].includes(table)
      ? `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`
      : count > 0
        ? `${count} ${name}`
        : null;
    return this.validLabel(label) ? label : null;
  }
  static format(playerName: string, reward: string): string {
    return !playerName || !this.validLabel(reward)
      ? ''
      : this.wrap(`${this.escape(playerName)} received ${this.escape(reward)} from a pod!`);
  }
  static escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  static wrap(text: string, lowRelic = false): string {
    return `<font color='${lowRelic ? '#43efdf' : '#ff4b85'}'>${text}</font>`;
  }
}
