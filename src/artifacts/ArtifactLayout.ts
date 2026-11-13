import type { Player } from '../game/Bindings';
import { artifactFitness } from './Fitness';

export interface ArtifactLayout {
  expandedView?: boolean;
  viewWidth: number;
  viewHeight: number;
  cargoX: number;
  cargoY: number;
  cargoWidth: number;
  cargoHeight: number;
  cargoColumns: number;
  statsX: number;
  statsY: number;
  statsWidth: number;
  statsHeight: number;
  infoX: number;
  infoWidth: number;
  actionY: number;
}

export function configureArtifactLayout<T extends { expandedView?: boolean }>(
  view: T,
  width: number,
  height: number,
): asserts view is T & ArtifactLayout {
  const layout = Object.assign(view, {
    viewWidth: 665,
    viewHeight: 520,
    cargoX: 0,
    cargoY: 105,
    cargoWidth: 375,
    cargoHeight: 365,
    cargoColumns: 10,
    statsX: 390,
    statsY: 100,
    statsWidth: 270,
    statsHeight: 365,
    infoX: 0,
    infoWidth: 0,
    actionY: 480,
  });
  if (!layout.expandedView) return;
  layout.viewWidth = Math.max(900, width);
  layout.viewHeight = Math.max(600, height);
  layout.statsWidth = Math.min(340, Math.max(300, Math.round(layout.viewWidth * 0.2)));
  layout.infoWidth = 250;
  layout.cargoX = 14;
  layout.cargoWidth = layout.viewWidth - 28 - layout.statsWidth - layout.infoWidth - 40;
  layout.cargoY = 152;
  layout.actionY = layout.viewHeight - 40;
  layout.cargoHeight = layout.actionY - layout.cargoY - 18;
  layout.cargoColumns = Math.max(6, Math.trunc((layout.cargoWidth - 8) / 36));
  layout.statsX = layout.cargoX + layout.cargoWidth + 20;
  layout.statsY = 118;
  layout.statsHeight = layout.actionY - layout.statsY - 18;
  layout.infoX = layout.statsX + layout.statsWidth + 20;
}

export function artifactInventorySummary(
  player: Pick<Player, 'get_level' | 'artifacts' | 'artifactCount' | 'get_artifactLimit'>,
): string {
  let revealed = 0,
    unique = 0,
    upgrading = 0,
    total = 0,
    highest = 0;
  for (const artifact of player.artifacts) {
    if (artifact.revealed) {
      revealed++;
      const fitness = artifactFitness(artifact);
      total += fitness;
      highest = Math.max(highest, fitness);
    }
    if (artifact.get_isUnique()) unique++;
    if (artifact.upgrading) upgrading++;
  }
  const optimal = Math.min(150, Math.floor(player.get_level() * 1.2 + 10));
  return (
    "<font color='#ffcc00' size='14'>Artifact inventory</font><br>" +
    `Stored: ${player.artifactCount} / ${player.get_artifactLimit()}<br>` +
    `Revealed: ${revealed}   Unique: ${unique}<br>Upgrading: ${upgrading}<br>` +
    `Optimal artifact level: ${optimal}${optimal === 150 ? ' (Max)' : ''}<br>` +
    `Average fitness: ${(revealed ? total / revealed : 0).toFixed(1)}<br>` +
    `Highest fitness: ${highest.toFixed(1)}`
  );
}

export const artifactFitnessGuide =
  "<font color='#ffcc00' size='14'>Understanding artifacts</font><br>" +
  "<font color='#ffff88'>Potential</font> is the artifact's original drop level and controls its player-level requirement.<br>" +
  "<font color='#ffff88'>Strength</font> is its current level and the base used for modifier power. Upgrades can raise it.<br>" +
  "<font color='#ffff88'>Lines</font> is the number of modifiers on the artifact.<br>" +
  "<font color='#ffff88'>Fitness</font> is a weighted total of every modifier, making unlike stat types easier to compare. It is a quality guide, not a damage percentage.<br><br>" +
  "<font color='#ffff88'>Adequacy</font> measures how closely an artifact's modifier families match the currently equipped setup. Tiered variants count as the same family; 100% means every line matches the setup's most-used family. It measures build fit, not power.<br><br>" +
  "<font color='#ffcc00'>Purify filters</font><br>Purify checks unrevealed artifacts only and recycles up to 40 that fall below any saved minimum. Favorite artifacts, unique artifacts and the Recycle Generator are protected.";
