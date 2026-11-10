import {read,type Raw} from '../api/types';
import {NativeUI} from './native';
import {Telemetry} from '../telemetry/metrics';
import type {Settings} from '../settings/settings';
// RadarTelemetry.as: 15px rows, 10px Verdana, above the existing radar.
export class RadarTelemetry {
 readonly node:Raw;private labels:Raw[]=[];private metrics=new Telemetry();private elapsed=.25;
 constructor(private ui:NativeUI,private game:Raw,private config:Settings){this.node=ui.sprite();this.node.set_touchable(false);for(let i=0;i<4;i++){const label=ui.text(i===3?420:200,15,'',10,0xbfc4cc,'left','QoLAF_Verdana16');label.set_alpha(.85);this.node.addChild(label);this.labels.push(label);}}
 update(dt:number){const ship=read(this.game,'me')?.ship,speed=read(ship,'course')?.speed;this.metrics.advance(dt,ship?.landed?0:speed?.x,ship?.landed?0:speed?.y,!!ship?.alive&&!!speed);this.elapsed+=dt;
  if(this.elapsed<.25)return;this.elapsed=0;const format=(value:number)=>Number.isFinite(value)?String(Math.round(value)):'—';const lines:string[]=[];
  if(this.config.show_radar_fps)lines.push(`FPS: ${format(this.metrics.fps)}`);
  if(this.config.show_radar_latency)lines.push(`Latency: ${format(this.game.clock?.latency)} ms`);
  if(this.config.show_radar_speed)lines.push(`Speed: ${format(this.metrics.displaySpeed(this.config.radar_speed_in_mph))} ${this.config.radar_speed_in_mph?'mph':'km/h'}`);
  if(this.config.show_radar_service)lines.push(`Service: ${read(this.game.serviceConnection,'connected',false)?'Connected':'Disconnected'}`);
  this.labels.forEach((label,i)=>{label.set_text(lines[i]??'');label.set_y(i*15);label.set_visible(i<lines.length);});
  const radar=this.game.hud.radar;this.node.set_x(read(radar,'x'));this.node.set_y(Math.max(0,read(radar,'y')-lines.length*15-6));this.node.set_visible(read(radar,'visible')&&lines.length>0);
 }
 dispose(){this.ui.dispose(this.node);}
}
