import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import type {} from '../game/GameRecovery';
import { TechTree, SoundLocator, type TechLevelIcon } from '../game/Bindings';
import { NativeUI } from '../ui/NativeUI';
import { ResourceUpgradeBatch } from './ResourceUpgradeBatch';

export function installNativeResourceUpgrades(api: API): void {
  const reflection = new GameReflection(api);
  const ui = new NativeUI(api);
  const views = new Map<
    TechTree,
    {
      batch: ResourceUpgradeBatch<TechLevelIcon>;
      refresh: () => void;
      setBusy: (busy: boolean) => void;
      dispose: () => void;
    }
  >();
  reflection.after(TechTree.prototype, 'load', function () {
    views.get(this)?.dispose();
    if (!this.canUpgrade) return;
    const tree = this;
    const player = tree.me;
    let disposed = false;
    let busy = false;
    let finishing = 0;
    const available = () =>
      !disposed &&
      !!tree.get_stage() &&
      !tree.g.get_isLeaving() &&
      !tree.g.get_isRecoveringGameConnection?.() &&
      tree.g.get_connected() &&
      tree.g.get_me() === player;
    const Button = ui.cls('core.hud.components.Button');
    const button = new Button(
      () => {
        const icon = tree.techSelectedForUpgrade;
        if (
          !icon ||
          icon.level >= 6 ||
          !available() ||
          batch.active ||
          busy ||
          !TechTree.hasRequiredLevel(6, player.get_level()) ||
          !tree.canAfford(icon)
        )
          return;
        finishing++;
        tree.disableTouch();
        tree.buyWithResourcesButton.set_enabled(false);
        tree.buyWithFluxButton.set_enabled(false);
        button.set_enabled(false);
        batch.start(icon);
      },
      'Upgrade to ET',
      'positive',
    );
    const refresh = () => {
      const icon = tree.techSelectedForUpgrade;
      button.set_x(tree.buyWithResourcesButton.get_x());
      button.set_y(
        tree.buyWithResourcesButton.get_y() + tree.buyWithResourcesButton.get_height() + 8,
      );
      button.set_visible(!!icon && icon.level < 6 && tree.buyWithResourcesButton.get_visible());
      button.set_enabled(
        !busy &&
          !batch.active &&
          !!icon &&
          tree.canAfford(icon) &&
          TechTree.hasRequiredLevel(6, player.get_level()),
      );
    };
    const batch = new ResourceUpgradeBatch<TechLevelIcon>({
      valid: (icon) => available() && tree.techSelectedForUpgrade === icon,
      send: (icon, reply) => {
        const message = tree.g.createMessage('upgrade');
        message.add(icon.table);
        message.add(icon.tech);
        message.add(icon.level);
        tree.g.rpcMessage(message, (response) => {
          const success = response.getBoolean(0);
          if (!success && available() && batch.active && response.length > 1)
            tree.g.showErrorDialog(response.getString(1));
          reply(success);
        });
      },
      acknowledge: (icon) => {
        // A reply may arrive after closing this view. Keep counters, not old UI.
        if (tree.g.get_isLeaving() || tree.g.get_me() !== player) return;
        tree._nrOfUpgrades[0]++;
        tree._nrOfUpgrades[icon.level]++;
      },
      advance: (icon) => {
        SoundLocator.getService().play('7zeIcPFb-UWzgtR_3nrZ8Q');
        tree.g.creditManager.refresh();
        icon.upgrade();
        const next = icon.level < 6 ? icon.tb.getUpgradeByLevel(icon.level + 1) : null;
        if (!next || !TechTree.hasRequiredLevel(next.level, player.get_level())) return null;
        tree.techSelectedForUpgrade = next;
        next.updateState('selected');
        return next;
      },
      finish: (stoppedAt) => {
        const generation = ++finishing;
        tree.techSelectedForUpgrade = stoppedAt;
        tree.upgradeInfo.set_visible(false);
        tree.buyWithResourcesButton.set_visible(false);
        tree.buyWithFluxButton.set_visible(false);
        button.set_visible(false);
        tree.g.creditManager.refresh();
        tree.myCargo.reloadCargoFromServer(() => {
          if (!available() || finishing !== generation) return;
          tree.enableTouch();
          if (stoppedAt) {
            stoppedAt.updateState('selected');
            tree.buyWithResourcesButton.set_visible(true);
            tree.buyWithFluxButton.set_visible(true);
            tree.buyWithResourcesButton.set_enabled(tree.canAfford(stoppedAt));
            tree.buyWithFluxButton.set_enabled(true);
            tree.updateTechUpgradeInfo(stoppedAt);
          }
          refresh();
        });
      },
    });
    const removed = () => {
      finishing++;
      batch.cancel();
    };
    tree.addEventListener('removedFromStage', removed);
    tree.addChild(button);
    views.set(tree, {
      batch,
      refresh,
      setBusy: (value) => {
        busy = value;
        refresh();
      },
      dispose: () => {
        if (batch.active && available()) tree.enableTouch();
        disposed = true;
        removed();
        tree.removeEventListener('removedFromStage', removed);
        button.removeFromParent(true);
      },
    });
    refresh();
  });
  for (const method of [
    'handleClickTechIcon',
    'handleClickEliteTechIcon',
    'updateTechUpgradeInfo',
  ] as const)
    reflection.after(TechTree.prototype, method, function () {
      views.get(this)?.refresh();
    });
  reflection.after(TechTree.prototype, 'disableTouch', function () {
    views.get(this)?.setBusy(true);
  });
  reflection.after(TechTree.prototype, 'enableTouch', function () {
    views.get(this)?.setBusy(false);
  });
  reflection.before(TechTree.prototype, 'dispose', function () {
    views.get(this)?.dispose();
    views.delete(this);
  });
  api.defer(() => {
    for (const state of views.values()) state.dispose();
    views.clear();
  });
}
