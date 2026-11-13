import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { API } from '../src/api/Types';
import { bindGameClasses } from '../src/game/Bindings';
import { installExplorationRewards } from '../src/artifacts/ExplorationRewards';
// @ts-expect-error actual host dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('exploration rewards count once, reuse refreshed inventory and ignore stale report UI', () => {
  type Artifact = { id: string };
  const owner = {
    artifacts: [] as Artifact[] | null,
    artifactCount: 0,
    getArtifactById(id: string) {
      return this.artifacts?.find((a) => a.id === id) ?? null;
    },
    get_artifactLimit: () => 1,
  };
  const other = { ...owner, artifacts: [] as Artifact[] };
  let current = owner,
    leaving = false,
    limits = 0,
    failures = 0;
  const game = {
    get_me: () => current,
    get_isLeaving: () => leaving,
    hud: { showArtifactLimitText: () => limits++ },
  };
  const scene = { instance: game };
  class Box {
    x = 0;
    y = 0;
    constructor(
      _game: object,
      public artifact: Artifact,
    ) {}
    update() {}
    set_x(value: number) {
      this.x = value;
    }
    set_y(value: number) {
      this.y = value;
    }
    get_width() {
      return 100;
    }
  }
  class Report {
    g = game;
    container: object | null = {};
    children: Box[] = [];
    rewardStepContainer = { addChild: (box: Box) => this.children.push(box) };
    rewardTweens: object[] = [];
    createArtifactFunction(
      _count: number,
      _index: number,
      _id: string,
    ): (artifact: Artifact | null) => void {
      return (artifact) => {
        if (!artifact) failures++;
        else throw new Error('unsafe native callback');
      };
    }
  }
  const hooks = new Hooks(),
    cleanup: Array<() => void> = [];
  const classes: Record<string, unknown> = {
    'core.states.exploreStates.ReportState': Report,
    'core.artifact.ArtifactBox': Box,
    'core.scene.Game': scene,
    'com.greensock.TweenMax': { from: () => ({}) },
  };
  const api = {
    cls: (name: string) => classes[name] ?? {},
    around(owner: object, name: string, callback: unknown) {
      const off = hooks.add(owner, name, 'around', callback);
      cleanup.push(off);
      return off;
    },
    defer: (off: () => void) => cleanup.push(off),
  } as unknown as API;
  bindGameClasses(api);
  installExplorationRewards(api);
  const report = new Report();
  try {
    const first = report.createArtifactFunction(1, 0, 'a');
    report.createArtifactFunction(1, 0, 'a');
    assert.equal(owner.artifactCount, 1);
    assert.equal(limits, 1);
    const refreshed = { id: 'a' };
    owner.artifacts!.push(refreshed);
    first({ id: 'a' });
    assert.equal(owner.artifacts!.length, 1);
    assert.equal(report.children[0]?.artifact, refreshed);
    assert.equal(report.children[0]?.x, 207.5);
    assert.equal(report.children[0]?.y, 200);
    const late = report.createArtifactFunction(1, 1, 'b');
    report.container = null;
    current = other;
    late({ id: 'b' });
    assert.equal(owner.artifacts!.length, 2);
    assert.equal(other.artifacts.length, 0);
    assert.equal(report.children.length, 1);
    late(null);
    assert.equal(failures, 1);
    current = owner;
    report.container = {};
    const leavingCallback = report.createArtifactFunction(1, 2, 'c');
    leaving = true;
    leavingCallback({ id: 'c' });
    assert.equal(report.children.length, 1);
    owner.artifacts = null;
    leavingCallback({ id: 'c' });
  } finally {
    cleanup.reverse().forEach((off) => off());
  }
});
