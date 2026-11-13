import type { Artifact } from '../game/Bindings';

/** Verified artifact data, with a plain-text label for rich bitmap token projection. */
export class ChatArtifactLinkData {
  readonly label: string;
  readonly color: number;
  readonly playerLevel: number;

  constructor(
    readonly playerId: string,
    readonly artifactId: string,
    readonly playerName: string,
    readonly artifact: Artifact,
    playerLevel = 0,
    localize: (text: string) => string = (text) => text,
  ) {
    this.playerLevel = Math.max(0, Math.trunc(playerLevel) || 0);
    const name = artifact.name ? localize(artifact.name).replace(/[\r\n\t]+/g, ' ') : 'Artifact';
    this.label = '[Artifact: ' + name + ']';
    this.color = artifact.stats?.length ? artifact.getColor() : 0xffaa44;
  }
}
