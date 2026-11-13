import assert from 'node:assert/strict';
import test from 'node:test';
import { createRadioList } from '../src/radio/RadioList';
import { Display } from './fixtures/NativeGame';

test('native getter-only touches select rows, while cancellation, dragging and scrolling do not', () => {
  const List = createRadioList(() => Display, Display);
  const list: any = Object.create(List.prototype);
  list.items = [{ id: 'first' }, { id: 'second' }];
  list.selected = -1;
  list.press = null;
  Object.defineProperty(list, 'layoutRows', { value: () => {} });
  Object.defineProperty(list, 'verticalScrollPosition', { value: 0, writable: true });
  let changes = 0;
  list.dispatchEventWith = (type: string) => {
    assert.equal(type, 'change');
    changes++;
  };
  const row = { name: '1' };
  const touch = (phase: string, x = 10, y = 10, cancelled = false) => {
    const point = { get_globalX: () => x, get_globalY: () => y, get_cancelled: () => cancelled };
    list.onRowTouch({
      get_currentTarget: () => row,
      getTouch: (target: unknown, requested: string) => {
        assert.equal(target, row);
        return requested === phase ? point : null;
      },
    });
  };
  touch('began');
  touch('ended', 12, 13);
  assert.equal(list.selectedItem.id, 'second');
  assert.equal(changes, 1);
  list.selectedIndex = -1;
  changes = 0;
  touch('began');
  touch('ended', 10, 10, true);
  touch('began');
  touch('ended', 18, 10);
  touch('began');
  list.verticalScrollPosition = 15;
  touch('ended');
  assert.equal(list.selectedIndex, -1);
  assert.equal(changes, 0);
  touch('ended');
  assert.equal(list.selectedIndex, -1);
});
