import { NativeTextFormat, Point, type Matrix, type DisplayObject } from '../src/game/Bindings';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bitmapRendererFixture } from './fixtures/BitmapRenderer';

test('source bitmap layout wraps words, drops trailing newline phantom lines, and retains per-glyph color', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const renderer = new fixture.Renderer();
  t.after(() => renderer.dispose());
  renderer.textFormat = new fixture.BitmapFormat(fixture.font, 16, 0xffffff);
  renderer.text = '<font color="#f00">A</font>B\n';
  renderer.validate();
  assert.equal(renderer.numLines, 1);
  assert.equal(renderer.measureText().y, fixture.font.lineHeight);
  assert.deepEqual(
    fixture.paintedGlyphs(renderer).map((mesh: any) => mesh.color),
    [0xff0000, 0xffffff],
  );
  renderer.text = 'A\n\nB';
  renderer.validate();
  assert.equal(renderer.numLines, 3);
  renderer.text = 'AA BB';
  renderer.wordWrap = true;
  renderer.width = fixture.font.getChar(65).xAdvance * 2 + 1;
  renderer.validate();
  assert.equal(renderer.numLines, 2);
  assert.equal(fixture.paintedGlyphs(renderer).length, 4, 'wrapping discards the separator space');
});

test('source Text auto-sizing and alignment preserve original coordinates across repeated content changes', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const text = new fixture.Text(12.9, 34.9);
  t.after(() => text.dispose());
  assert.equal(text.x, 12);
  assert.equal(text.y, 34);
  text.size = 16;
  text.text = 'AB';
  const width = text.width;
  assert.equal(text.get_width(), width);
  assert.equal(text.get_x(), 12);
  text.set_x(18.8);
  assert.equal(text.x, 18);
  assert.ok(width > 5);
  text.alignCenter();
  assert.equal(fixture.labelRenderer(text).get_x(), -width / 2);
  text.alignRight();
  assert.equal(fixture.labelRenderer(text).get_x(), -width);
  text.text = 'A';
  assert.ok(text.width < width);
  text.text = '';
  assert.equal(text.width, 0);
  assert.equal(text.height, 0);
});

test('Text htmlText sends color spans through bitmap glyphs while plain text stays escaped', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const text = new fixture.Text(0, 0);
  t.after(() => text.dispose());
  text.size = 16;
  text.color = 0xffffff;
  text.htmlText = '<font color="#12ab34">A</font>B';
  assert.equal(text.text, 'AB');
  assert.deepEqual(
    fixture.paintedGlyphs(fixture.labelRenderer(text)).map((mesh: any) => mesh.color),
    [0x12ab34, 0xffffff],
  );
  text.text = '<font color="#12ab34">A</font>B';
  assert.equal(text.text, '<font color="#12ab34">A</font>B');
  assert.ok(
    fixture
      .paintedGlyphs(fixture.labelRenderer(text))
      .every((mesh: any) => mesh.color === 0xffffff),
  );
  text.htmlText = '<font color="#ff0000">A</font>';
  assert.deepEqual(
    fixture.paintedGlyphs(fixture.labelRenderer(text)).map((mesh: any) => mesh.color),
    [0xff0000],
  );
});

test('bitmap control bounds retain the full layout box under parent transforms', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const renderer = new fixture.Renderer();
  t.after(() => renderer.dispose());
  renderer.textFormat = new fixture.BitmapFormat(fixture.font, 16, 0xffffff);
  renderer.text = 'A';
  renderer.width = 100;
  renderer.height = 30;
  const bounds = renderer.getBounds(renderer);
  assert.deepEqual([bounds.x, bounds.y, bounds.width, bounds.height], [0, 0, 100, 30]);
  renderer.getTransformationMatrix = () => ({ a: 0, b: 2, c: -2, d: 0, tx: 5, ty: 7 }) as Matrix;
  renderer.getBounds(new fixture.Sprite() as unknown as DisplayObject, bounds);
  assert.deepEqual([bounds.x, bounds.y, bounds.width, bounds.height], [-55, 7, 60, 200]);
});

