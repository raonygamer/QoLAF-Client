"""Review aid: compare method tokens while normalizing decompiler local names.

This does not prove semantic equivalence; it removes common this./local naming
noise so the human port review can focus on changed bodies.
"""
from pathlib import Path
import argparse,json,re,hashlib,collections
p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path,required=True);p.add_argument('--client',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
lex=re.compile(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|//[^\n]*|/\*[\s\S]*?\*/|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|[^\s]')
def methods(source):
 tokens=[v for v in lex.findall(source) if not v.startswith(('//','/*'))];result={};i=0
 while i<len(tokens)-3:
  if tokens[i]!='function':i+=1;continue
  at=i+1;kind=''
  if tokens[at] in ('get','set'):kind=tokens[at]+' ';at+=1
  if tokens[at]=='(' or tokens[at+1]!='(':i+=1;continue
  name=kind+tokens[at];start=at+2;depth=1;end=start
  while end<len(tokens) and depth:
   if tokens[end]=='(':depth+=1
   if tokens[end]==')':depth-=1
   end+=1
  params=tokens[start:end-1];body=end
  while body<len(tokens) and tokens[body] not in ('{',';'):body+=1
  if body>=len(tokens) or tokens[body]==';':i=body+1;continue
  finish=body+1;depth=1
  while finish<len(tokens) and depth:
   if tokens[finish]=='{':depth+=1
   if tokens[finish]=='}':depth-=1
   finish+=1
  rename={}
  for n,t in enumerate(params):
   if n+1<len(params) and params[n+1]==':' and (n==0 or params[n-1]==','):rename[t]='PARAM'+str(len(rename))
  bodytokens=tokens[body+1:finish-1]
  for n,t in enumerate(bodytokens):
   if t in ('var','const') and n+2<len(bodytokens) and bodytokens[n+2] in (':','='):
    name_=bodytokens[n+1]
    if name_ not in rename:rename[name_]='LOCAL'+str(len(rename))
  canonical=[];n=0;alltokens=params+tokens[end:body]+bodytokens
  while n<len(alltokens):
   if alltokens[n]=='this' and n+1<len(alltokens) and alltokens[n+1]=='.':n+=2;continue
   canonical.append(rename.get(alltokens[n],alltokens[n]));n+=1
  key=name
  if key in result:key+=' #'+str(i)
  result[key]=hashlib.sha256('\x1f'.join(canonical).encode()).hexdigest();i=finish
 return result
rows=[]
for path in sorted(args.client.rglob('*.as')):
 rel=path.relative_to(args.client);base=args.baseline/rel
 current=methods(path.read_text());old=methods(base.read_text()) if base.exists() else {}
 changes={}
 for name in sorted(set(current)|set(old)):
  changes[name]='added' if name not in old else 'removed' if name not in current else 'same-normalized' if current[name]==old[name] else 'changed'
 rows.append({'path':str(rel),'methods':changes})
counts=collections.Counter(status for row in rows for status in row['methods'].values())
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps({'warning':__doc__.strip(),'counts':dict(counts),'files':rows},indent=2)+'\n');print(dict(counts))
