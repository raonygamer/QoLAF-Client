export interface HeadingKeybinds {
  getKeyName(command: number, slot: number): string | null;
  isInputDown(command: number): boolean;
}

/** Physical input is queried independently from authoritative and replayed Heading flags. */
export function formatHeadingInput(keybinds: HeadingKeybinds | null | undefined): string {
  if (!keybinds) return 'physical keybinds  unavailable';
  const names = (command: number): string => {
    const first = keybinds.getKeyName(command, 1) || '';
    const second = keybinds.getKeyName(command, 2) || '';
    return first ? (second ? `${first}/${second}` : first) : second || 'unbound';
  };
  return (
    `physical keybinds  accel [${names(11)}] ${keybinds.isInputDown(11) ? 'DOWN' : 'UP'}` +
    `   decel [${names(12)}] ${keybinds.isInputDown(12) ? 'DOWN' : 'UP'}`
  );
}
