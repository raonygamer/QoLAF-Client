// Source port of af/PlayerInspectViewModel.as.
import { bound, type Resolve } from '../runtime/HaxeInterop';
export function createPlayerInspectViewModel(resolve: Resolve): any {
  type Player = any;
  const DataLocator: any = resolve('data.DataLocator');
  type DataLocator = any;
  /** Detached, plain-text inspector cards. Metadata reads only; never creates a ship. */

  class PlayerInspectViewModel {
    private static MAX_ITEMS: number = 512;
    private static MAX_SETS: number = 200;
    private static MAX_SLOTS: number = 64;
    private static MAX_TEXT: number = 300;
    private static PAINT_FIELDS: any[] = [
      'shipHue',
      'shipBrightness',
      'shipSaturation',
      'shipContrast',
      'engineHue',
    ];
    /** bitmap values are Images keys: ship hull bitmap, or a tech's GUI techIcon. */
    @bound
    public static fleet(saved: any, live: Player = null): any[] {
      var result: any[] = [];
      var active: string = PlayerInspectViewModel.activeSkin(saved, live);
      for (var record of Object.values<any>(PlayerInspectViewModel.fleetRecords(saved, live))) {
        var skin: any = PlayerInspectViewModel.metadata('Skins', record.skin);
        var ship: any = PlayerInspectViewModel.metadata(
          'Ships',
          PlayerInspectViewModel.string(PlayerInspectViewModel.get(skin, 'ship')),
        );
        var paint: any = {};
        for (var field of Object.values<any>(PlayerInspectViewModel.PAINT_FIELDS)) {
          var value: any = PlayerInspectViewModel.prefer(record.live, record.saved, field);
          paint[field] = PlayerInspectViewModel.number(value) == null ? 0 : Number(value);
        }
        var ownedSource: any = record.saved;
        if (
          record.skin == active &&
          !PlayerInspectViewModel.has(ownedSource, 'weapons') &&
          (PlayerInspectViewModel.activeSkin(saved, null) == '' ||
            record.skin == PlayerInspectViewModel.activeSkin(saved, null)) &&
          PlayerInspectViewModel.has(saved, 'weapons')
        )
          ownedSource = saved;
        var owned: any[] = PlayerInspectViewModel.weaponCards(ownedSource, record.live);
        if (record.skin == active) PlayerInspectViewModel.appendLiveWeaponDetails(owned, live);
        var builtins: any[] = PlayerInspectViewModel.builtinCards(
          PlayerInspectViewModel.get(skin, 'upgrades'),
        );
        var details: any[] = [];
        var defaults: any[] = [];

        for (var stat of Object.values<any>([
          { field: 'hp', label: 'health' },
          { field: 'shieldHp', label: 'shield' },
          { field: 'armor', label: 'armor' },
        ])) {
          var amount: any = PlayerInspectViewModel.number(
            PlayerInspectViewModel.get(ship, stat.field),
          );
          if (amount != null) defaults.push(stat.label + ' ' + amount);
        }
        if (defaults.length > 0) details.push('Ship defaults: ' + defaults.join('; '));
        if (
          !PlayerInspectViewModel.has(ownedSource, 'weapons') &&
          !PlayerInspectViewModel.has(record.live, 'weapons')
        ) {
          details.push('Owned weapons unavailable');
        }
        var setup: any = PlayerInspectViewModel.number(
          PlayerInspectViewModel.prefer(record.live, record.saved, 'activeArtifactSetup'),
        );
        if (setup != null && setup >= 0 && Math.trunc(setup) == setup) {
          details.push('Artifact setup: Set ' + (Math.trunc(setup) + 1));
        }
        result.push({
          skin: record.skin,
          name: PlayerInspectViewModel.displayName('Skins', record.skin, 'Unknown ship'),
          bitmap: PlayerInspectViewModel.string(PlayerInspectViewModel.get(ship, 'bitmap')),
          active: record.skin == active,
          paint: paint,
          weapons: owned,
          builtins: builtins,
          details: details,
        });
      }
      return result;
    }
    @bound
    public static weapons(saved: any, live: Player = null): any[] {
      var active: string = PlayerInspectViewModel.activeSkin(saved, live);
      for (var record of Object.values<any>(PlayerInspectViewModel.fleetRecords(saved, live))) {
        if (record.skin != active) continue;
        var source: any = record.saved;
        if (
          !PlayerInspectViewModel.has(source, 'weapons') &&
          (PlayerInspectViewModel.activeSkin(saved, null) == '' ||
            active == PlayerInspectViewModel.activeSkin(saved, null))
        )
          source = saved;
        var result: any[] = PlayerInspectViewModel.weaponCards(source, record.live);
        PlayerInspectViewModel.appendLiveWeaponDetails(result, live);
        return result;
      }
      result = PlayerInspectViewModel.weaponCards(
        saved,
        PlayerInspectViewModel.activeLiveRecord(live),
      );
      PlayerInspectViewModel.appendLiveWeaponDetails(result, live);
      return result;
    }
    /** Only self's room setup array is authoritative. Remote defaults are not empty sets. */
    @bound
    public static artifactSets(saved: any, live: Player = null): any[] {
      var source: any = PlayerInspectViewModel.get(saved, 'artifactSetups');
      var active: any = PlayerInspectViewModel.get(saved, 'activeArtifactSetup');
      if (live != null && live.isMe) {
        source = live.artifactSetups;
        active = live.activeArtifactSetup;
      } else if (active === undefined || active === null) {
        for (var record of Object.values<any>(PlayerInspectViewModel.fleetRecords(saved, null))) {
          if (record.skin == PlayerInspectViewModel.activeSkin(saved, null)) {
            active = PlayerInspectViewModel.get(record.saved, 'activeArtifactSetup');
            break;
          }
        }
      }
      var result: any[] = [];
      var setEntries: any[] = PlayerInspectViewModel.entries(
        source,
        PlayerInspectViewModel.MAX_SETS + 1,
      );
      for (var entry of Object.values<any>(setEntries)) {
        if (result.length >= PlayerInspectViewModel.MAX_SETS) break;
        var setup: any = entry.value;
        var slots: any = setup;

        for (var field of Object.values<any>(['slots', 'artifacts', 'items', 'artifactIds'])) {
          if (PlayerInspectViewModel.has(setup, field)) {
            slots = PlayerInspectViewModel.get(setup, field);
            break;
          }
        }
        var name: string = PlayerInspectViewModel.string(PlayerInspectViewModel.get(setup, 'name'));
        if (name == '')
          name = /^\d+$/.test(entry.key)
            ? 'Set ' + (Math.trunc(entry.key) + 1)
            : 'Set ' + (result.length + 1);
        for (var slotEntry of Object.values<any>(
          PlayerInspectViewModel.entries(slots, PlayerInspectViewModel.MAX_SLOTS + 1),
        )) {
          if (
            /^\d+$/.test(slotEntry.key) &&
            Number(slotEntry.key) >= PlayerInspectViewModel.MAX_SLOTS
          ) {
            name += ' (first ' + PlayerInspectViewModel.MAX_SLOTS + ' slots)';
            break;
          }
        }
        result.push({
          name: name,
          active: active !== undefined && active !== null && String(active) == entry.key,
          slots: PlayerInspectViewModel.slotIds(slots),
        });
      }
      if (setEntries.length > PlayerInspectViewModel.MAX_SETS)
        result[result.length - 1].name += ' (more sets omitted)';
      return result;
    }
    /** Human names only. IDs remain separate keys for lookups, not appended labels. */
    @bound
    public static displayName(table: string, key: string, fallback: string): string {
      var name: string = PlayerInspectViewModel.string(
        PlayerInspectViewModel.get(PlayerInspectViewModel.metadata(table, key), 'name'),
      );
      return name != '' ? name : PlayerInspectViewModel.string(fallback);
    }
    @bound
    private static fleetRecords(saved: any, live: Player): any[] {
      var result: any[] = [];
      var bySkin: any = {};
      for (var entry of Object.values<any>(
        PlayerInspectViewModel.entries(
          PlayerInspectViewModel.get(saved, 'fleet'),
          PlayerInspectViewModel.MAX_ITEMS,
        ),
      )) {
        var value: any = entry.value;
        var skin: string =
          typeof value == 'string'
            ? PlayerInspectViewModel.string(value)
            : PlayerInspectViewModel.string(PlayerInspectViewModel.get(value, 'skin'));
        if (skin == '')
          skin = PlayerInspectViewModel.string(PlayerInspectViewModel.get(value, 'key'));
        if (skin == '' && !/^\d+$/.test(entry.key)) skin = entry.key;
        if (skin == '' || value === false || bySkin['$' + skin] != null) continue;
        var record: any = { skin: skin, saved: value, live: null };
        bySkin['$' + skin] = record;
        result.push(record);
      }
      skin = PlayerInspectViewModel.string(PlayerInspectViewModel.get(saved, 'activeSkin'));
      if (
        skin != '' &&
        bySkin['$' + skin] == null &&
        result.length < PlayerInspectViewModel.MAX_ITEMS
      ) {
        record = { skin: skin, saved: null, live: null };
        bySkin['$' + skin] = record;
        result.push(record);
      }
      if (live != null) {
        for (entry of Object.values(
          PlayerInspectViewModel.entries(live.fleet, PlayerInspectViewModel.MAX_ITEMS),
        )) {
          value = entry.value;
          skin = PlayerInspectViewModel.string(PlayerInspectViewModel.get(value, 'skin'));
          if (skin == '') continue;
          record = bySkin['$' + skin];
          if (record == null) {
            if (result.length >= PlayerInspectViewModel.MAX_ITEMS) continue;
            record = { skin: skin, saved: null, live: null };
            bySkin['$' + skin] = record;
            result.push(record);
          }
          record.live = value;
        }
        skin = PlayerInspectViewModel.string(live.activeSkin);
        if (skin != '') {
          record = bySkin['$' + skin];
          if (record == null && result.length < PlayerInspectViewModel.MAX_ITEMS) {
            record = { skin: skin, saved: null, live: null };
            result.push(record);
          }
          if (record != null) record.live = PlayerInspectViewModel.activeLiveRecord(live);
        }
      }
      return result;
    }
    @bound
    private static activeLiveRecord(live: Player): any {
      if (live == null) return null;
      var result: any = null;
      for (var entry of Object.values<any>(
        PlayerInspectViewModel.entries(live.fleet, PlayerInspectViewModel.MAX_ITEMS),
      )) {
        if (
          PlayerInspectViewModel.string(PlayerInspectViewModel.get(entry.value, 'skin')) !=
          PlayerInspectViewModel.string(live.activeSkin)
        )
          continue;
        result = {};
        for (var field of Object.values<any>(
          PlayerInspectViewModel.PAINT_FIELDS.concat([
            'weapons',
            'weaponsState',
            'weaponsHotkeys',
            'activeWeapon',
            'activeArtifactSetup',
            'techSkills',
          ]),
        )) {
          if (PlayerInspectViewModel.has(entry.value, field))
            result[field] = PlayerInspectViewModel.get(entry.value, field);
        }
        break;
      }
      // The current room equipment may update without replacing FleetObj.
      // A remote Player's default empty arrays alone do not erase saved data.
      if (live.isMe || (live.weapons != null && live.weapons.length > 0)) {
        if (result == null) result = {};
        result.weapons = live.weapons;
        result.weaponsState = live.weaponsState;
        result.weaponsHotkeys = live.weaponsHotkeys;
        result.techSkills = live.techSkills;
      }
      var selected: string = PlayerInspectViewModel.string(live.acknowledgedWeaponKey);
      if (selected == '' && live.ship != null && live.ship.weapon != null)
        selected = PlayerInspectViewModel.string(live.ship.weapon.key);
      if (selected != '') {
        if (result == null) result = {};
        result.activeWeapon = selected;
      }
      return result;
    }
    @bound
    private static weaponCards(saved: any, live: any): any[] {
      var result: any[] = [];
      var byKey: any = {};
      var selected: string = PlayerInspectViewModel.string(
        PlayerInspectViewModel.prefer(live, saved, 'activeWeapon'),
      );
      var techs: any = {};

      for (var source of Object.values<any>([saved, live])) {
        for (var techEntry of Object.values<any>(
          PlayerInspectViewModel.entries(
            PlayerInspectViewModel.get(source, 'techSkills'),
            PlayerInspectViewModel.MAX_ITEMS,
          ),
        )) {
          var tech: any = techEntry.value;
          var table: string = PlayerInspectViewModel.string(
            PlayerInspectViewModel.get(tech, 'table'),
          );
          var techKey: string = PlayerInspectViewModel.string(
            PlayerInspectViewModel.get(tech, 'tech'),
          );
          if (techKey == '' && !/^\d+$/.test(techEntry.key)) techKey = techEntry.key;
          if (techKey != '' && (table == '' || table == 'Weapons')) techs['$' + techKey] = tech;
        }
      }

      for (source of Object.values([saved, live])) {
        for (var entry of Object.values<any>(
          PlayerInspectViewModel.entries(
            PlayerInspectViewModel.get(source, 'weapons'),
            PlayerInspectViewModel.MAX_ITEMS,
          ),
        )) {
          var value: any = entry.value;
          var key: string =
            typeof value == 'string'
              ? PlayerInspectViewModel.string(value)
              : PlayerInspectViewModel.string(PlayerInspectViewModel.get(value, 'weapon'));
          if (key == '')
            key = PlayerInspectViewModel.string(PlayerInspectViewModel.get(value, 'key'));
          if (key == '' && !/^\d+$/.test(entry.key)) key = entry.key;
          if (value === false || value === null || value === undefined) continue;
          var card: any = key == '' ? null : byKey['$' + key];
          if (card == null) {
            if (result.length >= PlayerInspectViewModel.MAX_ITEMS) continue;
            card = {
              key: key,
              name: PlayerInspectViewModel.displayName('Weapons', key, 'Unknown weapon'),
              bitmap: PlayerInspectViewModel.string(
                PlayerInspectViewModel.get(
                  PlayerInspectViewModel.metadata('Weapons', key),
                  'techIcon',
                ),
              ),
              equipped: null,
              hotkey: null,
              selected: key != '' && key == selected,
              dps: null,
              details: [],
            };
            result.push(card);
            if (key != '') byKey['$' + key] = card;
          }
          var state: any = PlayerInspectViewModel.indexed(
            PlayerInspectViewModel.get(source, 'weaponsState'),
            entry.key,
            key,
          );
          if (state === undefined)
            state = PlayerInspectViewModel.has(value, 'equipped')
              ? PlayerInspectViewModel.get(value, 'equipped')
              : PlayerInspectViewModel.get(value, 'active');
          if (typeof state == 'boolean') card.equipped = state;
          var hotkey: any = PlayerInspectViewModel.indexed(
            PlayerInspectViewModel.get(source, 'weaponsHotkeys'),
            entry.key,
            key,
          );
          if (hotkey === undefined) hotkey = PlayerInspectViewModel.get(value, 'hotkey');
          var parsed: any = PlayerInspectViewModel.number(hotkey);
          if (parsed != null && parsed >= 0 && parsed <= 2147483647 && Math.trunc(parsed) == parsed)
            card.hotkey = Math.trunc(parsed);
          var upgrade: any = techs['$' + key];
          var level: any = PlayerInspectViewModel.number(
            PlayerInspectViewModel.has(upgrade, 'level')
              ? PlayerInspectViewModel.get(upgrade, 'level')
              : PlayerInspectViewModel.get(value, 'level'),
          );
          if (level != null) card.details = ['Tech level: ' + level];
          var elite: any = PlayerInspectViewModel.number(
            PlayerInspectViewModel.get(upgrade, 'activeEliteTechLevel'),
          );
          if (
            PlayerInspectViewModel.string(PlayerInspectViewModel.get(upgrade, 'activeEliteTech')) !=
              '' &&
            elite != null
          ) {
            var eliteText: string = 'Elite tech level: ' + elite;
            if (card.details.indexOf(eliteText) < 0) card.details.push(eliteText);
          }
        }
      }
      return result;
    }
    @bound
    private static builtinCards(upgrades: any): any[] {
      var result: any[] = [];
      for (var entry of Object.values<any>(
        PlayerInspectViewModel.entries(upgrades, PlayerInspectViewModel.MAX_ITEMS),
      )) {
        var value: any = entry.value;
        var table: string = PlayerInspectViewModel.string(
          PlayerInspectViewModel.get(value, 'table'),
        );
        var key: string = PlayerInspectViewModel.string(PlayerInspectViewModel.get(value, 'tech'));
        if (table == '' || key == '') continue;
        var details: any[] = [];
        var level: any = PlayerInspectViewModel.number(PlayerInspectViewModel.get(value, 'level'));
        if (level != null) details.push('Built-in level: ' + level);
        var fallback: string = PlayerInspectViewModel.string(
          PlayerInspectViewModel.get(value, 'name'),
        );
        result.push({
          table: table,
          key: key,
          name: PlayerInspectViewModel.displayName(
            table,
            key,
            fallback == '' ? 'Unknown upgrade' : fallback,
          ),
          bitmap: PlayerInspectViewModel.string(
            PlayerInspectViewModel.get(PlayerInspectViewModel.metadata(table, key), 'techIcon'),
          ),
          details: details,
        });
      }
      return result;
    }
    /** Nominal DPS, using the same burst/projectile formula as Weapon.getDescription.
     * Missing live stats are unavailable, never a guessed base value or zero.
     */
    @bound
    public static weaponDPS(weapon: any): any {
      var damage: any = PlayerInspectViewModel.get(weapon, 'dmg');
      var amount: any = null;
      try {
        if (damage != null) amount = PlayerInspectViewModel.number(damage.dmg());
      } catch (error: any) {
        return null;
      }
      var reload: any = PlayerInspectViewModel.number(
        PlayerInspectViewModel.get(weapon, 'reloadTime'),
      );
      var burst: any = PlayerInspectViewModel.number(PlayerInspectViewModel.get(weapon, 'burst'));
      var projectiles: any = PlayerInspectViewModel.number(
        PlayerInspectViewModel.get(weapon, 'multiNrOfP'),
      );
      if (
        amount == null ||
        amount < 0 ||
        reload == null ||
        reload <= 0 ||
        burst == null ||
        burst < 1 ||
        Math.floor(burst) != burst ||
        projectiles == null ||
        projectiles < 0 ||
        Math.floor(projectiles) != projectiles
      )
        return null;
      var result: number =
        (amount * burst * (projectiles == 0 ? 1 : projectiles) * 1000) /
        (reload + (burst - 1) * 33);
      return isFinite(result) && result >= 0 ? result : null;
    }
    @bound
    private static appendLiveWeaponDetails(cards: any[], live: Player): void {
      if (live == null || live.ship == null) return;
      var byKey: any = {};
      var card: any;
      for (card of cards) if (card.key !== '') byKey['$' + card.key] = card;
      var seen: any = {};
      for (var entry of Object.values<any>(
        PlayerInspectViewModel.entries(live.ship.weapons, PlayerInspectViewModel.MAX_ITEMS),
      )) {
        var weapon: any = entry.value;
        var key: string = PlayerInspectViewModel.string(PlayerInspectViewModel.get(weapon, 'key'));
        card = byKey['$' + key];
        if (card == null || seen['$' + key] === true) continue;
        seen['$' + key] = true;
        card.dps = PlayerInspectViewModel.weaponDPS(weapon);
        var primary: any[] = [];
        var secondary: any[] = [];
        var damage: any = PlayerInspectViewModel.get(weapon, 'dmg');
        try {
          // Damage.dmg() only sums its existing damage vector.
          if (damage != null) {
            var amount: any = PlayerInspectViewModel.number(damage.dmg());
            if (amount != null) primary.push('damage ' + amount);
          }
        } catch (error: any) {
          /* Missing snapshot data is not a zero. */
        }
        amount = PlayerInspectViewModel.number(PlayerInspectViewModel.get(weapon, 'reloadTime'));
        if (amount != null) primary.push('reload ' + amount + ' ms');

        for (var stat of Object.values<any>([
          { field: 'range', label: 'range' },
          { field: 'speed', label: 'speed' },
          { field: 'heatCost', label: 'power cost' },
          { field: 'multiNrOfP', label: 'projectiles' },
        ])) {
          amount = PlayerInspectViewModel.number(PlayerInspectViewModel.get(weapon, stat.field));
          if (amount != null) secondary.push(stat.label + ' ' + amount);
        }
        if (primary.length > 0) card.details.push('Room stats: ' + primary.join('; '));
        if (secondary.length > 0) card.details.push('Room stats: ' + secondary.join('; '));
      }
    }
    @bound
    private static slotIds(value: any): any[] {
      var result: any[] = [];
      for (var entry of Object.values<any>(
        PlayerInspectViewModel.entries(value, PlayerInspectViewModel.MAX_SLOTS),
      )) {
        if (!/^\d+$/.test(entry.key) || Math.trunc(entry.key) >= PlayerInspectViewModel.MAX_SLOTS)
          continue;
        var slot: number = Math.trunc(entry.key);
        while (result.length <= slot) result.push(null);
        var id: string =
          typeof entry.value == 'string' ? PlayerInspectViewModel.string(entry.value) : '';

        for (var field of Object.values<any>(['artifactId', 'artifact', 'id', 'key'])) {
          if (id == '')
            id = PlayerInspectViewModel.string(PlayerInspectViewModel.get(entry.value, field));
        }
        result[slot] = id == '' ? null : id;
      }
      return result;
    }
    @bound
    private static activeSkin(saved: any, live: Player): string {
      var current: string = live == null ? '' : PlayerInspectViewModel.string(live.activeSkin);
      return current != ''
        ? current
        : PlayerInspectViewModel.string(PlayerInspectViewModel.get(saved, 'activeSkin'));
    }
    /** Arrays/vectors retain index order and holes; keyed records sort predictably. */
    @bound
    private static entries(value: any, limit: number): any[] {
      var result: any[] = [];
      if (value == null || typeof value != 'object') return result;
      var length: any = PlayerInspectViewModel.get(value, 'length');
      if (
        typeof length == 'number' &&
        isFinite(length) &&
        length >= 0 &&
        Math.trunc(length) == length
      ) {
        for (var index: number = 0; index < Math.min(length, limit); index++) {
          result.push({
            key: String(index),
            value: PlayerInspectViewModel.get(value, String(index)),
          });
        }
      } else {
        var key: string;
        for (key in value) {
          result.push({ key: key, value: PlayerInspectViewModel.get(value, key) });
          if (result.length >= limit) break;
        }
        result.sort((a: any, b: any): number => {
          var numericA: boolean = /^\d+$/.test(a.key);
          var numericB: boolean = /^\d+$/.test(b.key);
          if (numericA && numericB) return Number(a.key) - Number(b.key);
          return a.key < b.key ? -1 : a.key == b.key ? 0 : 1;
        });
      }
      return result;
    }
    @bound
    private static indexed(values: any, index: string, key: string): any {
      return PlayerInspectViewModel.has(values, index)
        ? PlayerInspectViewModel.get(values, index)
        : PlayerInspectViewModel.get(values, key);
    }
    @bound
    private static prefer(first: any, second: any, field: string): any {
      return PlayerInspectViewModel.has(first, field)
        ? PlayerInspectViewModel.get(first, field)
        : PlayerInspectViewModel.get(second, field);
    }
    @bound
    private static metadata(table: string, key: string): any {
      if (table == null || table == '' || key == null || key == '') return null;
      try {
        return DataLocator.getService() == null
          ? null
          : DataLocator.getService().loadKey(table, key);
      } catch (error: any) {}
      return null;
    }
    @bound
    private static has(value: any, field: string): boolean {
      if (value == null || typeof value != 'object' || field == null) return false;
      try {
        return value.hasOwnProperty(field);
      } catch (error: any) {}
      return false;
    }
    @bound
    private static get(value: any, field: string): any {
      if (!PlayerInspectViewModel.has(value, field)) return undefined;
      try {
        return value[field];
      } catch (error: any) {}
      return undefined;
    }
    @bound
    private static string(value: any): string {
      return typeof value == 'string'
        ? String(value).substring(0, PlayerInspectViewModel.MAX_TEXT)
        : '';
    }
    @bound
    private static number(value: any): any {
      return typeof value == 'number' && isFinite(Number(value)) ? Number(value) : null;
    }
  }

  return PlayerInspectViewModel;
}
