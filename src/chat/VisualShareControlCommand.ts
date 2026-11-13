/** Source /ssv enable/disable grammar: @display-name versus opaque player ID. */
export class VisualShareControlCommand {
  static parse(argument: string): { target: string; byName: boolean; now: boolean } | null {
    if (argument == null || /[\x00-\x08\x0a-\x1f\x7f]/.test(argument)) return null;
    let text = argument.trim();
    if (!text) return null;
    let byName = text[0] === '@';
    if (byName) text = text.slice(1);
    if (!text || /\s/.test(text[0])) return null;
    let target: string, tail: string;
    const quote = text[0];
    if (quote === '"' || quote === "'") {
      const end = text.indexOf(quote, 1);
      if (end < 0 || (end + 1 < text.length && !/\s/.test(text[end + 1]))) return null;
      target = text.slice(1, end);
      tail = text.slice(end + 1).trim();
      if (!byName && target[0] === '@') {
        byName = true;
        target = target.slice(1);
      }
    } else {
      const separator = text.search(/\s/);
      target = separator < 0 ? text : text.slice(0, separator);
      tail = separator < 0 ? '' : text.slice(separator).trim();
      if (/["']/.test(target)) return null;
    }
    if (byName) {
      if (
        !target ||
        target.length > 100 ||
        target !== target.trim() ||
        /[\x00-\x1f\x7f]/.test(target)
      )
        return null;
    } else if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(target)) return null;
    if (tail && !/^(true|false)$/i.test(tail)) return null;
    return { target, byName, now: !tail || tail.toLowerCase() === 'true' };
  }
}
