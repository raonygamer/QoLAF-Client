import { validCredentials, type Provider } from './LoginProfile';

/** Original Login.validateAddCredentials per-field feedback. */
export function loginCredentialErrors(
  provider: Provider,
  identifier: string,
  secret: string,
  submitted: boolean,
) {
  let identifierError = '';
  let secretError = '';
  if (provider === 'kongregate') {
    if (!identifier.length) {
      if (submitted) identifierError = 'User ID required';
    } else if (!/^\d+$/.test(identifier)) identifierError = 'Invalid numeric User ID';
    else if (identifier.length < 6) identifierError = `User ID: ${identifier.length}/6 minimum`;
    if (secret.length !== 64 && (submitted || secret.length > 0))
      secretError = `Auth token: ${secret.length}/64`;
  } else if (provider === 'armor') {
    if (identifier.length !== 32 && (submitted || identifier.length > 0))
      identifierError = `User ID: ${identifier.length}/32`;
    if (secret.length !== 32 && (submitted || secret.length > 0))
      secretError = `Auth token: ${secret.length}/32`;
  } else {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) && (submitted || identifier.length > 0))
      identifierError = 'Invalid e-mail';
    if (!secret.length && submitted) secretError = 'Password required';
  }
  return {
    identifierError,
    secretError,
    valid: !identifierError && !secretError && validCredentials(provider, identifier, secret),
  };
}
