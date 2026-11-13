import assert from 'node:assert/strict';

// Disposable off-stage fixtures use the actual loaded Haxe classes and hooks.
// Synthetic accumulator samples are not a live gameplay FPS benchmark.
function probe() {
  const classes = window.__AF_hx;
  const results = [];
  for (const kind of ['drop', 'bitmapless-projectile']) {
    const clip = new classes['starling.display.Sprite']();
    const type = kind === 'drop' ? 'core.drops.Drop' : 'core.projectile.Projectile';
    const object = Object.create(classes[type].prototype);
    const timing = { accumulator: 0 };
    const position = { x: 100, y: 200 };
    const speed = kind === 'drop' ? { x: 9, y: -3 } : { x: 900, y: -300 };
    Object.assign(object, {
      g: { gameStateMachine: timing },
      _mc: clip,
      _pos: position,
      speed,
      course: { pos: position, speed, time: 1000 },
      _rotation: 0,
      imgObj: kind === 'drop' ? {} : null,
      isAddedToCanvas: true,
      alive: true,
      isVisible: true,
      tractorBeamPlayer: null,
      weapon: null,
      stateMachine: null,
      ribbonTrail: null,
    });
    const original = JSON.stringify({ position, speed, time: object.course.time });
    try {
      for (const rate of [60, 120, 180]) {
        let previous = -Infinity;
        let samples = 0;
        for (let milliseconds = 0; milliseconds < 33; milliseconds += 1000 / rate) {
          timing.accumulator = milliseconds;
          object.draw();
          const factor = milliseconds / (kind === 'drop' ? 33 : 1000);
          const x = clip.get_x();
          const y = clip.get_y();
          if (
            Math.abs(x - (100 + speed.x * factor)) > 1e-8 ||
            Math.abs(y - (200 + speed.y * factor)) > 1e-8 ||
            x <= previous ||
            object.get_renderX() !== x ||
            object.get_renderY() !== y
          ) {
            throw Error(`${kind}: render pose mismatch at ${rate} Hz, ${milliseconds} ms`);
          }
          previous = x;
          samples++;
        }
        results.push({ kind, sampledRate: rate, samples });
      }
      if (JSON.stringify({ position, speed, time: object.course.time }) !== original)
        throw Error(`${kind}: rendering changed simulation state`);
      if (kind === 'bitmapless-projectile' && object.get_hasImage())
        throw Error('Projectile fixture unexpectedly has a bitmap');
    } finally {
      clip.dispose();
    }
  }
  return { passed: true, scope: 'off-stage native pose hooks', results };
}

const port = Number(process.env.QOLAF_CDP_PORT ?? 9228);
assert.ok(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid CDP port');
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find(
  (page) => page.type === 'page' && /^https:\/\/raony\.dev\/astroflux\//.test(page.url),
);
assert.ok(page, 'Open Steam QoLAF with remote debugging enabled');
const socket = new WebSocket(page.webSocketDebuggerUrl);
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('CDP connection timeout')), 10000);
    socket.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
    socket.onerror = () => {
      clearTimeout(timer);
      reject(Error('CDP connection failed'));
    };
  });
  const response = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Render probe timeout')), 10000);
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timer);
      resolve(message);
    };
    socket.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(${probe.toString()})()`,
          returnByValue: true,
        },
      }),
    );
  });
  assert.ok(!response.error, JSON.stringify(response.error));
  assert.ok(
    !response.result.exceptionDetails,
    response.result.exceptionDetails?.exception?.description ?? 'Native probe failed',
  );
  const result = response.result.result.value;
  assert.equal(result.passed, true);
  console.log(JSON.stringify(result));
} finally {
  socket.close();
}
