import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error actual host JavaScript module
import {nativeManager} from './fixtures/native-manager.js';
// @ts-expect-error actual host JavaScript module
import {PluginHost} from './fixtures/host-core.js';
import {registry,Stage,Game} from './fixtures/native-game';
test('native Plugins UI mounts in login/game display lists, blocks input only while open, and cleans up',()=>{
 const errors:any[]=[];const host=new PluginHost({storage:{getItem:()=>null},log:{info(){},error:(...args:any[])=>errors.push(args)}});
 const ui=nativeManager(host,{config:()=>({plugins:[]}),save(){},reload(){},safe:false,error:()=>''});
 const classes=registry();host.classesReady(classes);const login=new classes.Login(),stage=new Stage();stage.addChild(login);login.init();
 assert.equal(login.children.length,1);ui.open();assert.equal(login.children.length,2);
 const game=new Game();host.created(game);game.runGameLoop();assert.equal(login.children.length,0);assert.equal(game.overlay.children.length,1);
 ui.open();assert.equal(game.blockHotkeys,true);assert.equal(game.overlay.children.length,2);
 const panel=game.overlay.children[1],close=panel.children.find((c:any)=>typeof c.callback==='function');close!.callback();assert.equal(game.blockHotkeys,false);
 host.dispose();assert.equal(game.overlay.children.length,0);assert.deepEqual(errors,[]);
});
