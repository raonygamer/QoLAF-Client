// Disposal methods captured from upstream build 564. Dependencies are supplied
// explicitly so the regression exercises the real child-disposal loops.
export function nativeContainerDispose(H) {
  return function(){for(var t=this.__children.get_length()-1;t>=0;)this.__children.get(t).dispose(),--t;H.prototype.dispose.call(this)};
}
export function nativeTechBarDispose(j) {
  return function(){for(var t=0,e=this.techIcons;t<e.length;){var i=e[t];++t,i.dispose()}this.removeEventListeners(),j.prototype.dispose.call(this)};
}
