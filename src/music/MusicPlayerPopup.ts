import { bound, type Resolve } from '../runtime/HaxeInterop';
import { createMusicTrackCatalog } from './MusicTrackCatalog';
import type { MusicPlayerService } from './MusicPlayer';
export function createMusicPlayerPopup(resolve: Resolve, MusicPlayer: MusicPlayerService) {
  const MusicTrackCatalog = createMusicTrackCatalog(resolve);
  const PopupMessage = resolve('core.hud.components.dialogs.PopupMessage');
  const Button = resolve('core.hud.components.Button');
  const Text = resolve('core.hud.components.Text');
  const SceneBase = resolve('core.scene.SceneBase');
  const NativeCheck = resolve('core.hud.components.ui.CheckBox');
  const Russo = resolve('core.text.RussoBitmapFontRegistry');
  class Check extends NativeCheck {
    constructor() {
      super();
      this.alignLeft = true;
      this.labelPadding = 20;
      this.labelFont = Russo.fontNameForSize(11);
      this.textField.set_wordWrap(false);
      this.width = 300;
    }
    get isSelected(): boolean {
      return this.get_selected();
    }
    set isSelected(value: boolean) {
      this.set_selected(value);
    }
  }
  const ScrollContainer = resolve('core.hud.components.ui.ScrollBox');
  const NativeSlider = resolve('core.hud.components.ui.Slider');
  class Slider extends NativeSlider {
    private viewHeight = 24;
    get_height(): number {
      return this.viewHeight ?? 24;
    }
    set_height(value: number): number {
      this.viewHeight = value;
      this.layout();
      return value;
    }
    layout(): void {
      super.layout();
      const height = this.viewHeight ?? 24;
      this.track.set_y((height - 4) / 2);
      this.thumb?.set_y((height - 13) / 2);
      this.hitQuad.set_y(0);
      this.hitQuad.set_height(height);
    }
  }
  const Quad = resolve('starling.display.Quad');
  const Sprite = resolve('starling.display.Sprite');
  resolve('starling.events.Touch');
  resolve('starling.events.TouchEvent');
  resolve('starling.events.KeyboardEvent');
  /** A disposable view of session-owned music; closing it never stops audio. */

  class MusicPlayerPopup extends PopupMessage {
    public static active: MusicPlayerPopup | null = null;
    private g: any;
    private disposed = false;
    private syncing = false;
    private tracks: any[];
    private rows: any[] = [];
    private selected: number = -1;
    private gameDrive: any = new Check();
    private loopTrack: any = new Check();
    private manualControls: any = new Sprite();
    private scroll: any = new ScrollContainer();
    private list: any = new Sprite();
    private heading: any;
    private nowPlaying: any;
    private note: any;
    private playButton: any;
    private pauseButton: any;
    private stopButton: any;
    private previousButton: any;
    private nextButton: any;
    private volume: any = new Slider();
    private volumeLabel: any;
    private poll: ReturnType<typeof setInterval>;
    private observedStage: any = null;
    private panelWidth: number = 600;
    private panelHeight: number = 550;
    private pressedRow: any;
    private pressedX = 0;
    private pressedY = 0;
    private pressedScroll = 0;
    @bound
    public static open(game: any): void {
      if (game == null || game.isLeaving) return;
      if (MusicPlayerPopup.active != null) MusicPlayerPopup.active.dismiss();
      let popup: MusicPlayerPopup = new MusicPlayerPopup(game);
      MusicPlayerPopup.active = popup;
      popup.addEventListener('close', popup.onClose);
      game.addChildToOverlay(popup, true);
    }
    constructor(game: any) {
      super('Close');
      this.g = game;
      this.box.removeChild(this.textField, true);
      this.closeButton.removeFromParent(true);
      this.closeButton = new Button(() => this.close(), 'Close');
      this.box.addChild(this.closeButton);
      this.heading = this.label(this.box, 'Music player', 16, 0xffffff);
      this.gameDrive.label = 'Let the game drive the songs';
      this.gameDrive.isSelected = !MusicPlayer.manual;
      this.gameDrive.addEventListener('change', this.onGameDrive);
      this.box.addChild(this.gameDrive);
      this.nowPlaying = this.label(this.box, '', 12, 0xb9dcec);
      this.note = this.label(this.box, '', 11, 0x999999);
      this.note.wordWrap = true;
      this.box.addChild(this.manualControls);
      this.scroll.horizontalScrollPolicy = 'off';
      this.scroll.verticalScrollPolicy = 'on';
      this.scroll.scrollBarDisplayMode = 'fixed';
      this.scroll.addChild(this.list);
      this.manualControls.addChild(this.scroll);
      this.tracks = MusicTrackCatalog.getTracks();
      for (let i: number = 0; i < this.tracks.length; i++) {
        let row: any = new Sprite();
        row.name = String(i);
        row.useHandCursor = true;
        let background: any = new Quad(100, 48, 0x202020);
        row.addChild(background);
        let title: any = this.label(row, this.tracks[i].title, 13, 0xffffff);
        title.x = 10;
        title.y = 4;
        let subtitle: any = this.label(row, this.tracks[i].subtitle, 10, 0xaaaaaa);
        subtitle.x = 10;
        subtitle.y = 26;
        row.addEventListener('touch', this.onTrackTouch);
        row.y = i * 50;
        this.list.addChild(row);
        this.rows.push({ view: row, background: background, title: title, subtitle: subtitle });
        if (
          this.tracks[i].key ==
          (MusicPlayer.selectedTrackKey != null
            ? MusicPlayer.selectedTrackKey
            : MusicPlayer.trackKey)
        )
          this.selected = i;
      }
      if (this.selected < 0 && this.tracks.length > 0) this.selected = 0;
      if (this.tracks.length == 0)
        this.label(this.list, 'No music tracks are available in the cache.', 12, 0xaaaaaa);
      this.previousButton = this.button(this.previousTrack, '<');
      this.playButton = this.button(this.playSelected, 'Play');
      this.pauseButton = this.button(this.pauseOrResume, 'Pause');
      this.stopButton = this.button(this.stopTrack, 'Stop');
      this.nextButton = this.button(this.nextTrack, '>');
      this.loopTrack.label = 'Loop selected track';
      this.loopTrack.isSelected = MusicPlayer.preferredLoop;
      this.loopTrack.addEventListener('change', this.onLoopChanged);
      this.manualControls.addChild(this.loopTrack);
      this.volumeLabel = this.label(this.manualControls, 'Music volume', 11, 0xaaaaaa);
      this.volume.minimum = 0;
      this.volume.maximum = 1;
      this.volume.step = 0.01;
      this.volume.value = SceneBase.settings.musicVolume;
      this.volume.addEventListener('change', this.onVolumeChanged);
      this.manualControls.addChild(this.volume);
      this.poll = setInterval(this.syncState, 250);
      this.syncState();
    }
    @bound
    private label(owner: any, value: string, size: number, color: number): any {
      let field: any = new Text();
      field.font = 'Verdana';
      field.size = size;
      field.color = color;
      field.text = value;
      owner.addChild(field);
      return field;
    }
    @bound
    private button(callback: Function, title: string): any {
      let value: any = new Button(callback, title);
      value.autoEnableAfterClick = true;
      this.manualControls.addChild(value);
      return value;
    }
    @bound
    private onGameDrive(event: any): void {
      if (this.syncing || this.disposed) return;
      this.pressedRow = null;
      if (this.gameDrive.isSelected) MusicPlayer.useGameMusic();
      else {
        MusicPlayer.stop();
        MusicPlayer.setLoop(this.loopTrack.isSelected);
      }
      this.syncState();
    }
    @bound
    private onTrackTouch(event: any): void {
      if (!MusicPlayer.manual) return;
      let row: any = event.currentTarget;
      let touch: any = event.getTouch(row, 'began');
      if (touch != null) {
        this.pressedRow = row;
        this.pressedX = touch.globalX;
        this.pressedY = touch.globalY;
        this.pressedScroll = this.scroll.verticalScrollPosition;
      }
      touch = event.getTouch(row, 'ended');
      if (touch != null && this.pressedRow === row) {
        if (
          !touch.cancelled &&
          Math.abs(touch.globalX - this.pressedX) < 8 &&
          Math.abs(touch.globalY - this.pressedY) < 8 &&
          Math.abs(this.scroll.verticalScrollPosition - this.pressedScroll) < 8
        ) {
          this.selected = Number(row.name);
          MusicPlayer.selectTrack(this.tracks[this.selected].key);
          this.syncState();
        }
        this.pressedRow = null;
      }
    }
    @bound
    private playSelected(event: any = null): void {
      if (!MusicPlayer.manual || this.selected < 0) return;
      MusicPlayer.play(this.tracks[this.selected].key, this.loopTrack.isSelected);
      this.syncState();
    }
    @bound
    private previousTrack(event: any): void {
      this.stepTrack(-1);
    }
    @bound
    private nextTrack(event: any): void {
      this.stepTrack(1);
    }
    @bound
    private stepTrack(direction: number): void {
      if (!MusicPlayer.manual || this.tracks.length == 0) return;
      this.selected = (this.selected + direction + this.tracks.length) % this.tracks.length;
      this.scroll.arrange();
      this.scroll.verticalScrollPosition = Math.min(
        this.scroll.maxVerticalScrollPosition,
        this.selected * 50,
      );
      this.playSelected();
    }
    @bound
    private pauseOrResume(event: any): void {
      if (!MusicPlayer.manual) return;
      if (MusicPlayer.paused) MusicPlayer.resume();
      else MusicPlayer.pause();
      this.syncState();
    }
    @bound
    private stopTrack(event: any): void {
      if (!MusicPlayer.manual) return;
      MusicPlayer.stop();
      this.syncState();
    }
    @bound
    private onLoopChanged(event: any): void {
      if (!this.syncing && MusicPlayer.manual) MusicPlayer.setLoop(this.loopTrack.isSelected);
    }
    @bound
    private onVolumeChanged(event: any): void {
      if (!this.syncing && MusicPlayer.manual) SceneBase.settings.musicVolume = this.volume.value;
    }
    @bound
    private syncState(event: any = null): void {
      if (this.disposed) return;
      this.syncing = true;
      let manual: boolean = MusicPlayer.manual;
      this.gameDrive.isSelected = !manual;
      this.manualControls.alpha = manual ? 1 : 0.3;
      this.manualControls.touchable = manual;
      // isEnabled also prevents keyboard/focus activation while automatic.
      this.scroll.isEnabled = this.loopTrack.isEnabled = this.volume.isEnabled = manual;
      this.loopTrack.textField.get_format().set_color(manual ? 734012 : 0x5b6770);
      this.playButton.enabled =
        this.previousButton.enabled =
        this.nextButton.enabled =
          manual && this.selected >= 0;
      this.pauseButton.enabled =
        manual &&
        (MusicPlayer.paused || MusicPlayer.status == 'Playing' || MusicPlayer.status == 'Loading');
      this.stopButton.enabled = manual;
      this.pauseButton.text = MusicPlayer.paused ? 'Resume' : 'Pause';
      if (manual) this.loopTrack.isSelected = MusicPlayer.looping;
      this.volume.value = SceneBase.settings.musicVolume;
      this.volumeLabel.text = 'Music volume: ' + Math.round(this.volume.value * 100) + '%';
      let title: string = 'No track';
      for (const track of this.tracks) {
        if (track.key == MusicPlayer.trackKey) {
          title = track.title;
          break;
        }
      }
      let status: string = MusicPlayer.status + ' • ' + title;
      this.fitLabel(this.nowPlaying, status, this.panelWidth - 32);
      let help: string =
        MusicPlayer.error != ''
          ? MusicPlayer.error
          : manual
            ? 'Manual music stays in control through death and room changes. Closing this window keeps it playing.'
            : 'The game chooses the music. Uncheck the option above to select and loop a track.';
      // Keep backend error details bounded, including long asset URLs.
      if (help.length > 150) help = help.substr(0, 147) + '...';
      let changed: boolean = this.note.text != help;
      if (changed) this.note.text = help;
      for (let i: number = 0; i < this.rows.length; i++)
        this.rows[i].background.color = i == this.selected ? 0x35434a : 0x202020;
      this.syncing = false;
      if (changed && this.stage != null) this.redraw();
      this.prepareDisplayTree(this.box);
    }
    private prepareDisplayTree(display: any): void {
      display.excludeFromCache();
      display.setRequiresRedraw();
      const count = display.get_numChildren?.() ?? 0;
      for (let index = 0; index < count; index++) {
        this.prepareDisplayTree(display.getChildAt(index));
      }
    }
    @bound
    private fitLabel(field: any, value: string, available: number): void {
      // Text.width alone does not clip a non-wrapping legacy bitmap label.
      field.text = value;
      if (field.width <= available) return;
      let low: number = 0;
      let high: number = value.length;
      while (low < high) {
        let middle: number = Math.ceil((low + high) / 2);
        field.text = value.substr(0, middle) + '...';
        if (field.width <= available) low = middle;
        else high = middle - 1;
      }
      field.text = value.substr(0, low) + '...';
    }
    @bound
    redraw(event: any = null): void {
      if (this.stage == null || this.disposed) return;
      this.panelWidth = Math.max(420, Math.min(600, this.stage.stageWidth - 48));
      this.panelHeight = Math.max(400, Math.min(550, this.stage.stageHeight - 48));
      this.box.width = this.panelWidth;
      this.box.height = this.panelHeight;
      this.box.x = Math.round((this.stage.stageWidth - this.panelWidth) / 2);
      this.box.y = Math.round((this.stage.stageHeight - this.panelHeight) / 2);
      this.heading.x =
        this.gameDrive.x =
        this.nowPlaying.x =
        this.note.x =
        this.manualControls.x =
          16;
      this.heading.y = 12;
      this.gameDrive.y = 42;
      this.gameDrive.width = this.panelWidth - 32;
      this.nowPlaying.y = 78;
      this.note.y = 105;
      this.note.width = this.panelWidth - 32;
      this.manualControls.y = Math.max(162, this.note.y + this.note.height + 12);
      this.scroll.width = this.panelWidth - 32;
      this.scroll.height = Math.max(32, this.panelHeight - this.manualControls.y - 138);
      for (let i: number = 0; i < this.rows.length; i++) {
        let row: any = this.rows[i];
        row.background.width = this.panelWidth - 44;
        this.fitLabel(row.title, this.tracks[i].title, this.panelWidth - 64);
        this.fitLabel(row.subtitle, this.tracks[i].subtitle, this.panelWidth - 64);
      }
      this.scroll.arrange();
      let controlsY: number = this.scroll.height + 10;
      let buttons: any[] = [
        this.previousButton,
        this.playButton,
        this.pauseButton,
        this.stopButton,
        this.nextButton,
      ];
      let x: number = 0;
      for (const control of buttons) {
        control.x = x;
        control.y = controlsY;
        control.width = control === this.previousButton || control === this.nextButton ? 38 : 82;
        x += control.width + 8;
      }
      this.loopTrack.y = controlsY + 34;
      this.volumeLabel.y = controlsY + 71;
      this.volume.x = 146;
      this.volume.y = controlsY + 64;
      this.volume.width = this.panelWidth - 178;
      this.volume.height = 24;
      this.closeButton.x = this.panelWidth - this.closeButton.width - 16;
      this.closeButton.y = this.panelHeight - this.closeButton.height - 10;
      this.bgr.width = this.stage.stageWidth;
      this.bgr.height = this.stage.stageHeight;
      this.syncState();
    }
    @bound
    keyDown(event: any): void {
      if (event.keyCode == 27) {
        event.stopImmediatePropagation();
        this.close();
      }
    }
    @bound
    private onClose(event: any): void {
      this.dismiss();
    }
    @bound
    public dismiss(): void {
      if (this.disposed) return;
      if (this.parent != null && this.g != null) this.g.removeChildFromOverlay(this, true);
      else this.dispose();
    }

    @bound
    stageAddHandler(): void {
      this.observedStage = this.stage;
      this.addEventListener('removedFromStage', this.clean);
      this.observedStage.addEventListener('keyDown', this.keyDown);
      this.observedStage.addEventListener('resize', this.redraw);
      this.redraw();
    }
    @bound
    clean(): void {
      this.observedStage?.removeEventListener('keyDown', this.keyDown);
      this.observedStage?.removeEventListener('resize', this.redraw);
      this.observedStage = null;
    }
    @bound
    public dispose(): void {
      if (this.disposed) return;
      this.disposed = true;
      clearInterval(this.poll);
      this.clean();
      if (MusicPlayerPopup.active === this) MusicPlayerPopup.active = null;
      this.pressedRow = null;
      this.g = null;
      super.dispose();
    }
  }

  return MusicPlayerPopup;
}
