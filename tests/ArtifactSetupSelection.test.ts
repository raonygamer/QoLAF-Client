import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installArtifactSetupSelection } from '../src/artifacts/ArtifactSetupSelection';
// @ts-expect-error actual host hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

test('setup selection uses native setters, compact labels, and authoritative player state', () => {
  const errors: unknown[] = [];
  const hooks = new Hooks((error: unknown) => errors.push(error));
  const cleanup: Function[] = [];
  class Toggle {
    selected = false;
    skinSelected = false;
    label = '';
    labelFont = 'DAIDRR';
    labelSize = 12;
    format = {
      font: 'DAIDRR',
      size: 12,
      set_font(value: string) {
        this.font = value;
      },
      set_size(value: number) {
        this.size = value;
      },
    };
    textField = {
      get_format: () => this.format,
      pixelSnapping: true,
      set_pixelSnapping(value: boolean) {
        this.pixelSnapping = value;
      },
    };
    width = 0;
    height = 0;
    x = 0;
    trigger: (() => void) | null = null;
    set_selected(value: boolean) {
      this.selected = this.skinSelected = value;
    }
    set_label(value: string) {
      this.label = value;
      this.width = 99;
    }
    set_width(value: number) {
      this.width = value;
    }
    get_width() {
      return this.width;
    }
    set_height(value: number) {
      this.height = value;
    }
    set_x(value: number) {
      this.x = value;
    }
    dispatchEventWith(type: string, _bubbles: boolean) {
      if (type === 'triggered') this.trigger?.();
    }
    onTriggered() {
      this.set_selected(!this.selected);
      this.dispatchEventWith('triggered', true);
    }
  }
  class Overview {
    p = { artifactSetups: [[], [], []], activeArtifactSetup: 0 };
    setups: Toggle[] = [];
    allowed = false;
    drawArtifactSetups() {
      this.setups = Array.from({ length: 4 }, () => new Toggle());
      this.setups.forEach((button, index) => {
        button.trigger = () => {
          if (this.allowed && index < this.p.artifactSetups.length)
            this.p.activeArtifactSetup = index;
          this.syncSetupButtons();
        };
      });
    }
    // Native Service1412 writes .selected without updating the control skin.
    syncSetupButtons() {
      this.setups.forEach((button, index) => {
        button.selected = index === this.p.activeArtifactSetup;
      });
    }
  }
  const classes: Record<string, any> = {
    'core.artifact.ArtifactOverview': Overview,
    'core.hud.components.ui.ToggleButton': Toggle,
    'generics.Localize': { t: () => 'Setup' },
  };
  const api: any = { cls: (name: string) => classes[name] };
  for (const kind of ['after', 'around'])
    api[kind] = (target: any, key: string, fn: Function) =>
      cleanup.push(hooks.add(target, key, kind, fn));
  installArtifactSetupSelection(api);
  const view = new Overview();
  view.drawArtifactSetups();
  for (const button of view.setups) {
    assert.equal(button.format.font, 'DAIDRR_16');
    assert.equal(button.format.size, 10);
    assert.equal(button.textField.pixelSnapping, false);
  }
  assert.deepEqual(
    view.setups.map((button) => button.label),
    ['Setup 1', '2', '3', ''],
  );
  assert.deepEqual(
    view.setups.map((button) => button.width),
    [72, 32, 32, 34],
  );
  assert.deepEqual(
    view.setups.map((button) => button.x),
    [0, 78, 116, 154],
  );
  view.setups[1].onTriggered();
  assert.equal(view.p.activeArtifactSetup, 0, 'rejected native change remains rejected');
  assert.deepEqual(
    view.setups.map((button) => button.skinSelected),
    [true, false, false, false],
  );
  view.allowed = true;
  view.setups[1].onTriggered();
  assert.deepEqual(
    view.setups.map((button) => button.skinSelected),
    [false, true, false, false],
  );
  assert.deepEqual(
    view.setups.map((button) => button.label),
    ['1', 'Setup 2', '3', ''],
  );
  assert.deepEqual(
    view.setups.map((button) => button.width),
    [32, 72, 32, 34],
  );
  const unrelated = new Toggle();
  unrelated.onTriggered();
  assert.equal(unrelated.selected, true, 'other native toggle controls retain self-toggling');
  assert.equal(unrelated.format.font, 'DAIDRR');
  assert.deepEqual(errors, []);
  cleanup.reverse().forEach((fn) => fn());
});
