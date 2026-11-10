export function parseCommand(raw: string): string[] {
 const tokens: string[] = []; let token = '', quote = '', escaped = false, started = false;
 for (const c of raw) {
  if (escaped) { token += c; escaped = false; started = true; }
  else if (c === '\\') { escaped = true; started = true; }
  else if (quote) { if (c === quote) quote = ''; else token += c; }
  else if (c === '"' || c === "'") { quote = c; started = true; }
  else if (' \t\r\n\f'.includes(c)) { if (started) tokens.push(token); token = ''; started = false; }
  else { token += c; started = true; }
 }
 if (escaped) throw new Error('Command arguments end with an incomplete escape.');
 if (quote) throw new Error('Command arguments contain an unterminated quote.');
 if (started) tokens.push(token); return tokens;
}
