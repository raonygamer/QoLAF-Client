import type { API } from '../api/Types';
import { ClientErrorDiagnostics } from './ClientErrorDiagnostics';

/** Browser equivalents of the original uncaught-error evidence hooks. */
export function installNativeErrorDiagnostics(api: API): void {
  if (typeof window !== 'undefined') {
    const error = (event: ErrorEvent) => {
      ClientErrorDiagnostics.record(
        event.error ?? `${event.message}\n${event.filename}:${event.lineno}:${event.colno}`,
        'UncaughtErrorEvent',
      );
    };
    const rejection = (event: PromiseRejectionEvent) => {
      ClientErrorDiagnostics.record(event.reason, 'Unhandled promise rejection');
    };
    window.addEventListener('error', error);
    window.addEventListener('unhandledrejection', rejection);
    api.defer(() => {
      window.removeEventListener('error', error);
      window.removeEventListener('unhandledrejection', rejection);
    });
  }
  api.on('classesReady', () => {
    const classes = api.raw.classes;
    if (!classes) return;
    const name = 'qolaf.diagnostics.ClientErrorDiagnostics';
    const previous = Object.getOwnPropertyDescriptor(classes, name);
    classes[name] = ClientErrorDiagnostics;
    api.defer(() => {
      if (classes[name] !== ClientErrorDiagnostics) return;
      if (previous) Object.defineProperty(classes, name, previous);
      else delete classes[name];
    });
  });
}
