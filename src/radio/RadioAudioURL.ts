/** Keep prepared audio on WebAudio even when an HTTPS page uses a loopback helper.
 * Howler switches HTTP media URLs to HTMLAudio, which omits the bridge's Origin.
 */
export async function fetchRadioAudioURL(
  url: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<string> {
  const maximum = 40 * 1024 * 1024;
  const response = await request(url, {
    signal,
    mode: 'cors',
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
  });
  const size = Number(response.headers.get('Content-Length'));
  if (!response.ok || size > maximum || !response.body) {
    await response.body?.cancel();
    throw Error('Prepared audio could not be fetched.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) throw Error('Prepared audio exceeds the size limit.');
      chunks.push(value);
    }
    if (!total) throw Error('Prepared audio is empty.');
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // Multiples of three keep base64 padding confined to the final chunk, while
  // bounding the argument count for fromCharCode on long tracks.
  const encoded: string[] = [];
  for (let index = 0; index < bytes.length; index += 24576)
    encoded.push(btoa(String.fromCharCode(...bytes.subarray(index, index + 24576))));
  return 'data:audio/mp3;base64,' + encoded.join('');
}
