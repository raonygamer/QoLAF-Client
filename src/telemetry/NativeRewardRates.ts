import type { API } from '../api/Types';
import { Cargo, Player, type GameScene } from '../game/Bindings';
import { RewardRates } from './RewardRates';

const sessions = new Map<string, RewardRates>();
export function rewardRates(game: GameScene): RewardRates | null {
  const id = game.get_me()?.id;
  if (!id) return null;
  let rates = sessions.get(id);
  if (!rates) sessions.set(id, (rates = new RewardRates(performance.now())));
  return rates;
}

/** Hook native rewards once, keeping the same account's counters through room changes. */
export function installRewardRates(api: API): void {
  api.defer(() => sessions.clear());
  api.on('frame', ({ game }) => {
    rewardRates(game);
  });
  api.after(Player.prototype, 'increaseXp', function (_result, earned) {
    if (this.isMe) rewardRates(this.g)?.add('xp', earned);
  });
  api.after(
    Player.prototype,
    'loadArtifactsFromMessage',
    function (_result, message, offset, announce) {
      // announce=true is the native pickup path; initial inventory uses false.
      if (this.isMe && announce) rewardRates(this.g)?.add('artifacts', message.getInt(offset));
    },
  );
  api.after(Player.prototype, 'checkPickupMessage', function (_result, message, offset) {
    if (this.isMe && message.getBoolean(offset + 2)) rewardRates(this.g)?.add('recycled', 1);
  });
  api.around(Cargo.prototype, 'addItem', function (next, ...args) {
    if (this !== this.g.myCargo) return next(...args);
    const total = () =>
      this.spaceJunkCount + this.get_minerals().reduce((sum, item) => sum + item.amount, 0);
    const before = total();
    const result = next(...args);
    rewardRates(this.g)?.add('cargo', total() - before);
    return result;
  });
}
