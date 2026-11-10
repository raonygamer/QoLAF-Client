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
    renderer.characterBatch.meshes.map((mesh: any) => mesh.color),
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
  assert.equal(renderer.characterBatch.meshes.length, 4, 'wrapping discards the separator space');
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
  assert.equal(text.finalLayer.x, -width / 2);
  text.alignRight();
  assert.equal(text.finalLayer.x, -width);
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
    text.finalLayer.characterBatch.meshes.map((mesh: any) => mesh.color),
    [0x12ab34, 0xffffff],
  );
  text.text = '<font color="#12ab34">A</font>B';
  assert.equal(text.text, '<font color="#12ab34">A</font>B');
  assert.ok(text.finalLayer.characterBatch.meshes.every((mesh: any) => mesh.color === 0xffffff));
  text.htmlText = '<font color="#ff0000">A</font>';
  assert.deepEqual(
    text.finalLayer.characterBatch.meshes.map((mesh: any) => mesh.color),
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
  renderer.getTransformationMatrix = () => ({ a: 0, b: 2, c: -2, d: 0, tx: 5, ty: 7 });
  renderer.getBounds({}, bounds);
  assert.deepEqual([bounds.x, bounds.y, bounds.width, bounds.height], [-55, 7, 60, 200]);
});
