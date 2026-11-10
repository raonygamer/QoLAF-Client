import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNativeRewardNotices } from '../src/chat/NativeRewardNotices';
import { PaidReceiptWatcher } from '../src/chat/PaidReceiptWatcher';
import { readNativeMessage } from '../src/ipc/NativeMessage';
// @ts-expect-error extracted Haxe methods
import { podClick, skinBuy, packageClose, artifactLoad } from './fixtures/NativeRewards.js';
// @ts-expect-error real hook dispatcher
import { Hooks } from './fixtures/HostCore.js';

const message = (type: string, fields: unknown[]) => ({
  type,
  length: fields.length,
  raw: { _internal_: () => fields },
  getInt: (i: number) => fields[i],
  getString: (i: number) => fields[i],
});

function fixture(t: { after(fn: () => void): void }) {
  const hooks = new Hooks();
  const cleanups: Function[] = [];
  const requests: any[] = [];
  const artifactRequests: any[] = [];
  const notices: any[] = [];
  let live = true;
  const feed: any = {
    announcePodReward: (...args: any[]) => {
      if (live) notices.push(['pod', ...args]);
    },
    announcePurchasedSkins: (...args: any[]) => {
      if (live) notices.push(['skins', ...args]);
    },
    announceArtifactReward: (...args: any[]) => {
      if (live) notices.push(['artifact', ...args]);
    },
  };
  class Scene {
    client = { connectUserId: 'owner' };
    me: any;
    blockHotkeys = false;
    textManager = { createDropText() {} };
    get_me() {
      return this.me;
    }
    createMessage(type: string) {
      return { type };
    }
    rpc(type: string, callback: Function, args?: unknown[]) {
      requests.push({ type, callback, args });
    }
    rpcMessage(request: any, callback: Function) {
      requests.push({ type: request.type, callback, request });
    }
  }
  const game = new Scene();
  class Pod {
    g = game;
    openPodPending = false;
    closeButton = { set_enabled() {} };
    soundManager = { play() {} };
    replies: any[] = [];
    UpdateNrOfPods() {}
    onOpenPod(...args: any[]) {
      this.replies.push(args);
    }
    createClickOpenPod = undefined as any;
  }
  delete new Pod().createClickOpenPod;
  Object.defineProperty(Pod.prototype, 'createClickOpenPod', {
    configurable: true,
    writable: true,
    value: podClick(),
  });
  class Skin {
    g = game;
    replies: any[] = [];
    onBuyComplete(reply: any) {
      this.replies.push(reply);
    }
  }
  (Skin.prototype as any).onBuy = skinBuy();
  class Package {
    g = game;
    rpcFunction = 'buyPackage';
    replies: any[] = [];
    onSuccess(reply: any) {
      this.replies.push(reply);
    }
  }
  (Package.prototype as any).onClose = packageClose();
  const Factory = { createArtifact: (...args: any[]) => artifactRequests.push(args) };
  class Player {
    g = game;
    id = 'owner';
    isMe = true;
    artifacts: any[] = [];
  }
  (Player.prototype as any).loadArtifactsFromMessage = artifactLoad(Factory, { writeChatMsg() {} });
  const player: any = (game.me = new Player());
  const classes: any = {
    'core.scene.SceneBase': Scene,
    'core.states.gameStates.PodState': Pod,
    'core.hud.components.hangar.SkinItem': Skin,
    'core.hud.components.credits.CreditPackageItem': Package,
    'core.player.Player': Player,
    'core.artifact.ArtifactFactory': Factory,
  };
  const api: any = {
    game,
    cls: (name: string) => classes[name],
    defer: (fn: Function) => cleanups.push(fn),
    around: (target: any, key: string, fn: Function) =>
      cleanups.push(hooks.add(target, key, 'around', fn)),
  };
  installNativeRewardNotices(api, (owner) => (owner === game ? feed : null));
  const cleanup = () => {
    for (const fn of cleanups.splice(0).reverse()) fn();
  };
  t.after(cleanup);
  return {
    game,
    Pod,
    Skin,
    Package,
    Player,
    player,
    feed,
    notices,
    requests,
    artifactRequests,
    cleanup,
    expire: () => {
      live = false;
    },
    Factory,
  };
}

test('pod and skin notices observe confirmed RPC callbacks and preserve native calls after a screen closes', (t) => {
  const f = fixture(t);
  const pod: any = new f.Pod();
  delete pod.createClickOpenPod;
  const click = pod.createClickOpenPod({ key: 'display pod' });
  click();
  click();
  assert.equal(f.requests.length, 1);
  assert.equal(f.notices.length, 0);
  assert.equal(f.requests[0].type, 'openPod');
  const reply = message('openPod', [true, 'Weapons', 'Item', '', false, 1, 'rare']);
  f.requests[0].callback(reply);
  assert.equal(pod.replies[0][0], reply);
  assert.equal(f.notices[0][0], 'pod');
  assert.equal(f.notices[0][2].type, 'openPod');
  const skin: any = new f.Skin();
  skin.onBuy({ key: 'skin' });
  assert.deepEqual(f.requests[1].args, ['skin']);
  f.requests[1].callback(message('buySkin', [true, 'skin']));
  assert.equal(f.notices[1][0], 'skins');
  const pack: any = new f.Package();
  pack.onClose();
  const packageReply: any = message('buyPackage', [true, 'skin']);
  packageReply.getBoolean = () => true;
  f.requests[2].callback(packageReply);
  assert.equal(f.notices[2][0], 'skins');
  assert.equal(pack.replies[0], packageReply);
  f.game.rpc('buySkin', () => {});
  f.requests[3].callback(message('buySkin', [true, 'unrelated']));
  assert.equal(f.notices.length, 3, 'unscoped calls cannot announce purchases');
});

