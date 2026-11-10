import { read, type API, type Raw } from '../api/Types';
import { artifactAdequacyValue } from './ArtifactOrder';
import { artifactFitness } from './Fitness';

/** Original cargo/active artifact tooltip ordering and localization. */
export function artifactTooltip(api: API, box: Raw, cargo: boolean): string {
  const artifact = box.a;
  const localize = api.cls('generics.Localize')!;
  const util = api.cls('generics.Util')!;
  const statText = api.cls('core.artifact.ArtifactStat')!;
  const t = (text: string) => localize.t(text);
  for (const crew of box.p.crewMembers ?? [])
    if (crew.artifact === artifact.id) artifact.upgradeTime = crew.artifactEnd;
  let text = t(artifact.name) + '<br>';
  if (cargo && read(artifact, 'isRestricted'))
    text +=
      t("<font color='#ff0000'>Requires level [level]</font>").replace(
        '[level]',
        String(read(artifact, 'requiredPlayerLevel')),
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
      t('Upgrading') + ': ' + util.getFormattedTime(artifact.upgradeTime - box.g.time) + '<br>';
  for (const stat of artifact.stats)
    text += statText.parseTextFromStatType(stat.type, stat.value, read(stat, 'isUnique')) + '<br>';
  return text;
}
