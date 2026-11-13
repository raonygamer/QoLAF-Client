import { ChatEmojiAutocompleteModel } from '../src/chat/ChatEmojiAutocompleteModel';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatCommandAutocompleteModel } from '../src/chat/ChatCommandAutocompleteModel';
import { ChatCommandAutocompletePopup } from '../src/chat/ChatCommandAutocompletePopup';
import { ChatCommandSuggestion } from '../src/chat/ChatCommandSuggestion';
import { builtInCommandSuggestions } from '../src/chat/ChatCommandSuggestions';

const suggestion = (name: string) =>
  new ChatCommandSuggestion(name, ' [value]', 'A long explanation for this command');
test('command model filters, sorts, deduplicates custom commands and shows passive exact argument help', () => {
  const custom = [suggestion('zebra'), suggestion('echo')];
  const model = new ChatCommandAutocompleteModel(
    [suggestion('echo'), suggestion('clear')],
    128,
    () => custom,
  );
  assert.equal(model.update('hello'), false);
  model.update('/');
  assert.deepEqual(
    model.matches.map((entry) => entry.commandName),
    ['clear', 'echo', 'zebra'],
  );
  model.selectPrevious();
  assert.equal(model.complete(), '/zebra ');
  model.selectNext();
  assert.equal(model.complete(), '/clear ');
  model.update('/E');
  assert.equal(model.complete(), '/echo ');
  model.update('/echo argument');
  assert.equal(model.argumentMode, true);
  assert.equal(model.matches.length, 1);
  assert.equal(model.update('/e argument'), false);
  custom.push(suggestion('extra'));
  model.update('/ex');
  assert.equal(model.complete(), '/extra ');
  model.dismiss();
  assert.equal(model.complete(), null);
});

test('native command casing is preserved in completion', () => {
  const commands = builtInCommandSuggestions();
  assert.equal(commands.find((entry) => entry.commandName === 'getid')?.completionText, '/getId ');
  assert.equal(
    commands.find((entry) => entry.commandName === 'warptoid')?.completionText,
    '/warpToId ',
  );
  assert.equal(
    commands.some((entry) => entry.commandName === 'resync'),
    true,
  );
});

test('public command help exposes implemented workflows and excludes private-only commands', () => {
  const commands = new Map(builtInCommandSuggestions().map((entry) => [entry.commandName, entry]));
  for (const name of [
    'ssv',
    'roominvite',
    'network',
    'profiler',
    'disconnect',
    'pktdbg',
    'headingdbg',
    'disposedbg',
  ])
    assert.ok(commands.has(name), `${name} has argument help`);
  for (const name of [
    'script',
    'automation',
    'invitetoroom',
    'kickfromroom',
    'switchservice',
    'joinservice',
    'radio',
    'invitetoradio',
  ])
    assert.equal(commands.has(name), false, `${name} is not advertised in the public client`);
  assert.equal(commands.get('roominvite')?.usage, ' <accept|deny>');
  assert.equal(commands.get('rec')?.description, 'Open the portable recycler');
  assert.equal(
    commands.get('spececho')?.description,
    'Check connected QoLAF clients over IPC; only you see the replies',
  );
  const model = new ChatCommandAutocompleteModel([...commands.values()]);
  assert.equal(model.update('/ssv reset @Pilot'), true);
  assert.equal(model.argumentMode, true);
  assert.equal(model.matches[0].commandName, 'ssv');
});

