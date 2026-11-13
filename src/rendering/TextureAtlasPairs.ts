import { Bitmap, Texture, TextureAtlas, TextureManager, Xml } from '../game/Bindings';
import { invalidateTextureFrames } from './TextureFrames';

export function textureXmlName(name: string): string {
  return name.replace(/\.(png|jpe?g)$/i, '.xml');
}

export function disposeTextureBitmap(bitmap: Bitmap | null): void {
  if (!bitmap) return;
  try {
    bitmap.get_bitmapData()?.dispose();
    bitmap.set_bitmapData(null);
  } catch {
    // Match source cancellation: inaccessible/already-released bitmap data
    // must not prevent the remaining requests from being detached.
  }
}

/** A batch owns temporary XML/bitmap pairs until the GPU atlas takes ownership. */
export class TextureAtlasPairs {
  private readonly pending = new Map<string, { name: string; bitmap: Bitmap }>();
  private readonly documents = new Map<string, Xml>();
  private readonly failed = new Set<string>();

  image(name: string, bitmap: Bitmap): void {
    const xmlName = textureXmlName(name);
    if (this.failed.has(xmlName)) return disposeTextureBitmap(bitmap);
    const xml = this.documents.get(xmlName);
    if (xml) this.create(name, bitmap, xml);
    else this.pending.set(xmlName, { name, bitmap });
  }

  xml(name: string, text: string): void {
    if (this.failed.has(name)) return;
    const xml = Xml.parse(text);
    this.documents.set(name, xml);
    TextureManager.xmlDict.h[name] = xml;
    const pending = this.pending.get(name);
    if (pending) this.create(pending.name, pending.bitmap, xml);
  }

  fail(name: string, bitmap: Bitmap | null = null): void {
    const xmlName = textureXmlName(name);
    this.failed.add(xmlName);
    const pending = this.pending.get(xmlName);
    this.pending.delete(xmlName);
    this.clearXml(xmlName);
    disposeTextureBitmap(pending?.bitmap ?? null);
    if (pending?.bitmap !== bitmap) disposeTextureBitmap(bitmap);
  }

  dispose(): void {
    for (const { bitmap } of this.pending.values()) disposeTextureBitmap(bitmap);
    this.pending.clear();
    for (const name of this.documents.keys()) this.clearXml(name);
    this.failed.clear();
  }

  private clearXml(name: string): void {
    const document = this.documents.get(name);
    if (document && TextureManager.xmlDict.h[name] === document)
      delete TextureManager.xmlDict.h[name];
    this.documents.delete(name);
  }

  private create(name: string, bitmap: Bitmap, xml: Xml): void {
    let texture: Texture | undefined;
    try {
      texture = Texture.fromBitmap(bitmap, false);
      const atlas = new TextureAtlas(texture, xml);
      const previous = TextureManager.textureAtlasDict.h[name];
      if (previous instanceof TextureAtlas) invalidateTextureFrames(previous);
      TextureManager.textureAtlasDict.h[name] = atlas;
    } catch (error) {
      texture?.dispose();
      throw error;
    }
    // Native Texture retains bitmap data for graphics-context restoration.
    const xmlName = textureXmlName(name);
    this.pending.delete(xmlName);
    this.clearXml(xmlName);
    this.failed.delete(xmlName);
  }
}
