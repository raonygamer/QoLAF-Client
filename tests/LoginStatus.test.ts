import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setLoginStatusHint } from '../src/login/LoginProfiles';
import { bindGameClasses, type LoadingBar } from '../src/game/Bindings';
import type { API } from '../src/api/Types';
import { LoginLoadingStatus } from '../src/login/LoginLoadingStatus';
import { Display } from './fixtures/NativeGame';
test('cancel hint is removed when Haxe ignores empty subText assignments', () => {
  let label = '';
  const status = {
    connectSubText: {
      set_text(value: string) {
        label = value;
      },
      set_visible(_value: boolean) {},
    },
    // ConnectStatus.set_subText from the current official Haxe client.
    set_subText(value: string) {
      if (value !== '') this.connectSubText.set_text(value);
      return value;
    },
  };
  setLoginStatusHint(status, '(press CTRL to cancel...)');
  assert.equal(label, '(press CTRL to cancel...)');
  status.set_subText('');
  assert.notEqual(label, '', 'native setter alone leaves a stale prompt');
  setLoginStatusHint(status, '');
  assert.equal(label, '');
});


test('parallel loading lines retain source spacing and cleanup restores native visibility', () => {
  class Label extends Display {
    text = '';
    size = 0;
    color = 0xffffff;
    set_size(size: number) {
      this.size = size;
      this.set_height(size);
    }
    set_color(color: number) {
      this.color = color;
    }
    set_text(text: string) {
      this.text = text;
      this.set_width(text.length * 10);
    }
  }
  bindGameClasses({
    cls: (name: string) => (name === 'core.hud.components.TextBitmap' ? Label : {}),
  } as unknown as API);
  for (const statusVisible of [true, false]) {
    const bar = Object.assign(new Display(), { status: new Label(), percent: new Label() });
    bar.status.set_visible(statusVisible);
    bar.percent.set_visible(!statusVisible);
    const loading = new LoginLoadingStatus(bar as unknown as LoadingBar);
    const [texture, network, detail, interfaceAssets] = bar.children as Label[];
    assert.equal(texture.text, 'Loading textures 0%');
    assert.equal(network.text, 'Searching for service rooms...');
    assert.equal(network.get_y(), 31);
    assert.equal(detail.get_visible(), false);
    loading.updateTextures(57.9);
    assert.equal(texture.text, 'Loading textures 57%');
    assert.equal(texture.get_x(), -texture.get_width() / 2);
    loading.setInterfaceLoading(true);
    assert.equal(interfaceAssets.text, 'Loading interface...');
    assert.equal(interfaceAssets.get_visible(), true);
    assert.equal(network.get_y(), 57);
    loading.setInterfaceLoading(false);
    assert.equal(network.get_y(), 31);
    loading.setNetwork('Joining room...', 'Retry 2');
    assert.equal(detail.get_y(), 55);
    assert.equal(detail.get_visible(), true);
    assert.equal(detail.color, 0x999999);
    loading.completeTextures();
    assert.equal(network.get_y(), 5);
    assert.equal(detail.get_y(), 29);
    loading.setNetwork('');
    loading.setDetail('hidden detail');
    assert.equal(detail.get_visible(), false);
    loading.dispose();
    loading.dispose();
    loading.setNetwork('late callback');
    assert.equal(network.text, '');
    assert.equal(bar.children.length, 0);
    assert.equal(bar.status.get_visible(), statusVisible);
    assert.equal(bar.percent.get_visible(), !statusVisible);
  }
});
