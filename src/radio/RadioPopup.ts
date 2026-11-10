import { bound, type Resolve } from '../runtime/As3';
import type { RadioViewService } from './RadioViewService';
import { createRadioMarqueeTextRenderer } from './RadioMarqueeTextRenderer';
import { createRadioList } from './RadioList';
import { createRadioSlider } from './RadioSlider';
/** Source: core/hud/components/dialogs/RadioPopup.as; native Starling controls. */
export function createRadioPopup(resolve: Resolve, InputText: any, service: RadioViewService) {
  const PopupMessage = resolve('core.hud.components.dialogs.PopupMessage');
  const Button = resolve('core.hud.components.Button');
  const Text = resolve('core.hud.components.Text');
  const SceneBase = resolve('core.scene.SceneBase');
  const Quad = resolve('starling.display.Quad');
  const Sprite = resolve('starling.display.Sprite');
  const BitmapFontTextFormat = resolve('feathers.text.BitmapFontTextFormat');
  const VerdanaBitmapFontRegistry = resolve('core.text.VerdanaBitmapFontRegistry');
  const RadioMarqueeTextRenderer = createRadioMarqueeTextRenderer(resolve);
  const List = createRadioList(resolve, RadioMarqueeTextRenderer);
  const ListCollection = class {
    constructor(public data: any[]) {}
  };
  const RadioQueryInput = InputText;
  const Slider = createRadioSlider(resolve);
  const Event = { CHANGE: 'change' };
  const FeathersEventType = {
    ENTER: 'enter',
    BEGIN_INTERACTION: 'beginInteraction',
    END_INTERACTION: 'endInteraction',
  };
  /** Opt-in radio view; audio/queues belong to the session, not this popup. */
  class RadioPopup extends PopupMessage {
    private static readonly PANEL_WIDTH: number = 900;
    private static readonly PANEL_HEIGHT: number = 780;
    public static active: any = null;
    private game: any = null;
    private service: RadioViewService;
    private disposed: boolean = false;
    private syncing: boolean = false;
    private poll: ReturnType<typeof setInterval>;
    private observedStage: any = null;
    private statusLabel: any = null;
    private messageLabel: any = null;
    private groupLabel: any = null;
    private requestLabel: any = null;
    private requestHint: any = null;
    private requestDivider: any = null;
    private setupButton: any = null;
    private retryButton: any = null;
    private createButton: any = null;
    private joinButton: any = null;
    private leaveButton: any = null;
    private addButton: any = null;
    private pauseButton: any = null;
    private skipButton: any = null;
    private restartButton: any = null;
    private playSelectedButton: any = null;
    private removeSelectedButton: any = null;
    private shuffleButton: any = null;
    private repeatButton: any = null;
    private keepButton: any = null;
    private timeLabel: any = null;
    private seekBar: any = new Slider();
    private seeking: boolean = false;
    private seekChanged: boolean = false;
    private seekRoom: string = '';
    private seekPlayback: number = -1;
    private acceptButton: any = null;
    private denyButton: any = null;
    private peersButton: any = null;
    private requestsButton: any = null;
    private djButton: any = null;
    private leaderButton: any = null;
    private kickButton: any = null;
    private peerHint: any = null;
    private peerList: any = new List();
    private peerKey: string = '';
    private showPeerList: boolean = false;
    private roomList: any = new List();
    private queueList: any = new List();
    private requestList: any = new List();
    private roomName: any = new InputText(18, 488, 152, 30);
    private roomPassword: any = new InputText(18, 442, 238, 30);
    private query: any = new RadioQueryInput(274, 530, 495, 30);
    private volume: any = new Slider();
    private directoryKey: string = '';
    private queueKey: string = '';
    private requestKey: string = '';
    @bound
    public static open(g: any): void {
      if (g == null || g.isLeaving) return;
      if (RadioPopup.active != null) RadioPopup.active.dismiss();
      RadioPopup.active = new RadioPopup(g);
      RadioPopup.active.addEventListener('close', RadioPopup.active.onClose);
      g.addChildToOverlay(RadioPopup.active, true);
    }
    constructor(g: any) {
      super('Close');
      this.game = g;
      this.service = service;
      this.box.removeChild(this.textField, true);
      this.closeButton.removeFromParent(true);
      this.closeButton = new Button(() => this.close(), 'Close');
      this.box.addChild(this.closeButton);
      // Replace only this popup's ornate legacy Box image. Keep its content
      // container and inherited close/keyboard lifecycle intact.
      this.box.getChildAt(0).visible = false;
      this.box.getChildAt(0).touchable = false;
      this.bgr.color = 0x000000;
      this.bgr.alpha = 0.1;
      this.drawChrome();
      this.label('Radio', 18, 15, 20, 0xfff1a8);
      this.label('LISTEN TOGETHER', 714, 22, 10, 0x969eaa);
      this.statusLabel = this.scrollingLabel('', 30, 68, 13, 0x8bdcea, 846, 28);
      this.messageLabel = this.scrollingLabel('', 30, 108, 11, 0xb9bec8, 846, 28);
      this.setupButton = this.button(this.setup, 'Set up Radio', 18, 145, 140);
      this.retryButton = this.button(this.retry, 'Check / retry', 168, 145, 124);
      this.button(this.stop, 'Stop Radio', 304, 145, 122);
      this.label('Groups', 18, 185, 14, 0xfff1a8);
      this.groupLabel = this.scrollingLabel('Queue', 274, 185, 13, 0xfff1a8, 326, 22);
      this.requestLabel = this.label('Requests (0)', 620, 185, 13, 0xfff1a8, 262, 22);
      this.requestLabel.visible = false;
      this.peersButton = this.button(this.showPeers, 'Peers (0)', 620, 181, 126);
      this.requestsButton = this.button(this.showRequests, 'Requests (0)', 756, 181, 126);
      this.configureList(this.roomList, 18, 214, 238, 214);
      this.configureList(this.queueList, 274, 214, 608, 302);
      this.queueList.addEventListener(Event.CHANGE, this.selectedQueue);
      this.configureList(this.requestList, 620, 214, 262, 210);
      this.configureList(this.peerList, 620, 214, 262, 210);
      this.peerList.addEventListener(Event.CHANGE, this.selectedPeer);
      this.requestList.addEventListener(Event.CHANGE, this.selectedRequest);
      this.acceptButton = this.button(this.accept, 'Accept', 620, 438, 126);
      this.denyButton = this.button(this.deny, 'Deny', 756, 438, 126);
      this.requestHint = this.scrollingLabel('', 630, 478, 10, 0xa4abb4, 242, 22);
      this.djButton = this.button(this.toggleDJ, 'Give DJ', 620, 438, 126);
      this.kickButton = this.button(this.kickPeer, 'Kick', 756, 438, 126);
      this.leaderButton = this.button(this.promoteLeader, 'Promote to leader', 620, 478, 262);
      this.peerHint = this.label('First DJ takes over on logout.', 630, 509, 10, 0xa4abb4, 242, 18);
      this.roomList.addEventListener(Event.CHANGE, this.selectedRoom);
      this.roomName.set_maxChars(48);
      this.roomName.prompt = 'Group name';
      this.roomPassword.set_maxChars(64);
      this.roomPassword.prompt = 'Group password (optional)';
      this.roomPassword.set_displayAsPassword(true);
      this.query.set_maxChars(240);
      this.query.prompt = 'Song name or YouTube link…';
      this.roomName.addEventListener(FeathersEventType.ENTER, this.enterRoomName);
      this.query.addEventListener(FeathersEventType.ENTER, this.enterQuery);
      this.box.addChild(this.roomName);
      this.box.addChild(this.roomPassword);
      this.box.addChild(this.query);
      this.createButton = this.button(this.create, 'Create', 180, 488, 76);
      this.addButton = this.button(this.add, 'Queue', 779, 530, 103);
      this.button(this.refresh, 'Refresh', 18, 530, 76);
      this.joinButton = this.button(this.join, 'Join', 104, 530, 66);
      this.leaveButton = this.button(this.leave, 'Leave', 180, 530, 76);
      this.timeLabel = this.label('0:00 / 0:00', 274, 576, 11, 0xb9bec8, 125, 22);
      this.seekBar.minimum = 0;
      this.seekBar.maximum = 1;
      this.seekBar.step = 1000;
      this.seekBar.x = 412;
      this.seekBar.y = 572;
      this.seekBar.width = 470;
      this.seekBar.height = 24;
      this.seekBar.addEventListener(FeathersEventType.BEGIN_INTERACTION, this.beginSeek);
      this.seekBar.addEventListener(FeathersEventType.END_INTERACTION, this.endSeek);
      this.seekBar.addEventListener(Event.CHANGE, this.changeSeek);
      this.box.addChild(this.seekBar);
      this.restartButton = this.button(this.restart, 'Restart', 18, 610, 82);
      this.pauseButton = this.button(this.pause, 'Pause', 110, 610, 90);
      this.skipButton = this.button(this.skip, 'Next', 210, 610, 68);
      this.playSelectedButton = this.button(this.playSelected, 'Play selected', 288, 610, 116);
      this.removeSelectedButton = this.button(this.removeSelected, 'Remove', 414, 610, 88);
      this.label('Volume', 578, 617, 11, 0xb9bec8);
      this.volume.minimum = 0;
      this.volume.maximum = 1;
      this.volume.step = 0.01;
      this.volume.x = 638;
      this.volume.y = 610;
      this.volume.width = 244;
      this.volume.height = 24;
      this.volume.addEventListener(Event.CHANGE, this.changeVolume);
      this.box.addChild(this.volume);
      this.shuffleButton = this.button(this.toggleShuffle, 'Shuffle: off', 18, 654, 144);
      this.repeatButton = this.button(this.cycleRepeat, 'Repeat: off', 172, 654, 144);
      this.keepButton = this.button(this.toggleKeep, 'Keep finished songs: off', 326, 654, 246);
      this.label(
        'Repeat all keeps the queue. Volume is just for you.',
        18,
        688,
        10,
        0xa4abb4,
        680,
        18,
      );
      this.label(
        'The leader and DJs control playback. The leader approves listener requests.\n' +
          'Closing this window keeps Radio playing; Leave or Stop restores your usual music.',
        18,
        711,
        10,
        0xa4abb4,
        762,
        38,
      );
      this.label(
        'Browser audio requires a Radio helper. Opening this window does not install or download anything.',
        18,
        755,
        10,
        0x89939f,
        762,
        16,
      );
      this.closeButton.width = 84;
      this.service.open();
      this.poll = setInterval(this.sync, 250);
      this.sync();
    }
    @bound
    private drawChrome(): void {
      let chrome: any = new Sprite();
      chrome.touchable = false;
      RadioPopup.rect(
        chrome,
        0,
        0,
        RadioPopup.PANEL_WIDTH,
        RadioPopup.PANEL_HEIGHT,
        0x000000,
        0.92,
      );
      RadioPopup.border(
        chrome,
        1,
        1,
        RadioPopup.PANEL_WIDTH - 2,
        RadioPopup.PANEL_HEIGHT - 2,
        0x707070,
        0.95,
      );
      RadioPopup.border(
        chrome,
        5,
        5,
        RadioPopup.PANEL_WIDTH - 10,
        RadioPopup.PANEL_HEIGHT - 10,
        0x282828,
        0.8,
      );
      RadioPopup.rect(chrome, 16, 48, RadioPopup.PANEL_WIDTH - 32, 1, 0x505050, 0.85);
      RadioPopup.rect(chrome, 16, 60, 2, 80, 0xe5cc78, 0.85);
      RadioPopup.rect(chrome, 14, 179, 246, 389, 0x080808, 0.18);
      RadioPopup.rect(chrome, 268, 179, 618, 389, 0x080808, 0.18);
      RadioPopup.border(chrome, 14, 179, 246, 389, 0x505050, 0.6);
      RadioPopup.border(chrome, 268, 179, 618, 389, 0x505050, 0.6);
      this.requestDivider = new Quad(1, 322, 0x505050);
      this.requestDivider.x = 610;
      this.requestDivider.y = 191;
      this.requestDivider.alpha = 0.6;
      this.requestDivider.touchable = false;
      chrome.addChild(this.requestDivider);
      this.box.addChildAt(chrome, 0);
    }
    @bound
    private static rect(
      owner: any,
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
      opacity: number,
    ): void {
      let quad: any = new Quad(width, height, color);
      quad.x = x;
      quad.y = y;
      quad.alpha = opacity;
      quad.touchable = false;
      owner.addChild(quad);
    }
    @bound
    private static border(
      owner: any,
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
      opacity: number,
    ): void {
      RadioPopup.rect(owner, x, y, width, 1, color, opacity);
      RadioPopup.rect(owner, x, y + height - 1, width, 1, color, opacity);
      RadioPopup.rect(owner, x, y, 1, height, color, opacity);
      RadioPopup.rect(owner, x + width - 1, y, 1, height, color, opacity);
    }
    @bound
    private label(
      value: string,
      x: number,
      y: number,
      size: number,
      color: number,
      width: number = 0,
      height: number = 0,
    ): any {
      let field: any = new Text();
      field.font = 'Verdana';
      field.size = size;
      field.color = color;
      field.x = x;
      field.y = y;
      if (width > 0) {
        field.wordWrap = true;
        field.width = width;
      }
      if (height > 0) field.height = height;
      field.text = value;
      this.box.addChild(field);
      return field;
    }
    @bound
    private button(callback: any, text: string, x: number, y: number, width: number): any {
      let control: any = new Button(callback, text, 'normal', 12, 'Verdana');
      control.x = x;
      control.y = y;
      control.width = width;
      control.autoEnableAfterClick = true;
      this.box.addChild(control);
      return control;
    }
    @bound
    private scrollingLabel(
      value: string,
      x: number,
      y: number,
      size: number,
      color: number,
      width: number,
      height: number,
    ): any {
      let field: any = new RadioMarqueeTextRenderer();
      field.styleProvider = null;
      field.textFormat = new BitmapFontTextFormat(
        VerdanaBitmapFontRegistry.fontNameForSize(size),
        size,
        color,
        'left',
      );
      field.x = x;
      field.y = y;
      field.width = width;
      field.height = height;
      field.text = value;
      this.box.addChild(field);
      return field;
    }
    @bound
    private configureList(list: any, x: number, y: number, width: number, height: number): void {
      list.x = x;
      list.y = y;
      list.width = width;
      list.height = height;
      list.horizontalScrollPolicy = 'off';
      list.verticalScrollPolicy = 'on';
      list.scrollBarDisplayMode = 'fixed';
      list.hasElasticEdges = false;
      list.itemRendererProperties.labelField = 'label';

      list.dataProvider = new ListCollection([]);
      this.box.addChild(list);
    }
    @bound
    private setup(event: any): void {
      this.service.setup();
      this.sync();
    }
    @bound
    private retry(event: any): void {
      this.service.retry();
      this.sync();
    }
    @bound
    private stop(event: any): void {
      this.service.stop();
      this.sync();
    }
    @bound
    private create(event: any): void {
      this.service.create(this.roomName.text, this.roomPassword.text);
      this.sync();
    }
    @bound
    private join(event: any): void {
      this.service.join(this.roomList.selectedItem, this.roomPassword.text);
      this.sync();
    }
    @bound
    private leave(event: any): void {
      this.service.leave();
      this.sync();
    }
    @bound
    private pause(event: any): void {
      this.service.pauseOrResume();
      this.sync();
    }
    @bound
    private skip(event: any): void {
      this.service.skip();
      this.sync();
    }
    @bound
    private refresh(event: any): void {
      this.service.rooms.refresh();
      this.sync();
    }
    @bound
    private selectedRoom(event: any): void {
      if (!this.syncing) this.sync();
    }
    @bound
    private selectedQueue(event: any): void {
      if (!this.syncing) this.sync();
    }
    @bound
    private selectedPeer(event: any): void {
      if (!this.syncing) this.sync();
    }
    @bound
    private showPeers(event: any): void {
      this.showPeerList = true;
      this.sync();
    }
    @bound
    private showRequests(event: any): void {
      this.showPeerList = false;
      this.sync();
    }
    @bound
    private toggleDJ(event: any): void {
      let peer: any = this.peerList.selectedItem;
      if (peer != null && this.service.rooms.host && peer.role != 'host')
        this.service.setDJ(peer.id, peer.session, peer.role != 'dj');
      this.sync();
    }
    @bound
    private restart(event: any): void {
      this.service.seek(0);
      this.sync();
    }
    @bound
    private playSelected(event: any): void {
      if (this.queueList.selectedItem != null)
        this.service.playTrack(Math.trunc(this.queueList.selectedItem.index));
      this.sync();
    }
    @bound
    private removeSelected(event: any): void {
      if (this.queueList.selectedItem != null)
        this.service.removeTrack(Math.trunc(this.queueList.selectedItem.index));
      this.sync();
    }
    @bound
    private toggleShuffle(event: any): void {
      let state: any = this.service.rooms.state;
      if (state != null)
        this.service.setQueueModes(!state.shuffle, state.repeatMode, state.keepFinished);
      this.sync();
    }
    @bound
    private cycleRepeat(event: any): void {
      let state: any = this.service.rooms.state;
      if (state != null)
        this.service.setQueueModes(
          state.shuffle,
          state.repeatMode == 'off' ? 'one' : state.repeatMode == 'one' ? 'all' : 'off',
          state.keepFinished,
        );
      this.sync();
    }
    @bound
    private toggleKeep(event: any): void {
      let state: any = this.service.rooms.state;
      if (state != null)
        this.service.setQueueModes(
          state.shuffle,
          state.keepFinished && state.repeatMode == 'all' ? 'off' : state.repeatMode,
          !state.keepFinished,
        );
      this.sync();
    }
    @bound
    private beginSeek(event: any): void {
      if (!this.canControl()) return;
      let state: any = this.service.rooms.state;
      if (state == null || state.queue.length == 0) return;
      this.seeking = true;
      this.seekChanged = false;
      this.seekRoom = state.roomId;
      this.seekPlayback = state.playbackRevision;
    }
    @bound
    private changeSeek(event: any): void {
      if (this.syncing || !this.canControl()) return;
      if (this.seeking) {
        this.seekChanged = true;
        this.updateTimeLabel(this.seekBar.value, this.seekBar.maximum);
      } else this.service.seek(this.seekBar.value);
    }
    @bound
    private endSeek(event: any): void {
      if (!this.seeking) return;
      this.seeking = false;
      let state: any = this.service == null ? null : this.service.rooms.state;
      if (
        this.seekChanged &&
        this.canControl() &&
        state != null &&
        state.roomId == this.seekRoom &&
        state.playbackRevision == this.seekPlayback
      )
        this.service.seek(this.seekBar.value);
      this.sync();
    }
    @bound
    private canControl(): boolean {
      return (
        !this.disposed &&
        this.service != null &&
        this.service.available &&
        this.service.rooms.controller
      );
    }
    @bound
    private static clockText(ms: number): string {
      let seconds: number = isFinite(ms) ? Math.trunc(Math.max(0, ms) / 1000) : 0;
      return Math.trunc(seconds / 60) + ':' + (seconds % 60 < 10 ? '0' : '') + (seconds % 60);
    }
    @bound
    private updateTimeLabel(position: number, duration: number): void {
      this.timeLabel.text = RadioPopup.clockText(position) + ' / ' + RadioPopup.clockText(duration);
    }
    @bound
    private selectedRequest(event: any): void {
      if (!this.syncing) this.sync();
    }
    @bound
    private accept(event: any): void {
      if (
        this.disposed ||
        this.service == null ||
        !this.service.available ||
        !this.service.rooms.host ||
        this.requestList.selectedItem == null
      )
        return;
      this.service.acceptRequest(this.requestList.selectedItem.id);
      this.sync();
    }
    @bound
    private deny(event: any): void {
      if (
        this.disposed ||
        this.service == null ||
        !this.service.available ||
        !this.service.rooms.host ||
        this.requestList.selectedItem == null
      )
        return;
      this.service.denyRequest(this.requestList.selectedItem.id);
      this.sync();
    }
    @bound
    private enterRoomName(event: any): void {
      if (
        !this.disposed &&
        this.service != null &&
        this.service.available &&
        !this.service.rooms.joined
      )
        this.create(null);
    }
    @bound
    private enterQuery(event: any): void {
      if (
        !this.disposed &&
        this.service != null &&
        this.service.available &&
        this.service.rooms.joined
      )
        this.add(null);
    }
    @bound
    private add(event: any): void {
      if (
        this.disposed ||
        this.service == null ||
        !this.service.available ||
        !this.service.rooms.joined
      )
        return;
      if (this.query.text == null || this.query.text.replace(/^\s+|\s+$/g, '').length == 0) return;
      this.service.add(this.query.text);
      this.query.text = '';
      this.sync();
    }
    @bound
    private changeVolume(event: any): void {
      if (!this.disposed && !this.syncing && SceneBase.settings != null)
        SceneBase.settings.musicVolume = this.volume.value;
    }
    @bound
    private promoteLeader(event: any): void {
      let target: any = this.peerList.selectedItem;
      if (
        this.disposed ||
        this.service == null ||
        !this.service.rooms.host ||
        !this.service.rooms.synchronized ||
        this.service.rooms.transferringLeadership ||
        target == null ||
        target.role == 'host'
      )
        return;
      this.service.promoteLeader(target.id, target.session);
      this.sync();
    }
    @bound
    private kickPeer(event: any): void {
      let target: any = this.peerList.selectedItem;
      if (
        this.disposed ||
        this.service == null ||
        !this.service.rooms.host ||
        !this.service.rooms.synchronized ||
        this.service.rooms.transferringLeadership ||
        target == null ||
        target.role == 'host'
      )
        return;
      this.service.kickPeer(target.id, target.session);
      this.sync();
    }
    @bound
    private static plain(value: any): string {
      return String(value).replace(/[<>\x00-\x1f\x7f]/g, ' ');
    }
    @bound
    private sync(event: any = null): void {
      if (this.disposed || this.syncing || this.service == null) return;
      this.syncing = true;
      try {
        this.syncControls();
      } finally {
        this.syncing = false;
      }
    }
    @bound
    private syncControls(): void {
      this.statusLabel.text = RadioPopup.plain(this.service.status);
      this.messageLabel.text = RadioPopup.plain(this.service.message);
      let entries: any[] = this.service.rooms.rooms;
      let fingerprint: string = JSON.stringify(entries);
      if (fingerprint != this.directoryKey) {
        this.directoryKey = fingerprint;
        let selected: any = this.roomList.selectedItem;
        let selectedId: string = selected == null ? null : selected.roomId;
        let selectedHost: string = selected == null ? null : selected.hostId;
        let selectedIndex: number = -1;
        let roomRows: any[] = [];
        for (var i: number = 0; i < entries.length; i++) {
          roomRows.push({
            roomId: entries[i].roomId,
            hostId: entries[i].hostId,
            label:
              (entries[i].passwordProtected ? '[Locked] ' : '') +
              RadioPopup.plain(entries[i].name) +
              ' • ' +
              RadioPopup.plain(entries[i].hostName),
          });
          if (entries[i].roomId == selectedId && entries[i].hostId == selectedHost)
            selectedIndex = i;
        }
        this.roomList.dataProvider = new ListCollection(roomRows);
        this.roomList.selectedIndex = selectedIndex;
      }
      let state: any = this.service.rooms.state;
      entries = state == null ? [] : state.queue;
      fingerprint =
        JSON.stringify(entries) +
        ':' +
        (state == null ? '' : state.roomId + ':' + state.currentIndex + ':' + state.playedMask);
      if (fingerprint != this.queueKey) {
        this.queueKey = fingerprint;
        let queueRows: any[] = [];
        for (i = 0; i < entries.length; i++)
          queueRows.push({
            index: i,
            label:
              (i == Math.trunc(state.currentIndex)
                ? 'Now: '
                : (Math.trunc(state.playedMask) & (1 << i)) != 0
                  ? 'Played: '
                  : i + 1 + '. ') + RadioPopup.plain(entries[i].title),
          });
        this.queueList.dataProvider = new ListCollection(queueRows);
      }
      this.groupLabel.text =
        state == null
          ? 'Queue'
          : RadioPopup.plain(state.name) +
            (this.service.rooms.host ? ' • leader' : this.service.rooms.controller ? ' • DJ' : '');
      this.setupButton.enabled = this.service.canSetup && !this.service.available;
      this.retryButton.enabled = !this.service.busy;
      this.createButton.enabled = this.service.available && !this.service.rooms.joined;
      this.roomName.isEnabled = this.service.available && !this.service.rooms.joined;
      this.roomPassword.isEnabled = !this.service.rooms.joined;
      if (this.service.rooms.joined && this.service.rooms.synchronized) this.roomPassword.text = '';
      this.joinButton.enabled =
        this.service.available && this.roomList.selectedItem != null && !this.service.rooms.joined;
      this.leaveButton.enabled = this.service.rooms.joined;
      // Let users paste/edit before setup or joining; only submission needs a room.
      this.addButton.enabled = this.service.available && this.service.rooms.joined;
      this.addButton.text =
        this.service.rooms.joined && !this.service.rooms.controller ? 'Request' : 'Queue';
      let controls: boolean = this.canControl();
      this.pauseButton.enabled =
        this.skipButton.enabled =
        this.restartButton.enabled =
          controls && entries.length > 0;
      this.playSelectedButton.enabled = this.removeSelectedButton.enabled =
        controls && this.queueList.selectedItem != null;
      this.shuffleButton.enabled = this.repeatButton.enabled = this.keepButton.enabled = controls;
      this.shuffleButton.text = 'Shuffle: ' + (state != null && state.shuffle ? 'on' : 'off');
      this.repeatButton.text = 'Repeat: ' + (state == null ? 'off' : state.repeatMode);
      this.keepButton.text =
        'Keep finished songs: ' + (state != null && state.keepFinished ? 'on' : 'off');
      this.pauseButton.text = state != null && !state.playing ? 'Resume' : 'Pause';
      this.seekBar.isEnabled = controls && entries.length > 0;
      if (!this.seeking) {
        let duration: number =
          entries.length == 0 ? 0 : Number(entries[Math.trunc(state.currentIndex)].durationMs);
        this.seekBar.maximum = Math.max(1, duration);
        this.seekBar.value = this.service.positionMs;
        this.updateTimeLabel(this.service.positionMs, duration);
      }
      this.volume.value = this.service.volume;
      this.syncRequests();
      this.syncPeers();
    }
    @bound
    private syncRequests(): void {
      let host: boolean = this.service.rooms.host;
      let entries: any[] = host ? this.service.pendingRequests : [];
      let fingerprint: string = JSON.stringify(entries);
      if (fingerprint != this.requestKey) {
        this.requestKey = fingerprint;
        let selected: any = this.requestList.selectedItem;
        let selectedId: string = selected == null ? null : selected.id;
        let selectedIndex: number = -1;
        let rows: any[] = [];
        for (var i: number = 0; i < entries.length; i++) {
          let queryText: string = RadioPopup.plain(entries[i].query);
          rows.push({
            id: entries[i].id,
            query: queryText,
            label: RadioPopup.plain(entries[i].requester) + ' • ' + queryText,
          });
          if (entries[i].id == selectedId) selectedIndex = i;
        }
        this.requestList.dataProvider = new ListCollection(rows);
        this.requestList.selectedIndex = selectedIndex;
      }
      this.requestLabel.text = 'Requests (' + entries.length + ')';
      this.requestsButton.text = this.requestLabel.text;
      this.requestHint.text =
        this.requestList.selectedItem != null
          ? this.requestList.selectedItem.query
          : entries.length == 0
            ? 'Songs requested by listeners appear here.'
            : 'Select a request, then accept it into the queue or deny it.';
      this.requestList.visible = this.requestHint.visible = host && !this.showPeerList;
      this.acceptButton.visible = this.denyButton.visible = host && !this.showPeerList;
      this.requestDivider.visible = this.service.rooms.joined;
      this.acceptButton.enabled = this.denyButton.enabled =
        host && this.service.available && this.requestList.selectedItem != null;
      this.queueList.width = this.groupLabel.width = this.service.rooms.joined ? 326 : 608;
    }
    @bound
    private syncPeers(): void {
      let entries: any[] = this.service.rooms.peers;
      let fingerprint: string = JSON.stringify(entries);
      if (fingerprint != this.peerKey) {
        this.peerKey = fingerprint;
        let selected: any = this.peerList.selectedItem;
        let selectedIndex: number = -1;
        let rows: any[] = [];
        for (var i: number = 0; i < entries.length; i++) {
          let peer: any = entries[i];
          rows.push({
            id: peer.id,
            session: peer.session,
            role: peer.role,
            label:
              (peer.role == 'host' ? 'Leader' : peer.role == 'dj' ? 'DJ' : 'Listener') +
              ' • ' +
              RadioPopup.plain(peer.name),
          });
          if (selected != null && selected.id == peer.id && selected.session == peer.session)
            selectedIndex = i;
        }
        this.peerList.dataProvider = new ListCollection(rows);
        this.peerList.selectedIndex = selectedIndex;
      }
      let showing: boolean =
        this.service.rooms.joined && (!this.service.rooms.host || this.showPeerList);
      this.peersButton.text = 'Peers (' + entries.length + ')';
      this.peersButton.visible = this.service.rooms.joined;
      this.requestsButton.visible = this.service.rooms.host;
      this.peersButton.enabled = this.service.rooms.host && !this.showPeerList;
      this.requestsButton.enabled = this.showPeerList;
      this.peerList.visible = this.peerHint.visible = showing;
      this.djButton.visible = showing && this.service.rooms.host;
      this.leaderButton.visible = this.djButton.visible;
      this.kickButton.visible = this.djButton.visible;
      let target: any = this.peerList.selectedItem;
      let canManage: boolean =
        this.service.rooms.host &&
        this.service.rooms.synchronized &&
        !this.service.rooms.transferringLeadership &&
        target != null &&
        target.role != 'host';
      this.djButton.enabled = this.leaderButton.enabled = this.kickButton.enabled = canManage;
      this.djButton.text = target != null && target.role == 'dj' ? 'Remove DJ' : 'Give DJ';
    }
    @bound
    protected redraw(event: any = null): void {
      if (this.stage == null || this.disposed) return;
      this.box.scaleX = this.box.scaleY = 1;
      this.box.width = RadioPopup.PANEL_WIDTH;
      this.box.height = RadioPopup.PANEL_HEIGHT;
      let scale: number = Math.min(
        1,
        (this.stage.stageWidth - 24) / RadioPopup.PANEL_WIDTH,
        (this.stage.stageHeight - 24) / RadioPopup.PANEL_HEIGHT,
      );
      this.box.scaleX = this.box.scaleY = Math.max(0.01, scale);
      this.box.x = Math.round(
        (this.stage.stageWidth - RadioPopup.PANEL_WIDTH * this.box.scaleX) / 2,
      );
      this.box.y = Math.round(
        (this.stage.stageHeight - RadioPopup.PANEL_HEIGHT * this.box.scaleY) / 2,
      );
      this.closeButton.x = RadioPopup.PANEL_WIDTH - this.closeButton.width - 18;
      this.closeButton.y = 740;
      this.bgr.width = this.stage.stageWidth;
      this.bgr.height = this.stage.stageHeight;
    }
    @bound
    protected keyDown(event: any): void {
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
      if (this.parent != null && this.game != null) this.game.removeChildFromOverlay(this, true);
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
      this.roomList.removeEventListener(Event.CHANGE, this.selectedRoom);
      this.queueList.removeEventListener(Event.CHANGE, this.selectedQueue);
      this.requestList.removeEventListener(Event.CHANGE, this.selectedRequest);
      this.peerList.removeEventListener(Event.CHANGE, this.selectedPeer);
      this.volume.removeEventListener(Event.CHANGE, this.changeVolume);
      this.seekBar.removeEventListener(FeathersEventType.BEGIN_INTERACTION, this.beginSeek);
      this.seekBar.removeEventListener(FeathersEventType.END_INTERACTION, this.endSeek);
      this.seekBar.removeEventListener(Event.CHANGE, this.changeSeek);
      this.roomName.removeEventListener(FeathersEventType.ENTER, this.enterRoomName);
      this.query.removeEventListener(FeathersEventType.ENTER, this.enterQuery);
      if (RadioPopup.active === this) RadioPopup.active = null;

      this.game = null;
      super.dispose();
    }
  }

  return RadioPopup;
}
