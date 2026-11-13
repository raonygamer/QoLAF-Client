import {
  ArtifactStat,
  Localize,
  Util,
  type Artifact,
  type Player,
  type GameScene,
} from '../game/Bindings';

export interface ArtifactTooltipContext {
  a: Artifact;
  p: Player;
  g: Pick<GameScene, 'time'>;
}
import { artifactAdequacyValue } from './ArtifactOrder';
import { artifactFitness } from './Fitness';

/** Original cargo/active artifact tooltip ordering and localization. */
export function artifactTooltip(box: ArtifactTooltipContext, cargo: boolean): string {
  const artifact = box.a;
  const t = (text: string) => Localize.t(text);
  for (const crew of box.p.crewMembers ?? [])
    if (crew.artifact === artifact.id) artifact.upgradeTime = crew.artifactEnd;
  let text = t(artifact.name) + '<br>';
  if (cargo && artifact.get_isRestricted())
    text +=
      t("<font color='#ff0000'>Requires level [level]</font>").replace(
        '[level]',
        String(artifact.get_requiredPlayerLevel()),
      ) + '<br>';
  text +=
    t('Level [potential], strength [level]')
      .replace('[level]', String(artifact.level))
      .replace('[potential]', String(artifact.levelPotential)) + '<br>';
  if (cargo) text += `${t('Fitness')}: ${artifactFitness(artifact) | 0}<br>`;
  text += `${t('Adequacy')}: ${artifactAdequacyValue(box.p, artifact).toFixed(0)}%<br>`;
  if (cargo && artifact.upgraded >= 10) text += t('Max Upgraded') + '<br>';
  else if (artifact.upgraded > 0)
    text += t('[nr] upgrades').replace('[nr]', String(artifact.upgraded)) + '<br>';
  if (artifact.upgrading)
    text +=
      t('Upgrading') + ': ' + Util.getFormattedTime(artifact.upgradeTime - box.g.time) + '<br>';
  for (const stat of artifact.stats)
    text += ArtifactStat.parseTextFromStatType(stat.type, stat.value, stat.get_isUnique()) + '<br>';
  return text;
}
