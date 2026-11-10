// Source port of core/hud/components/chat/ChatRoleTags.as.
import type { Resolve } from '../Runtime/As3';
import { read } from '../Api/Types';
export function createChatRoleTags(resolve: Resolve): any {
  const Style: any = resolve('core.hud.components.Style');
  type RichBitmapMarkup = import('../Chat/Rich/RichBitmapMarkup').RichBitmapMarkup;
  type DisplayObject = any;

  /** Presentation-only player badges and explanations; these never change permissions. */

  class ChatRoleTags {
    /** Match authenticated player IDs, never display names or typed tags. */

    public static forPlayer(playerId: string): any {
      if (playerId == 'simple1394732616658') {
        return { label: 'darkness', color: 0x5e5e5e };
      }
      if (
        playerId == 'simple1744094288719' ||
        playerId == 'simple1713447605146' ||
        playerId == 'simple1681471966749'
      ) {
        return { label: 'grinder', color: 0x55ccff };
      }
      if (playerId == 'kong4106679') {
        return { label: 'cheater', color: 0xff6666 };
      }
      if (playerId == 'simple1785239895147') {
        return { label: 'pest', color: 0x804800 };
      }
      if (playerId == 'simple1429056679467') {
        return { label: 'killer', color: 0xc20000 };
      }
      if (playerId == 'steam76561199166562663') {
        return { label: 'tree', color: 0x2bba00 };
      }
      if (playerId == 'simple1339408310085') {
        return { label: 'cute', color: 0xff63b9 };
      }
      if (playerId == 'simple1431134449680') {
        return { label: 'menace', color: 0xf54248 };
      }
      if (playerId == 'steam76561198452722633') {
        return { label: 'circle', color: 0x42f59b };
      }
      return null;
    }

    /** Match authenticated sender IDs, never display names or typed chat tags. */

    public static prependPlayerTags(playerId: string, text: string): string | null {
      let role: any = ChatRoleTags.forPlayer(playerId);
      if (role == null) return text;
      let color: string = (Number(role.color) >>> 0).toString(16);
      while (color.length < 6) color = '0' + color;
      return "<FONT COLOR='#" + color + "'>[" + role.label + ']</FONT> ' + text;
    }

    public static atVisibleIndex(markup: RichBitmapMarkup, index: number): string | null {
      if (
        markup == null ||
        index < 0 ||
        index >= markup.text.length ||
        markup.atomAtVisibleIndex(index) != null
      )
        return null;
      let start: number = markup.text.lastIndexOf('[', index);
      if (start < 0 || index - start > 11) return null;
      let end: number = markup.text.indexOf(']', start);
      if (end < index || end - start > 11) return null;
      let tag: string = markup.text.substring(start, end + 1);
      let color: number = markup.colors[start];
      let role: string;
      if (tag == '[client_dev]' && (color == Style.COLOR_CLIENT_DEVELOPER || color == 0xc2fc03)) {
        role = 'client_dev';
      } else if (tag == '[mod]' && color == 0xffaa44) {
        role = 'mod';
      } else if (tag == '[dev]' && color == 0xff86fb) {
        role = 'dev';
      } else {
        return null;
      }
      for (let i: number = start; i <= end; i++) {
        if (markup.colors[i] != color) return null;
      }
      return role;
    }

    public static explanation(role: string): string | null {
      switch (role) {
        case 'client_dev':
          return 'QoLAF client developer.\nNot Astroflux game staff.';
        case 'mod':
          return 'Astroflux game chat moderator.';
        case 'dev':
          return 'Astroflux game developer.';
      }
      return null;
    }

    /** Simple chat stays click-through, but covered text must not show a card. */

    public static isCoveredBy(hit: DisplayObject, view: DisplayObject): boolean {
      let branch: DisplayObject = view;
      while (branch != null && branch.parent != null) {
        let hitBranch: DisplayObject = hit;
        while (hitBranch != null && hitBranch.parent !== branch.parent) {
          hitBranch = hitBranch.parent;
        }
        if (hitBranch != null && hitBranch !== branch) {
          return branch.parent.getChildIndex(hitBranch) > branch.parent.getChildIndex(branch);
        }
        branch = branch.parent;
      }
      return false;
    }
  }

  return ChatRoleTags;
}
