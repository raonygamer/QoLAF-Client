interface LoginPresentationView {
  isLoggedIn: boolean;
  get_visible(): boolean;
  set_visible(visible: boolean): boolean | void;
  get_stage(): object | null;
}

/** Hide vanilla controls until the asynchronously prepared client UI is ready. */
export function prepareLoginPresentation(
  login: LoginPresentationView,
  ready: Promise<void>,
  present: () => void,
  reportError: (error: unknown) => void,
): () => void {
  const announce = (name: string) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(name));
  };
  announce('qolaf:login-pending');
  const wasVisible = login.get_visible();
  login.set_visible(false);
  let active = true;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    // Successful authentication owns the transition away from this view.
    if (!login.isLoggedIn) {
      login.set_visible(wasVisible);
      if (wasVisible && login.get_stage()) announce('qolaf:login-ready');
    }
  };
  void ready
    .then(() => {
      if (active && !login.isLoggedIn && login.get_stage()) present();
    })
    .catch(reportError)
    .finally(restore);
  return () => {
    active = false;
    restore();
  };
}
