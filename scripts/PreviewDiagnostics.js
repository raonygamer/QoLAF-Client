// Local preview only. Never reads forms, credentials, chat, or account IDs.
let runtimeErrors = 0;
window.addEventListener('error', () => runtimeErrors++);
window.addEventListener('unhandledrejection', () => runtimeErrors++);
const read = (object, key) =>
  typeof object?.['get_' + key] === 'function' ? object['get_' + key]() : object?.[key];

setInterval(() => {
  const canvas = document.querySelector('canvas');
  const starling = window.QoLAF?.cls('starling.core.Starling');
  const stage = read(starling?.get_current?.(), 'stage');
  let loginProfilePanel = false;
  let loginIdentity = false;
  let pluginsButton = false;
  let remaining = 1000;
  function inspect(node) {
    if (!node || remaining-- <= 0) return;
    const name = read(node, 'name');
    if (name === 'qolaf.loginProfiles') loginProfilePanel = true;
    if (name === 'qolaf.loginIdentity') loginIdentity = true;
    if (name === 'qolaf.pluginsButton') pluginsButton = true;
    const count = read(node, 'numChildren') ?? 0;
    for (let index = 0; index < count; index++) inspect(node.getChildAt(index));
  }
  try {
    inspect(window.QoLAF?.game?.overlay);
    inspect(stage);
  } catch {
    /* Display nodes may be removed during traversal. */
  }
  void fetch('/__preview/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canvas: !!canvas,
      bridge: !!window.QoLAF?.classes,
      connected: !!window.QoLAF?.game?.gameStartedTime,
      loginProfilePanel,
      loginIdentity,
      pluginsButton,
      runtimeErrors,
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
    }),
  }).catch(() => {});
}, 2000);
