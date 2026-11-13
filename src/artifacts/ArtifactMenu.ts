import { cancelNativePlayerCommands } from '../movement/NativeCommandCancellation';
import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import {
  ArtifactState2,
  DisplayState,
  ArtifactOverview,
  MenuHud,
  Point,
  Quad,
  Starling,
  RymdenRunt,
  SceneBase,
  ToolTip,
  type StarlingStage,
} from '../game/Bindings';
import { configureArtifactLayout } from './ArtifactLayout';

const expandedGames = new WeakSet<object>();
export function expandedArtifactsOpen(game: object): boolean {
  return expandedGames.has(game);
}

interface MenuOverview extends ArtifactOverview {
  expandedView?: boolean;
  landedClassicView?: boolean;
  artifactMenu?: MenuHud;
}

interface MenuSession {
  overview: MenuOverview | null;
  menu: MenuHud;
  stage: StarlingStage;
  stats: Starling | null;
  statsVisible: boolean;
  backgroundVisible: boolean;
  closeVisible: boolean;
  dim: Quad | null;
  dimAlpha: number;
  position: () => void;
  rebuild: () => void;
  close: () => void;
  release: () => void;
}

/** Original ArtifactState2 lifecycle adapted to the native Haxe DisplayState container. */
export function installArtifactMenu(api: API): void {
  const reflection = new GameReflection(api);
  const sessions = new Map<ArtifactState2, MenuSession>();
  const setStats = (stats: Starling | null, visible: boolean) => {
    stats?.set_showStats(visible);
  };
  const reset = (session: MenuSession) => {
    const { menu } = session;
    menu.set_x(0);
    menu.set_y(0);
    menu.bgr?.set_visible(session.backgroundVisible);
    menu.continueGameButton?.set_visible(session.closeVisible);
    if (session.dim) session.dim.set_alpha(session.dimAlpha);
    session.dim = null;
    setStats(session.stats, session.statsVisible);
  };
  const destroyOverview = (state: ArtifactState2, session: MenuSession) => {
    const view = session.overview;
    session.overview = null;
    if (!view) return;
    view.removeEventListener('artifactOverviewLayoutChanged', session.rebuild);
    view.removeEventListener('artifactOverviewCloseRequested', session.close);
    state.removeChild(view, true);
  };
  const release = (state: ArtifactState2) => {
    const session = sessions.get(state);
    if (!session) return;
    sessions.delete(state);
    expandedGames.delete(state.g);
    ToolTip.disposeType('artifactBox');
    session.menu.removeEventListener('addedToStage', session.position);
    session.menu.removeEventListener('removedFromStage', session.release);
    session.stage.removeEventListener('resize', session.position);
    destroyOverview(state, session);
    reset(session);
    state.g.messageLog?.set_visible(true);
  };
  reflection.around(ArtifactState2.prototype, 'enter', function () {
    const state = this;
    DisplayState.prototype.enter.call(state);
    const game = state.g;
    cancelNativePlayerCommands(game);
    const menu = reflection.cast(state.sm.parent, 'core.hud.MenuHud');
    const stage = Starling.get_current()?.get_stage();
    if (!stage) throw new Error('Artifact menu requires an active Starling stage');
    const stats = RymdenRunt.s ?? null;
    const session: MenuSession = {
      overview: null,
      menu,
      stage,
      stats,
      statsVisible: stats?.get_showStats() ?? false,
      backgroundVisible: menu.bgr?.get_visible() ?? true,
      closeVisible: menu.continueGameButton?.get_visible() ?? true,
      dim: null,
      dimAlpha: 0,
      position: () => {},
      rebuild: () => {},
      close: () => menu.close(),
      release: () => release(state),
    };
    session.position = () => {
      const expanded = !!session.overview?.expandedView;
      menu.set_x(0);
      menu.set_y(0);
      if (!expanded) return;
      const parent = menu.get_parent();
      if (!parent || !menu.get_stage()) return;
      const origin = parent.localToGlobal(new Point(0, 0));
      menu.set_x(-origin.x);
      menu.set_y(-origin.y);
      if (!session.dim) {
        const index = parent.getChildIndex(menu);
        const candidate = index > 0 ? parent.getChildAt(index - 1) : null;
        if (candidate && candidate instanceof Quad) {
          session.dim = candidate;
          session.dimAlpha = candidate.get_alpha();
        }
      }
      session.dim?.set_alpha(Math.min(session.dimAlpha, 0.35));
    };
    session.rebuild = () => {
      ToolTip.disposeType('artifactBox');
      destroyOverview(state, session);
      reset(session);
      const view: MenuOverview = new ArtifactOverview(game);
      view.landedClassicView = !!view.p.isLanded;
      view.expandedView =
        !view.landedClassicView && (SceneBase.clientSettings?.expandedArtifactOverview ?? true);
      if (view.expandedView) {
        expandedGames.add(game);
        if (game.chatInput?.isActive()) game.chatInput.closeChat();
      } else expandedGames.delete(game);
      game.messageLog?.set_visible(!view.expandedView);
      configureArtifactLayout(view, stage.get_stageWidth(), stage.get_stageHeight());
      view.artifactMenu = menu;
      view.addEventListener('artifactOverviewLayoutChanged', session.rebuild);
      view.addEventListener('artifactOverviewCloseRequested', session.close);
      session.overview = view;
      state.addChild(view);
      view.set_x(view.expandedView ? 0 : 55);
      view.set_y(view.expandedView ? 0 : 50);
      menu.bgr?.set_visible(view.expandedView ? false : session.backgroundVisible);
      menu.continueGameButton?.set_visible(view.expandedView ? false : session.closeVisible);
      setStats(stats, view.expandedView ? false : session.statsVisible);
      view.load();
      session.position();
    };
    sessions.set(state, session);
    menu.addEventListener('addedToStage', session.position);
    menu.addEventListener('removedFromStage', session.release);
    stage.addEventListener('resize', session.position);
    session.rebuild();
  });
  reflection.before(ArtifactState2.prototype, 'exit', function () {
    release(this);
  });
  api.defer(() => {
    for (const session of [...sessions.values()]) session.close();
    for (const state of sessions.keys()) expandedGames.delete(state.g);
    sessions.clear();
  });
}
