/** Attachment providers cross a plugin boundary; their result is validated before rendering. */
export type ArtifactLabelResolver = (
  playerId: string,
  artifactId: string,
  rawToken: string,
) => unknown;

export interface ArtifactLabelPresentation {
  label: string;
  color: number;
}
