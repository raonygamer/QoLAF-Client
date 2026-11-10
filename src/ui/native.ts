import {read, type API, type Raw} from '../api/types';
export class NativeUI {
 constructor(readonly api: API) {}
 cls(name: string): any { const cls = this.api.cls(name); if (!cls) throw Error(`Missing Haxe class: ${name}`); return cls; }
 sprite() { return new (this.cls('starling.display.Sprite'))(); }
 quad(w: number,h: number,color: number,alpha = 1) {
  const q = new (this.cls('starling.display.Quad'))(Math.max(.01,w),Math.max(.01,h),color);
  q.set_alpha(alpha);return q;
 }
 text(w: number,h: number,text = '',size = 14,color = 0xffffff,align = 'left',font = 'DAIDRR_24') {
  const f = new (this.cls('starling.text.TextFormat'))(font,size,color,align,'center');
  const t = new (this.cls('starling.text.TextField'))(w,h,text,f);
  t.set_touchable(false);t.set_wordWrap(false);t.set_autoScale(false);t.set_pixelSnapping(false);return t;
 }
 image(texture: Raw) { return new (this.cls('starling.display.Image'))(texture); }
 texture(name: string, atlas?: string) {
  const manager = this.cls('textures.TextureLocator').getService();
  return atlas ? manager.getTextureByTextureName(name,atlas) : manager.getTextureGUIByTextureName(name);
 }
 place(child: Raw,x: number,y: number,parent?: Raw) {child.set_x(x);child.set_y(y);parent?.addChild(child);return child;}
 touch(target: Raw, fn: () => void, phase = 'began') {
  const listener = (event: Raw) => {if (event.getTouch(target,phase)) fn();};
  target.addEventListener('touch',listener);return () => target.removeEventListener('touch',listener);
 }
 button(label: string,fn: () => void) {return new (this.cls('core.hud.components.Button'))(fn,label);}
 dispose(object: Raw) {const parent=read(object,'parent');if(parent)parent.removeChild(object,true);else object.dispose();}
}