test('native label setup preserves wrap width when styling precedes its first text', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const text = new fixture.Text();
  t.after(() => text.dispose());
  const initialWidth = text.width;
  // Current Haxe daily reward and offer labels configure size before wrapping.
  text.size = 16;
  text.wordWrap = true;
  text.color = 0xffff00;
  text.text = 'AB';
  assert.equal(text.width, initialWidth);
  assert.equal(fixture.labelRenderer(text).numLines, 1);
  text.width = 5;
  text.text = 'AB AB';
  assert.ok(fixture.labelRenderer(text).numLines > 1, 'explicit narrow widths still wrap');
});

test('elite-tech native setup retains its 360px wrap width through empty-field styling', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const text = new fixture.Text();
  t.after(() => text.dispose());
  // Haxe EliteTechBar sets width before these format changes. The original
  // AS3 workaround moved width afterwards; the port preserves explicit width.
  text.color = 978670;
  text.width = 360;
  text.size = 10;
  text.font = 'Verdana';
  text.alignLeft();
  text.wordWrap = true;
  text.htmlText = 'AB AB AB';
  assert.equal(text.width, 360);
  assert.equal(fixture.labelRenderer(text).numLines, 1);
});

test('rich label hit area includes whitespace, minimum touch bounds, and respects visibility and masks', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const renderer = new fixture.Renderer();
  t.after(() => renderer.dispose());
  renderer.textFormat = new fixture.BitmapFormat(fixture.font, 16);
  renderer.text = 'A B';
  renderer.width = 100;
  renderer.height = 30;
  assert.equal(renderer.hitTest(new Point(90, 20)), renderer);
  assert.equal(renderer.hitTest(new Point(100, 20)), null);
  renderer.minTouchWidth = 120;
  assert.equal(renderer.hitTest(new Point(-9, 20)), renderer);
  assert.equal(renderer.hitTest(new Point(-11, 20)), null);
  renderer.set_visible(false);
  assert.equal(renderer.hitTest(new Point(10, 10)), null);
  renderer.set_visible(true);
  renderer.set_touchable(false);
  assert.equal(renderer.hitTest(new Point(10, 10)), null);
  renderer.set_touchable(true);
  renderer.hitTestMask = () => false;
  assert.equal(renderer.hitTest(new Point(10, 10)), null);
  renderer.hitTestMask = () => true;
  renderer.isQuickHitAreaEnabled = false;
  assert.equal(renderer.hitTest(new Point(10, 10)), null);
});

test('native OpenFL numeric alignment reaches the source bitmap label format', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const text = new fixture.Text();
  t.after(() => text.dispose());
  const cases: [number | null, string][] = [
    [0, 'center'],
    [3, 'left'],
    [4, 'right'],
    [null, 'left'],
  ];
  for (const [alignment, expected] of cases) {
    const format = new NativeTextFormat('DAIDRR', 16, 0xffffff);
    format.align = alignment;
    text.defaultTextFormat = format;
    text.wordWrap = true;
    text.width = 100;
    text.text = 'A';
    assert.equal(fixture.labelRenderer(text).currentTextFormat?.align, expected);
    const glyphs = fixture.paintedGlyphs(fixture.labelRenderer(text));
    const x = glyphs[0].x;
    if (expected === 'center') assert.ok(x > 30 && x < 65);
    else if (expected === 'right') assert.ok(x > 70);
    else assert.ok(x < 15);
  }
});

test('glyph layout survives removal of temporary Haxe font and character property aliases', (t) => {
  const fixture = bitmapRendererFixture();
  t.after(fixture.cleanup);
  const renderer = new fixture.Renderer();
  t.after(() => renderer.dispose());
  renderer.textFormat = new fixture.BitmapFormat(fixture.font, 16, 0xffffff);
  renderer.text = 'AB';
  renderer.validate();
  const before = renderer.measureText();
  for (const code of [65, 66]) {
    const character = fixture.font.getChar(code);
    for (const key of ['texture', 'xOffset', 'yOffset', 'xAdvance', 'width'])
      Reflect.deleteProperty(character, key);
  }
  for (const key of ['size', 'lineHeight', 'baseline', 'offsetX', 'offsetY'])
    Reflect.deleteProperty(fixture.font, key);
  renderer.text = 'B';
  renderer.text = 'AB';
  assert.doesNotThrow(() => renderer.validate());
  const after = renderer.measureText();
  assert.equal(after.x, before.x);
  assert.equal(after.y, before.y);
  assert.equal(fixture.paintedGlyphs(renderer).length, 2);
});
