import type { Game } from './Game';

/** Entries used by the native chat mode selector. */
export interface ChatChannel {
  label: string;
  chatMode: string;
}

export interface ChatTabs extends Game.core.hud.components.ui.TabBar {
  dataProvider: ChatChannel[];
  set_dataProvider(value: ChatChannel[]): void;
}
