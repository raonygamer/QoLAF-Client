import './Game';

declare module './Game' {
  namespace Game.camerafocus {
    interface StarlingCameraFocus {
      _viewWidth?: number;
      _viewHeight?: number;
      _worldCullingRadius?: number;
      _viewSizeRevision?: number;
      get_viewCenterX(): number;
      get_viewCenterY(): number;
      get_worldCullingRadius(): number;
      get_viewSizeRevision(): number;
    }
  }
}