test('artifact hooks distinguish loot, inventory reloads, other players and expired authentication', (t) => {
  const f = fixture(t);
  const artifact = { id: 'artifact', name: 'Item', level: 75, get_isUnique: () => true };
  f.player.loadArtifactsFromMessage(message('inventory', [1, 'artifact']), 0, false);
  f.artifactRequests[0][3](artifact);
  assert.equal(f.notices.length, 0);
  f.player.loadArtifactsFromMessage(message('loot', [1, 'artifact']), 0, true);
  assert.equal(f.notices.length, 0);
  f.artifactRequests[1][3](artifact);
  assert.deepEqual(f.notices[0], [
    'artifact',
    { id: 'artifact', name: 'Item', level: 75, isUnique: true },
  ]);
  const other: any = new f.Player();
  other.id = 'other';
  other.isMe = false;
  other.loadArtifactsFromMessage(message('loot', [1, 'artifact']), 0, true);
  f.artifactRequests[2][3](artifact);
  assert.equal(f.notices.length, 1);
  f.player.loadArtifactsFromMessage(message('loot', [1, 'artifact']), 0, true);
  f.expire();
  f.artifactRequests[3][3](artifact);
  assert.equal(f.notices.length, 1);
  assert.equal(f.player.artifacts.length, 3, 'native inventory callback still runs');
});

test('malformed replies and failing notice callbacks never block native completion; cleanup invalidates pending work', (t) => {
  const f = fixture(t);
  const skin: any = new f.Skin();
  skin.onBuy({ key: 'one' });
  f.requests[0].callback({ type: 'buySkin', length: 2, raw: { _internal_: () => [true] } });
  assert.equal(f.notices.length, 0);
  assert.equal(skin.replies.length, 1);
  skin.onBuy({ key: 'two' });
  f.feed.announcePurchasedSkins = () => {
    throw new Error('notice only');
  };
  f.requests[1].callback(message('buySkin', [true, 'two']));
  assert.equal(skin.replies.length, 2);
  skin.onBuy({ key: 'three' });
  f.cleanup();
  f.requests[2].callback(message('buySkin', [true, 'three']));
  assert.equal(skin.replies.length, 3);
  assert.equal(
    readNativeMessage({
      raw: {
        _internal_: () => {
          throw Error();
        },
      },
    }),
    null,
  );
});

const receipt = (id: string, amount = 100, timestamp = 1000) => ({
  providerTransactionId: id,
  providerPrice: 'paid',
  amount,
  timestamp: new Date(timestamp),
  itemKeys: [],
});
function receiptFixture() {
  const reads: any[] = [],
    timers: any[] = [];
  let live = true,
    announced = 0,
    finished = 0;
  const watcher = new PaidReceiptWatcher(
    {
      current: () => live,
      readHistory: (success, failure) => reads.push({ success, failure }),
      later: (callback, ms) => {
        const timer = { callback, ms, cancelled: false };
        timers.push(timer);
        return () => {
          timer.cancelled = true;
        };
      },
      finished: () => finished++,
    },
    100,
    150,
    () => announced++,
  );
  return {
    watcher,
    reads,
    timers,
    expire: () => {
      live = false;
    },
    announced: () => announced,
    finished: () => finished,
  };
}

test('receipt proof excludes old, unrelated, item and malformed records and waits for baseline readiness', () => {
  const f = receiptFixture();
  f.watcher.request();
  f.watcher.request();
  assert.equal(f.reads.length, 1);
  f.reads[0].success([receipt('old')]);
  assert.equal(f.reads.length, 2);
  f.reads[1].success([
    receipt('old'),
    receipt('other', 999),
    { ...receipt('item'), itemKeys: ['ship'] },
    receipt('older', 100, 500),
    { ...receipt('bad'), providerPrice: '' },
    { ...receipt('date'), timestamp: '1000' },
  ]);
  assert.equal(f.announced(), 0);
  assert.equal(f.timers[0].ms, 2000);
  f.timers[0].callback();
  f.reads[2].success([receipt('new', 150)]);
  f.reads[2].success([receipt('new', 150)]);
  assert.equal(f.announced(), 1);
  assert.equal(f.finished(), 1);
});

test('receipt polling stops after twelve attempts, initial failure, disposal or authentication change', () => {
  const f = receiptFixture();
  f.reads[0].success([]);
  f.watcher.request();
  for (let attempt = 0; attempt < 12; attempt++) {
    f.reads[attempt + 1].failure();
    if (attempt < 11) f.timers[attempt].callback();
  }
  assert.equal(f.reads.length, 13);
  assert.equal(f.timers.length, 11);
  assert.equal(f.watcher.finished, true);
  const gone = receiptFixture();
  gone.reads[0].success([]);
  gone.watcher.request();
  gone.expire();
  gone.reads[1].success([receipt('new')]);
  assert.equal(gone.announced(), 0);
  assert.equal(gone.watcher.finished, true);
  const failed = receiptFixture();
  failed.reads[0].failure();
  failed.watcher.request();
  assert.equal(failed.reads.length, 1);
  const disposed = receiptFixture();
  disposed.reads[0].success([]);
  disposed.watcher.request();
  disposed.reads[1].failure();
  disposed.watcher.dispose();
  assert.equal(disposed.timers[0].cancelled, true);
});
