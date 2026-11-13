import type { TorpedoLogExport } from './TorpedoDebugLog';

/** Browser replacement for the source's local JSONL file writer. */
export function downloadTorpedoRecording(recording: TorpedoLogExport): void {
  const blob = new Blob([recording.content], { type: 'application/x-ndjson;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | undefined;
  try {
    link = document.createElement('a');
    link.href = url;
    link.download = recording.fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    link?.remove();
    // Download navigation may consume the URL after the synchronous click returns.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
