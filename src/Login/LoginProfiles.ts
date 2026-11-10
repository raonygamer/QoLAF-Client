import { read, type API, type Raw } from '../Api/Types';
import { NativeUI } from '../UI/NativeUI';
import { portedClasses } from '../Ported/Registry';
import { LoginAttempt } from './LoginAttempt';
export type Provider = 'simple' | 'kongregate' | 'armor';
export interface Profile {
  id: string;
  type: 'site' | 'steam';
  label: string;
  detail: string;
  email: string;
  password: string;
  authProvider: Provider;
  accountName: string;
  removable: boolean;
  enabled?: boolean;
}
export function providerFor(provider: string, email: string, secret: string): Provider {
  if (provider === 'simple' || provider === 'kongregate' || provider === 'armor') return provider;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'simple';
  if (email.length === 32 && secret.length === 32) return 'armor';
  return email.length >= 6 && /^\d+$/.test(email) && secret.length === 64 ? 'kongregate' : 'simple';
}
export function validCredentials(provider: Provider, id: string, secret: string) {
  if (provider === 'kongregate')
    return id.length >= 6 && id.length <= 320 && /^\d+$/.test(id) && secret.length === 64;
  if (provider === 'armor') return id.length === 32 && secret.length === 32;
  return (
    id.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) &&
    secret.length > 0 &&
    secret.length <= 512
  );
}
export function siteProfile(
  id: string,
  secret: string,
  provider: Provider,
  accountName = '',
): Profile {
  const email = id.trim();
  return {
    id: 'site:' + email.toLowerCase(),
    type: 'site',
    label: email,
    detail:
      provider === 'simple'
        ? 'Simple account'
        : provider === 'kongregate'
          ? 'Kongregate account'
          : 'Armor account',
    email,
    password: secret.trim(),
    accountName: accountName.trim().slice(0, 64),
    authProvider: provider,
    removable: true,
  };
}
export function loginProfiles(api: API, login: Raw) {
  const ui = new NativeUI(api),
    { resolve } = portedClasses(api),
    Button = resolve('core.hud.components.LoginButton');
  const Login = api.cls('Login')!,
    Rymden = api.cls('RymdenRunt')!,
    PIO = api.cls('playerio.PlayerIO')!;
  const nativeStage = () => api.cls('starling.core.Starling')!.get_current().get_nativeStage();
  if (!login.loginContainer) {
    login.loginForm();
    login.recoverForm();
    login.registerForm();
  }
  const key = 'login.profiles';
  let state: any;
  try {
    state = api.storage.get(key, { profiles: [], selected: null, autoLogin: false });
  } catch {
    state = { profiles: [], selected: null, autoLogin: false };
  }
  let profiles: Profile[] = Array.isArray(state.profiles)
    ? state.profiles
        .filter(
          (p: Profile) =>
            p.type === 'site' &&
            validCredentials(providerFor(p.authProvider, p.email, p.password), p.email, p.password),
        )
        .map((p: Profile) =>
          siteProfile(
            p.email,
            p.password,
            providerFor(p.authProvider, p.email, p.password),
            p.accountName,
          ),
        )
    : [];
  const steam = !!(Rymden.isDesktop && Rymden.info?.origin === 'steam');
  if (steam)
    profiles.unshift({
      id: 'steam',
      type: 'steam',
      label: 'Steam',
      detail: 'Steam account',
      email: '',
      password: '',
      authProvider: 'simple',
      accountName: Rymden.info.name || '',
      removable: false,
    });
  let provider: Provider = 'simple',
    editing: string | null = null,
    inFlight = false,
    disposed = false,
    countdown = 0,
    timer: ReturnType<typeof setInterval> | undefined;
  let pending: Profile | null = null;
  const cleanups: (() => void)[] = [];
  const attempts = new LoginAttempt();
  const save = () =>
    api.storage.set(key, {
      profiles: profiles.filter((p) => p.type === 'site'),
      selected: state.selected ?? panel.selectedProfileId,
      autoLogin: panel.autoLogin,
    });
  const cancel = () => {
    countdown = 0;
    if (timer) clearInterval(timer);
    timer = undefined;
    login.connectStatus.set_subText('');
    login.connectStatus.set_visible(false);
  };
  const hide = () => {
    panel.visible = false;
    providers.visible = false;
    form.set_visible(false);
    login.loginContainer?.set_visible(false);
    login.registerDialog?.set_visible(false);
    login.recoverDialog?.set_visible(false);
  };
  const show = () => {
    cancel();
    hide();
    Login.currentState = 'profiles';
    panel.visible = true;
    panel.setProfiles(profiles, state.selected);
    layout();
  };
  const fail = (error: any) => {
    if (disposed) return;
    attempts.cancel();
    inFlight = false;
    pending = null;
    login.connectStatus.set_visible(false);
    show();
    panel.statusMessage = String(error?.message || error);
  };
  const connect = (profile: Profile) => {
    if (inFlight || profile.enabled === false) return;
    cancel();
    hide();
    pending = profile;
    inFlight = true;
    Login.currentState = profile.type === 'steam' ? 'steam' : 'login';
    login.updateStatus('Connecting to Server');
    if (profile.type === 'steam') {
      login.$qolafAllowSteam = true;
      login.connectSteam();
      return;
    }
    const attempt = attempts.start(() => {
      fail('The server did not answer in time. Please try again.');
    });
    const failure = (error: unknown) => {
      if (disposed || !attempts.finish(attempt)) return;
      fail(error);
    };
    const success = (client: Raw) => {
      if (disposed || !attempts.finish(attempt)) return;
      inFlight = false;
      state.selected = profile.id;
      save();
      login.handleConnect(client);
    };
    try {
      if (profile.authProvider === 'simple')
        PIO.quickConnect.simpleConnect(
          nativeStage(),
          Login.gameId,
          profile.email,
          profile.password,
          success,
          failure,
        );
      else if (profile.authProvider === 'kongregate') {
        const sdk = (globalThis as Raw)._pio,
          channel = new sdk.channel();
        api.cls('playerio.sdk.PlayerIOSdk')!.keepChannels();
        channel.kongregateConnect(
          Login.gameId,
          profile.email,
          profile.password,
          [],
          'javascript',
          {},
          (client: Raw) => success(api.cls('playerio.Client')!.wrap(client)),
          failure,
          api.cls('playerio.QuickConnect')!.convertFor(channel, Login.gameId),
        );
      } else {
        const url = new URL('https://api.playerio.com/clientintegrations/armorgames/auth');
        url.searchParams.set('gameid', Login.gameId);
        url.searchParams.set('userid', profile.email);
        url.searchParams.set('authtoken', profile.password);
        void fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(30000) })
          .then(async (response) => {
            if (!response.ok) throw Error('Armor Games authentication failed.');
            const [id, token] = (await response.text()).split('\n').map((v) => v.trim());
            if (!id || !token) throw Error('Invalid Armor Games authentication response.');
            if (disposed || !attempts.isCurrent(attempt)) return;
            const channel = new (globalThis as Raw)._pio.channel();
            api.cls('playerio.sdk.PlayerIOSdk')!.keepChannels();
            channel.connect(
              Login.gameId,
              'public',
              id,
              token,
              'armorgames',
              [],
              'javascript',
              {},
              (client: Raw) => success(api.cls('playerio.Client')!.wrap(client)),
              failure,
              api.cls('playerio.QuickConnect')!.convertFor(channel, Login.gameId),
            );
          })
          .catch(failure);
      }
    } catch (error) {
      failure(error);
    }
  };
  const panel = new (resolve('core.hud.components.LoginProfilePanel'))(
    () => {
      cancel();
      hide();
      providers.visible = true;
      layout();
    },
    (profile: Profile) => {
      profiles = profiles.filter((p) => p.id !== profile.id || p.type === 'steam');
      panel.setProfiles(profiles);
      save();
    },
    connect,
    (enabled: boolean) => {
      cancel();
      panel.autoLogin = enabled;
      save();
    },
    (enabled: boolean) => {
      const p = profiles.find((p) => p.type === 'steam');
      if (p) p.enabled = enabled;
      save();
    },
    (profile: Profile) => {
      editing = profile.id;
      edit(profile.authProvider, profile);
    },
  );
  const providers = new (resolve('core.hud.components.LoginAccountTypePanel'))(
    (selected: Provider) => {
      editing = null;
      edit(selected);
    },
    () => {
      hide();
      login.setState('register');
    },
    show,
  );
  panel.set_name('qolaf.loginProfiles');
  panel.autoLogin = state.autoLogin === true;
  panel.steamIntegrationAvailable = steam;
  panel.steamIntegrationEnabled = true;
  panel.setProfiles(profiles, state.selected);
  const form = ui.sprite();
  const field = (placeholder: string, password = false) => {
    const node = ui.sprite(),
      label = ui.text(300, 30, placeholder, 12, 0xffffff, 'center', 'DAIDRR_16');
    label.set_y(4);
    node.addChild(label);
    ui.place(ui.quad(300, 1, 0xffffff), 0, 34, node);
    const entry = new (ui.cls('core.hud.components.ui.TextEntry'))('plain');
    entry.set_width(300);
    entry.set_height(30);
    entry.set_paddingLeft(5);
    entry.set_displayAsPassword(password);
    entry.set_textFormat(
      new (ui.cls('openfl.text.TextFormat'))(
        'Verdana',
        14,
        0xffffff,
        null,
        null,
        null,
        null,
        null,
        1,
      ),
    );
    node.addChild(entry);
    entry.addEventListener('focusIn', () => label.set_visible(false));
    entry.addEventListener('focusOut', () => label.set_visible(entry.get_text().length === 0));
    node.set_alpha(0.7);
    return { node, entry, label };
  };
  const identifier = field('EMAIL'),
    secret = field('PASSWORD', true);
  ui.place(identifier.node, 0, 0, form);
  ui.place(secret.node, 0, 65, form);
  const error = ui.text(300, 35, '', 10, 0xff0000, 'center', 'DAIDRR_16');
  error.set_wordWrap(true);
  ui.place(error, 0, 104, form);
  const submit = new Button('add', () => {
    const id = identifier.entry.get_text().trim(),
      password = secret.entry.get_text().trim();
    if (!validCredentials(provider, id, password)) {
      error.set_text('Check your account credentials');
      return;
    }
    const p = siteProfile(id, password, provider);
    if (editing && profiles.some((other) => other.id === p.id && other.id !== editing)) {
      error.set_text('A profile with this User ID already exists');
      return;
    }
    const previous = profiles.find((other) => other.id === editing);
    if (previous?.id === p.id && previous.authProvider === p.authProvider)
      p.accountName = previous.accountName;
    profiles = profiles.filter((other) => other.id !== editing && other.id !== p.id);
    profiles.push(p);
    state.selected = p.id;
    panel.setProfiles(profiles, p.id);
    save();
    show();
  });
  ui.place(submit, 0, 142, form);
  ui.place(new Button('back', show, 0xffffff, 0x222222), 180, 142, form);
  function edit(selected: Provider, profile?: Profile) {
    cancel();
    hide();
    provider = selected;
    Login.currentState = 'qolaf-credentials';
    identifier.label.set_text(provider === 'simple' ? 'EMAIL' : 'USER ID');
    secret.label.set_text(provider === 'simple' ? 'PASSWORD' : 'AUTH TOKEN');
    identifier.entry.set_text(profile?.email ?? '');
    secret.entry.set_text(profile?.password ?? '');
    identifier.label.set_visible(!profile?.email);
    secret.label.set_visible(!profile?.password);
    identifier.entry.set_maxChars(provider === 'armor' ? 32 : 320);
    secret.entry.set_maxChars(provider === 'simple' ? 512 : provider === 'armor' ? 32 : 64);
    identifier.entry.set_restrict(provider === 'kongregate' ? '0-9' : null);
    submit.text = editing ? 'save' : 'add';
    error.set_text('');
    form.set_visible(true);
    layout();
  }
  function layout() {
    const stage = login.get_stage();
    if (!stage) return;
    const offset = Rymden.isDesktop ? 40 : 0,
      base = login.logoContainer.get_y() + login.logoContainer.get_height();
    for (const [node, gap] of [
      [panel, 45],
      [providers, 65],
      [form, 80],
    ] as const) {
      node.set_x(stage.get_stageWidth() / 2 - node.get_width() / 2);
      node.set_y(
        Math.min(
          base + gap + offset,
          Math.max(10, stage.get_stageHeight() - node.get_height() - 20),
        ),
      );
    }
  }
  for (const node of [panel, providers, form]) login.addChild(node);
  const changed = () => {
    cancel();
    state.selected = panel.selectedProfileId;
    save();
  };
  panel.addEventListener('change', changed);
  cleanups.push(api.after(login, 'centerLogin', layout));
  cleanups.push(
    api.before(login, 'handleConnect', () => {
      attempts.cancel();
      inFlight = false;
      hide();
      if (pending) {
        state.selected = pending.id;
        save();
      }
    }),
  );
  cleanups.push(
    api.before(login, 'handleLoginError', () => {
      inFlight = false;
    }),
  );
  cleanups.push(api.around(login, 'showLoginError', (_next, message: string) => fail(message)));
  // Native registration/recovery callbacks must not revive the vanilla form
  // behind the source profile/provider panels.
  cleanups.push(
    api.around(login, 'setState', (next, nextState: string) => {
      if (nextState === 'site') {
        show();
        return;
      }
      hide();
      return next(nextState);
    }),
  );
  cleanups.push(api.before(login, 'hideLogin', hide));
  cleanups.push(
    api.after(login, 'onKeyPress', (_result, event: Raw) => {
      if (read(event, 'keyCode') === 17 && countdown > 0) show();
      if (read(event, 'keyCode') === 13 && Login.currentState === 'profiles') panel.loginSelected();
    }),
  );
  show();
  if (panel.autoLogin && state.selected && !Rymden.controlKeyDown) {
    const p = profiles.find((p) => p.id === state.selected);
    if (p) {
      hide();
      Login.currentState = 'qolaf-autologin';
      countdown = 3;
      login.updateStatus('Auto-login in 3...');
      login.connectStatus.set_subText('(press CTRL to cancel...)');
      timer = setInterval(() => {
        if (Rymden.controlKeyDown) {
          show();
          return;
        }
        if (--countdown <= 0) {
          cancel();
          connect(p);
        } else login.updateStatus(`Auto-login in ${countdown}...`);
      }, 1000);
    }
  }
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    attempts.cancel();
    cancel();
    for (const off of cleanups.reverse()) off();
    for (const node of [form, providers, panel]) ui.dispose(node);
  };
  cleanups.push(api.before(login, 'removeLoginScreen', dispose));
  return dispose;
}
