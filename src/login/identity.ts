import type {API,Raw} from '../api/types';
import {NativeUI} from '../ui/native';
// Exact credit text and top-left placement from Login.as. Port version is
// separate from the source release, so we do not falsely claim AS3 parity.
export const PORT_VERSION='0.2.0-dev';
export const SOURCE_VERSION='1.1.22';
export function loginIdentity(api:API,login:Raw){
 const ui=new NativeUI(api);const label=ui.text(400,125,`QoLAF - v${SOURCE_VERSION} (Public)\nTypeScript port ${PORT_VERSION}\nContains modifications from:\n  - ryd3v\n  - TheRealPancake\n  - Kaiser/Primiano\n  - TheLostOne\n  - mufenz\n`,12,0xffffff,'left','DAIDRR_16');
 label.set_autoSize('bothDirections');label.get_format().set_verticalAlign('top');ui.place(label,10,10,login);return ()=>ui.dispose(label);
}
