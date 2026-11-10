import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClientSettings} from '../src/ported/ClientSettings';
test('complete ClientSettings source port preserves per-player defaults, clamping and serialization',()=>{
 const saved:any={data:{},flush(){}};const game:any={instance:{me:{id:'player-one'}}};
 const definitions:any={'core.scene.Game':game,'core.scene.SceneBase':{},'openfl.geom.Point':class{constructor(public x=0,public y=0){}},'openfl.net.SharedObject':{getLocal:()=>saved}};
 const Settings=createClientSettings(name=>{assert.ok(definitions[name],name);return definitions[name];});
 const settings=new Settings();assert.equal(settings.autoTarget,true);assert.equal(settings.targetSearchDistance,2000);
 settings.targetSearchDistance=99999;assert.equal(settings.targetSearchDistance,5000);
 settings.nearbyEnemyRadarLines=-100;assert.equal(settings.nearbyEnemyRadarLines,0);
 settings.autoTarget=false;settings.save();const restored=new Settings();assert.equal(restored.autoTarget,false);
 game.instance.me.id='player-two';assert.equal(restored.autoTarget,true);assert.equal(restored.nearbyEnemyRadarLines,5);
 game.instance.me.id='player-one';assert.equal(restored.autoTarget,false);
});
