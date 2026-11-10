import { read, type API, type Raw } from '../api/Types';
import { EmitterTargets } from './EmitterTargets';

/** Preserve the source factory's target lifetime across delayed multiple effects. */
export function installEmitterDelays(api: API, targets: EmitterTargets): void {
  const factory = api.cls('core.particle.EmitterFactory');
  const tween = api.cls('com.greensock.TweenMax');
  if (typeof factory?.create !== 'function' || typeof tween?.delayedCall !== 'function') return;

  let current: Raw | null = null;
  api.around(factory, 'create', function (next, ...args: any[]) {
    const previous = current;
    const game = args[1];
    const target = args[4];
    current = target ? { g: game, target, followTarget: true } : null;
    if (current) targets.capture(current);
    try {
      return next(...args);
    } finally {
      current = previous;
    }
  });
  api.around(tween, 'delayedCall', function (next, delay, callback, ...args: any[]) {
    const attachment = current;
    if (!attachment || typeof callback !== 'function') return next(delay, callback, ...args);
    return next(
      delay,
      function (this: unknown, ...values: any[]) {
        if (read(attachment.g, 'isLeaving') || targets.stale(attachment)) return;
        return callback.apply(this, values);
      },
      ...args,
    );
  });
}
