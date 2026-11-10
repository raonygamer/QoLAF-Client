import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artifactTooltip } from '../src/artifacts/ArtifactTooltip';

function fixture() {
  const localize: Record<string, string> = {
    Artifact: 'Localized artifact',
    Fitness: 'Fitness localized',
    Adequacy: 'Adequacy localized',
  };
  const classes: any = {
    'generics.Localize': { t: (text: string) => localize[text] ?? text },
    'generics.Util': { getFormattedTime: (time: number) => `${time}ms` },
    'core.artifact.ArtifactStat': {
      parseTextFromStatType: (type: string, value: number, unique: boolean) =>
        `${type}:${value}:${unique}`,
    },
  };
  const artifact: any = {
    id: 'a',
    name: 'Artifact',
    revealed: true,
    level: 20,
    levelPotential: 60,
    upgraded: 10,
    upgrading: true,
    upgradeTime: 0,
    get_isRestricted: () => true,
    get_requiredPlayerLevel: () => 50,
    stats: [
      { type: 'healthAdd2', value: 1000, get_isUnique: () => false },
      { type: 'armorAdd', value: 20, get_isUnique: () => true },
    ],
  };
  const player = {
    activeArtifacts: ['equipped'],
    crewMembers: [{ artifact: 'a', artifactEnd: 500 }],
    getArtifactById: () => ({ revealed: true, stats: [{ type: 'healthAdd', value: 1 }] }),
  };
  return {
    api: { cls: (name: string) => classes[name] } as any,
    box: { a: artifact, p: player, g: { time: 100 } },
  };
}

test('cargo tooltip follows source localized order, integer fitness, adequacy and native stat HTML', () => {
  const { api, box } = fixture();
  assert.equal(
    artifactTooltip(api, box, true),
    "Localized artifact<br><font color='#ff0000'>Requires level 50</font><br>" +
      'Level 60, strength 20<br>Fitness localized: 5<br>Adequacy localized: 50%<br>' +
      'Max Upgraded<br>Upgrading: 400ms<br>healthAdd2:1000:false<br>armorAdd:20:true<br>',
  );
  assert.equal(box.a.upgradeTime, 500);
});

test('active tooltip omits cargo-only fitness/restriction and recomputes adequacy after setup changes', () => {
  const { api, box } = fixture();
  const first = artifactTooltip(api, box, false);
  assert.doesNotMatch(first, /Fitness|Requires|Max Upgraded/);
  assert.match(first, /strength 20<br>Adequacy localized: 50%<br>10 upgrades/);
  box.p.activeArtifacts = [];
  assert.match(artifactTooltip(api, box, false), /Adequacy localized: 0%/);
});
