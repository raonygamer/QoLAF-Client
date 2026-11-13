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

/** Original sanitizeSiteProfile/loadLoginProfiles normalization and first-ID-wins migration. */
export function normalizeSavedProfiles(value: unknown): Profile[] {
  if (!Array.isArray(value)) return [];
  const profiles: Profile[] = [];
  const seen = new Set<string>();
  const entries: readonly unknown[] = value;
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('type' in entry) ||
      entry.type !== 'site' ||
      !('email' in entry) ||
      !('password' in entry) ||
      entry.email == null ||
      entry.password == null
    )
      continue;
    const email = String(entry.email).trim();
    const password = String(entry.password).trim();
    if (!email || !password || email.length > 320 || password.length > 512) continue;
    const provider = providerFor(
      String('authProvider' in entry ? (entry.authProvider ?? '') : ''),
      email,
      password,
    );
    if (!validCredentials(provider, email, password)) continue;
    const profile = siteProfile(
      email,
      password,
      provider,
      String('accountName' in entry ? (entry.accountName ?? '') : ''),
    );
    if (seen.has(profile.id)) continue;
    seen.add(profile.id);
    profiles.push(profile);
  }
  return profiles;
}

/** Original Login.preferredProfileId; row selection does not choose auto-login. */
export function preferredProfileId(
  profiles: readonly Profile[],
  lastLoginId: string | null,
): string | null {
  const previous = profiles.find((profile) => profile.id === lastLoginId);
  if (previous && previous.enabled !== false) return previous.id;
  return profiles.find((profile) => profile.enabled !== false)?.id ?? profiles[0]?.id ?? null;
}
