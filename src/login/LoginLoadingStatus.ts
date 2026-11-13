import { TextBitmap, type LoadingBar } from '../game/Bindings';

/** LoadingBar.diff: independent texture, network and retry-detail lines. */
export class LoginLoadingStatus {
  private texture: TextBitmap;
  private interfaceAssets: TextBitmap;
  private network: TextBitmap;
  private detail: TextBitmap;
  private disposed = false;
  private statusWasVisible: boolean;
  private percentWasVisible: boolean;

  constructor(private bar: LoadingBar) {
    this.statusWasVisible = bar.status.get_visible();
    this.percentWasVisible = bar.percent.get_visible();
    this.texture = new TextBitmap();
    this.interfaceAssets = new TextBitmap();
    this.interfaceAssets.set_visible(false);
    this.network = new TextBitmap();
    this.detail = new TextBitmap();
    this.texture.set_size(20);
    this.interfaceAssets.set_size(20);
    this.network.set_size(20);
    this.detail.set_size(16);
    this.detail.set_color(0x999999);
    bar.status.set_visible(false);
    bar.percent.set_visible(false);
    for (const text of [this.texture, this.network, this.detail, this.interfaceAssets])
      bar.addChild(text);
    this.texture.set_y(5);
    this.updateTextures(0);
    this.setNetwork('Searching for service rooms...');
  }

  updateTextures(percent: number): void {
    if (this.disposed) return;
    this.texture.set_visible(true);
    this.texture.set_text(`Loading textures ${Math.trunc(percent)}%`);
    this.texture.set_x(-this.texture.get_width() / 2);
    this.layout();
  }

  completeTextures(): void {
    if (this.disposed) return;
    this.texture.set_visible(false);
    this.layout();
  }

  setInterfaceLoading(loading: boolean): void {
    if (this.disposed) return;
    this.interfaceAssets.set_text('Loading interface...');
    this.interfaceAssets.set_x(-this.interfaceAssets.get_width() / 2);
    this.interfaceAssets.set_visible(loading);
    this.layout();
  }

  setNetwork(status: string, detail = ''): void {
    if (this.disposed) return;
    this.network.set_text(status);
    this.network.set_visible(status.length > 0);
    this.network.set_x(-this.network.get_width() / 2);
    this.setDetail(detail);
  }

  setDetail(detail: string): void {
    if (this.disposed) return;
    this.detail.set_text(detail);
    this.detail.set_x(-this.detail.get_width() / 2);
    this.detail.set_visible(this.network.get_visible() && detail.length > 0);
    this.layout();
  }

  private layout(): void {
    let y = this.texture.get_visible() ? 5 + this.texture.get_height() + 6 : 5;
    this.interfaceAssets.set_y(y);
    if (this.interfaceAssets.get_visible()) y += this.interfaceAssets.get_height() + 6;
    this.network.set_y(y);
    this.detail.set_y(this.network.get_y() + this.network.get_height() + 4);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const text of [this.texture, this.network, this.detail, this.interfaceAssets]) {
      text.removeFromParent();
      text.dispose();
    }
    this.bar.status.set_visible(this.statusWasVisible);
    this.bar.percent.set_visible(this.percentWasVisible);
  }
}
