import { read, type Raw } from '../api/Types';
import { artifactFitness } from './Fitness';

export function configureArtifactLayout(view: Raw, width: number, height: number): void {
  Object.assign(view, {
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
  if (!view.expandedView) return;
  view.viewWidth = Math.max(900, width);
  view.viewHeight = Math.max(600, height);
  view.statsWidth = Math.min(340, Math.max(300, Math.round(view.viewWidth * 0.2)));
  view.infoWidth = 250;
  view.cargoX = 14;
  view.cargoWidth = view.viewWidth - 28 - view.statsWidth - view.infoWidth - 40;
  view.cargoY = 152;
  view.actionY = view.viewHeight - 40;
  view.cargoHeight = view.actionY - view.cargoY - 18;
  view.cargoColumns = Math.max(6, Math.trunc((view.cargoWidth - 8) / 36));
  view.statsX = view.cargoX + view.cargoWidth + 20;
  view.statsY = 118;
  view.statsHeight = view.actionY - view.statsY - 18;
  view.infoX = view.statsX + view.statsWidth + 20;
}

export function artifactInventorySummary(player: Raw): string {
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
    if (read(artifact, 'isUnique')) unique++;
    if (artifact.upgrading) upgrading++;
  }
  const optimal = Math.min(150, Math.floor(player.level * 1.2 + 10));
  return (
    "<font color='#ffcc00' size='14'>Artifact inventory</font><br>" +
    `Stored: ${player.artifactCount} / ${read(player, 'artifactLimit')}<br>` +
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
