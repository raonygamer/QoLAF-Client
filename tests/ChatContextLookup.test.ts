import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadChatContextRecord } from '../src/chat/ChatContextLookup';

test('chat metadata uses account BigDB and settles each request once', () => {
  let received: object | null = null;
  let failures = 0;
  const record = { name: 'Clan' };
  const started = loadChatContextRecord(
    {
      load(table: string, key: string, success: (value: unknown) => void, failure: () => void) {
        assert.equal(table, 'Clans');
        assert.equal(key, 'clan-id');
        success(record);
        failure();
        success({ name: 'Duplicate' });
      },
    },
    'Clans',
    'clan-id',
    (value) => {
      received = value;
    },
    () => {
      failures++;
    },
  );
  assert.equal(started, true);
  assert.equal(received, record);
  assert.equal(failures, 0);
});

test('chat metadata releases a failed request and permits a later lookup', () => {
  let pending = true;
  assert.equal(
    loadChatContextRecord(
      {
        load(
          _table: string,
          _key: string,
          _success: (value: unknown) => void,
          failure: () => void,
        ) {
          failure();
        },
      },
      'PlayerObjects',
      'player-id',
      () => assert.fail('unexpected success'),
      () => {
        pending = false;
      },
    ),
    true,
  );
  assert.equal(pending, false);
  pending = true;
  assert.equal(
    loadChatContextRecord(
      {
        load() {
          throw Error('offline');
        },
      },
      'PlayerObjects',
      'player-id',
      () => assert.fail('unexpected success'),
      () => {
        pending = false;
      },
    ),
    false,
  );
  assert.equal(pending, false);
  assert.equal(
    loadChatContextRecord(
      null,
      'Clans',
      'id',
      () => {},
      () => {},
    ),
    false,
  );
});
