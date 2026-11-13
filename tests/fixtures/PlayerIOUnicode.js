// Captured upstream SDK encoder and decoder, 2026-11-12.
export const bytesFromString = function(c){for(var b=[],a=0;a<c.length;a++)if(127>=c.charCodeAt(a))b.push(c.charCodeAt(a));else for(var e=encodeURIComponent(c.charAt(a)).substr(1).split("%"),f=0;f<e.length;f++)b.push(parseInt(e[f],16));return b};
export const stringFromBytes = function(c,b,a){for(var d="",f=b;f<b+a;f++)d+=127>=c[f]?37===c[f]?"%25":String.fromCharCode(c[f]):"%"+c[f].toString(16).toUpperCase();return decodeURIComponent(d)};
