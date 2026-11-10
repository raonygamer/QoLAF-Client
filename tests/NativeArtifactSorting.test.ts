import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installArtifactUI } from '../src/artifacts/NativeArtifacts';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('fitness sorting preserves source reveal ordering and resets the rebuilt inventory scroll', () => {
  const hooks = new Hooks();
  const calls: unknown[] = [];
  class Cargo {
    addToolTip() {}
  }
  class Box {
    setArtifact() {}
  }
  class Overview {
    p = {
      artifacts: [
        { id: 'hidden-low', revealed: false, stats: [{ type: 'dotDamage', value: 1 }] },
        { id: 'shown-low', revealed: true, stats: [{ type: 'dotDamage', value: 1 }] },
        { id: 'hidden-high', revealed: false, stats: [{ type: 'dotDamage', value: 2 }] },
        { id: 'shown-high', revealed: true, stats: [{ type: 'dotDamage', value: 2 }] },
      ],
    };
    chooseSortingButton = { set_enabled: (value: boolean) => calls.push(value) };
    cargoBoxes: unknown[] = ['stale'];
    cargoContainer = {
      removeChildren: (...args: unknown[]) => calls.push(args),
      scrollToPosition: (...args: unknown[]) => calls.push(args),
    };
    chooseSorting() {}
    drawArtifactsInCargo() {
      calls.push('draw');
    }
    onSort(order: string) {
      calls.push(['native', order]);
    }
  }
  const classes: Record<string, any> = {
    'core.artifact.ArtifactCargoBox': Cargo,
    'core.artifact.ArtifactBox': Box,
    'core.artifact.ArtifactOverview': Overview,
  };
  installArtifactUI({
    cls: (name: string) => classes[name],
    after: (target: any, name: string, callback: Function) =>
      hooks.add(target, name, 'after', callback),
    around: (target: any, name: string, callback: Function) =>
      hooks.add(target, name, 'around', callback),
  } as any);
  const view = new Overview();
  view.onSort('fitnesshigh');
  assert.deepEqual(
    view.p.artifacts.map((a) => a.id),
    ['shown-high', 'shown-low', 'hidden-high', 'hidden-low'],
  );
  assert.deepEqual(calls, [true, [0, -1, true], 'draw', [0, 0]]);
  assert.deepEqual(view.cargoBoxes, []);
  view.onSort('fitnesslow');
  assert.deepEqual(
    view.p.artifacts.map((a) => a.id),
    ['shown-low', 'shown-high', 'hidden-low', 'hidden-high'],
  );
  view.onSort('shield');
  assert.deepEqual(calls.at(-1), ['native', 'shield']);
});
