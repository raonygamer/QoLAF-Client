import type { Artifact, Player } from '../game/Bindings';
import { artifactFitness } from './Fitness';

/** Artifact.statFamily treats only tier suffixes 2 and 3 as the same modifier. */
export function artifactStatFamily(type: string | null): string {
  return type ? type.replace(/[23]$/, '') : '';
}

/** Source overview adequacy: affinity with the currently equipped modifier mix. */
function adequacyWeights(player: Player): Map<string, number> {
  const counts = new Map<string, number>();
  let highest = 0;
  for (const id of player.get_activeArtifacts()) {
    const artifact = player.getArtifactById(id);
    if (!artifact?.revealed) continue;
    for (const stat of artifact.stats) {
      const family = artifactStatFamily(stat.type);
      const count = (counts.get(family) ?? 0) + 1;
      counts.set(family, count);
      highest = Math.max(highest, count);
    }
  }
  for (const [family, count] of counts) counts.set(family, count / highest);
  return counts;
}

function scoreAdequacy(artifact: Artifact, weights: Map<string, number>): number {
  if (!artifact.revealed || !artifact.stats?.length || !weights.size) return 0;
  let matched = 0;
  for (const stat of artifact.stats) matched += weights.get(artifactStatFamily(stat.type)) ?? 0;
  return (100 * matched) / artifact.stats.length;
}

export function artifactAdequacyValue(player: Player, artifact: Artifact): number {
  return scoreAdequacy(artifact, adequacyWeights(player));
}

export function artifactAdequacy(player: Player): Map<Artifact, number> {
  const weights = adequacyWeights(player);
  return new Map(
    player.artifacts.map((artifact: Artifact) => [artifact, scoreAdequacy(artifact, weights)]),
  );
}

/** Source comparators; unknown stat orders remain the native game's responsibility. */
export function artifactOrder(
  player: Player,
  order: string,
): ((a: Artifact, b: Artifact) => number) | null {
  const adequacy = order.startsWith('adequacy') ? artifactAdequacy(player) : null;
  const value: Record<string, (artifact: Artifact) => number | string> = {
    level: (a) => a.level,
    potential: (a) => a.levelPotential ?? a.level,
    fitness: (a) => artifactFitness(a),
    adequacy: (a) => adequacy?.get(a) ?? 0,
    modifiers: (a) => a.stats.length,
    upgrades: (a) => a.upgraded,
    name: (a) => (a.name ?? '').toLowerCase(),
  };
  if (order === 'statcountasc') order = 'modifiershigh';
  if (order === 'statcountdesc') order = 'modifierslow';
  const match =
    /^(level|potential|fitness|adequacy|modifiers|upgrades|name)(high|low|asc|desc)$/.exec(order);
  if (!match) return null;
  const metric = value[match[1]];
  const direction = match[2] === 'high' || match[2] === 'desc' ? -1 : 1;
  return (a, b) => {
    if (a.revealed !== b.revealed) return a.revealed ? -1 : 1;
    const left = metric(a),
      right = metric(b);
    return left < right ? -direction : left > right ? direction : 0;
  };
}