class Node {
  children: Node[] = [];
  x = 0;
  y = 0;
  width = 1;
  height = 1;
  visible = true;
  alpha = 1;
  text = '';
  font = '';
  disposed = false;
  listeners = new Map<string, Function>();
  parent?: Node;
  constructor(width = 1, height = 1, text = '') {
    Object.assign(this, { width, height, text });
  }
  set_name(_value: string) {}
  set_touchable(_value: boolean) {}
  set_x(value: number) {
    this.x = value;
  }
  set_y(value: number) {
    this.y = value;
  }
  set_width(value: number) {
    this.width = value;
  }
  set_height(value: number) {
    this.height = value;
  }
  set_visible(value: boolean) {
    this.visible = value;
  }
  get_visible(): boolean {
    return this.visible;
  }
  set_alpha(value: number) {
    this.alpha = value;
  }
  set_text(value: string) {
    this.text = value;
  }
  get_textBounds() {
    return { width: this.text.length * 6, height: 16 };
  }
  addChild(child: Node) {
    this.children.push(child);
    child.parent = this;
  }
  addEventListener(key: string, listener: Function) {
    this.listeners.set(key, listener);
  }
  removeEventListener(key: string) {
    this.listeners.delete(key);
  }
}
function popupFixture(emoji = false, previews = false, applyCompletion = true) {
  let cleanupCount = 0;
  const filters: { disposed: boolean; dispose(): void }[] = [];
  const ui = {
    api: {
      cls: () => ({
        createPlayerShipColorMatrixFilter: () => {
          const filter = {
            disposed: false,
            dispose() {
              this.disposed = true;
            },
          };
          filters.push(filter);
          return filter;
        },
      }),
    },
    image: (texture: Node) =>
      Object.assign(new Node(texture.width, texture.height), {
        filter: null as unknown,
        set_filter(value: unknown) {
          this.filter = value;
        },
        texture,
        width: texture.width,
        height: texture.height,
        set_texture(value: Node) {
          this.texture = value;
        },
        readjustSize() {
          this.width = this.texture.width;
          this.height = this.texture.height;
        },
        set_scaleX(value: number) {
          this.width = this.texture.width * value;
        },
        set_scaleY(value: number) {
          this.height = this.texture.height * value;
        },
      }),
    sprite: () => new Node(),
    quad: (w: number, h: number) => new Node(w, h),
    text: (
      w: number,
      h: number,
      value: string,
      _size: number,
      _color: number,
      _align: string,
      font: string,
    ) => Object.assign(new Node(w, h, value), { font }),
    place(node: Node, x: number, y: number, parent?: Node) {
      node.x = x;
      node.y = y;
      parent?.addChild(node);
      return node;
    },
    touch(node: Node, listener: Function, phase: string) {
      const event = phase === 'began' ? 'press' : 'click';
      node.listeners.set(event, listener);
      return () => {
        cleanupCount++;
        node.listeners.delete(event);
      };
    },
    dispose(node: Node) {
      node.disposed = true;
    },
  };
  const model = emoji
    ? new ChatEmojiAutocompleteModel()
    : new ChatCommandAutocompleteModel(
        Array.from({ length: 20 }, (_, index) =>
          suggestion(`cmd${String(index).padStart(2, '0')}`),
        ),
        128, // Match the actual chat popup's explicit limit.
      );
  const completions: string[] = [];
  const popup = new ChatCommandAutocompletePopup(
    ui as any,
    model,
    (text) => {
      completions.push(text);
      if (applyCompletion) popup.update(text);
    },
    emoji
      ? () =>
          new Node(20, 20) as unknown as InstanceType<
            ReturnType<typeof import('../src/ported/Text').createText>
          >
      : undefined,
    previews
      ? (key) => {
          if (key === 'broken') throw new Error('missing texture');
          return new Node(72, 40) as unknown as import('../src/game/Bindings').Texture;
        }
      : undefined,
  );
  return { popup, model, completions, filters, cleanupCount: () => cleanupCount };
}

test('native popup preserves Enter, completes with Tab and keeps argument help passive', () => {
  const { popup, completions } = popupFixture();
  popup.update('/cmd0');
  popup.update('/cmd01');
  assert.equal(popup.height, 44, 'hidden pooled rows must not affect the anchor height');
  popup.update('/cmd0');
  assert.equal(popup.handleKey('Enter'), false);
  assert.equal(popup.handleKey('ArrowDown'), true);
  assert.equal(popup.handleKey('Tab'), true);
  assert.deepEqual(completions, ['/cmd01 ']);
  assert.equal(popup.handleKey('ArrowDown'), false);
  assert.equal(popup.handleKey('Escape'), false);
  popup.update('/cmd');
  assert.equal(popup.handleKey('Escape'), true);
  assert.equal(popup.node.get_visible(), false);
});

