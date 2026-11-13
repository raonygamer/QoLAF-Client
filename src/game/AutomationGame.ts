import type { GameScene } from './Bindings';
import type { AutomationManager } from '../automation/AutomationManager';

/** The automation manager is attached only after its room integration loads. */
export interface AutomationGame extends GameScene {
  readonly automationManager?: Pick<
    AutomationManager,
    | 'controlsClaimed'
    | 'ownsControls'
    | 'transientDontKickActive'
    | 'canDispatchOwnedCommand'
    | 'handleCommandStop'
  >;
}
