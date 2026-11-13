import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { errorMessage } from '../runtime/ErrorMessage';
import {
  Login,
  PlayerIO,
  Localize,
  Starling,
  RymdenRunt,
  type RegisterDialog2,
  type LoginInput,
  type Client,
  type PlayerIORegistrationError,
} from '../game/Bindings';

type RegistrationFailure = Pick<
  PlayerIORegistrationError,
  'emailError' | 'passwordError' | 'message'
>;

/** Original RegisterDialog2 request lifecycle, using the native form and SDK. */
export function installRegistrationRequest(
  api: API,
  dialog: RegisterDialog2,
  registered: (email: string, password: string) => void,
): () => void {
  const reflection = new GameReflection(api);
  const button = dialog.registerButton;
  const box = dialog.registerBox;
  // Haxe keeps Cancel as a constructor local; it is the last button in registerBox.
  const cancel = reflection.cast(
    box.getChildAt(box.get_numChildren() - 1),
    'core.hud.components.LoginButton',
  );
  const nativeSubmit = button.callback;
  const nativeCancel = cancel.callback;
  const localize = (text: string) => Localize.t(text);
  const stage = () => {
    const starling = Starling.get_current();
    if (!starling) throw new Error('Registration requires an active game stage.');
    return starling.get_nativeStage();
  };
  let pending = false;
  let disposed = false;
  const release = () => {
    pending = false;
    button.set_enabled(true);
    cancel.set_enabled(true);
  };
  const submit = () => {
    if (disposed || pending) return;
    const email = dialog.trim(dialog.emailInput.get_text());
    const name = dialog.trim(dialog.nameInput.get_text());
    const password = dialog.trim(dialog.passwordInput.get_text());
    const confirmation = dialog.trim(dialog.passwordConfirmInput.get_text());
    for (const input of [
      dialog.emailInput,
      dialog.nameInput,
      dialog.passwordInput,
      dialog.passwordConfirmInput,
    ])
      input.set_error('');
    let invalid = false;
    const error = (input: LoginInput, text: string) => {
      input.set_error(text);
      invalid = true;
    };
    // Keep the newer game's email validation; restore the original all-field gate.
    if (!email || !dialog.isValidEmail(email)) error(dialog.emailInput, localize('Invalid'));
    if (name.length < 3) error(dialog.nameInput, localize('Too short').replace('[n]', '3'));
    if (password.length < 4) error(dialog.passwordInput, localize('Too short').replace('[n]', '4'));
    else if (password.toLowerCase() === name.toLowerCase())
      error(dialog.passwordInput, localize('Too simple'));
    else if (password !== confirmation) error(dialog.passwordConfirmInput, localize("Don't match"));
    if (invalid) {
      button.set_enabled(true);
      return;
    }
    dialog.username = name;
    pending = true;
    button.set_enabled(false);
    cancel.set_enabled(false);
    dialog.updateStatus(localize('Creating new user...'));
    const success = (client: Client) => {
      if (disposed || !pending) return;
      // Remain locked while Login preloads/joins, just like registrationInFlight.
      registered(email, password);
      dialog.handleConnect(client);
    };
    const failure = (error: RegistrationFailure) => {
      if (disposed || !pending) return;
      release();
      dialog.updateStatus();
      const hasFieldError = error?.emailError != null || error?.passwordError != null;
      dialog.emailInput.set_error(
        error?.emailError ?? (hasFieldError ? '' : (error?.message ?? String(error))),
      );
      dialog.passwordInput.set_error(error?.passwordError ?? '');
    };
    try {
      if (dialog.client != null) success(dialog.client);
      else {
        PlayerIO.quickConnect.simpleRegister(
          stage(),
          Login.gameId,
          String(Date.now()),
          password,
          email,
          null,
          null,
          null,
          Login.partnerId,
          RymdenRunt.partnerSegmentArray,
          success,
          failure,
        );
      }
    } catch (error) {
      failure({
        emailError: null,
        passwordError: null,
        message: errorMessage(error),
      });
    }
  };
  // Touch uses a cached callback, while keyboard dispatch reads the method.
  button.callback = submit;
  const method = reflection.around(dialog, 'onRegisterSimple', () => submit());
  cancel.callback = () => {
    if (!disposed && !pending) nativeCancel();
  };
  return () => {
    if (disposed) return;
    disposed = true;
    method();
    button.callback = nativeSubmit;
    cancel.callback = nativeCancel;
    release();
  };
}
