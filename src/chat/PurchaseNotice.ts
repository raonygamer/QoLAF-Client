import { PodRewardNotice } from './PodRewardNotice';
export class PurchaseNotice {
  static readonly type = 'qipc3.purchase';
  static fluxLabel(amount: number): string | null {
    return Number.isFinite(amount) && amount > 0 && amount === (amount | 0)
      ? `${amount} flux`
      : null;
  }
  static format(playerName: string, label: string): string {
    return !playerName || !PodRewardNotice.validLabel(label)
      ? ''
      : PodRewardNotice.wrap(
          `${PodRewardNotice.escape(playerName)} just bought ${PodRewardNotice.escape(label)}!`,
        );
  }
  static isPaidCoinReceipt(
    entry: Record<string, unknown> | null,
    baseAmount: number,
    totalAmount: number,
  ): boolean {
    if (
      !entry ||
      typeof entry.providerTransactionId !== 'string' ||
      !entry.providerTransactionId ||
      typeof entry.providerPrice !== 'string' ||
      !entry.providerPrice ||
      typeof entry.amount !== 'number'
    )
      return false;
    return (
      (entry.itemKeys == null || (Array.isArray(entry.itemKeys) && entry.itemKeys.length === 0)) &&
      this.fluxLabel(entry.amount) !== null &&
      (entry.amount === baseAmount || entry.amount === totalAmount)
    );
  }
}
