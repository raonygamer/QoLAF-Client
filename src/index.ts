import {read, type API, type Raw} from './api/types';
import {ChatHistory} from './chat/history';
import {parseCommand} from './chat/parser';
import {settings, type Settings} from './settings/settings';
import {TargetSystem} from './target/system';
import {Telemetry} from './telemetry/metrics';
import {artifactFitness} from './artifacts/fitness';

export default {
 id: 'qolaf.client', name: 'QoLAF Client', version: '0.1.0', apiVersion: 1,
 activate(api: API) {
  const history = new ChatHistory();
  let open: (() => void) | undefined;
  api.on('classesReady', () => {
   const chat = api.cls('core.hud.components.chat.ChatInputText')?.prototype;
   if (!chat || !['previous', 'next', 'sendMessage', 'closeChat'].every(k => typeof chat[k] === 'function')) {
    api.log('Chat API changed; chat enhancements disabled.'); return;
   }
   api.around(chat, 'previous', function () { this.input.set_text(history.previous(this.input.get_text())); });
   api.around(chat, 'next', function () { this.input.set_text(history.next(this.input.get_text())); });
   api.after(chat, 'closeChat', () => history.begin());
   api.around(chat, 'sendMessage', function (next, ...args) {
    const text = this.input.get_text();
    if (/^\/qolaf(?:\s|$)/i.test(text)) {
     // This command stays local, including malformed arguments.
     try { parseCommand(text); open?.(); } catch (error) { api.log(error); }
     history.record(text); this.input.set_text(''); return;
    }
    const result = next(...args); history.record(text); return result;
   });
  });
  api.onGame((game, session) => {
   const me = read(game, 'me');
   if (!me?.ship || !Array.isArray(game.unitManager?.units)) { api.log('Game object layout changed; session UI disabled.'); return; }
   const key = 'settings.' + String(me.id ?? read(me, 'name', 'default'));
   let config: Settings;
   try { config = settings(session.storage.get(key, {})); } catch { config = settings({}); }
   const target = new TargetSystem(game, config, api.cls('core.ship.PlayerShip'));
   const metrics = new Telemetry();
   const root = document.createElement('div');
   root.style.cssText = 'position:fixed;top:44px;right:12px;z-index:10000;color:white;font:13px system-ui';
   const shadow = root.attachShadow({mode:'open'});
   const style = document.createElement('style');
   style.textContent = ':host{color-scheme:dark}button,input{font:inherit}button{cursor:pointer;background:#153247;color:#eef;border:1px solid #58819a;border-radius:4px;padding:5px;margin:2px}section{background:#0c1823ed;border:1px solid #486273;padding:10px;border-radius:6px;width:290px;max-height:65vh;overflow:auto;margin-top:5px}label{display:block;margin:7px 0}input[type=number]{width:70px}p{margin:6px 0}small{color:#aac}';
   shadow.append(style);
   const button = (text: string, action: () => void, parent: Node = shadow) => {
    const b = document.createElement('button'); b.textContent = text; b.onclick = action; parent.appendChild(b); return b;
   };
   const telemetry = document.createElement('p'); shadow.append(telemetry);
   const panel = document.createElement('section'); panel.hidden = true;
   const targetInfo = document.createElement('p');
   const nearby = document.createElement('div');
   const tools = document.createElement('section'); tools.hidden = true;
   let blockedBefore: unknown;
   const showTools = (show: boolean) => {
    if (show === !tools.hidden) return;
    tools.hidden = !show;
    if (show) {
     blockedBefore = game.blockHotkeys; game.blockHotkeys = true;
     const input = api.cls('io.InputLocator')?.getService();
     if (input) {
      for (const map of [input.downKeys, input.pressedKeys, input.releasedKeys]) {
       if (map?.h) for (const key of Object.keys(map.h)) map.h[key] = false;
      }
      input._isMousePressed = input._isRightMousePressed = false;
      input._mouseJustPressed = input._rightMouseJustPressed = false;
     }
    }
    else if (game.blockHotkeys === true) game.blockHotkeys = blockedBefore;
   };
   button('QoLAF', () => showTools(tools.hidden));
   button('Targets', () => { panel.hidden = !panel.hidden; });
   panel.append(targetInfo);
   const lockButton = button('Lock', () => { target.locked = !!target.current && !target.locked; }, panel);
   button('Clear', () => target.clear(true), panel); panel.append(nearby);
   const names: Record<keyof Settings,string> = {
    auto_target:'Automatic target selection',exclude_af_faction_from_radar:'Exclude AF faction',target_search_distance:'Target range',nearby_enemy_radar_lines:'Nearby targets',
    show_radar_fps:'Show FPS',show_radar_latency:'Show latency',show_radar_speed:'Show speed',radar_speed_in_mph:'Speed in mph',show_radar_service:'Show connection status'
   };
   for (const keyName of Object.keys(config) as (keyof Settings)[]) {
    const label = document.createElement('label'), input = document.createElement('input');
    input.type = typeof config[keyName] === 'boolean' ? 'checkbox' : 'number';
    if (input.type === 'checkbox') input.checked = config[keyName] as boolean;
    else { input.value = String(config[keyName]); input.min = keyName === 'target_search_distance' ? '100' : '0'; input.max = keyName === 'target_search_distance' ? '5000' : '10'; }
    input.onchange = () => {
     Object.assign(config, settings({...config,[keyName]:input.type === 'checkbox' ? input.checked : Number(input.value)}));
     if (input.type === 'number') input.value = String(config[keyName]);
     try { session.storage.set(key, config); } catch (error) { api.log('Could not save settings', error); }
    };
    label.append(input, ' ' + names[keyName]); tools.append(label);
   }
   const artifacts = document.createElement('div');
   button('Artifact fitness', () => {
    artifacts.replaceChildren();
    const owned: Raw[] = Array.isArray(me.artifacts) ? me.artifacts : [];
    const scored = owned.filter(a => a.revealed && Array.isArray(a.stats)).map(a => ({a,score:artifactFitness(a as any)})).sort((a,b) => b.score-a.score);
    if (!scored.length) artifacts.textContent = 'No revealed artifacts.';
    for (const {a,score} of scored) {
     const line = document.createElement('p'); line.textContent = `${a.name || a.id}: ${score.toFixed(2)}`; artifacts.append(line);
    }
   }, tools);
   tools.append(artifacts); button('Close', () => showTools(false), tools);
   shadow.append(panel, tools); session.mount(root);
   for (const event of ['keydown','keyup','pointerdown','pointerup','click','wheel']) root.addEventListener(event, e => e.stopPropagation());
   const sessionOpen = () => showTools(true); open = sessionOpen;
   session.defer(() => { showTools(false); if (open === sessionOpen) open = undefined; });
   const bindings = new Map<Raw, () => void>();
   session.defer(() => { for (const dispose of bindings.values()) dispose(); bindings.clear(); });
   const canvas = game.canvas;
   if (typeof canvas?.set_touchable === 'function') {
    const old = read(canvas,'touchable'); canvas.set_touchable(true);
    session.defer(() => { if (read(canvas,'touchable') === true) canvas.set_touchable(old); });
   }
   const name = (u: Raw) => String(read(u.player,'name', read(u,'name','Unknown')));
   session.on('frame', ({game: current, event}) => {
    if (current !== game) return;
    const dt = Number(read(event,'passedTime',0));
    const ship = read(game,'me')?.ship, speed = read(ship,'course')?.speed;
    metrics.advance(dt, ship?.landed ? 0 : speed?.x, ship?.landed ? 0 : speed?.y, !!ship?.alive && !!speed);
    target.update(dt);
   });
   session.interval(() => {
    const units: Raw[] = game.unitManager.units;
    const present = new Set(units);
    for (const [unit, dispose] of bindings) if (!present.has(unit) || !unit.alive) { dispose(); bindings.delete(unit); }
    for (const unit of units) {
     if (!target.valid(unit) || bindings.has(unit)) continue;
     const clip = read(unit,'movieClip');
     if (typeof clip?.addEventListener !== 'function' || typeof clip?.set_touchable !== 'function') continue;
     const old = read(clip,'touchable');
     const touched = (event: Raw) => { if (event.getTouch(clip,'began')) target.select(unit); };
     clip.set_touchable(true); clip.addEventListener('touch', touched);
     bindings.set(unit, () => { clip.removeEventListener('touch',touched); if (read(clip,'touchable') === true) clip.set_touchable(old); });
    }
    const candidates = units.filter(u => target.valid(u) && !target.excluded(u) && target.distance(u) < config.target_search_distance).sort((a,b) => target.distance(a)-target.distance(b));
    // Keep a valid target stable; consider higher-priority players without rotating NPCs.
    if (!target.current) { for (const unit of candidates) if (target.auto(unit)) break; }
    else for (const unit of candidates) if (unit.player && !target.current.player && target.auto(unit)) break;
    const pieces: string[] = [], fmt = (v: number) => Number.isFinite(v) ? Math.round(v).toString() : '—';
    if (config.show_radar_fps) pieces.push(`${fmt(metrics.fps)} FPS`);
    if (config.show_radar_latency) pieces.push(`${fmt(Number(game.clock?.latency))} ms`);
    if (config.show_radar_speed) pieces.push(`${fmt(metrics.displaySpeed(config.radar_speed_in_mph))} ${config.radar_speed_in_mph ? 'mph' : 'km/h'}`);
    if (config.show_radar_service) pieces.push(read(game.serviceConnection,'connected',false) ? 'Connected' : 'Disconnected');
    telemetry.textContent = pieces.join(' · ');
    const u = target.current;
    targetInfo.textContent = u ? `${name(u)} · ${fmt(target.distance(u))} units | HP ${fmt(u.hp)}/${fmt(read(u,'hpMax'))} | Shield ${fmt(u.shieldHp)}/${fmt(read(u,'shieldHpMax'))}` : 'No target';
    lockButton.textContent = target.locked ? 'Unlock' : 'Lock';
    if (!panel.hidden) {
     nearby.replaceChildren();
     for (const unit of candidates.slice(0,config.nearby_enemy_radar_lines)) button(`${name(unit)} · ${fmt(target.distance(unit))}`, () => target.select(unit,true), nearby);
    }
   }, 200);
  });
 }
};
