import {NativeUI} from './native';
import type {Raw} from '../api/types';
// qolaf/ui/elements/AuraTextRoller.as: same ellipsis and pulsing glow.
export class AuraText {
 readonly node:Raw;readonly label:Raw;private aura:Raw;private phase=0;private full='';private width=1;private height=1;private color=0;
 constructor(private ui:NativeUI,width:number,height:number,size:number){
  this.node=ui.sprite();this.node.set_touchable(false);this.label=ui.text(1,1,'',size);this.node.addChild(this.label);
  this.aura=new (ui.cls('starling.filters.GlowFilter'))(0,0,14,1);this.viewport(width,height);
 }
 viewport(width:number,height:number){if(this.width===width&&this.height===height)return;this.width=Math.max(1,width);this.height=Math.max(1,height);this.label.set_x(2);this.render();}
 text(value:string){if(this.full===value)return;this.full=value??'';this.render();}
 auraColor(color:number){this.color=color;this.label.set_filter(color?this.aura:null);this.aura.set_color(color);this.aura.set_alpha(color?1.6+Math.sin(this.phase)*.15:0);}
 private measure(text:string){this.label.set_width(2048);this.label.set_text(text);return Math.ceil(this.label.get_textBounds().width)+4;}
 private render(){const width=Math.max(1,this.width-2);let text=this.full;
  if(text&&this.measure(text)>width){if(this.measure('...')>width)text='';else{const scalars=Array.from(text);let low=0,high=scalars.length;
   while(low<high){const mid=Math.ceil((low+high)/2);if(this.measure(scalars.slice(0,mid).join('')+'...')<=width)low=mid;else high=mid-1;}
   text=scalars.slice(0,low).join('').trimEnd()+'...';}}
  this.label.set_width(width);this.label.set_height(this.height);this.label.set_text(text);
 }
 update(dt:number){if(this.color){this.phase+=8*Math.max(0,dt);this.aura.set_alpha(1.6+Math.sin(this.phase)*.15);}}
 dispose(){this.label.set_filter(null);this.aura.dispose();this.ui.dispose(this.node);}
}
