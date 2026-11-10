/** Browser counterpart of AIR's file dialog. Cancellation never imports a module. */
export function pickAutomationFile(signal: AbortSignal): Promise<File | null> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js,.mjs,text/javascript,application/javascript';
    input.hidden = true;
    const finish = (file: File | null) => {
      signal.removeEventListener('abort', cancel);
      input.removeEventListener('change', changed);
      input.removeEventListener('cancel', cancel);
      input.remove();
      resolve(file);
    };
    const cancel = () => finish(null);
    const changed = () => finish(input.files?.[0] ?? null);
    signal.addEventListener('abort', cancel, { once: true });
    input.addEventListener('cancel', cancel, { once: true });
    input.addEventListener('change', changed, { once: true });
    document.body.append(input);
    // Called synchronously from the native Add File button's pointer callback.
    input.click();
  });
}
