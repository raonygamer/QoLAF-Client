import type { GameObject } from './Bindings';

/** Client accessors are optional until RenderPosition has installed its hooks. */
export interface RenderedGameObject extends GameObject {
  readonly hasRenderPosition?: boolean;
  get_lifecycleId?(): number;
  get_renderX?(): number;
  get_renderY?(): number;
  get_renderRotation?(): number;
  get_renderMirrored?(): boolean;
}
