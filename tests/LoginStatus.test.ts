import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setLoginStatusHint } from '../src/login/LoginProfiles';

test('cancel hint is removed when Haxe ignores empty subText assignments', () => {
  let label = '';
  const status = {
    connectSubText: {
      set_text(value: string) {
        label = value;
      },
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
