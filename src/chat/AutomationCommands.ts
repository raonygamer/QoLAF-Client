import type { Raw } from '../api/Types';

export const automationCommandNames = ['script', 'automation', 'dontkick'];

function escapeHTML(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Original MessageLog automation status; names are data, not rich-text markup. */
export function automationStatus(game: Raw | null): string {
  if (!game) return 'No automation running.';
  if (!game.automationManager) return 'Automations are unavailable in this runtime.';
  const running = game.automationManager.modules
    .filter((module: Raw) => module.running)
    .map((module: Raw) => escapeHTML(module.displayName));
  if (!running.length) return 'No automation running.';
  return `Running automation${running.length === 1 ? '' : 's'}: <font color='#ff00bf'>${running.join(', ')}</font>.`;
}

/** Keep legacy /script whitespace splitting distinct from structured command parsing. */
export function dispatchAutomationChat(
  parsed: readonly string[],
  game: Raw | null,
  write: (message: string, type?: string) => void,
  writeStatus: (message: string) => void,
): boolean {
  const [name, raw] = parsed;
  if (name === 'dontkick') {
    if (typeof game?.toggleInactivityDisconnectPrevention !== 'function')
      write('Client settings are not ready.', 'error');
    else
      write(
        game.toggleInactivityDisconnectPrevention()
          ? 'Persistent no-kick on inactivity enabled.'
          : 'Persistent no-kick on inactivity disabled.',
      );
    return true;
  }
  if (name !== 'script' && name !== 'automation') return false;
  if (parsed.length === 1) {
    writeStatus(automationStatus(game));
    return true;
  }
  const manager = game?.automationManager;
  if (!manager) {
    write('Automations are unavailable in this runtime.', 'error');
    return true;
  }
  const trimmed = (raw ?? '').trim();
  const parts = trimmed ? trimmed.split(/\s+/) : [];
  if (parts.length < 2) {
    write('Usage: /script <automation-id> <command> [arguments]', 'error');
    return true;
  }
  const [id, command, ...args] = parts;
  if (!manager.getModule(id)) write(`Automation '${id}' is not installed.`, 'error');
  else if (!manager.dispatchCommand(id, command, args))
    write(`Automation '${id}' did not handle command '${command}'.`, 'error');
  return true;
}
