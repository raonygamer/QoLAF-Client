import type {API,Raw} from '../api/types';
import {aliasProperties} from '../runtime/as3';
import {createLoginButton} from './LoginButton';
import {createLoginProfilePanel} from './LoginProfilePanel';
import {createLoginAccountTypePanel} from './LoginAccountTypePanel';
import {createSettingsWindowChrome} from './SettingsWindowChrome';
export function portedClasses(api:API){
 const cache:Record<string,any>={
  'core.text.RussoBitmapFontRegistry':{UI_24_FONT_NAME:'DAIDRR_24',fontNameForSize:(size:number)=>size<=16?'DAIDRR_16':'DAIDRR_24'},
  'core.text.VerdanaBitmapFontRegistry':{fontNameForSize:()=> 'QoLAF_Verdana16'},
  'starling.utils.Align':{LEFT:'left',CENTER:'center',RIGHT:'right',TOP:'top',BOTTOM:'bottom'},
  'starling.events.TouchPhase':{BEGAN:'began',ENDED:'ended',HOVER:'hover',MOVED:'moved',STATIONARY:'stationary'},
 };
 const resolve=(name:string):any=>{
  if(cache[name])return cache[name];const cls=api.cls(name);if(!cls)throw Error('Missing native dependency: '+name);
  // Importing Sprite also needs inherited DisplayObject properties.
  for(let current:Raw|undefined=cls;current;current=current.__super__)aliasProperties(api,current);
  return cache[name]=cls;
 };
 cache['core.hud.components.LoginButton']=createLoginButton(resolve);
 cache['core.hud.components.LoginProfilePanel']=createLoginProfilePanel(resolve);
 cache['core.hud.components.LoginAccountTypePanel']=createLoginAccountTypePanel(resolve);
 cache['core.hud.components.SettingsWindowChrome']=createSettingsWindowChrome(resolve);
 return {resolve};
}
