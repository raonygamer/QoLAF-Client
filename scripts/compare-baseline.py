from pathlib import Path
import re,json,hashlib,difflib,argparse
parser=argparse.ArgumentParser()
parser.add_argument("--baseline",type=Path,required=True)
parser.add_argument("--client",type=Path,required=True)
parser.add_argument("--swf",type=Path,required=True)
parser.add_argument("--output",type=Path,required=True)
args=parser.parse_args()
vanilla=args.baseline
client=args.client
out=args.output
out.mkdir(parents=True,exist_ok=True)
# Strip comments/spacing without touching strings. Token changes are evidence,
# not an automatic assertion that every decompiler difference is a feature.
token=re.compile(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|//[^\n]*|/\*[\s\S]*?\*/|\w+|[^\s]')
def tokens(s):return [x for x in token.findall(s) if not x.startswith(('//','/*'))]
rows=[]
for p in sorted(client.rglob('*.as')):
 rel=p.relative_to(client);old=vanilla/rel;s=p.read_text();a=tokens(s)
 row={'path':str(rel),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'lines':len(s.splitlines())}
 if not old.exists():row.update(change='added',status='pending')
 else:
  t=old.read_text();b=tokens(t)
  if a==b:row.update(change='unchanged',status='upstream')
  else:
   row.update(change='changed',status='pending',vanillaSha256=hashlib.sha256(old.read_bytes()).hexdigest())
   # Line diffs remain local; original source is not copied into the port repo.
   diff=out/'diffs'/rel.with_suffix('.diff');diff.parent.mkdir(parents=True,exist_ok=True)
   diff.write_text(''.join(difflib.unified_diff(t.splitlines(True),s.splitlines(True),fromfile='Preload/'+str(rel),tofile='Client/'+str(rel))))
 rows.append(row)
manifest={'baseline':{'file':'Preload.swf','sha256':hashlib.sha256(args.swf.read_bytes()).hexdigest()},'files':rows}
(out/'inventory.json').write_text(json.dumps(manifest,indent=2)+'\n')
from collections import Counter
print(Counter(x['change'] for x in rows));print('AS3 source lines',sum(x['lines'] for x in rows));print('Changed or added source lines',sum(x['lines'] for x in rows if x['change']!='unchanged'))
