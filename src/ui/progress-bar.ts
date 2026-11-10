// Port of qolaf/ui/elements/CustomProgressBar.as. Geometry, palette and math
// are preserved; Haxe properties use their generated accessors.
import type {Raw} from '../api/types';
import {NativeUI} from './native';
export const MULTIBAR_COLORS=[0xE74C3C,0xF39C12,0xF1C40F,0x2ECC71,0x1ABC9C,0x3498DB,0x9B59B6,0xE84393,0xFF6B6B,0xFF9F43,0xA3CB38,0x00D2D3,0x54A0FF,0x5F27CD,0xF368E0,0xC8D6E5];
export class ProgressBar {
 readonly node:Raw; private back:Raw;private trail:Raw;private overlay:Raw;private valueText:Raw;private multiplierText:Raw;
 private tip:Raw;private tipTexture:Raw;private tipBitmap:Raw;private mask:Raw;
 private maximum=100;private value=100;private lerped=100;private colors:number[];
 obscured=false; multibar=true;dividend=10000;
 constructor(private ui:NativeUI,private width=300,private height=14,private color=0xffffff){
  this.colors=[color];this.node=ui.sprite();this.node.set_touchable(false);
  this.back=ui.quad(width,height,0,.35);this.trail=ui.quad(1,height,color,.45);this.overlay=ui.quad(1,height,color);
  this.tipBitmap=new (ui.cls('openfl.display.BitmapData'))(28,18,true,0);
  const stops=[0,.08,.25,.55,.75,.55,.25,.08,0];
  for(let x=0;x<28;x++){const at=x/27*8,i=Math.min(7,Math.floor(at));const alpha=Math.round(255*(stops[i]+(stops[i+1]-stops[i])*(at-i)));
   for(let y=0;y<18;y++)this.tipBitmap.setPixel32(x,y,((alpha<<24)|0xffffff)>>>0);}
  this.tipTexture=ui.cls('starling.textures.Texture').fromBitmapData(this.tipBitmap,false,false,1);
  this.tip=ui.image(this.tipTexture);this.tip.set_blendMode('screen');this.tip.set_height(height);this.tip.set_touchable(false);
  this.mask=ui.quad(width,height,0xffffff);this.mask.set_touchable(false);this.node.set_mask(this.mask);
  this.valueText=ui.text(width,height,'0 / 0',12,0xffffff,'center');this.valueText.set_y(1);
  this.multiplierText=ui.text(54,height,'',11,0xffffff,'right');ui.place(this.multiplierText,width-59,1);
  for(const child of [this.back,this.trail,this.overlay,this.tip,this.valueText,this.multiplierText])this.node.addChild(child);
 }
 set(maximum:number,value:number){
  maximum=Math.max(0,maximum);if(this.maximum!==maximum)this.colors=[this.color];this.maximum=maximum;
  this.value=Math.max(0,Math.min(value,maximum));this.lerped=Math.min(maximum,Math.max(this.value,this.lerped));
 }
 private layerColor(depth:number){while(this.colors.length<=depth){let i=Math.floor(Math.random()*MULTIBAR_COLORS.length);if(MULTIBAR_COLORS[i]===this.colors.at(-1))i=(i+1)%MULTIBAR_COLORS.length;this.colors.push(MULTIBAR_COLORS[i]);}return this.colors[depth];}
 update(dt:number,format:(value:number)=>string=(v)=>String(Math.max(0,Math.floor(v)))){
  this.lerped+=(this.value-this.lerped)*Math.min(1,8*Math.max(0,dt));
  if(this.obscured){this.tip.set_visible(false);this.back.set_color(0);this.back.set_alpha(.35);
   for(const fill of [this.overlay,this.trail]){fill.set_color(0x777777);fill.set_width(this.width);}
   this.valueText.set_text('??? / ???');this.valueText.get_format().set_color(0xffffff);this.multiplierText.set_text(this.multibar?'???x':'');return;}
  let color=this.color,capacity=Math.max(1,this.maximum),start=0,layer=0;
  if(this.multibar){layer=this.value<=0?0:Math.ceil(this.value/this.dividend);const highest=this.maximum<=0?0:Math.ceil(this.maximum/this.dividend);const depth=Math.max(0,highest-layer);
   color=this.layerColor(depth);start=layer<=0?0:(layer-1)*this.dividend;capacity=layer<=0?this.dividend:Math.min(this.dividend,Math.max(1,this.maximum-start));
   this.back.set_color(layer>1?this.layerColor(depth+1):0);this.back.set_alpha(layer>1?.8:.35);
  }else{this.back.set_color(0);this.back.set_alpha(.35);}
  this.overlay.set_color(color);this.trail.set_color(color);
  const ratio=(v:number)=>Math.max(0,Math.min(1,(v-start)/capacity));
  const w=this.width*ratio(this.value);this.overlay.set_width(Math.max(.01,w));this.trail.set_width(Math.max(.01,this.width*ratio(this.lerped)));
  const delta=Math.abs(this.lerped-this.value);this.tip.set_visible(delta>=.5);this.tip.set_color(color);this.tip.set_alpha(.95*Math.min(1,delta/Math.max(1,capacity*.45)));this.tip.set_x(Math.max(-14,Math.min(this.width-14,w-14)));
  this.valueText.set_text(`${format(this.value)} / ${format(this.maximum)}`);this.valueText.get_format().set_color(this.maximum>0&&this.value<=this.maximum*.1?0xff3030:0xffffff);
  this.multiplierText.set_text(this.multibar?`${layer}x`:'');
 }
 dispose(){this.node.set_mask(null);this.mask.dispose();this.ui.dispose(this.node);this.tipTexture.dispose();this.tipBitmap.dispose();}
}
