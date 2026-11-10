/** ArtifactOverview.layoutArtifactSetups and dependent classic inventory layout. */
export function setupRowLayout(width: number, contentWidth: number, rowY: number, actionY: number) {
  const maximum = Math.max(0, contentWidth - width);
  const height = 24 + (maximum > 0 ? 10 : 0);
  const thumbWidth = Math.min(width, Math.max(52, (width * width) / Math.max(width, contentWidth)));
  return {
    maximum,
    height,
    thumbWidth,
    cargoY: rowY + height + 12,
    cargoHeight: actionY - (rowY + height + 12) - 10,
  };
}
