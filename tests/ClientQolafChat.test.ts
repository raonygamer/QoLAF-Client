import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { ClientIpcService } from '../src/ipc/ClientIpcService';
import { ClientQolafChat, type QolafChatRow } from '../src/chat/ClientQolafChat';
import { PodRewardNotice } from '../src/chat/PodRewardNotice';
import { RareArtifactNotice } from '../src/chat/RareArtifactNotice';
import { PurchaseNotice } from '../src/chat/PurchaseNotice';
import { installNativeQolafChat } from '../src/chat/NativeQolafChat';

function fixture(t: { after(fn: () => void): void }) {
  ClientQolafChat.shutdown();
  ClientIpcService.shutdown();
  let now = 0;
  const timers = new Set<() => void>();
  const interval = (callback: () => void) => {
    timers.add(callback);
    return () => {
      timers.delete(callback);
    };
  };
  const ipc = ClientIpcService.ensure(
    { connectUserId: 'owner', createJoinRoom() {} },
    '0.3.0 (Public)',
    {
      now: () => now,
      random: () => 0.3,
      interval,
      defer: (fn) => fn(),
      debug() {},
    },
  )!;
  Object.defineProperty(ipc, 'connected', { configurable: true, value: true });
  const jobs: any[] = [];
  ipc.broadcast = (message, options) => {
    jobs.push({ message, options });
    return true;
  };
  const environment = {
    now: () => now,
    interval,
    hash: (text: string) => createHash('md5').update(text).digest('hex'),
    skinName: (key: string) => (key === 'skin' ? 'A ship' : null),
  };
  const chat = ClientQolafChat.ensure(ipc, 'owner', 'Owner', environment)!;
  t.after(() => {
    ClientQolafChat.shutdown();
    ClientIpcService.shutdown();
  });
  return {
    ipc,
    chat,
    jobs,
    timers,
    environment,
    receive: (body: unknown, id = 'peer', name = 'Peer') =>
      (chat as any).onMessage({ type: ClientQolafChat.type, fields: [body] }, id, name),
    advance: (ms: number) => {
      now += ms;
      for (const tick of [...timers]) tick();
    },
  };
}

test('QoLAF inbox survives scene receivers, copies rows on retries and expires bounded history', (t) => {
  const f = fixture(t);
  f.receive('before scene');
  const first = (row: QolafChatRow) => {
    row.body = 'mutated';
    return false;
  };
  f.chat.attachReceiver(first);
  f.chat.detachReceiver(first);
  const rows: QolafChatRow[] = [];
  const receiver = (row: QolafChatRow) => {
    rows.push(row);
    return true;
  };
  f.chat.attachReceiver(receiver);
  assert.equal(rows[0].body, 'before scene');
  assert.equal(rows[0].ownerId, 'owner');
  f.chat.detachReceiver(receiver);
  for (let i = 0; i < 70; i++) f.receive(String(i));
  f.chat.attachReceiver(receiver);
  assert.equal(rows.length, 65);
  assert.equal(rows[1].body, '6');
  f.chat.detachReceiver(receiver);
  f.receive('expires');
  f.advance(300000);
  f.chat.attachReceiver(receiver);
  assert.equal(rows.length, 65);
});

test('QoLAF sends echo only after transport success, isolate stale scenes, and reject invalid bodies', (t) => {
  const f = fixture(t);
  const rows: QolafChatRow[] = [];
  const errors: string[] = [];
  const receiver = (row: QolafChatRow) => {
    rows.push(row);
    return true;
  };
  f.chat.attachReceiver(receiver);
  for (const body of ['', '   ', 'a'.repeat(251), '<script>x</script>'])
    assert.equal(f.chat.send(body), false);
  assert.equal(f.jobs.length, 0);
  assert.equal(
    f.chat.send('hello', (value) => errors.push(value)),
    true,
  );
  assert.equal(rows.length, 0);
  assert.equal(f.jobs[0].options.beforeSend().fields[0], 'hello');
  f.jobs[0].options.onSent();
  f.jobs[0].options.onSent();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].senderId, 'owner');
  f.chat.send('later', (value) => errors.push(value));
  f.chat.detachReceiver(receiver);
  f.jobs[1].options.onError('stale scene');
  assert.deepEqual(errors, []);
  f.chat.send('cancelled');
  ClientIpcService.shutdown();
  assert.equal(f.jobs[2].options.beforeSend(), null);
  f.jobs[2].options.onSent();
  assert.equal(rows.length, 1);
  assert.equal(f.timers.size, 0);
});

test('inbox rejects malformed/self input and safely handles receiver changes during delivery', (t) => {
  const f = fixture(t);
  for (const body of [null, 1, '', ' ', 'x'.repeat(251), '<bad>x</bad>']) f.receive(body);
  f.receive('self', 'owner');
  f.receive('bad id', 'peer\n');
  f.receive('bad name', 'peer', 'Peer\n');
  f.receive('one');
  f.receive('two');
  const rows: string[] = [];
  const second = (row: QolafChatRow) => {
    rows.push(row.body);
    return true;
  };
  const first = (row: QolafChatRow) => {
    rows.push(row.body);
    f.chat.attachReceiver(second);
    return true;
  };
  f.chat.attachReceiver(first);
  f.advance(1000);
  assert.deepEqual(rows, ['one', 'two']);
});

