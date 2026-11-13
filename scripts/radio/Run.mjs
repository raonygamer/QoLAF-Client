import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import path from 'node:path';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRadioBridge } from './Bridge.mjs';

const { values } = parseArgs({
  options: {
    helper: { type: 'string' },
    origin: { type: 'string' },
    cache: { type: 'string' },
    tools: { type: 'string' },
    help: { type: 'boolean' },
  },
});
if (values.help) {
  process.stdout.write(
    'Usage: npm run radio -- --helper /path/to/radio-helper --origin https://your-game-origin\nOptional: --cache /path/to/cache --tools /path/to/tools\n',
  );
} else {
  try {
    if (!values.helper || !values.origin) throw Error('--helper and --origin are required.');
    const helper = path.resolve(values.helper);
    await access(helper, constants.X_OK);
    const bridge = await createRadioBridge({
      helper,
      origin: values.origin,
      cache: values.cache ?? path.join(homedir(), '.cache', 'qolaf', 'radio'),
      tools: values.tools ?? path.join(homedir(), '.local', 'share', 'qolaf', 'radio', 'tools'),
    });
    process.stdout.write(
      'Radio connection address (keep this terminal open):\n' + bridge.endpoint + '\n',
    );
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await bridge.close();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (error) {
    process.stderr.write(
      (error instanceof Error ? error.message : 'Radio bridge could not start.') + '\n',
    );
    process.exitCode = 1;
  }
}
