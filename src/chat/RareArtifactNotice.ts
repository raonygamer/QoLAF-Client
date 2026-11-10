import { PodRewardNotice } from './PodRewardNotice';
export interface RewardArtifact {
  id: string;
  name: string;
  level: number;
  isUnique: boolean;
}
/** Only newly awarded unique artifacts qualify, never inventory reloads. */
export class RareArtifactNotice {
  static readonly type = 'qipc3.artifact.rare';
  static validLevel(level: number): boolean {
    return Number.isFinite(level) && level >= 0 && level === (level | 0);
  }
  static fromArtifact(artifact: RewardArtifact | null): string | null {
    if (!artifact?.isUnique || !this.validLevel(artifact.level) || artifact.name == null)
      return null;
    const name = artifact.name.trim();
    return PodRewardNotice.validLabel(name) ? name : null;
  }
  static format(playerName: string, name: string, level = 76): string {
    if (!this.validLevel(level) || !playerName || !PodRewardNotice.validLabel(name)) return '';
    return PodRewardNotice.wrap(
      `${PodRewardNotice.escape(playerName)} got ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${PodRewardNotice.escape(name)}!`,
      level < 76,
    );
  }
}
