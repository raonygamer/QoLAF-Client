// Source port of core/hud/components/dialogs/PlayerInspectPopup.as.
import { artifactFitness } from '../artifacts/Fitness';
import { read } from '../api/Types';
import { bound, type Resolve } from '../runtime/HaxeInterop';
export function createPlayerInspectPopup(resolve: Resolve): any {
  const PopupMessage: any = resolve('core.hud.components.dialogs.PopupMessage');
  type PopupMessage = any;
  const PlayerInspectCard: any = resolve('qolaf.inspect.PlayerInspectCard');
  type PlayerInspectCard = any;
  const Quad: any = resolve('starling.display.Quad');
  type Quad = any;
  const PlayerInspectProjection: any = resolve('af.PlayerInspectProjection');
  type PlayerInspectProjection = any;
  const PlayerInspectViewModel: any = resolve('af.PlayerInspectViewModel');
  type PlayerInspectViewModel = any;
  const Artifact: any = resolve('core.artifact.Artifact');
  type Artifact = any;
  const ArtifactStat: any = resolve('core.artifact.ArtifactStat');
  type ArtifactStat = any;
  type Friend = any;
  const PressButton = resolve('core.hud.components.ui.PressButton');
  const Verdana = resolve('core.text.VerdanaBitmapFontRegistry');
  const Button: any = resolve('core.hud.components.Button');
  type Button = any;
  const Text: any = resolve('core.hud.components.Text');
  type Text = any;
  const ChatArtifactToken: any = resolve('core.hud.components.chat.ChatArtifactToken');
  type ChatArtifactToken = any;
  const MessageLog: any = resolve('core.hud.components.chat.MessageLog');
  type MessageLog = any;
  const CargoReadQueue: any = resolve('core.hud.components.cargo.CargoReadQueue');
  type CargoReadQueue = any;
  const Player: any = resolve('core.player.Player');
  type Player = any;
  const Game: any = resolve('core.scene.Game');
  type Game = any;
  const DataLocator: any = resolve('data.DataLocator');
  type DataLocator = any;
  const ScrollContainer: any = resolve('feathers.controls.ScrollContainer');
  type ScrollContainer = any;
  const TabBar: any = resolve('feathers.controls.TabBar');
  type TabBar = any;
  const ListCollection: any = resolve('feathers.data.ListCollection');
  type ListCollection = any;
  const TimerEvent: any = resolve('openfl.events.TimerEvent');
  type TimerEvent = any;
  const System: any = resolve('openfl.system.System');
  type System = any;
  const Timer: any = resolve('openfl.utils.Timer');
  type Timer = any;
  const Localize: any = resolve('generics.Localize');
  type Localize = any;
  type DatabaseObject = any;
  type Message = any;
  type PlayerIOError = any;
  const Starling: any = resolve('starling.core.Starling');
  type Starling = any;
  const Sprite: any = resolve('starling.display.Sprite');
  type Sprite = any;
  const Event: any = resolve('starling.events.Event');
  type Event = any;
  type KeyboardEvent = any;
  type TouchEvent = any;
  /** Read-only private-build inspector. Never constructs a gameplay ship. */

  class PlayerInspectPopup extends PopupMessage {
    private static PAGE_SIZE: number = 8;
    private static active: PlayerInspectPopup | null = null;
    private g: Game = null as any;
    private stopped: boolean = false;
    private record: any = null as any;
    private playerId: string = null as any;
    private snapshotPlayer: Player = null as any;
    private sections: any[] = [];
    private artifacts: any[] = [];
    private artifactStatus: string = 'Loading artifacts...';
    private tabs: TabBar = new TabBar();
    private scroll: ScrollContainer = new ScrollContainer();
    private content: Sprite = new Sprite();
    private heading: Text = new Text();
    private pageLabel: Text = new Text();
    private previous: Button = null as any;
    private next: Button = null as any;
    private copyId: Button = null as any;
    private preview: PlayerInspectCard = null as any;
    private fleetCards: any[] = [];
    private weaponCards: any[] = [];
    private setCards: any[] = [];
    private cargoCards: any[] = [];
    private cargoStatus: string = 'Loading cargo...';
    private artifactById: any = {};
    private selectedFleet: any = null as any;
    private selectedArtifact: Artifact = null as any;
    private artifactReturnPage: number = 0;
    private snapshotIsLive: boolean = false;
    private vitals: any[] = [];
    private rebuilding: boolean = false;
    private page: number = 0;
    private panelWidth: number = 880;
    private panelHeight: number = 640;
    private timeout: Timer = new Timer(15000, 1);
    @bound
    public static open(game: Game, argument: string): void {
      argument = argument == null ? '' : argument.replace(/^\s+|\s+$/g, '');
      if (argument.length == 0) {
        MessageLog.write('Usage: /inspect <@PlayerName|player_id>', 'error');
        return;
      }
      if (PlayerInspectPopup.active != null) PlayerInspectPopup.active.dismiss();
      var popup: PlayerInspectPopup = new PlayerInspectPopup(game);
      PlayerInspectPopup.active = popup;
      popup.addEventListener('close', popup.onClose);
      game.addChildToOverlay(popup, true);
      popup.resolve(argument);
    }
    static isOpen(): boolean {
      return !!PlayerInspectPopup.active;
    }
    static dismissActive(): void {
      PlayerInspectPopup.active?.dismiss();
    }
    private observedStage: any = null;
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
    constructor(game: Game) {
      super('Close');
      this.g = game;
      this.closeButton.removeFromParent(true);
      this.closeButton = new Button(() => this.close(), 'Close');
      this.box.addChild(this.closeButton);
      this.box.removeChild(this.textField, true);
      this.heading.x = 128;
      this.heading.y = 12;
      this.heading.font = 'Verdana';
      this.heading.size = 15;
      this.heading.wordWrap = true;
      this.heading.width = this.panelWidth - 144;
      this.heading.text = 'Player inspection\nLoading...';
      this.box.addChild(this.heading);
      this.tabs.styleNameList.add('settings_tabs');
      this.tabs.y = 105;
      this.tabs.width = this.panelWidth;
      this.tabs.addEventListener(Event.CHANGE, this.onTabChanged);
      this.box.addChild(this.tabs);
      this.scroll.y = 140;
      this.scroll.horizontalScrollPolicy = 'off';
      this.scroll.addChild(this.content);
      this.box.addChild(this.scroll);
      this.previous = new Button(this.previousPage, '<');
      this.next = new Button(this.nextPage, '>');
      this.box.addChild(this.previous);
      this.box.addChild(this.next);
      this.pageLabel.size = 12;
      this.box.addChild(this.pageLabel);
      this.copyId = new Button(this.copyPlayerId, 'Copy player ID');
      this.copyId.enabled = false;
      this.box.addChild(this.copyId);
      this.timeout.addEventListener(TimerEvent.TIMER_COMPLETE, this.onTimeout);
      this.timeout.start();
    }
    @bound
    private isCurrent(): boolean {
      return !this.stopped && this.g != null && !this.g.isLeaving && Game.instance === this.g;
    }
    @bound
    private resolve(argument: string): void {
      argument = PlayerInspectPopup.unquote(argument);
      if (argument.charAt(0) != '@') {
        this.loadPlayer(PlayerInspectPopup.unquote(argument));
        return;
      }
      var name: string = PlayerInspectPopup.unquote(argument.substr(1)).toLowerCase();
      var id: string = this.idForName(name);
      if (id.length > 0) {
        this.loadPlayer(id);
        return;
      }
      this.g.friendManager.updateOnlineFriends((): void => {
        if (!this.isCurrent() || this.record != null) return;
        var resolved: string = this.idForName(name);
        if (resolved.length > 0) this.loadPlayer(resolved);
        else
          this.fail(
            'Player name not found in this room or online friends. Use their copied player ID.',
          );
      });
    }
    @bound
    private idForName(name: string): string {
      for (var player of Object.values<any>(read(this.g.playerManager, 'players') ?? [])) {
        if (player.name != null && player.name.toLowerCase() == name) return player.id;
      }
      for (var friend of Object.values<any>(Player.onlineFriends)) {
        if (friend.name != null && friend.name.toLowerCase() == name) {
          return friend.playerId != null && friend.playerId.length > 0
            ? friend.playerId
            : friend.id;
        }
      }
      return '';
    }
    @bound
    private loadPlayer(id: string): void {
      this.playerId = id;
      try {
        this.g.client.bigDB.load(
          'PlayerObjects',
          id,
          (value: DatabaseObject): void => {
            if (!this.isCurrent()) return;
            if (value == null || value.key != this.playerId) {
              this.fail('Player not found, or this account cannot read their saved data.');
              return;
            }
            this.record = value;
            this.snapshotPlayer = this.findLivePlayer();
            this.snapshotIsLive = this.snapshotPlayer != null;
            if (this.snapshotPlayer != null && this.snapshotPlayer.ship != null) {
              this.vitals = [
                {
                  name: 'Health',
                  value: this.snapshotPlayer.ship.hp,
                  max: read(this.snapshotPlayer.ship, 'hpMax'),
                  color: 0x67bd83,
                },
                {
                  name: 'Shield',
                  value: this.snapshotPlayer.ship.shieldHp,
                  max: read(this.snapshotPlayer.ship, 'shieldHpMax'),
                  color: 0x70b4e4,
                },
              ];
            }
            this.sections = PlayerInspectProjection.sections(this.record, this.snapshotPlayer);
            this.sections.push({ label: 'Artifacts', rows: [] });
            var order: any[] = [
              'Fleet',
              'Weapons',
              'Stats',
              'Artifact sets',
              'Artifacts',
              'Resources',
              'Overview',
            ];
            this.sections.sort((a: any, b: any): number => {
              return order.indexOf(a.label) - order.indexOf(b.label);
            });
            this.fleetCards = PlayerInspectViewModel.fleet(this.record, this.snapshotPlayer);
            this.weaponCards = PlayerInspectViewModel.weapons(this.record, this.snapshotPlayer);
            this.setCards = PlayerInspectViewModel.artifactSets(this.record, this.snapshotPlayer);
            var entries: any[] = [];
            for (const section of this.sections) entries.push({ label: section.label });
            this.tabs.dataProvider = new ListCollection(entries);
            this.heading.text =
              (value.name == null ? 'Unknown player' : String(value.name)) +
              '  •  Level ' +
              (value.level == null ? 'unknown' : value.level) +
              '\nRead-only player inspection\n' +
              (this.snapshotIsLive
                ? 'Saved account + room snapshot'
                : 'Saved account • player not in this room');
            this.copyId.enabled = true;
            this.updatePreview();
            // Everything presented below is now detached data, never a
            // live/pooled Player reference that can change underneath us.
            this.snapshotPlayer = null;
            this.tabs.selectedIndex = 0;
            this.redraw();
            this.loadArtifacts();
            this.loadCargo();
          },
          (error: PlayerIOError): void => {
            if (this.isCurrent())
              this.fail("Unable to read this player's saved data (" + error.errorID + ').');
          },
        );
      } catch (error: any) {
        this.fail('Unable to start player lookup.');
      }
    }
    @bound
    private findLivePlayer(): Player {
      for (var player of Object.values<any>(read(this.g.playerManager, 'players') ?? [])) {
        if (player.id == this.playerId) return player;
      }
      return null;
    }
    @bound
    private loadArtifacts(): void {
      this.g.client.bigDB.loadRange(
        'Artifacts',
        'ByPlayer',
        [this.playerId],
        null,
        null,
        1000,
        (values: any[]): void => {
          if (!this.isCurrent()) return;
          this.timeout.stop();
          this.artifacts = [];
          this.artifactById = {};
          if (values == null) {
            this.artifactStatus = 'Artifact data unavailable: empty database response.';
            if (this.currentSection() == 'Artifacts' || this.currentSection() == 'Artifact sets')
              this.showPage();
            return;
          }
          var skipped: number = 0;
          for (var value of Object.values<any>(values)) {
            if (value != null && value.player == this.playerId) {
              try {
                var artifact: Artifact = new Artifact(value);
                this.artifacts.push(artifact);
                this.artifactById['$' + artifact.id] = artifact;
              } catch (error: any) {
                skipped++;
              }
            }
          }
          this.artifacts.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
          this.artifactStatus =
            this.artifacts.length == 0
              ? 'No artifacts in this saved collection.'
              : values.length >= 1000
                ? 'Showing the first 1,000 saved artifacts.'
                : '';
          if (skipped > 0)
            this.artifactStatus = 'Some artifact records could not be displayed (' + skipped + ').';
          if (this.currentSection() == 'Artifacts' || this.currentSection() == 'Artifact sets')
            this.showPage();
        },
        (error: PlayerIOError): void => {
          if (!this.isCurrent()) return;
          this.timeout.stop();
          this.artifactStatus =
            'Artifacts unavailable: database read failed (' + error.errorID + ').';
          if (this.currentSection() == 'Artifacts' || this.currentSection() == 'Artifact sets')
            this.showPage();
        },
      );
    }
    @bound
    private loadCargo(): void {
      // Same read-only request used by the cargo panel; the server remains
      // responsible for which inventories this account is allowed to read.
      try {
        CargoReadQueue.read(
          this.g,
          this.playerId,
          (message: Message): void => {
            if (!this.isCurrent() || read(message, 'length', -1) % 4 != 0) return;
            this.cargoCards = [];
            this.cargoStatus =
              read(message, 'length', -1) == 0
                ? 'No cargo returned by the server.'
                : 'Cargo snapshot returned by the server';
            for (var i: number = 0; i + 3 < read(message, 'length', -1); i += 4) {
              var table: string = message.getString(i);
              var key: string = message.getString(i + 1);
              var entries: any = DataLocator.getService().loadTable(table);
              var item: any = entries != null ? entries[key] : null;
              this.cargoCards.push({
                name: item != null && item.name != null ? String(item.name) : 'Unknown resource',
                bitmap: item != null && item.bitmap != null ? String(item.bitmap) : '',
                amount: message.getInt(i + 3),
              });
            }
            if (this.currentSection() == 'Resources') this.showPage();
          },
          (reason: string): void => {
            if (!this.isCurrent()) return;
            this.cargoStatus = 'Cargo unavailable: ' + reason;
            if (this.currentSection() == 'Resources') this.showPage();
          },
        );
        if (this.g.me != null && this.playerId == this.g.me.id) {
          this.g.rpc('getFluxAmount', (message: Message): void => {
            if (!this.isCurrent() || read(message, 'length', -1) == 0) return;
            this.resourceRows().push('Current Flux (server): ' + message.getInt(0));
            if (this.currentSection() == 'Resources') this.showPage();
          });
        }
      } catch (error: any) {
        this.cargoStatus = 'Cargo unavailable; saved resource fields are shown below.';
      }
    }
    @bound
    private resourceRows(): any[] {
      for (var section of Object.values<any>(this.sections)) {
        if (section.label == 'Resources') return section.rows;
      }
      return [];
    }
    @bound
    private currentSection(): string {
      return this.tabs.selectedIndex >= 0 && this.tabs.selectedIndex < this.sections.length
        ? String(this.sections[this.tabs.selectedIndex].label)
        : '';
    }
    @bound
    private updatePreview(): void {
      if (this.preview != null) this.preview.removeFromParent(true);
      for (var ship of Object.values<any>(this.fleetCards)) {
        if (!ship.active) continue;
        this.preview = new PlayerInspectCard(this.g, 108, 86);
        this.preview.addShip(ship.bitmap, ship.paint, 6, 6, 96, 74);
        this.preview.y = 8;
        this.preview.touchable = false;
        this.box.addChild(this.preview);
        return;
      }
    }
    @bound
    private onTabChanged(event: Event): void {
      this.page = 0;
      this.selectedFleet = null;
      this.selectedArtifact = null;
      this.showPage();
    }
    @bound
    private previousPage(event: TouchEvent): void {
      this.page--;
      this.showPage();
    }
    @bound
    private nextPage(event: TouchEvent): void {
      this.page++;
      this.showPage();
    }
    @bound
    private copyPlayerId(event: TouchEvent): void {
      if (this.playerId != null) System.setClipboard(this.playerId);
    }
    @bound
    private pageRows(): any[] {
      if (this.selectedArtifact != null) return [this.selectedArtifact];
      switch (this.currentSection()) {
        case 'Fleet':
          return this.selectedFleet == null
            ? this.fleetCards
            : this.selectedFleet.weapons.concat(this.selectedFleet.builtins);
        case 'Weapons':
          return this.weaponCards;
        case 'Artifact sets':
          return this.setCards;
        case 'Artifacts':
          return this.artifacts;
        case 'Resources':
          return this.cargoCards.concat(this.resourceRows());
      }
      return this.sections[this.tabs.selectedIndex].rows;
    }
    @bound
    private showPage(): void {
      if (
        this.stopped ||
        this.rebuilding ||
        this.tabs.selectedIndex < 0 ||
        this.sections.length == 0
      )
        return;
      this.rebuilding = true;
      try {
        this.content.removeChildren(0, -1, true);
        var rows: any[] = this.pageRows();
        // One set per page bounds nested artifact tiles; other tabs use eight
        // cards, including both owned weapons and default upgrades in details.
        var pageSize: number =
          this.currentSection() == 'Artifact sets' ? 1 : PlayerInspectPopup.PAGE_SIZE;
        var count: number = Math.max(1, Math.ceil(rows.length / pageSize));
        this.page = Math.max(0, Math.min(this.page, count - 1));
        this.previous.enabled = this.page > 0;
        this.next.enabled = this.page < count - 1;
        this.pageLabel.text = 'Page ' + (this.page + 1) + ' / ' + count;
        var y: number = 8;
        var start: number = this.page * pageSize;
        var end: number = Math.min(rows.length, (this.page + 1) * pageSize);
        if (this.selectedArtifact != null) {
          y = this.addBack('< Back to ' + this.currentSection().toLowerCase(), y, (): void => {
            this.selectedArtifact = null;
            this.page = this.artifactReturnPage;
            this.showPage();
          });
          var detail: PlayerInspectCard = this.artifactCard(
            this.selectedArtifact,
            this.viewWidth(),
            true,
          );
          detail.x = 8;
          detail.y = y;
          this.content.addChild(detail);
        } else {
          switch (this.currentSection()) {
            case 'Fleet':
              if (this.selectedFleet != null) {
                y = this.addBack('< Back to fleet', y, (): void => {
                  this.selectedFleet = null;
                  this.page = 0;
                  this.showPage();
                });
                y = this.addShipDetails(this.selectedFleet, y);
                y = this.addRow(
                  "<font color='#ffbd6a'>Owned weapons &amp; built-in upgrades</font>",
                  y,
                );
                y = this.addRow(
                  'Nominal DPS uses room stats and matches weapon tooltips, not measured combat damage.',
                  y,
                );
                y = this.grid(rows, start, end, y, this.makeWeaponCard);
                if (rows.length == 0)
                  y = this.addRow('No owned weapon data available for this ship.', y);
              } else {
                y = this.addRow(
                  'Select a ship to inspect its loadout. Browsing never equips or purchases anything.',
                  y,
                );
                y = this.grid(rows, start, end, y, this.makeFleetCard);
                if (rows.length == 0)
                  y = this.addRow('No fleet data available in this saved account.', y);
              }
              break;
            case 'Weapons':
              y = this.addRow('Active ship • equipped weapons, hotbar assignments and upgrades', y);
              y = this.addRow(
                'Nominal DPS uses room stats and matches weapon tooltips, not measured combat damage.',
                y,
              );
              y = this.grid(rows, start, end, y, this.makeWeaponCard);
              if (rows.length == 0) y = this.addRow('Owned weapon data unavailable.', y);
              break;
            case 'Artifacts':
              y = this.addRow(
                PlayerInspectPopup.escape(
                  this.artifactStatus.length > 0
                    ? this.artifactStatus
                    : 'Select an artifact to view its full stats.',
                ),
                y,
              );
              y = this.grid(rows, start, end, y, this.makeArtifactCard);
              break;
            case 'Artifact sets':
              y = this.addRow('Saved artifact loadouts • select an artifact to view its stats', y);
              if (this.artifactStatus.length > 0)
                y = this.addRow(PlayerInspectPopup.escape(this.artifactStatus), y);
              for (var i: number = start; i < end; i++) y = this.addArtifactSet(rows[i], y);
              if (rows.length == 0)
                y = this.addRow('Artifact sets are unavailable in this account snapshot.', y);
              break;
            case 'Resources':
              y = this.addRow(PlayerInspectPopup.escape(this.cargoStatus), y);
              y = this.grid(rows, start, end, y, this.makeResourceCard);
              break;
            case 'Stats':
              if (this.page == 0 && this.vitals.length > 0) y = this.addVitals(y);
              for (i = start; i < end; i++) y = this.addReadableStat(String(rows[i]), y);
              break;
            default:
              for (i = start; i < end; i++) y = this.addReadableStat(String(rows[i]), y);
          }
        }
        this.scroll.arrange();
        this.scroll.verticalScrollPosition = 0;
        // Rebuilt cards change the native painter's batch offsets. Invalidate
        // cached sibling ranges too so headers and footer controls stay visible.
        this.invalidateDisplayTree(this.box);
      } finally {
        this.rebuilding = false;
      }
    }
    @bound
    private viewWidth(): number {
      return Math.max(180, this.panelWidth - 36);
    }
    @bound
    private addBack(label: string, y: number, action: Function): number {
      var button: Button = new Button((event: TouchEvent): void => {
        action();
      }, label);
      button.x = 8;
      button.y = y;
      this.content.addChild(button);
      return y + button.height + 12;
    }
    @bound
    private grid(rows: any[], start: number, end: number, y: number, factory: Function): number {
      var columns: number = this.viewWidth() >= 520 ? 2 : 1;
      var width: number = (this.viewWidth() - (columns - 1) * 12) / columns;
      var rowHeight: number = 0;
      for (var i: number = start; i < end; i++) {
        var column: number = (i - start) % columns;
        var card: PlayerInspectCard = factory(rows[i], width);
        card.x = 8 + column * (width + 12);
        card.y = y;
        this.content.addChild(card);
        rowHeight = Math.max(rowHeight, card.fitHeight());
        if (column == columns - 1 || i == end - 1) {
          y += rowHeight + 12;
          rowHeight = 0;
        }
      }
      return y;
    }
    @bound
    private makeFleetCard(entry: any, width: number): PlayerInspectCard {
      var card: PlayerInspectCard = new PlayerInspectCard(
        this.g,
        width,
        170,
        entry.active ? 0x7cce9e : 0x424242,
        entry.active,
      );
      var title: Text = card.addText(entry.name, 12, 10, width - 24, 15, 0xffffff);
      var y: number = title.y + title.height + 6;
      var state: Text = card.addText(
        entry.active ? 'CURRENT SHIP' : 'View ship loadout',
        12,
        y,
        width - 24,
        10,
        entry.active ? 0x7cce9e : 0xaaaaaa,
      );
      y = state.y + state.height + 8;
      card.addShip(entry.bitmap, entry.paint, 12, y, width - 24, 82);
      y += 90;
      var equipped: any[] = [];
      for (var weapon of Object.values<any>(entry.weapons)) {
        if (weapon.equipped === true) equipped.push(weapon);
      }
      var size: number = 32;
      var maxIcons: number = Math.max(1, Math.trunc((width - 24) / (size + 8)));
      for (var i: number = 0; i < Math.min(equipped.length, maxIcons); i++) {
        card.addIcon(equipped[i].bitmap, 12 + i * (size + 8), y, size);
      }
      if (equipped.length == 0)
        card.addText('No equipped weapon snapshot', 12, y, width - 24, 11, 0x999999);
      card.onSelect((): void => {
        this.selectedFleet = entry;
        this.page = 0;
        this.showPage();
      });
      card.fitHeight();
      return card;
    }
    @bound
    private addShipDetails(entry: any, y: number): number {
      var card: PlayerInspectCard = new PlayerInspectCard(this.g, this.viewWidth(), 160, 0x80623e);
      card.x = 8;
      card.y = y;
      var shipWidth: number = Math.min(200, this.viewWidth() * 0.35);
      card.addShip(entry.bitmap, entry.paint, 12, 12, shipWidth, 132);
      var x: number = shipWidth + 28;
      var title: Text = card.addText(entry.name, x, 12, this.viewWidth() - x - 12, 20, 0xffbd6a);
      var dy: number = title.y + title.height + 8;
      var state: Text = card.addText(
        entry.active ? 'Current ship' : 'Saved fleet ship',
        x,
        dy,
        this.viewWidth() - x - 12,
        12,
        0x7cce9e,
      );
      dy = state.y + state.height + 8;
      for (var line of Object.values<any>(entry.details)) {
        var field: Text = card.addText(line, x, dy, this.viewWidth() - x - 12, 12, 0xcccccc);
        dy = field.y + field.height + 4;
      }
      this.content.addChild(card);
      return y + card.fitHeight() + 12;
    }
    @bound
    private makeWeaponCard(entry: any, width: number): PlayerInspectCard {
      var card: PlayerInspectCard = new PlayerInspectCard(
        this.g,
        width,
        92,
        entry.equipped === true ? 0x6dba92 : 0x424242,
        entry.selected === true,
      );
      card.addIcon(entry.bitmap, 12, 12, 44);
      var title: Text = card.addText(entry.name, 68, 10, width - 80, 13, 0xffffff);
      var y: number = Math.max(64, title.y + title.height + 8);
      var flags: any[] = [];
      if (entry.table != null) flags.push('Ship default');
      if (entry.equipped === true) flags.push('Equipped');
      else if (entry.equipped === false) flags.push('Not equipped');
      if (entry.selected === true) flags.push('Selected');
      if (entry.hotkey != null && entry.hotkey > 0) flags.push('Slot ' + entry.hotkey);
      if (flags.length > 0) {
        var state: Text = card.addText(flags.join(' • '), 12, y, width - 24, 11, 0x7cce9e);
        y = state.y + state.height + 6;
      }
      if (entry.table == null) {
        var dpsLabel: string =
          entry.dps != null
            ? 'Nominal DPS: ' + Number(entry.dps).toFixed(1)
            : 'DPS unavailable (no room stats)';
        var dpsText: Text = card.addText(
          dpsLabel,
          12,
          y,
          width - 24,
          12,
          entry.dps != null ? 0xe8cf89 : 0x999999,
        );
        y = dpsText.y + dpsText.height + 4;
      }
      for (var line of Object.values<any>(entry.details)) {
        var field: Text = card.addText(line, 12, y, width - 24, 11, 0xbfbfbf);
        y = field.y + field.height + 4;
      }
      card.fitHeight();
      return card;
    }
    private invalidateDisplayTree(display: any): void {
      display.excludeFromCache();
      display.setRequiresRedraw();
      const count = display.get_numChildren?.() ?? 0;
      for (let index = 0; index < count; index++) {
        this.invalidateDisplayTree(display.getChildAt(index));
      }
    }
    @bound
    private makeArtifactCard(entry: any, width: number): PlayerInspectCard {
      return this.artifactCard(<Artifact>entry, width, false);
    }
    @bound
    private artifactCard(artifact: Artifact, width: number, detailed: boolean): PlayerInspectCard {
      var color: number = artifact.revealed ? artifact.getColor() : 0x999999;
      var card: PlayerInspectCard = new PlayerInspectCard(this.g, width, 108, color);
      card.addIcon(artifact.bitmap, 12, 12, detailed ? 72 : 52);
      var x: number = detailed ? 100 : 76;
      var title: Text = card.addText(
        artifact.revealed ? Localize.t(artifact.name) : 'Unrevealed artifact',
        x,
        12,
        width - x - 12,
        detailed ? 18 : 13,
        color,
      );
      var details: Text = card.addText(
        'Level ' +
          artifact.levelPotential +
          ' • Strength ' +
          artifact.level +
          '\nFitness ' +
          Math.trunc(artifactFitness(artifact)) +
          ' • Upgrades ' +
          (artifact.upgraded ?? 0),
        x,
        title.y + title.height + 6,
        width - x - 12,
        11,
        0xcccccc,
      );
      var y: number = Math.max(detailed ? 96 : 80, details.y + details.height + 10);
      if (detailed && artifact.revealed) {
        for (var stat of Object.values<any>(artifact.stats)) {
          var field: Text = card.addText(
            ArtifactStat.parseTextFromStatType(
              PlayerInspectPopup.escape(stat.type),
              stat.value,
              stat.isUnique,
            ),
            16,
            y,
            width - 32,
            13,
            0xdddddd,
            true,
          );
          y = field.y + field.height + 8;
        }
      } else if (!detailed) {
        var hint: Text = card.addText('View artifact stats', 12, y, width - 24, 10, 0x999999);
        y = hint.y + hint.height + 10;
        card.onSelect((): void => {
          this.artifactReturnPage = this.page;
          this.selectedArtifact = artifact;
          this.page = 0;
          this.showPage();
        });
      }
      // Feathers triggers on release and cancels scroll gestures, so
      // dragging artifact/set cards cannot accidentally share one.
      const share = new PressButton('button');
      share.labelFont = Verdana.fontNameForSize(11);
      share.labelSize = 11;
      share.labelColor = 0xeeeeee;
      share.textField.set_wordWrap(false);
      share.set_label(artifact.revealed ? 'Share on Chat...' : 'Reveal to share');

      share.x = 12;
      share.y = y;
      share.width = Math.min(160, width - 24);
      share.height = 30;
      share.set_isEnabled(
        artifact.revealed && ChatArtifactToken.encode(this.playerId, artifact.id).length > 0,
      );
      share.addEventListener(Event.TRIGGERED, (event: Event): void => {
        this.shareArtifact(artifact);
      });
      card.addChild(share);

      card.fitHeight();
      return card;
    }
    @bound
    private shareArtifact(artifact: Artifact): void {
      if (
        !this.isCurrent() ||
        artifact == null ||
        !artifact.revealed ||
        this.artifactById['$' + artifact.id] !== artifact ||
        ChatArtifactToken.encode(this.playerId, artifact.id).length == 0 ||
        this.g.chatInput == null
      )
        return;
      // Dismissal disposes this popup, so capture the validated owner
      // and artifact before releasing its fields and input lock.
      var game: Game = this.g;
      var ownerId: string = this.playerId;
      this.dismiss();
      Starling.juggler.delayCall((): void => {
        if (Game.instance !== game || game.isLeaving || game.chatInput == null) return;
        game.chatInput.insertArtifactLink(ownerId, artifact);
      }, 0);
    }
    @bound
    private addArtifactSet(entry: any, y: number): number {
      var card: PlayerInspectCard = new PlayerInspectCard(
        this.g,
        this.viewWidth(),
        90,
        entry.active ? 0x7cce9e : 0x424242,
        entry.active,
      );
      card.x = 8;
      card.y = y;
      var title: Text = card.addText(
        entry.name + (entry.active ? ' • ACTIVE' : ''),
        12,
        10,
        this.viewWidth() - 24,
        14,
        entry.active ? 0x7cce9e : 0xffffff,
      );
      var dy: number = title.y + title.height + 12;
      var columns: number = Math.max(1, Math.trunc((this.viewWidth() - 12) / 172));
      var width: number = (this.viewWidth() - 24 - (columns - 1) * 8) / columns;
      var rowHeight: number = 0;
      for (var i: number = 0; i < entry.slots.length; i++) {
        var id: string = entry.slots[i];
        var artifact: Artifact = id == null ? null : <Artifact>this.artifactById['$' + id];
        var tile: PlayerInspectCard;
        if (artifact != null) {
          tile = this.artifactCard(artifact, width, false);
        } else {
          tile = new PlayerInspectCard(this.g, width, 110);
          tile.addText(
            id == null || id.length == 0 ? 'Empty slot' : 'Artifact unavailable',
            12,
            16,
            width - 24,
            12,
            0x999999,
          );
          tile.addText('Slot ' + (i + 1), 12, 70, width - 24, 10, 0x777777);
        }
        var column: number = i % columns;
        tile.x = 12 + column * (width + 8);
        tile.y = dy;
        card.addChild(tile);
        rowHeight = Math.max(rowHeight, tile.fitHeight());
        if (column == columns - 1 || i == entry.slots.length - 1) {
          dy += rowHeight + 8;
          rowHeight = 0;
        }
      }
      if (entry.slots.length == 0)
        card.addText('No artifact slots recorded', 12, dy, this.viewWidth() - 24, 12, 0x999999);
      this.content.addChild(card);
      return y + card.fitHeight() + 12;
    }
    @bound
    private makeResourceCard(entry: any, width: number): PlayerInspectCard {
      var card: PlayerInspectCard = new PlayerInspectCard(this.g, width, 84);
      if (typeof entry === 'string') {
        card.addText(
          PlayerInspectPopup.readableStat(String(entry)),
          12,
          12,
          width - 24,
          12,
          0xcccccc,
          true,
        );
        card.fitHeight();
        return card;
      }
      card.addIcon(entry.bitmap, 12, 16, 44);
      var title: Text = card.addText(entry.name, 68, 10, width - 80, 12, 0xbfbfbf);
      card.addText(String(entry.amount), 68, title.y + title.height + 6, width - 80, 20, 0xffbd6a);
      card.fitHeight();
      return card;
    }
    @bound
    private addReadableStat(html: string, y: number): number {
      // Keep ID access in the explicit copy action, not in every visible
      // label. Named metadata from the legacy projection appends [key].
      if (html.indexOf('Player ID:') == 0 || html.indexOf('clanId:') == 0) return y;
      var card: PlayerInspectCard = new PlayerInspectCard(this.g, this.viewWidth(), 38);
      card.x = 8;
      card.y = y;
      card.addText(
        PlayerInspectPopup.readableStat(html),
        12,
        10,
        this.viewWidth() - 24,
        12,
        0xdddddd,
        true,
      );
      this.content.addChild(card);
      return y + card.fitHeight() + 8;
    }
    @bound
    private static readableStat(html: string): string {
      html = html.replace(/ \[[^\]]{12,}\]/g, '');
      var separator: number = html.indexOf(':');
      if (separator >= 0) {
        // Humanize field labels, never change a player's name/value.
        return (
          html.substring(0, separator).replace(/([a-z])([A-Z])/g, '$1 $2') +
          html.substring(separator)
        );
      }
      return html;
    }
    @bound
    private addVitals(y: number): number {
      var card: PlayerInspectCard = new PlayerInspectCard(this.g, this.viewWidth(), 140);
      card.x = 8;
      card.y = y;
      var dy: number = 12;
      for (var vital of Object.values<any>(this.vitals)) {
        var valid: boolean = isFinite(vital.value) && isFinite(vital.max) && vital.max > 0;
        var field: Text = card.addText(
          vital.name +
            (valid
              ? '  ' + Math.round(vital.value) + ' / ' + Math.round(vital.max)
              : ' unavailable'),
          12,
          dy,
          this.viewWidth() - 24,
          14,
          vital.color,
        );
        dy = field.y + field.height + 8;
        var track: Quad = new Quad(this.viewWidth() - 24, 10, 0x292d34);
        track.x = 12;
        track.y = dy;
        track.touchable = false;
        card.addChild(track);
        if (valid && vital.value > 0) {
          var fill: Quad = new Quad(
            (this.viewWidth() - 24) * Math.min(1, vital.value / vital.max),
            10,
            vital.color,
          );
          fill.x = 12;
          fill.y = dy;
          fill.touchable = false;
          card.addChild(fill);
        }
        dy += 24;
      }
      this.content.addChild(card);
      return y + card.fitHeight() + 12;
    }
    @bound
    private addRow(html: string, y: number, indent: number = 12): number {
      var field: Text = new Text();
      field.font = 'Verdana';
      field.size = 12;
      field.bold = false;
      field.wordWrap = true;
      field.width = this.panelWidth - indent - 28;
      field.x = indent;
      field.y = y;
      field.htmlText = html;
      this.content.addChild(field);
      return y + Math.max(20, field.height) + 10;
    }
    @bound
    /*override*/
    protected redraw(event: Event = null): void {
      if (this.stage == null) return;
      this.panelWidth = Math.max(260, Math.min(880, this.stage.stageWidth - 56));
      this.panelHeight = Math.max(260, Math.min(640, this.stage.stageHeight - 56));
      this.box.width = this.panelWidth;
      this.box.height = this.panelHeight;
      this.box.x = Math.round((this.stage.stageWidth - this.panelWidth) / 2);
      this.box.y = Math.round((this.stage.stageHeight - this.panelHeight) / 2);
      this.heading.width = this.panelWidth - 144;
      this.tabs.y = Math.max(105, this.heading.y + this.heading.height + 12);
      this.tabs.width = this.panelWidth;
      this.scroll.y = this.tabs.y + 40;
      this.scroll.width = this.panelWidth;
      this.previous.x = 12;
      this.next.x = 58;
      this.previous.y = this.next.y = this.panelHeight - 42;
      this.pageLabel.x = 108;
      this.pageLabel.y = this.panelHeight - 38;
      this.closeButton.x = this.panelWidth - this.closeButton.width - 14;
      this.closeButton.y = this.panelHeight - 42;
      this.copyId.x = this.closeButton.x - this.copyId.width - 12;
      this.copyId.y = this.panelHeight - 42;
      // Tiny windows need a second footer row instead of overlapping paging.
      var footerHeight: number = this.copyId.x < 210 ? 88 : 58;
      if (footerHeight == 88)
        this.previous.y = this.next.y = this.pageLabel.y = this.panelHeight - 76;
      this.scroll.height = Math.max(40, this.panelHeight - this.scroll.y - footerHeight);
      this.bgr.width = this.stage.stageWidth;
      this.bgr.height = this.stage.stageHeight;
      this.showPage();
    }
    @bound
    private onTimeout(event: TimerEvent): void {
      if (!this.isCurrent()) return;
      if (this.record == null) this.fail('Player lookup timed out. Try their copied player ID.');
      else {
        this.artifactStatus = 'Artifact lookup is taking longer than expected.';
        this.showPage();
      }
    }
    @bound
    private fail(message: string): void {
      this.timeout.stop();
      this.heading.text = 'Player inspection\n' + message;
    }
    @bound
    /*override*/
    protected keyDown(event: KeyboardEvent): void {
      if (read(event, 'keyCode') == 27) {
        event.stopImmediatePropagation();
        this.close();
      }
    }
    @bound
    private onClose(event: Event): void {
      this.dismiss();
    }
    @bound
    private dismiss(): void {
      if (this.parent != null && this.g != null) this.g.removeChildFromOverlay(this, true);
      else this.dispose();
    }
    @bound
    /*override*/
    public dispose(): void {
      if (this.stopped) return;
      this.stopped = true;
      this.clean();
      if (PlayerInspectPopup.active === this) PlayerInspectPopup.active = null;
      this.timeout.stop();
      this.timeout.removeEventListener(TimerEvent.TIMER_COMPLETE, this.onTimeout);
      this.snapshotPlayer = null;
      this.record = null;
      this.sections = [];
      this.artifacts = [];
      this.artifactById = {};
      this.fleetCards = [];
      this.weaponCards = [];
      this.setCards = [];
      this.cargoCards = [];
      this.vitals = [];
      this.selectedFleet = null;
      this.selectedArtifact = null;
      this.g = null;
      super.dispose();
    }
    @bound
    private static unquote(value: string): string {
      if (
        value.length >= 2 &&
        (value.charAt(0) == '"' || value.charAt(0) == "'") &&
        value.charAt(value.length - 1) == value.charAt(0)
      )
        return value.slice(1, -1);
      return value;
    }
    @bound
    private static escape(value: string): string {
      return value == null
        ? ''
        : value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
  }

  return PlayerInspectPopup;
}
