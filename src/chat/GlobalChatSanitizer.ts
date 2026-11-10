/** Source final outbound guard for Global chat's plain-text protocol. */
export class GlobalChatSanitizer {
  static stripHTML(value: string | null): string {
    if (!value) return '';
    let sanitized = value;
    let previous: string;
    let passes = 0;
    do {
      previous = sanitized;
      sanitized = sanitized.replace(/<[^<>]*>/g, '');
      passes++;
    } while (sanitized !== previous && passes < 32);
    return sanitized.replace(/[<>]/g, '');
  }
}
