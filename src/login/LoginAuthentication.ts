import { Client, Login, PlayerIO, PlayerIOSDK, QuickConnect } from '../game/Bindings';
import type { Game } from '../game/Game';
import { createPlayerIOChannel } from '../game/PlayerIOChannel';
import type { Profile } from './LoginProfile';

/** Authenticate a saved provider profile; cancellation owns the whole request. */
export function authenticateLoginProfile(
  profile: Profile,
  stage: Game.openfl.display.Stage,
  signal: AbortSignal,
  success: (client: Client) => void,
  failure: (error: unknown) => void,
): void {
  if (signal.aborted) return;
  const connected = (client: Client) => {
    if (!signal.aborted) success(client);
  };
  const failed = (error: unknown) => {
    if (!signal.aborted) failure(error);
  };
  if (profile.authProvider === 'simple') {
    PlayerIO.quickConnect.simpleConnect(
      stage,
      Login.gameId,
      profile.email,
      profile.password,
      connected,
      failed,
    );
  } else if (profile.authProvider === 'kongregate') {
    const channel = createPlayerIOChannel();
    PlayerIOSDK.keepChannels();
    const convert = QuickConnect.convertFor(channel, Login.gameId);
    channel.kongregateConnect(
      Login.gameId,
      profile.email,
      profile.password,
      [],
      'javascript',
      {},
      connected,
      failed,
      (response) => Client.wrap(convert(response)),
    );
  } else {
    const url = new URL('https://api.playerio.com/clientintegrations/armorgames/auth');
    url.searchParams.set('gameid', Login.gameId);
    url.searchParams.set('userid', profile.email);
    url.searchParams.set('authtoken', profile.password);
    void fetch(url, { credentials: 'omit', signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Armor Games authentication failed.');
        const [id, token] = (await response.text()).split('\n').map((value) => value.trim());
        if (signal.aborted) return;
        if (!id || !token) throw new Error('Invalid Armor Games authentication response.');
        const channel = createPlayerIOChannel();
        PlayerIOSDK.keepChannels();
        const convert = QuickConnect.convertFor(channel, Login.gameId);
        channel.connect(
          Login.gameId,
          'public',
          id,
          token,
          'armorgames',
          [],
          'javascript',
          {},
          connected,
          failed,
          (result) => Client.wrap(convert(result)),
        );
      })
      .catch(failed);
  }
}
