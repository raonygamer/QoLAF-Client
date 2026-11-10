import {build} from 'esbuild';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('dist', {recursive:true});
const result = await build({entryPoints:['src/Index.ts'], outfile:'dist/qolaf-client.js', bundle:true, loader:{'.png':'dataurl','.fnt':'text'}, format:'esm', platform:'browser', target:'es2022', metafile:true, legalComments:'inline'});
if (Object.keys(result.metafile.outputs).length !== 1 || Object.values(result.metafile.outputs)[0].imports.length) throw new Error('Expected one self-contained module');
const bytes = await readFile('dist/qolaf-client.js');
await writeFile('dist/index.html', '<!doctype html><meta charset="utf-8"><title>QoLAF Client</title><h1>QoLAF Client</h1><p>Add <a href="qolaf-client.js">qolaf-client.js</a> in the QoLAF Plugins menu. This is an initial TypeScript port; see the repository for coverage.</p><a href="https://github.com/raonygamer/QoLAF-Client">Source and documentation</a>');
await writeFile('dist/build.json', JSON.stringify({version:JSON.parse(await readFile('package.json')).version,sha256:createHash('sha256').update(bytes).digest('hex')},null,2));
