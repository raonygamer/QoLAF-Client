import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const privateBuild = process.argv.includes('--private');
const outputDirectory = privateBuild ? 'private-dist' : 'dist';
await mkdir(outputDirectory, { recursive: true });
const result = await build({
  entryPoints: ['src/index.ts'],
  outfile: `${outputDirectory}/qolaf-client.js`,
  define: { __QOLAF_PRIVATE__: String(privateBuild) },
  minifySyntax: true,
  bundle: true,
  loader: {
    '.mp3': 'dataurl',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.fnt': 'text',
    '.woff': 'dataurl',
  },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  metafile: true,
  write: false,
  legalComments: 'inline',
});
if (
  Object.keys(result.metafile.outputs).length !== 1 ||
  Object.values(result.metafile.outputs)[0].imports.length
)
  throw new Error('Expected one self-contained module');
// Reject public artifacts containing even a retained fragment of private modules.
const privateSources =
  /^(src\/network\/ServerEndpoints\.ts$|src\/ipc\/VisualBroadcastNotice\.ts$|src\/inspect\/|src\/automation\/|src\/service\/ServiceSwitch\.ts$|src\/ported\/SettingsAutomations\.ts$|src\/settings\/AutomationList\.ts$|src\/chat\/(WarpCommand|FriendWarpCommand|RoomDiagnosticsCommand|ChatPrivateDiagnostics|RoomControlSender|RoomPeerTargets)\.ts$)/;
if (!privateBuild) {
  for (const output of Object.values(result.metafile.outputs)) {
    for (const [source, contribution] of Object.entries(output.inputs)) {
      if (privateSources.test(source) && contribution.bytesInOutput > 0)
        throw new Error(`Private implementation leaked into public build: ${source}`);
    }
  }
}
const bytes = result.outputFiles[0].contents;
await writeFile(`${outputDirectory}/qolaf-client.js`, bytes);
await writeFile(
  `${outputDirectory}/index.html`,
  '<!doctype html><meta charset="utf-8"><title>QoLAF Client</title><h1>QoLAF Client</h1><p>Add <a href="qolaf-client.js">qolaf-client.js</a> in the QoLAF Plugins menu. See the repository for current feature coverage.</p><a href="https://github.com/raonygamer/QoLAF-Client">Source and documentation</a>',
);
await writeFile(
  `${outputDirectory}/build.json`,
  JSON.stringify(
    {
      build: privateBuild ? 'Private' : 'Public',
      version: JSON.parse(await readFile('package.json')).version,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    null,
    2,
  ),
);
