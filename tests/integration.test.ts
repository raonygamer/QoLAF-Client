import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// @ts-expect-error actual host JavaScript fixture
import {PluginHost} from './fixtures/host-core.js';
import {registry,Game} from './fixtures/native-game';
const plugin=(await import(pathToFileURL(process.cwd()+'/dist/qolaf-client.js').href)).default;

test('compiled native client: real Starling event dispatch, HUD ownership and session cleanup',async t=>{
 const errors:unknown[]=[];const data=new Map();
 const host=new PluginHost({storage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)},importer:async()=>({default:plugin}),log:{info:(...v:unknown[])=>errors.push(v),error:(...v:unknown[])=>errors.push(v)}});
 t.after(()=>host.dispose());
 const result=await host.load('https://example.com/client.js');assert.equal(result.state,'active');host.classesReady(registry());
 const game=new Game();host.created(game);game.runGameLoop();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(errors,[]);assert.equal(game.hud.container.children.length,3,'radar plus native target and telemetry nodes');
 for(let i=0;i<35;i++)game.frame();assert.equal(game.frames,35);
 assert.deepEqual(errors,[]);assert.equal(game.canvas.get_touchable(),true);
 await new Promise(resolve=>setTimeout(resolve,270));assert.equal(game.unitManager.units[0].clip.listeners('touch').length,1);
 const nodes=game.hud.container.children.slice(1);game.exit();assert.ok(nodes.every(node=>node.disposed));assert.equal(game.hud.container.children.length,1);assert.equal(game.unitManager.units[0].clip.listeners('touch').length,0);
 const second=new Game();host.created(second);second.runGameLoop();await new Promise(resolve=>setImmediate(resolve));second.frame();assert.equal(second.frames,1);assert.deepEqual(errors,[]);
 host.dispose();assert.equal(second.hud.container.children.length,1);
});
