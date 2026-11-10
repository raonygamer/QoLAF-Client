import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatArtifactLinkResolver } from '../src/chat/ChatArtifactLinkResolver';
import { ChatArtifactTokenRegistry } from '../src/chat/rich/ChatArtifactTokenRegistry';

function fixture(owner = '', shared = false) {
  let time = 1;
  const requests: { table: string; key: string; ok: (record: any) => void; fail: () => void }[] =
    [];
  const game = {
    me: { id: owner || 'pilot', name: 'Local pilot', level: 100 },
    client: {
      connectUserId: owner,
      bigDB: {
        load(table: string, key: string, ok: (record: any) => void, fail: () => void) {
          requests.push({ table, key, ok, fail });
        },
      },
    },
  };
  const constructed: any[] = [];
  const resolver = new ChatArtifactLinkResolver(
    game,
    (record) => {
      constructed.push(record);
      return { ...record, getColor: () => 0x55ccff };
    },
    (name) => 'Localized ' + name,
    () => time,
    shared ? undefined : new ChatArtifactTokenRegistry(),
  );
  const player = (key = 'pilot') => ({ key, name: 'Remote pilot', level: 80 });
  const artifact = (key = 'artifact', owner = 'pilot') => ({
    key,
    id: key,
    player: owner,
    revealed: true,
    name: 'Name\nwith\ttabs',
    stats: [{ type: 'healthAdd', value: 100 }],
  });
  return {
    resolver,
    requests,
    constructed,
    game,
    player,
    artifact,
    advance: () => {
      time += 30001;
    },
  };
}

test('artifact resolution verifies player then ownership/reveal before constructing and notifying', () => {
  const f = fixture();
  const results: any[] = [];
  f.resolver.onResolved((data) => {
    assert.equal(f.resolver.cached('pilot', 'artifact'), data);
    assert.equal(results[0], data, 'waiters run before UI notification');
  });
  assert.equal(
    f.resolver.resolve('pilot', 'artifact', (data) => results.push(data)),
    false,
  );
  f.resolver.resolve('pilot', 'artifact', (data) => results.push(data));
  assert.deepEqual(
    f.requests.map(({ table, key }) => [table, key]),
    [['PlayerObjects', 'pilot']],
  );
  f.requests.shift()!.ok(f.player());
  assert.equal(f.requests[0].table, 'Artifacts');
  f.requests.shift()!.ok(f.artifact());
  assert.equal(f.constructed.length, 1);
  assert.equal(results.length, 2);
  assert.equal(results[0], results[1]);
  assert.equal(results[0].label, '[Artifact: Localized Name with tabs]');
  assert.equal(results[0].color, 0x55ccff);
  assert.equal(results[0].playerLevel, 80);
  assert.equal(f.resolver.registry.resolveLabel('pilot', 'artifact'), results[0].label);
  assert.equal(f.resolver.resolve('pilot', 'artifact'), true);
  assert.equal(f.requests.length, 0);
  f.resolver.dispose();
});

test('unrevealed, mismatched and failed records remain fallback labels and retry after negative expiry', () => {
  for (const bad of [
    { revealed: false },
    { revealed: 'true' },
    { player: 'other' },
    { key: 'other' },
  ]) {
    const f = fixture();
    const results: any[] = [];
    f.resolver.resolve('pilot', 'artifact', (data) => results.push(data));
    f.requests.shift()!.ok(f.player());
    f.requests.shift()!.ok({ ...f.artifact(), ...bad });
    assert.deepEqual(results, [null]);
    assert.equal(f.constructed.length, 0);
    assert.equal(f.resolver.resolve('pilot', 'artifact'), true);
    assert.equal(f.requests.length, 0);
    assert.equal(f.resolver.resolveLabel('pilot', 'artifact'), '[Artifact]');
    f.advance();
    assert.equal(f.resolver.resolve('pilot', 'artifact'), false);
    assert.equal(
      f.requests[0].table,
      'Artifacts',
      'verified player cache survives negative artifact expiry',
    );
    f.resolver.dispose();
  }
  const f = fixture();
  f.resolver.resolve('pilot', 'artifact');
  f.requests.shift()!.ok(f.player('wrong'));
  assert.equal(f.requests.length, 0, 'invalid player never triggers artifact request');
  f.resolver.dispose();
});

