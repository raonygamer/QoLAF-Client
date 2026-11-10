import { read, type Raw } from '../Api/Types';

/** Exact source names: shared ship art and spawner flags are not identities. */
export class NexarEnemyIdentification {
  static displayName(name: string | null): string {
    return name == null ? '' : name.replace(/\s+lvl\s+\d+\s*$/i, '');
  }

  static usesMinibossMarker(enemy: Raw | null): boolean {
    if (!enemy) return false;
    if (enemy.miniboss) return true;
    const name = read(enemy, 'name');
    if (name == null || !name.startsWith('Emperor ')) return false;
    return ['Emperor Xhersix', 'Emperor Yhgvis', 'Emperor Zharix'].includes(this.displayName(name));
  }

  static isImportant(
    name: string | null,
    nexar: boolean,
    miniboss: boolean,
    boss = false,
  ): boolean {
    if (!nexar) return false;
    const title = this.displayName(name);
    if (
      [
        'Nexar Elite Blade',
        'Nexar Elite Edge',
        'Nexar Elite Phaser',
        'Nexar Elite Shadow',
        'Nexar Elite Vindicator',
      ].includes(title)
    )
      return false;
    if (['Emperor Xhersix', 'Emperor Yhgvis', 'Emperor Zharix', 'Nexar Commander'].includes(title))
      return true;
    return miniboss || boss;
  }
}
