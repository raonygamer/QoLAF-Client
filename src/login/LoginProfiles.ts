import { RussoBitmapFontRegistry } from '../ui/RussoBitmapFontRegistry';
import type { createLoginProfilePanel } from '../ported/LoginProfilePanel';
import type { createLoginButton } from '../ported/LoginButton';
import type { createLoginAccountTypePanel } from '../ported/LoginAccountTypePanel';
import { TextFormatAlign } from '../game/TextFormatAlign';
import { type API } from '../api/Types';
import { NativeUI } from '../ui/NativeUI';
import { portedClasses } from '../ported/Registry';
import { LoginAttempt } from './LoginAttempt';
import { loginControl } from './LoginControl';
import { LoginProfileNames } from './LoginProfileNames';
import { loginCredentialErrors } from './LoginCredentialErrors';
import { installRecoveryRequest } from './RecoveryRequest';
import { installRegistrationRequest } from './RegistrationRequest';
import { installNativeLoginButton } from './NativeLoginButton';
import { installNativeLoginInput } from './NativeLoginInput';
import { GameReflection } from '../api/GameReflection';
import {
  Login,
  RymdenRunt as Rymden,
  Starling,
  Localize,
  NativeTextFormat,
  TextEntry,
  type Client,
} from '../game/Bindings';
import type { Game } from '../game/Game';
import { authenticateLoginProfile } from './LoginAuthentication';
import {
  normalizeSavedProfiles,
  preferredProfileId,
  siteProfile,
  validCredentials,
  type Profile,
  type Provider,
} from './LoginProfile';
export {
  normalizeSavedProfiles,
  siteProfile,
  validCredentials,
  providerFor,
  type Profile,
  type Provider,
} from './LoginProfile';
import { decodeLoginProfileState, type LoginProfileState } from './LoginProfileState';
import { errorMessage } from '../runtime/ErrorMessage';
/** Match ConnectStatus.subText, including hiding a previously rendered bitmap. */
export function setLoginStatusHint(
  status: { connectSubText: { set_text(text: string): void; set_visible(visible: boolean): void } },
  text: string | null,
): void {
  const value = text ?? '';
  status.connectSubText.set_text(value);
  status.connectSubText.set_visible(value.length > 0);
}