test('native popup scrolls rows, ellipsizes descriptions and disposes listeners', () => {
  const { popup, model, completions, cleanupCount } = popupFixture();
  popup.layout(180, 100);
  popup.update('/cmd');
  const node = popup.node as unknown as Node;
  assert.equal(node.children[0].height, 78, 'only two rows fit above the editor');
  assert.ok(node.children[3].text.endsWith('...'));
  popup.scroll(1);
  assert.equal(node.children[2].text, '/cmd01 [value]');
  node.children[1].listeners.get('click')!();
  assert.deepEqual(completions, ['/cmd01 ']);
  popup.update('/cmd');
  popup.handleKey('ArrowUp');
  assert.equal(model.selectedIndex, 19);
  assert.equal(node.children[5].text, '/cmd19 [value]');
  popup.dispose();
  assert.equal(node.disposed, true);
  assert.equal(cleanupCount(), 16);
  assert.equal(node.children.at(-1)!.listeners.size, 0);
});

test('emoji popup uses source preview column and resets pooled rows on query changes', () => {
  const { popup, model, completions } = popupFixture(true);
  popup.update('grinning');
  const node = popup.node as unknown as Node;
  assert.equal(node.children[2].font, 'verdana16_bitmap');
  assert.equal(node.children[3].font, 'verdana16_bitmap');
  assert.equal(node.children[2].x, 50);
  assert.equal(node.children[2].width, 340);
  assert.equal(node.children[4].x, 10);
  assert.equal(node.children[4].y, 12);
  assert.equal(node.children[4].text, model.matches[0].completionText);
  assert.equal(node.children[4].visible, true);
  const second = model.matches[1].completionText;
  popup.handleKey('ArrowDown');
  popup.handleKey('Tab');
  assert.deepEqual(completions, [second]);
  popup.update('no_such_emoji');
  assert.equal(node.visible, false);
  popup.update('thumbsup');
  assert.equal(node.children[2].text, ':thumbs_up:');
  assert.equal(node.children[8].visible, false);
  popup.dispose();
});

test('roster section heading reserves source height and offsets rows and scrollbar dragging', () => {
  const { popup } = popupFixture();
  popup.layout(400, 100);
  popup.update('/cmd');
  popup.sectionTitle = 'IPC Peers Online';
  const node = popup.node as unknown as Node;
  assert.equal(popup.height, 98);
  assert.equal(node.children[1].y, 25);
  assert.equal(node.children[2].y, 25);
  assert.equal(node.children[3].y, 43);
  const heading = node.children.find((child) => child.text === 'IPC Peers Online')!;
  assert.equal(heading.y, 5);
  assert.equal(heading.font, 'verdana16_bitmap');
  const track = node.children.at(-3)!;
  const thumb = node.children.at(-2)!;
  const hit = node.children.at(-1)!;
  assert.equal(track.y, 25);
  assert.equal(thumb.y, 25);
  assert.equal(hit.y, 25);
  hit.listeners.get('touch')!({
    getTouch: () => ({ phase: 'began', getLocation: () => ({ y: 26 }) }),
  });
  assert.equal(
    node.children[2].text,
    '/cmd00 [value]',
    'pressing thumb top must not jump past first row',
  );
  hit.listeners.get('touch')!({
    getTouch: () => ({ phase: 'ended', getLocation: () => ({ y: 26 }) }),
  });
  popup.layout(400, 78);
  assert.equal(popup.height, 64, 'heading reduces row capacity');
  popup.sectionTitle = '';
  assert.equal(popup.height, 78);
  assert.equal(node.children[1].y, 5);
  assert.equal(heading.visible, false);
  popup.dispose();
});

test('ship previews fit source bounds, reuse images and clear missing textures', () => {
  const { popup, model } = popupFixture(false, true);
  const matches = [new ChatCommandSuggestion('Pilot', '', 'Online', '@Pilot', '@Pilot', 0, 'ship')];
  Object.defineProperty(model, 'matches', { get: () => matches });
  popup.update('/cmd');
  const node = popup.node as unknown as Node;
  const preview = node.children.at(-1)!;
  assert.equal(preview.width, 36);
  assert.equal(preview.height, 20);
  assert.equal(preview.x, 12);
  assert.equal(preview.y, 12);
  assert.equal(node.children[2].x, 50);
  const count = node.children.length;
  matches[0] = new ChatCommandSuggestion('Other', '', '', '@Other', '@Other', 0, 'other');
  popup.update('/cmd');
  assert.equal(node.children.length, count);
  matches[0] = new ChatCommandSuggestion('Missing', '', '', '@Missing', '@Missing', 0, 'broken');
  popup.update('/cmd');
  assert.equal(preview.visible, false);
  assert.equal(node.children[2].x, 10);
  popup.dispose();
});

