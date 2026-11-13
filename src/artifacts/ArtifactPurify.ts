import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  ArtifactOverview,
  InputText,
  PaintButton as Button,
  TextBitmap as Text,
  Localize,
  type Artifact,
  type DisplayObject,
  type Message,
} from '../game/Bindings';
import type {} from '../game/ArtifactPurify';
import type { ArtifactFavorites } from './ArtifactFavorites';
import { artifactFitness } from './Fitness';

export interface PurifyFilters {
  fitness: number;
  strength: number;
  lines: number;
}

/** Original filter: any failed minimum qualifies an unrevealed, unprotected artifact. */
export function selectPurifyArtifacts(
  view: ArtifactOverview,
  filters: PurifyFilters,
  favorites: ArtifactFavorites,
): Artifact[] {
  const selected: Artifact[] = [];
  for (const box of view.cargoBoxes) {
    if (selected.length === 40) break;
    const artifact = box.a;
    if (
      !artifact ||
      artifact.revealed ||
      artifact.get_isUnique() ||
      favorites.isFavorite(view.p.id, artifact.id) ||
      artifact.name === 'Recycle Generator'
    )
      continue;
    if (
      artifact.stats.length < filters.lines ||
      artifactFitness(artifact) < filters.fitness ||
      artifact.level < filters.strength
    )
      selected.push(artifact);
  }
  return selected;
}

/** A request owns its snapshot even when sorting or closing replaces the display nodes. */
export class ArtifactPurify {
  disposed = false;

  constructor(
    private view: ArtifactOverview,
    private favorites: ArtifactFavorites,
    private localize: (text: string) => string,
    private onInventoryChanged: () => void = () => {},
  ) {}

  recycle(filters: PurifyFilters): void {
    const view = this.view;
    const game = view.g;
    const cargo = game.myCargo;
    if (this.disposed || !cargo) return;
    if (game.artifactRecyclePending) {
      view.purifyButton.set_enabled(true);
      return;
    }
    const artifacts = selectPurifyArtifacts(view, filters, this.favorites);
    for (const box of view.cargoBoxes)
      if (box.a && artifacts.includes(box.a)) box.setSelectedForRecycle();
    if (!artifacts.length || cargo.get_isFull()) {
      game.showErrorDialog(
        artifacts.length
          ? this.localize('Your cargo compressor is overloaded!')
          : 'No artifacts to recycle.',
      );
      view.purifyButton.set_enabled(true);
      return;
    }
    const message = game.createMessage('bulkRecycle');
    for (const artifact of artifacts) message.add(artifact.id);
    game.artifactRecyclePending = true;
    let completed = false;
    const finish = (response: Message) => {
      if (completed) return;
      completed = true;
      game.artifactRecyclePending = false;
      if (!response.getBoolean(0)) {
        game.showErrorDialog(response.getString(1));
      } else {
        for (const artifact of artifacts) {
          const index = view.p.artifacts.indexOf(artifact);
          if (index === -1) continue;
          view.p.artifactCount--;
          view.p.artifacts.splice(index, 1);
          if (!this.disposed)
            for (const box of view.cargoBoxes)
              if (box.a === artifact) {
                box.setEmpty();
                break;
              }
        }
        if (view.p.artifactCount < view.p.get_artifactLimit()) game.hud?.hideArtifactLimitText();
        for (let index = 1; index < response.length; index += 2)
          cargo.addItem('Commodities', response.getString(index), response.getInt(index + 1));
        if (!this.disposed) view.updateInventorySummary?.();
        this.onInventoryChanged();
      }
      if (!this.disposed) view.purifyButton.set_enabled(true);
    };
    try {
      game.rpcMessage(message, finish);
    } catch (error) {
      completed = true;
      game.artifactRecyclePending = false;
      if (!this.disposed) view.purifyButton.set_enabled(true);
      throw error;
    }
  }
}