export function loginProfiles(api: API, login: Login & { $qolafAllowSteam?: boolean }) {
  LoginProfileNames.clear();
  const ui = new NativeUI(api),
    { resolve } = portedClasses(api),
    Button = resolve('core.hud.components.LoginButton') as ReturnType<typeof createLoginButton>;
  const AccountTypePanel = resolve('core.hud.components.LoginAccountTypePanel') as ReturnType<
    typeof createLoginAccountTypePanel
  >;
  const ProfilePanel = resolve('core.hud.components.LoginProfilePanel') as ReturnType<
    typeof createLoginProfilePanel
  >;
  const reflection = new GameReflection(api);
  const nativeStage = () => {
    const starling = Starling.get_current();
    if (!starling) throw new Error('Login requires an active Starling instance.');
    return starling.get_nativeStage();
  };
  if (!login.loginContainer) {
    login.loginForm();
    login.recoverForm();
    login.registerForm();
  }
  const initialState = Login.currentState;
  const { recoverDialog, registerDialog, logoContainer } = login;
  if (!recoverDialog || !registerDialog || !logoContainer)
    throw new Error('Login profiles require initialized login forms and logo.');
  const logo = logoContainer;
  const key = 'login.profiles';
  let state: LoginProfileState;
  try {
    state = decodeLoginProfileState(api.storage.get<unknown>(key, null));
  } catch {
    state = decodeLoginProfileState(null);
  }
  let profiles = [...state.profiles];
  const steam = !!(Rymden.isDesktop && Rymden.info?.origin === 'steam');
  let steamIntegrationEnabled = state.steamIntegrationEnabled !== false;
  if (steam) {
    const steamId = 'steam:' + String(Rymden.info.userId ?? 'current');
    // Migrate the former port's unscoped Steam row to the active session once.
    if (state.selected === 'steam') state.selected = steamId;
    profiles.unshift({
      id: steamId,
      type: 'steam',
      label: String(Rymden.info.name || 'Steam'),
      detail: 'Steam profile (current session)',
      email: '',
      password: '',
      authProvider: 'simple',
      accountName: String(state.steamProfileNames?.[steamId] ?? '')
        .trim()
        .slice(0, 64),
      removable: false,
      enabled: steamIntegrationEnabled,
    });
  }
  let provider: Provider = 'simple',
    editing: string | null = null,
    inFlight = false,
    disposed = false,
    countdown = 0,
    timer: ReturnType<typeof setInterval> | undefined;
  let pending: Profile | null = null;
  let pendingSteamIntegration = false;
  const cleanups: (() => void)[] = [];
  const statusHint = login.connectStatus.connectSubText;
  const originalHintVisible = statusHint.get_visible();
  setLoginStatusHint(login.connectStatus, '');
  cleanups.push(() => statusHint.set_visible(originalHintVisible));
  cleanups.push(
    reflection.around(login.connectStatus, 'set_subText', (_next, text: string | null) => {
      setLoginStatusHint(login.connectStatus, text);
      return text;
    }),
    reflection.before(login, 'updateStatus', () => setLoginStatusHint(login.connectStatus, '')),
  );

  for (const input of [
    recoverDialog.recoverEmail,
    registerDialog.emailInput,
    registerDialog.nameInput,
    registerDialog.passwordInput,
    registerDialog.passwordConfirmInput,
  ])
    cleanups.push(installNativeLoginInput(api, input));
  const registrationBox = registerDialog.registerBox;
  for (const button of [
    recoverDialog.recoverButton,
    recoverDialog.cancelButton,
    registerDialog.registerButton,
    reflection.cast(
      registrationBox.getChildAt(registrationBox.get_numChildren() - 1),
      'core.hud.components.LoginButton',
    ),
  ])
    cleanups.push(installNativeLoginButton(api, button));
  cleanups.push(installRecoveryRequest(api, recoverDialog));
  const attempts = new LoginAttempt();
  const save = () =>
    api.storage.set(key, {
      profiles: profiles.filter((p) => p.type === 'site'),
      selected: state.selected,
      autoLogin: panel.autoLogin,
      steamIntegrationEnabled,
      steamProfileNames: state.steamProfileNames ?? {},
    });
  const cancel = () => {
    countdown = 0;
    if (timer) clearInterval(timer);
    timer = undefined;
    setLoginStatusHint(login.connectStatus, '');
    login.connectStatus.set_visible(false);
  };
  const hide = () => {
    panel.set_visible(false);
    providers.set_visible(false);
    form.set_visible(false);
    login.loginContainer?.set_visible(false);
    registerDialog?.set_visible(false);
    recoverDialog?.set_visible(false);
  };
  const show = () => {
    cancel();
    hide();
    editing = null;
    pendingSteamIntegration = false;
    nativeStage().set_focus(null);
    Login.currentState = 'profiles';
    panel.set_visible(true);
    panel.statusMessage = '';
    panel.setProfiles(profiles, preferredProfileId(profiles, state.selected));
    layout();
  };
  const showProviders = () => {
    cancel();
    hide();
    editing = null;
    nativeStage().set_focus(null);
    Login.currentState = 'qolaf-account-types';
    providers.set_visible(true);
    layout();
  };
  const cancelLogin = () => {
    if (disposed) return;
    if (countdown <= 0 && !(inFlight && pending?.type === 'site')) return;
    // Retire the authentication callback before showing the chooser. A response
    // already in transit must not connect this account after cancellation.
    attempts.cancel();
    inFlight = false;
    pending = null;
    show();
  };
  const fail = (error: unknown) => {
    if (disposed || login.isLoggedIn) return;
    const failedProfileId = pending?.id;
    attempts.cancel();
    inFlight = false;
    pending = null;
    login.connectStatus.set_visible(false);
    show();
    if (failedProfileId) panel.setProfiles(profiles, failedProfileId);
    panel.statusMessage = errorMessage(error);
  };
  const connect = (profile: Profile) => {
    if (inFlight || profile.enabled === false) return;
    cancel();
    hide();
    pending = profile;
    inFlight = true;
    pendingSteamIntegration = profile.type === 'steam' || (steam && steamIntegrationEnabled);
    Login.currentState = pendingSteamIntegration ? 'steam' : 'login';
    login.updateStatus(Localize.t('Connecting to Server'));
    if (profile.type === 'steam') {
      login.$qolafAllowSteam = true;
      try {
        login.connectSteam();
      } catch (error) {
        fail('Steam: ' + errorMessage(error));
      }
      return;
    }
    setLoginStatusHint(login.connectStatus, '(press CTRL to cancel...)');
    const attempt = attempts.start(() => {
      fail('The server did not answer in time. Please try again.');
    });
    const failure = (error: unknown) => {
      if (disposed || !attempts.finish(attempt)) return;
      fail(error);
    };
    const success = (client: Client) => {
      if (disposed || !attempts.finish(attempt)) return;
      inFlight = false;
      state.selected = profile.id;
      save();
      login.handleConnect(client);
    };
    try {
      authenticateLoginProfile(
        profile,
        nativeStage(),
        attempts.signalFor(attempt),
        success,
        failure,
      );
    } catch (error) {
      failure(error);
    }
  };
  const panel = new ProfilePanel(
    showProviders,
    (profile: Profile) => {
      if (profile.type !== 'site' || !profile.removable) return;
      cancel();
      profiles = profiles.filter((p) => p.id !== profile.id);
      if (state.selected === profile.id) state.selected = null;
      panel.statusMessage = '';
      panel.setProfiles(profiles, preferredProfileId(profiles, state.selected));
      save();
    },
    connect,
    (enabled: boolean) => {
      cancel();
      panel.autoLogin = enabled;
      panel.statusMessage = '';
      save();
    },
    (enabled: boolean) => {
      if (!steam) return;
      cancel();
      panel.statusMessage = '';
      steamIntegrationEnabled = enabled;
      const p = profiles.find((p) => p.type === 'steam');
      if (p) p.enabled = enabled;
      panel.steamIntegrationEnabled = enabled;
      panel.setProfiles(profiles, preferredProfileId(profiles, state.selected));
      save();
    },
    (profile: Profile) => {
      editing = profile.id;
      edit(profile.authProvider, profile);
    },
  );
  const providers = new AccountTypePanel(
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
  panel.steamIntegrationEnabled = steam && steamIntegrationEnabled;
  panel.setProfiles(profiles, preferredProfileId(profiles, state.selected));
  const form = ui.sprite();
  const field = (placeholder: string, password = false) => {
    const node = ui.sprite(),
      label = ui.text(
        300,
        30,
        placeholder,
        12,
        0xffffff,
        'center',
        RussoBitmapFontRegistry.fontNameForSize(12),
      );
    label.set_y(4);
    node.addChild(label);
    ui.place(ui.quad(300, 1, 0xffffff), 0, 30, node);
    const errorLabel = ui.text(
      300,
      15,
      '',
      10,
      0xff0000,
      'center',
      RussoBitmapFontRegistry.fontNameForSize(10),
    );
    errorLabel.set_wordWrap(true);
    errorLabel.set_visible(false);
    ui.place(errorLabel, 0, 35, node);
    const setError = (text: string) => {
      errorLabel.set_text(text.toUpperCase());
      errorLabel.set_visible(text.length > 0);
    };
    const entry = new TextEntry('plain');
    entry.set_width(300);
    entry.set_height(30);
    entry.set_paddingLeft(5);
    entry.set_displayAsPassword(password);
    entry.set_textFormat(
      new NativeTextFormat(
        'Verdana',
        14,
        0xffffff,
        null,
        null,
        null,
        null,
        null,
        TextFormatAlign.Center,
      ),
    );
    node.addChild(entry);
    entry.addEventListener('focusIn', () => label.set_visible(false));
    entry.addEventListener('focusOut', () => label.set_visible(entry.get_text().length === 0));
    node.set_alpha(0.7);
    return { node, entry, label, setError };
  };
  const identifier = field('EMAIL'),
    secret = field('PASSWORD', true);
  ui.place(identifier.node, 0, 0, form);
  ui.place(secret.node, 0, identifier.node.get_height() + 10, form);
  const submitForm = () => {
    const id = identifier.entry.get_text().trim(),
      password = secret.entry.get_text().trim();
    if (!validate(true)) return;
    const p = siteProfile(id, password, provider);
    if (editing && profiles.some((other) => other.id === p.id && other.id !== editing)) {
      identifier.setError('A profile with this User ID already exists');
      return;
    }
    const previous = profiles.find((other) => other.id === editing);
    if (previous?.id === p.id && previous.authProvider === p.authProvider)
      p.accountName = previous.accountName;
    profiles = profiles.filter((other) => other.id !== editing && other.id !== p.id);
    profiles.push(p);
    // Editing the last authenticated profile preserves its identity; adding
    // or selecting another account must not silently opt it into auto-login.
    if (editing && state.selected === editing) state.selected = p.id;
    save();
    show();
    panel.setProfiles(profiles, p.id);
  };
  const submit = new Button('add', submitForm);
  const back = new Button(
    'back',
    () => {
      if (editing) show();
      else showProviders();
    },
    0xffffff,
    0x222222,
  );
  const actionY = secret.node.get_y() + secret.node.get_height() + 10;
  const actionX = (300 - submit.get_width() - 10 - back.get_width()) / 2;
  ui.place(submit, actionX, actionY, form);
  ui.place(back, actionX + submit.get_width() + 10, actionY, form);
  const recovery = ui.text(
    200,
    20,
    '<u>' + Localize.t('Forgot password?') + '</u>',
    12,
    7434094,
    'center',
    RussoBitmapFontRegistry.fontNameForSize(12),
  );
  recovery.set_isHtmlText(true);
  recovery.set_touchable(true);
  recovery.set_useHandCursor(true);
  ui.place(recovery, 50, actionY + submit.get_height() + 40, form);
  cleanups.push(ui.touch(recovery, () => login.setState('password_recover'), 'ended'));
  const submitOnEnter = (event: KeyboardEvent) => {
    if (
      event.key !== 'Enter' ||
      event.repeat ||
      event.isComposing ||
      login.enterPressed ||
      !form.get_visible() ||
      disposed
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    login.enterPressed = true;
    submitForm();
  };
  for (const input of [identifier.entry, secret.entry]) {
    input.element?.addEventListener('keydown', submitOnEnter);
    cleanups.push(() => input.element?.removeEventListener('keydown', submitOnEnter));
  }
  function validate(submitted = false): boolean {
    const result = loginCredentialErrors(
      provider,
      identifier.entry.get_text().trim(),
      secret.entry.get_text().trim(),
      submitted,
    );
    identifier.setError(result.identifierError);
    secret.setError(result.secretError);
    submit.enabled = result.valid;
    return result.valid;
  }
  const changedCredentials = () => validate();
  identifier.entry.addEventListener('change', changedCredentials);
  secret.entry.addEventListener('change', changedCredentials);
  cleanups.push(() => {
    identifier.entry.removeEventListener('change', changedCredentials);
    secret.entry.removeEventListener('change', changedCredentials);
  });
  function edit(selected: Provider, profile?: Profile) {
    cancel();
    hide();
    provider = selected;
    recovery.set_visible(provider === 'simple');
    Login.currentState = 'qolaf-credentials';
    identifier.label.set_text(provider === 'simple' ? 'EMAIL' : 'USER ID');
    secret.label.set_text(provider === 'simple' ? 'PASSWORD' : 'AUTH TOKEN');
    // Configure before filling: native TextEntry sanitizes set_text immediately
    // using the previous provider's restriction and length limit otherwise.
    identifier.entry.set_restrict(provider === 'kongregate' ? '0-9' : null);
    identifier.entry.set_maxChars(provider === 'armor' ? 32 : 320);
    secret.entry.set_maxChars(provider === 'simple' ? 512 : provider === 'armor' ? 32 : 64);
    identifier.entry.set_text(profile?.email ?? '');
    secret.entry.set_text(profile?.password ?? '');
    identifier.label.set_visible(!profile?.email);
    secret.label.set_visible(!profile?.password);
    submit.text = editing ? 'save' : 'add';
    validate();
    form.set_visible(true);
    layout();
    nativeStage().set_focus(null);
    (identifier.entry.get_text() ? secret.entry : identifier.entry).setFocus();
  }
  function layout() {
    const stage = login.get_stage();
    if (!stage) return;
    const offset = Rymden.isDesktop ? 40 : 0,
      base = logo.get_y() + logo.get_height();
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
    panel.statusMessage = '';
  };
  panel.addEventListener('change', changed);
  cleanups.push(() => panel.removeEventListener('change', changed));
  cleanups.push(reflection.after(login, 'centerLogin', layout));
  cleanups.push(
    reflection.before(login, 'handleConnect', (client: Client) => {
      if (disposed || login.isLoggedIn) return;
      if (pendingSteamIntegration) Login.currentState = 'steam';
      pendingSteamIntegration = false;
      // Native handleConnect removes its cached listener, not our replacement.
      // Stop login keyboard handling as soon as authentication starts preload.
      keyboardStage.removeEventListener('keyDown', onKeyPress);
      attempts.cancel();
      inFlight = false;
      setLoginStatusHint(login.connectStatus, '');
      hide();
      if (pending) {
        LoginProfileNames.authenticate(client, pending.id);
        state.selected = pending.id;
        save();
        pending = null;
      }
    }),
  );
  cleanups.push(
    reflection.around(login, 'handleLoginError', (_next, error) => {
      fail(error.message);
    }),
    reflection.around(login, 'handleError', (next, error) => {
      if (disposed || login.isLoggedIn) return;
      if (Login.currentState === 'steam') fail('Steam: ' + error.message);
      else next(error);
    }),
  );
  cleanups.push(
    reflection.around(login, 'showLoginError', (_next, message: string) => fail(message)),
  );
  // Native registration/recovery callbacks must not revive the vanilla form
  // behind the source profile/provider panels.
  cleanups.push(
    reflection.around(login, 'setState', (next, nextState: string) => {
      if (nextState === 'site') {
        if (Login.currentState === 'register') {
          showProviders();
          return;
        }
        show();
        return;
      }
      hide();
      return next(nextState);
    }),
  );
  cleanups.push(reflection.before(login, 'hideLogin', hide));
  cleanups.push(
    installRegistrationRequest(api, registerDialog, (email, password) => {
      const profile = siteProfile(email, password, 'simple');
      pending = profile;
      profiles = profiles.filter((other) => other.id !== profile.id);
      profiles.push(profile);
      pendingSteamIntegration = steam && steamIntegrationEnabled;
      Login.currentState = pendingSteamIntegration ? 'steam' : 'login';
      // The existing handleConnect hook persists and authenticates this profile.
    }),
  );
  const registration = registerDialog;
  const onConnectStatus = (event: Game.core.login.ConnectEvent) => {
    login.connectStatus.update(event);
    if (login.connectStatus.get_visible()) hide();
    else if (Login.currentState === 'register') login.setState('register');
    else show();
  };
  // The native cached listener restores loginContainer on registration errors.
  // Replace the registered closure so the current ported screen owns recovery.
  cleanups.push(
    reflection.replaceListener(
      registration,
      'connectStatus',
      login,
      login.onConnectStatus,
      onConnectStatus,
    ),
  );

  const keyboardStage = (() => {
    const stage = login.get_stage();
    if (!stage) throw new Error('Login keyboard controls require an attached stage.');
    return stage;
  })();
  const nativeKeyPress = login.onKeyPress;
  const boundKeyPress = reflection.bound(login, nativeKeyPress);
  const onKeyPress = (event: Game.starling.events.KeyboardEvent) => {
    const code = event.get_keyCode();
    if (code === 17) cancelLogin();
    if (
      code !== 13 ||
      (Login.currentState !== 'profiles' && Login.currentState !== 'qolaf-credentials')
    ) {
      nativeKeyPress.call(login, event);
      return;
    }
    if (login.enterPressed) return;
    login.enterPressed = true;
    if (disposed || inFlight || countdown > 0) return;
    if (Login.currentState === 'profiles') panel.loginSelected();
    else submitForm();
  };
  // Haxe's cached closure captures the original function, not the replaceable
  // property. Keep its recovery/registration paths but replace the stage binding.
  keyboardStage.removeEventListener('keyDown', boundKeyPress);
  keyboardStage.addEventListener('keyDown', onKeyPress);
  cleanups.push(() => {
    keyboardStage.removeEventListener('keyDown', onKeyPress);
    if (!login.isLoggedIn) keyboardStage.addEventListener('keyDown', boundKeyPress);
  });
  if (initialState === 'register' || initialState === 'password_recover')
    login.setState(initialState);
  else show();
  cleanups.push(loginControl.onControl(cancelLogin));
  if (
    Login.currentState === 'profiles' &&
    panel.autoLogin &&
    state.selected &&
    !loginControl.controlDown &&
    !loginControl.startupOverride
  ) {
    const p = profiles.find((p) => p.id === state.selected);
    if (p && p.enabled !== false) {
      hide();
      Login.currentState = 'qolaf-autologin';
      countdown = 3;
      login.updateStatus('Auto-login in 3...');
      setLoginStatusHint(login.connectStatus, '(press CTRL to cancel...)');
      timer = setInterval(() => {
        if (loginControl.controlDown || loginControl.startupOverride) {
          show();
          return;
        }
        if (--countdown <= 0) {
          cancel();
          connect(p);
        } else login.connectStatus.set_text(`Auto-login in ${countdown}...`);
      }, 1000);
    }
  }
  const dispose = (restoreNative = true) => {
    if (disposed) return;
    const nativeState =
      Login.currentState === 'register' || Login.currentState === 'password_recover'
        ? Login.currentState
        : 'site';
    disposed = true;
    attempts.cancel();
    cancel();
    for (const off of cleanups.reverse()) off();
    for (const node of [form, providers, panel]) ui.dispose(node);
    if (restoreNative && !login.isLoggedIn && login.get_stage()) login.setState(nativeState);
  };
  cleanups.push(reflection.before(login, 'removeLoginScreen', () => dispose(false)));
  return dispose;
}
