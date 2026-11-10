import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
// Fixture is the actual QoLAF host implementation at 946fb07.
// @ts-expect-error JavaScript fixture retains upstream source verbatim.
import {PluginHost} from './fixtures/host-core.js';
import sourcePlugin from '../src/index';
import {pathToFileURL} from 'node:url';
const plugin = process.env.BUNDLE_TEST ? (await import(pathToFileURL(process.cwd() + '/dist/qolaf-client.js').href)).default : sourcePlugin;

test('actual host: hook installation, native chat, DOM settings, target UI, cleanup and reconnect', async (t) => {
 const {document} = parseHTML('<html><body></body></html>');
 Object.assign(globalThis,{document});
 const store = new Map<string,string>(); const storage = {getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
 const errors: unknown[]=[];
 const host = new PluginHost({storage,importer:async()=>({default:plugin}),log:{info(){},error:(...v:unknown[])=>errors.push(v)}});
 t.after(() => host.dispose());
 let sent = 0;
 class Chat {
  text=''; input={get_text:()=>this.text,set_text:(s:string)=>{this.text=s;}};
  previous(){} next(){} closeChat(){} sendMessage(){sent++;this.text='';return 42;}
 }
 class Clip { touchable=false; listeners=new Map(); get_touchable(){return this.touchable;} set_touchable(v:boolean){this.touchable=v;} addEventListener(n:string,f:any){this.listeners.set(n,f);} removeEventListener(n:string,f:any){if(this.listeners.get(n)===f)this.listeners.delete(n);} }
 const clip = new Clip();
 const enemy={alive:true,name:'Enemy',hp:50,shieldHp:25,get_hpMax:()=>100,get_shieldHpMax:()=>50,get_pos:()=>({x:10,y:0}),get_movieClip:()=>clip};
 class Game {
  blockHotkeys=false; canvas=new Clip(); unitManager={units:[enemy]};
  clock={latency:25}; serviceConnection={get_connected:()=>true};
  me={id:'tester',ship:{alive:true,get_pos:()=>({x:0,y:0}),get_course:()=>({speed:{x:3,y:4}})},artifacts:[{name:'Visible',revealed:true,stats:[{type:'dotDamage',value:2}]},{name:'Secret',revealed:false,stats:[]}]};
  get_me(){return this.me;} runGameLoop(){} exit(){} tickUpdate(){} update(_e:unknown){}
 }
 const originalSend = Chat.prototype.sendMessage;
 const record = await host.load('https://example.com/client.js'); assert.equal(record.state,'active');
 host.classesReady({'core.scene.Game':Game,'core.hud.components.chat.ChatInputText':Chat});
 const game=new Game(); host.created(game);game.runGameLoop();
 for(let i=0;i<31;i++)game.update({get_passedTime:()=>1/60});
 const chat=new Chat();chat.text='hello';assert.equal(chat.sendMessage(),42);assert.equal(sent,1);
 chat.text='draft';chat.previous();assert.equal(chat.text,'hello');chat.next();assert.equal(chat.text,'draft');
 chat.text='/qolaf';chat.sendMessage();assert.equal(sent,1);assert.equal(game.blockHotkeys,true);
 const root=document.body.firstElementChild!;const shadow=root.shadowRoot!;
 const button=(name:string)=>Array.from(shadow.querySelectorAll('button')).find(b=>b.textContent===name)!;
 button('Artifact fitness').click();assert.match(shadow.innerHTML,/Visible: 10.00/);assert.doesNotMatch(shadow.innerHTML,/Secret/);
 button('Close').click();assert.equal(game.blockHotkeys,false);button('Targets').click();
 await new Promise(resolve=>setTimeout(resolve,230));
 assert.match(shadow.innerHTML,/60 FPS/);assert.match(shadow.innerHTML,/Enemy/);assert.match(shadow.innerHTML,/180 km\/h/);
 assert.equal(clip.touchable,true); assert.equal(clip.listeners.size,1);
 game.exit(); assert.equal(document.body.children.length,0);assert.equal(clip.touchable,false);assert.equal(clip.listeners.size,0);assert.equal(game.canvas.touchable,false);
 const replacement=new Game();host.created(replacement);replacement.runGameLoop();assert.equal(document.body.children.length,1);
 host.dispose(); assert.equal(document.body.children.length,0); assert.equal(Chat.prototype.sendMessage,originalSend); assert.deepEqual(errors,[]);
});
