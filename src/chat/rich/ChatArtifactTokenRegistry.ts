// Source port of core/hud/components/chat/ChatArtifactTokenRegistry.as.
import { bound } from '../../runtime/HaxeInterop';
import { ChatArtifactToken } from './ChatArtifactToken';

/** Session-local labels; network/database ownership stays outside text layout. */
export class ChatArtifactTokenRegistry {
  static readonly FALLBACK_LABEL = '[Artifact]';
  private static readonly MAX_LABEL_LENGTH = 128;
  private static readonly MAX_LABELS = 512;
  private readonly labels = new Map<string, string>();

  setLabel(playerId: string, artifactId: string, label: string | null): void {
    const key = ChatArtifactTokenRegistry.keyFor(playerId, artifactId);
    if (key === null) return;
    const normalized = ChatArtifactTokenRegistry.normalizeLabel(label);
    if (normalized === null) {
      this.labels.delete(key);
      return;
    }
    if (!this.labels.has(key) && this.labels.size >= ChatArtifactTokenRegistry.MAX_LABELS) {
      this.labels.delete(this.labels.keys().next().value!);
    }
    this.labels.set(key, normalized);
  }

  removeLabel(playerId: string, artifactId: string): void {
    const key = ChatArtifactTokenRegistry.keyFor(playerId, artifactId);
    if (key !== null) this.labels.delete(key);
  }

  @bound
  resolveLabel(playerId: string, artifactId: string, _rawToken: string | null = null): string {
    const key = ChatArtifactTokenRegistry.keyFor(playerId, artifactId);
    return (
      (key === null ? undefined : this.labels.get(key)) ?? ChatArtifactTokenRegistry.FALLBACK_LABEL
    );
  }

  clear(): void {
    this.labels.clear();
  }

  private static keyFor(playerId: string, artifactId: string): string | null {
    if (!ChatArtifactToken.isValidId(playerId) || !ChatArtifactToken.isValidId(artifactId))
      return null;
    return playerId + '\u0000' + artifactId;
  }

  private static normalizeLabel(value: string | null): string | null {
    if (value === null) return null;
    const label = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
    return label.length ? label.substring(0, ChatArtifactTokenRegistry.MAX_LABEL_LENGTH) : null;
  }
}
