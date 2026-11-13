interface ClipboardBridge {
  writeText(value: string): Promise<void>;
  readText(): Promise<string>;
}

declare global {
  interface Window {
    qolafClipboard?: ClipboardBridge;
  }
}

/** Shared clipboard path for native shells and browser copy buttons. */
export async function writeClipboardText(value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.qolafClipboard) {
    await window.qolafClipboard.writeText(value);
    return;
  }
  // Keep the synchronous user gesture for browsers/shells denying async clipboard access.
  if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    const focused = document.activeElement;
    const selection = document.getSelection();
    const ranges = selection
      ? Array.from({ length: selection.rangeCount }, (_, index) =>
          selection.getRangeAt(index).cloneRange(),
        )
      : [];
    const input = document.createElement('textarea');
    input.value = value;
    input.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none';
    document.body.appendChild(input);
    let copied = false;
    try {
      input.focus({ preventScroll: true });
      input.select();
      copied = document.execCommand('copy');
    } catch {
      // Try the standards clipboard API below if legacy copy is unavailable.
    } finally {
      input.remove();
      if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
      if (selection) {
        selection.removeAllRanges();
        for (const range of ranges) selection.addRange(range);
      }
    }
    if (copied) return;
  }
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText)
    throw new Error('Clipboard copying is unavailable in this browser.');
  await navigator.clipboard.writeText(value);
}

export async function readClipboardText(): Promise<string> {
  if (typeof window !== 'undefined' && window.qolafClipboard)
    return window.qolafClipboard.readText();
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText)
    throw new Error('Clipboard reading is unavailable. Use Ctrl+V to paste.');
  return navigator.clipboard.readText();
}