test('pending limits, shared player requests and token scan limits match source', () => {
  const f = fixture();
  for (let i = 0; i < 33; i++) f.resolver.resolve('pilot', 'a' + i);
  assert.equal(f.requests.length, 1, 'parallel artifact requests coalesce their player lookup');
  f.requests.shift()!.ok(f.player());
  assert.equal(f.requests.length, 32);
  f.requests.shift()!.fail();
  assert.equal(
    f.resolver.resolve('pilot', 'a32'),
    false,
    'load-shed links can retry as capacity returns',
  );
  assert.equal(f.requests.at(-1)!.key, 'a32');
  f.resolver.dispose();
  const scan = fixture();
  const tokens = Array.from({ length: 10 }, (_, i) => '$artifact:p' + i + ':a$');
  assert.equal(
    scan.resolver.resolveText('<a title="$artifact:ignored:a$">' + tokens.join(' ')),
    false,
  );
  assert.equal(scan.requests.length, 8);
  assert.equal(scan.requests[0].key, 'p0');
  scan.resolver.resolve('bad:id', 'a');
  assert.equal(scan.requests.length, 8);
  scan.resolver.dispose();
});

test('local registration wins over an older request and reentrant disposal suppresses UI notification', () => {
  const f = fixture();
  f.resolver.resolve('pilot', 'artifact');
  f.requests.shift()!.ok(f.player());
  const request = f.requests.shift()!;
  const local = { ...f.artifact(), name: 'Fresh', stats: [] };
  const registered = f.resolver.registerLocal('pilot', local);
  assert.ok(registered);
  request.fail();
  assert.equal(f.resolver.cached('pilot', 'artifact'), registered);
  assert.equal(f.resolver.registerLocal('other', local), null);
  f.resolver.dispose();
  const reentrant = fixture();
  let notified = false;
  reentrant.resolver.onResolved(() => {
    notified = true;
  });
  reentrant.resolver.resolve('pilot', 'artifact', () => reentrant.resolver.dispose());
  reentrant.requests.shift()!.ok(reentrant.player());
  reentrant.requests.shift()!.ok(reentrant.artifact());
  assert.equal(notified, false);
});

test('room recreation reuses verified cache; account changes invalidate old callbacks and prototype IDs are safe', () => {
  const first = fixture('owner_a', true);
  first.resolver.resolve('__proto__', 'constructor');
  first.requests.shift()!.ok(first.player('__proto__'));
  first.requests.shift()!.ok(first.artifact('constructor', '__proto__'));
  const hit = first.resolver.cached('__proto__', 'constructor');
  first.resolver.dispose();
  const room = fixture('owner_a', true);
  assert.equal(room.resolver.cached('__proto__', 'constructor'), hit);
  let late: any = 'pending';
  room.resolver.resolve('pilot', 'new', (data) => {
    late = data;
  });
  const pending = room.requests.shift()!;
  const other = fixture('owner_b', true);
  assert.equal(other.resolver.cached('__proto__', 'constructor'), null);
  pending.ok(room.player());
  assert.equal(late, null);
  assert.equal(room.requests.length, 0);
  assert.equal(room.resolver.cached('__proto__', 'constructor'), null);
  room.resolver.dispose();
  other.resolver.dispose();
});

test('artifact eviction also removes its projected label and local registration rejects hidden items', () => {
  const f = fixture();
  const local = (id: string) => ({ ...f.artifact(id), stats: [] });
  assert.equal(f.resolver.registerLocal('pilot', { ...local('hidden'), revealed: false }), null);
  for (let index = 0; index < 513; index++) f.resolver.registerLocal('pilot', local('a' + index));
  assert.equal(f.resolver.cached('pilot', 'a0'), null);
  assert.equal(f.resolver.registry.resolveLabel('pilot', 'a0'), '[Artifact]');
  assert.ok(f.resolver.cached('pilot', 'a1'));
  assert.ok(f.resolver.cached('pilot', 'a512'));
  f.resolver.dispose();
});
