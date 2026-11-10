import { read, type API, type Raw } from '../api/Types';
import { configureArtifactLayout } from './ArtifactLayout';

interface MenuSession {
  overview: Raw | null;
  menu: Raw;
  stage: Raw;
  stats: Raw | null;
  statsVisible: boolean;
  backgroundVisible: boolean;
  closeVisible: boolean;
  dim: Raw | null;
  dimAlpha: number;
  position: () => void;
  rebuild: () => void;
  close: () => void;
}

/** Original ArtifactState2 lifecycle adapted to the native Haxe DisplayState container. */
export function installArtifactMenu(api: API): void {
  const State = api.cls('core.states.menuStates.ArtifactState2');
  const Base = api.cls('core.states.DisplayState');
  const Overview = api.cls('core.artifact.ArtifactOverview');
  const Point = api.cls('openfl.geom.Point') as any;
  if (!State || !Base || !Overview) throw Error('Artifact menu runtime dependencies are missing');
  const sessions = new Map<Raw, MenuSession>();
  const setStats = (stats: Raw | null, visible: boolean) => {
    if (stats?.set_showStats) stats.set_showStats(visible);
    else if (stats) stats.showStats = visible;
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
  const destroyOverview = (state: Raw, session: MenuSession) => {
    const view = session.overview;
    session.overview = null;
    if (!view) return;
    view.removeEventListener('artifactOverviewLayoutChanged', session.rebuild);
    view.removeEventListener('artifactOverviewCloseRequested', session.close);
    state.removeChild(view, true);
  };
  api.around(State.prototype, 'enter', function () {
    const state = this;
    Base.prototype.enter.call(state);
    const game = state.g;
    if (game.chatInput?.isActive()) game.chatInput.closeChat();
    game.messageLog.set_visible(false);
    const play = read(game.gameStateMachine, 'activeState');
    const ship = read(game, 'me')?.ship;
    if (play?.sendCommand && ship) {
      play.autoCruise = false;
      play.fireWithHotkeys = false;
      play.releaseAimAssist?.();
      const course = read(ship, 'course');
      for (const [field, command] of [
        ['accelerate', 0],
        ['deaccelerate', 8],
        ['rotateLeft', 1],
        ['rotateRight', 2],
      ] as const)
        if (course?.[field]) play.sendCommand(command, false);
      if (read(ship, 'isShooting')) {
        for (const weapon of ship.weapons) weapon.set_fire(false);
        play.sendCommand(3, false);
      }
      game.camera.zoomFocus(read(game, 'me').zoom, 100);
    }
    const menu = state.sm.parent;
    const stage = api.cls('starling.core.Starling')!.get_current().get_stage();
    const stats = api.cls('RymdenRunt')?.s ?? null;
    const session: MenuSession = {
      overview: null,
      menu,
      stage,
      stats,
      statsVisible: read(stats, 'showStats', false),
      backgroundVisible: read(menu.bgr, 'visible', true),
      closeVisible: read(menu.continueGameButton, 'visible', true),
      dim: null,
      dimAlpha: 0,
      position: () => {},
      rebuild: () => {},
      close: () => menu.close(),
    };
    session.position = () => {
      const expanded = !!session.overview?.expandedView;
      menu.set_x(0);
      menu.set_y(0);
      if (!expanded) return;
      const parent = read(menu, 'parent');
      if (!parent || !read(menu, 'stage')) return;
      const origin = parent.localToGlobal(new Point(0, 0));
      menu.set_x(-origin.x);
      menu.set_y(-origin.y);
      if (!session.dim) {
        const index = parent.getChildIndex(menu);
        const candidate = index > 0 ? parent.getChildAt(index - 1) : null;
        const Quad = api.cls('starling.display.Quad') as any;
        if (candidate && candidate instanceof Quad) {
          session.dim = candidate;
          session.dimAlpha = read(candidate, 'alpha');
        }
      }
      session.dim?.set_alpha(Math.min(session.dimAlpha, 0.35));
    };
    session.rebuild = () => {
      api.cls('core.hud.components.ToolTip')?.disposeType('artifactBox');
      destroyOverview(state, session);
      reset(session);
      const view = new (Overview as any)(game);
      view.landedClassicView = !!view.p.isLanded;
      view.expandedView =
        !view.landedClassicView &&
        (api.cls('core.scene.SceneBase')?.clientSettings?.expandedArtifactOverview ?? true);
      configureArtifactLayout(view, read(stage, 'stageWidth'), read(stage, 'stageHeight'));
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
    stage.addEventListener('resize', session.position);
    session.rebuild();
  });
  api.before(State.prototype, 'exit', function () {
    const session = sessions.get(this);
    if (!session) return;
    session.menu.removeEventListener('addedToStage', session.position);
    session.stage.removeEventListener('resize', session.position);
    destroyOverview(this, session);
    reset(session);
    this.g.messageLog.set_visible(true);
    sessions.delete(this);
  });
  api.defer(() => {
    for (const session of [...sessions.values()]) session.close();
    sessions.clear();
  });
}
