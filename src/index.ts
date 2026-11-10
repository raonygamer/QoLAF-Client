import {read,type API,type Raw} from './api/types';
import {ChatHistory} from './chat/history';
import {settings} from './settings/settings';
import {TargetSystem} from './target/system';
import {NativeUI} from './ui/native';
import {loadFonts} from './ui/fonts';
import {TargetInfo} from './ui/target-info';
import {RadarTelemetry} from './ui/radar-telemetry';
import {loginIdentity,PORT_VERSION} from './login/identity';
import {loginProfiles} from './login/profiles';
import {installArtifactUI} from './artifacts/native';

export default {
 id:'qolaf.client',name:'QoLAF Client',version:PORT_VERSION,apiVersion:1,
 activate(api:API){
  const history=new ChatHistory();let fonts:Promise<void>|undefined;
  const ensureFonts=()=>fonts??=loadFonts(api);
  api.on('classesReady',()=>{
   const login=api.cls('Login')!.prototype;
   api.around(login,'connectSteam',function(next,...args){if(this.$qolafAllowSteam)return next(...args);});
   api.after(login,'init',function(){const instance=this;void ensureFonts().then(()=>{if(read(instance,'stage')){api.defer(loginIdentity(api,instance));api.defer(loginProfiles(api,instance));}}).catch(error=>api.log('Login font initialization failed',error));});
   const chat=api.cls('core.hud.components.chat.ChatInputText')!.prototype;
   api.around(chat,'previous',function(){this.input.set_text(history.previous(this.input.get_text()));});
   api.around(chat,'next',function(){this.input.set_text(history.next(this.input.get_text()));});
   api.after(chat,'closeChat',()=>history.begin());
   api.around(chat,'sendMessage',function(next,...args){const text=this.input.get_text();const result=next(...args);history.record(text);return result;});
   installArtifactUI(api);
  });
  api.onGame((game,session)=>{
   let alive=true;session.defer(()=>{alive=false;});
   void ensureFonts().then(()=>{
    if(!alive)return;
    const ui=new NativeUI(session),me=read(game,'me');
    const key='settings.'+String(me.id);const config=settings(session.storage.get(key,{}));
    const save=()=>{try{session.storage.set(key,config);}catch(error){session.log('Settings save failed',error);}};
    const target=new TargetSystem(game,config,api.cls('core.ship.PlayerShip'));
    const panel=new TargetInfo(ui,game,target,config,save);session.defer(()=>panel.dispose());
    // The original HUD owns target info and telemetry, so menus hide them with it.
    game.hud.container.addChild(panel.node);
    const telemetry=new RadarTelemetry(ui,game,config);game.hud.container.addChild(telemetry.node);session.defer(()=>telemetry.dispose());
    const bindings=new Map<Raw,{clip:Raw;off:()=>void}>();
    session.defer(()=>{for(const binding of bindings.values())binding.off();bindings.clear();});
    const canvas=game.canvas,oldTouchable=read(canvas,'touchable');canvas.set_touchable(true);session.defer(()=>canvas.set_touchable(oldTouchable));
    const bossBar=game.hud.bossHealth,oldBossVisibility=read(bossBar,'visible');
    session.defer(()=>bossBar?.set_visible(oldBossVisibility));
    session.on('frame',({game:current,event})=>{
     if(current!==game)return;const dt=read(event,'passedTime',0);target.update(dt);panel.update(dt);telemetry.update(dt);
     if(config.disable_native_boss_bar)bossBar?.set_visible(false);
    });
    session.interval(()=>{
     const units:Raw[]=game.unitManager.units,present=new Set(units);
     for(const [unit,binding] of bindings)if(!present.has(unit)||!unit.alive||read(unit,'movieClip')!==binding.clip){binding.off();bindings.delete(unit);}
     for(const unit of units){if(!target.valid(unit)||bindings.has(unit))continue;const clip=read(unit,'movieClip');if(!clip)continue;
      const old=read(clip,'touchable');clip.set_touchable(true);const off=ui.touch(clip,()=>target.select(unit));bindings.set(unit,{clip,off:()=>{off();clip.set_touchable(old);}});}
    },250);
    // Match the original integration: radar candidates offer automatic targets.
    const radar=api.cls('core.hud.components.radar.Radar')?.prototype;
    if(typeof radar?.update==='function')session.after(radar,'update',function(){for(const unit of game.unitManager.units)if(unit.isHostile)target.auto(unit);});
   }).catch(error=>session.log('Native client initialization failed',error));
  });
 }
};
