import { build } from 'esbuild';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = 'docs/port/audit';
const audit = JSON.parse(await readFile(`${root}/FullPass.json`));
const inventory = JSON.parse(await readFile('/home/raony/Documentos/astroflux-port-audit/recheck/inventory.json'));
const methods = JSON.parse(await readFile(`${root}/method-inventory.json`));
const methodMap = new Map(methods.files.map(file => [file.path, file.methods]));
const sourceMap = new Map(inventory.files.map(file => [file.path, file]));
const hashes = {};
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]))).flat();
}
const sources = new Map();
for (const file of await files('src')) {
  if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
  const text = await readFile(file, 'utf8');
  sources.set(file, text);
  hashes[file] = createHash('sha256').update(text).digest('hex');
}
const normalize = value => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
const builds = {};
for (const [name, flag] of [['Public', false], ['Private', true]]) {
  const result = await build({ entryPoints: ['src/index.ts'], outfile: 'audit.js',
    define: { __QOLAF_PRIVATE__: String(flag) }, minifySyntax: true,
    bundle: true, loader: { '.mp3': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.fnt': 'text', '.woff': 'dataurl' },
    format: 'esm', platform: 'browser', target: 'es2022', metafile: true, write: false });
  builds[name] = Object.fromEntries(Object.entries(result.metafile.outputs['audit.js'].inputs)
    .filter(([, info]) => info.bytesInOutput > 0).map(([name, info]) => [name, info.bytesInOutput]));
}
const knownSources = new Set(audit.files.map(file => file.source));
for (const file of inventory.files) {
  if (!knownSources.has(file.path)) audit.files.push({ source: file.path, sourceSha256: file.sha256,
    change: file.change, review: file.change === 'unchanged' ? 'baseline-identical' : 'pending',
    candidateFiles: [], findings: [], unmatchedNewMethodNames: [] });
}
audit.files.sort((left, right) => left.source.localeCompare(right.source));
for (const file of audit.files) {
  const current = sourceMap.get(file.source);
  if (!current) throw new Error(`Stale audit source: ${file.source}`);
  const actual = createHash('sha256').update(await readFile(path.join(audit.sourceRoot, file.source))).digest('hex');
  if (actual !== current.sha256) throw new Error(`Regenerate baseline diff: ${file.source}`);
  file.sourceSha256 = actual;
  file.methodChanges = methodMap.get(file.source) ?? {};
  const stem = path.basename(file.source, '.as');
  const candidates = [...sources].filter(([name, text]) =>
    normalize(path.basename(name, '.ts')) === normalize(stem) || text.includes(`${stem}.as`));
  file.navigationEvidence = candidates.map(([name]) => ({ file: name,
    publicBuild: !!builds.Public[name], privateBuild: !!builds.Private[name] }));
  file.screening = file.change === 'unchanged' ? 'identical-baseline-tokens'
    : file.source.startsWith('qolaf/radio/') || /\/Radio[^/]*\.as$/.test(file.source) ? 'radio-excluded'
    : candidates.length ? 'implementation-candidates-found' : 'manual-mapping-required';
}
audit.screeningComplete = true;
audit.complete = false;
audit.screeningLimit = 'All original files and both compiled import graphs scanned. Candidates and normalized method matches do not establish semantic parity; review/findings track that separately.';
audit.screeningCounts = {};
for (const file of audit.files) audit.screeningCounts[file.screening] = (audit.screeningCounts[file.screening] ?? 0) + 1;
audit.portSourceHashes = hashes;
audit.buildContributions = builds;
await writeFile(`${root}/source-inventory.json`, JSON.stringify(inventory, null, 2) + '\n');
await writeFile(`${root}/FullPass.json`, JSON.stringify(audit, null, 2) + '\n');
console.log(audit.screeningCounts);
console.log('Compiled modules:', Object.fromEntries(Object.entries(builds).map(([name, modules]) => [name, Object.keys(modules).length])));
