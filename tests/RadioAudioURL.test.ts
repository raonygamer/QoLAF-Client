import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchRadioAudioURL } from '../src/radio/RadioAudioURL';

test('prepared audio uses CORS and produces exact MP3 bytes across arbitrary network chunks', async () => {
  const bytes = Uint8Array.from({ length: 90001 }, (_, index) => index % 256);
  const controller = new AbortController();
  const request: typeof fetch = async (_url, options) => {
    assert.equal(options?.signal, controller.signal);
    assert.equal(options?.mode, 'cors');
    assert.equal(options?.credentials, 'omit');
    assert.equal(options?.redirect, 'error');
    return new Response(
      new ReadableStream({
        start(stream) {
          stream.enqueue(bytes.slice(0, 7));
          stream.enqueue(bytes.slice(7, 50000));
          stream.enqueue(bytes.slice(50000));
          stream.close();
        },
      }),
    );
  };
  const url = await fetchRadioAudioURL(
    'http://127.0.0.1/audio/test.mp3',
    controller.signal,
    request,
  );
  assert.ok(url.startsWith('data:audio/mp3;base64,'));
  assert.deepEqual(Buffer.from(url.split(',')[1], 'base64'), Buffer.from(bytes));
});

test('empty, rejected and oversized audio fail before reaching native decoding', async () => {
  for (const response of [
    new Response('denied', { status: 403 }),
    new Response(new Uint8Array()),
    new Response('oversized', { headers: { 'Content-Length': String(40 * 1024 * 1024 + 1) } }),
    new Response(new Uint8Array(40 * 1024 * 1024 + 1)),
  ]) {
    await assert.rejects(
      fetchRadioAudioURL(
        'http://127.0.0.1/audio/test.mp3',
        new AbortController().signal,
        async () => response,
      ),
    );
  }
});

test('aborted audio cancels its reader and never returns a decodable URL', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      pull(stream) {
        controller.abort();
        stream.enqueue(new Uint8Array([1, 2, 3]));
      },
      cancel() {
        cancelled = true;
      },
    }),
  );
  await assert.rejects(
    fetchRadioAudioURL('http://127.0.0.1/audio/test.mp3', controller.signal, async () => response),
    { name: 'AbortError' },
  );
  assert.equal(cancelled, true);
});