test('reward notices retain receipt validation, escaping, per-operation deduplication and retry expiry', (t) => {
  const f = fixture(t);
  const rows: QolafChatRow[] = [];
  f.chat.attachReceiver((row) => {
    rows.push(row);
    return true;
  });
  const reply = { type: 'openPod', fields: [true, 'Skins', 'Old ship', '', true, 123, 'rare'] };
  assert.equal(PodRewardNotice.fromReply(reply), '123 Flux');
  const operation = { type: 'openPod' };
  f.chat.announcePodReward(reply, operation);
  f.chat.announcePodReward(reply, operation);
  assert.equal(rows.length, 1);
  assert.equal(f.jobs.length, 1);
  f.jobs[0].options.onError('retry');
  f.advance(1999);
  assert.equal(f.jobs.length, 1);
  f.advance(1);
  assert.equal(f.jobs.length, 2);
  f.advance(300000);
  assert.equal(f.jobs[1].options.beforeSend(), null);
  assert.match(RareArtifactNotice.format('<Peer>', 'Artifact', 75), /#43efdf.*&lt;Peer&gt;/);
  assert.equal(PurchaseNotice.isPaidCoinReceipt({ amount: 10 }, 10, 10), false);
  assert.equal(
    PurchaseNotice.isPaidCoinReceipt(
      { amount: 10, providerPrice: 'paid', providerTransactionId: 'id', itemKeys: [] },
      10,
      12,
    ),
    true,
  );
});

test('native QoLAF tab uses the rich log, retains rejected drafts, and detaches only its scene', (t) => {
  const f = fixture(t);
  const cleanups: Function[] = [];
  const hook = (target: any, key: string, callback: Function) => {
    const prior = target[key];
    target[key] = function (...args: any[]) {
      return callback.call(this, (...values: any[]) => prior.apply(this, values), ...args);
    };
    cleanups.push(() => {
      target[key] = prior;
    });
  };
  const input = {
    text: '',
    get_text() {
      return this.text;
    },
    set_text(text: string) {
      this.text = text;
    },
  };
  const tabs = {
    dataProvider: [{ label: 'Local', chatMode: 'local' }],
    set_dataProvider(value: any) {
      this.dataProvider = value;
    },
  };
  const chat = {
    input,
    tabs,
    chatMode: 'local',
    updateTab() {},
    sendMessage() {
      throw new Error('native send must not receive QoLAF');
    },
    parseCommand(text: string) {
      return text.startsWith('/qolaf')
        ? text
            .trim()
            .split(/ (.*)/s)
            .filter(Boolean)
            .map((x, i) => (i ? x : 'qolaf'))
        : [this.chatMode, text];
    },
  };
  const rows: any[] = [];
  const game: any = {
    client: { connectUserId: 'owner' },
    me: { id: 'owner', name: 'Owner' },
    chatInput: chat,
    playerManager: {},
    messageLog: { isMuted: () => false, updateTexts: (row: any) => rows.push(row) },
  };
  const log: any = {
    g: game,
    textQueue: [{ qolafOwner: 'other' }],
    colorCoding: (text: string) => text,
    write(text: string, type: string) {
      const row = { text, type };
      this.textQueue.push(row);
      game.messageLog.updateTexts(row);
    },
    writeChatMsg(channel: string, text: string, id: string, name: string) {
      this.write(this.colorCoding('[' + channel + ']') + name + ': ' + text, channel);
    },
  };
  const api: any = {
    game,
    cls: (name: string) => (name.endsWith('.MessageLog') ? log : null),
    around: hook,
    defer: (fn: Function) => cleanups.push(fn),
    interval() {},
  };
  installNativeQolafChat(api, game);
  assert.equal(tabs.dataProvider.at(-1)!.chatMode, 'qolaf');
  assert.deepEqual(log.textQueue, []);
  f.receive('hello', 'peer', '<Peer>');
  assert.equal(rows[0].qolafOwner, 'owner');
  assert.equal(rows[0].playerName, '<Peer>');
  assert.match(rows[0].text, /#82cfff.*&lt;Peer&gt;/);
  chat.chatMode = 'qolaf';
  input.text = 'message';
  Object.defineProperty(f.ipc, 'connected', { configurable: true, value: false });
  chat.sendMessage();
  assert.equal(input.text, 'message');
  Object.defineProperty(f.ipc, 'connected', { configurable: true, value: true });
  chat.sendMessage();
  assert.equal(input.text, '');
  assert.equal(f.jobs.length, 1);
  for (const cleanup of cleanups.reverse()) cleanup();
  assert.equal(tabs.dataProvider.length, 1);
  assert.equal(ClientIpcService.instance, f.ipc);
});
