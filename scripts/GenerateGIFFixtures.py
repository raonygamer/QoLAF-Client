"""Regenerate independent GIF pixel oracles with Pillow 13.0.0."""
from PIL import Image, ImageSequence
import io,json,base64,hashlib
from pathlib import Path
out = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures' / 'gif'
out.mkdir(parents=True, exist_ok=True)
def save(name,images,**options):
 b=io.BytesIO();images[0].save(b,format='GIF',save_all=len(images)>1,append_images=images[1:],**options)
 raw=b.getvalue();loaded=Image.open(io.BytesIO(raw)); frames=[]
 for frame in ImageSequence.Iterator(loaded):
  rgba=bytearray(frame.convert('RGBA').tobytes())
  for i in range(0,len(rgba),4):
   if rgba[i+3]==0: rgba[i:i+3]=b'\0\0\0'
  frames.append({'sha256':hashlib.sha256(rgba).hexdigest(),'delay':frame.info.get('duration',100)})
 (out/(name+'.json')).write_text(json.dumps({'generator':'Pillow 13.0.0; expected hashes are decoded RGBA, transparent RGB zeroed','gif':base64.b64encode(raw).decode(),'width':loaded.width,'height':loaded.height,'frames':frames},indent=2)+'\n')
palette=[0,0,0,255,0,0,0,255,0,0,0,255]+[0]*756
frames=[]
for i in range(4):
 im=Image.new('P',(8,8),0);im.putpalette(palette)
 for y in range(i,i+3):
  for x in range(i,i+3): im.putpixel((x,y),i%3+1)
 frames.append(im)
save('Disposal',frames,transparency=0,duration=[10,20,70,100],disposal=[1,2,3,1],optimize=False,loop=0)
im=Image.new('P',(32,32)); im.putpalette([c for i in range(256) for c in (i,(i*37)%256,(i*79)%256)])
im.putdata([(x*13+y*17+x*y)%256 for y in range(32) for x in range(32)])
save('Interlaced',[im],interlace=True,optimize=False)