export function installArtifactPurify(api: API, favorites: ArtifactFavorites): void {
  const reflection = new GameReflection(api);
  const key = 'artifact.purify';
  let filters: PurifyFilters = { fitness: 110, strength: 90, lines: 0 };
  try {
    const stored = api.storage.get<Partial<PurifyFilters>>(key, {});
    for (const field of ['fitness', 'strength', 'lines'] as const)
      if (typeof stored?.[field] === 'number' && Number.isFinite(stored[field]))
        filters[field] = stored[field]! | 0;
  } catch {
    // The source defaults remain usable when persistent storage is disabled.
  }
  const views = new Map<ArtifactOverview, { controller: ArtifactPurify; nodes: DisplayObject[] }>();
  const remove = (view: ArtifactOverview) => {
    const state = views.get(view);
    if (!state) return;
    state.controller.disposed = true;
    for (const node of state.nodes) node.removeFromParent(true);
    views.delete(view);
  };
  reflection.after(ArtifactOverview.prototype, 'drawComponents', function () {
    if (this.artifactViewDisposed) return;
    remove(this);
    const view = this;
    const controller = new ArtifactPurify(
      view,
      favorites,
      (text) => Localize.t(text),
      () => {
        // A menu reopened during the RPC has different boxes for the same
        // inventory. Retire those tiles too when the server confirms recycling.
        for (const openView of views.keys()) {
          if (openView.p !== view.p) continue;
          for (const box of openView.cargoBoxes)
            if (box.a && !view.p.artifacts.includes(box.a)) box.setEmpty();
          if (openView.markedForRecycle)
            openView.markedForRecycle = openView.markedForRecycle.filter((artifact) =>
              view.p.artifacts.includes(artifact),
            );
          openView.updateInventorySummary?.();
        }
      },
    );
    const nodes: DisplayObject[] = [];
    const add = <T extends DisplayObject>(node: T): T => {
      nodes.push(node);
      view.addChild(node);
      return node;
    };
    const expanded = !!view.expandedView;
    const baseY = expanded ? (view.viewHeight ?? 520) - 180 : 426;
    const inputX = expanded ? (view.infoX ?? 0) : 458;
    for (const [index, field] of (['lines', 'fitness', 'strength'] as const).entries()) {
      const y = baseY + index * (expanded ? 28 : 27);
      const input = add(new InputText(inputX, y, 40, 25));
      input.set_restrict('0-9');
      input.set_maxChars(3);
      input.set_text(String(filters[field]));
      input.set_visible(true);
      input.set_isEnabled(true);
      const inputField = {
        lines: 'lineInput',
        fitness: 'fitnessInput',
        strength: 'strengthInput',
      } as const;
      view[inputField[field]] = input;
      const label = expanded
        ? ['Min lines', 'Min fitness', 'Min strength'][index]
        : ['Lines', 'Fitness', 'Level'][index];
      add(new Text(expanded ? inputX + 50 : 500, y + 4, Localize.t(label), 12));
    }
    view.purifyButton = add(
      new Button(
        () => controller.recycle(filters),
        expanded ? Localize.t('Purify') : 'Purify!',
        'positive',
      ),
    );
    view.purifyButton.set_x(expanded ? (view.infoX ?? 0) : 380);
    view.purifyButton.set_y(expanded ? baseY + 92 : 480);
    view.saveStatsButton = add(
      new Button(
        () => {
          filters = {
            fitness: Number(view.fitnessInput.get_text()) | 0,
            strength: Number(view.strengthInput.get_text()) | 0,
            lines: Number(view.lineInput.get_text()) | 0,
          };
          try {
            api.storage.set(key, filters);
          } catch {
            /* Retain the session filters. */
          }
          view.saveStatsButton.set_enabled(true);
        },
        expanded ? Localize.t('Save filters') : 'Save!',
        'positive',
      ),
    );
    view.saveStatsButton.set_x(
      expanded ? (view.infoX ?? 0) + view.purifyButton.get_width() + 10 : 380,
    );
    view.saveStatsButton.set_y(expanded ? baseY + 92 : 480 - view.purifyButton.get_height() - 10);
    views.set(view, { controller, nodes });
  });
  reflection.before(ArtifactOverview.prototype, 'dispose', function () {
    remove(this);
  });
  api.defer(() => {
    for (const view of views.keys()) remove(view);
  });
}
