/** Original helper endpoint contract: peer-supplied media URLs are never accepted. */
export class RadioStreamURL {
  static valid(value: string | null, videoId: string | null): boolean {
    if (value === null || videoId === null || value.length > 200) return false;
    const match =
      /^http:\/\/127\.0\.0\.1:([0-9]{1,5})\/radio\/([0-9a-f]{64})\/([A-Za-z0-9_-]{11})\.mp3$/.exec(
        value,
      );
    return !!match && Number(match[1]) > 0 && Number(match[1]) <= 65535 && match[3] === videoId;
  }
}