test('friend preview paint filters are cached, replaced and disposed independently of shared textures', () => {
  const { popup, model, filters } = popupFixture(false, true);
  const friend = { previewShipHue: 0.3 };
  const matches = [
    new ChatCommandSuggestion('Pilot', '', '', '@Pilot', '@Pilot', 0, 'ship', friend),
  ];
  Object.defineProperty(model, 'matches', { get: () => matches });
  popup.update('/cmd');
  popup.update('/cmd');
  assert.equal(filters.length, 1);
  friend.previewShipHue = 0.5;
  popup.update('/cmd');
  assert.equal(filters.length, 2);
  assert.equal(filters[0].disposed, true);
  friend.previewShipHue = 0;
  popup.update('/cmd');
  assert.equal(filters[1].disposed, true);
  friend.previewShipHue = 0.2;
  popup.update('/cmd');
  popup.dispose();
  assert.equal(filters[2].disposed, true);
});

test('mouse press selects before release and cancelled scrollbar touches stop dragging', () => {
  const { popup, model, completions } = popupFixture();
  popup.layout(400, 100);
  popup.update('/cmd');
  const node = popup.node as unknown as Node;
  node.children[4].listeners.get('press')!();
  assert.equal(model.selectedIndex, 1);
  assert.equal(completions.length, 0);
  assert.equal(node.children[4].alpha, 0.88);
  node.children[4].listeners.get('click')!();
  assert.deepEqual(completions, ['/cmd01 ']);
  popup.update('/cmd');
  const hit = node.children.at(-1)!;
  let stopped = 0;
  const touch = (phase: string, y: number, cancelled = false) =>
    hit.listeners.get('touch')!({
      stopImmediatePropagation() {
        stopped++;
      },
      getTouch: () => ({ phase, cancelled, getLocation: () => ({ y }) }),
    });
  touch('began', 6);
  touch('stationary', 55, true);
  const last = node.children[2].text;
  assert.notEqual(last, '/cmd00 [value]');
  touch('moved', 6);
  assert.equal(node.children[2].text, last, 'cancelled touch has released the drag');
  assert.equal(stopped, 3);
  popup.dispose();
});

test('mouse acceptance dismisses before a rejected edit while Tab preserves the active suggestion', () => {
  const { popup, model, completions } = popupFixture(false, false, false);
  popup.update('/cmd');
  popup.handleKey('Tab');
  assert.equal(model.active, true, 'source Tab relies on the editor change to refresh');
  assert.equal(popup.node.get_visible(), true);
  const node = popup.node as unknown as Node;
  node.children[1].listeners.get('click')!();
  assert.equal(model.active, false, 'source mouse completion dismisses even if insertion fails');
  assert.equal(popup.node.get_visible(), false);
  assert.deepEqual(completions, ['/cmd00 ', '/cmd00 ']);
  popup.update('/cmd00 argument');
  assert.equal(
    node.children[1].alpha,
    0.88,
    'passive command usage retains source selected-row paint',
  );
  node.children[1].listeners.get('click')!();
  assert.equal(completions.length, 2, 'passive command help never inserts text');
  popup.dispose();
});

test('command models snapshot built-ins and retain source default versus popup result limits', () => {
  const builtIns = Array.from({ length: 12 }, (_, index) => suggestion('command' + index));
  const model = new ChatCommandAutocompleteModel(builtIns);
  const popupModel = new ChatCommandAutocompleteModel(builtIns, 128);
  builtIns.splice(0, builtIns.length, suggestion('replacement'));
  assert.equal(model.update('/command'), true);
  assert.equal(model.matches.length, 8);
  assert.equal(model.update('/replacement'), false);
  assert.equal(popupModel.update('/command'), true);
  assert.equal(popupModel.matches.length, 12);
  const returned = popupModel.matches;
  returned.length = 0;
  assert.equal(popupModel.matches.length, 12, 'returned matches cannot mutate model state');
});
