// Source port of af/PlayerInspectProjection.as.
import { read } from '../api/Types';
import { bound, type Resolve } from '../runtime/HaxeInterop';
export function createPlayerInspectProjection(resolve: Resolve): any {
  const PlayerInspectViewModel: any = resolve('af.PlayerInspectViewModel');
  type PlayerInspectViewModel = any;
  type AS3Utils = any;
  type Artifact = any;
  type FleetObj = any;
  type Player = any;
  type TechSkill = any;
  type PlayerShip = any;
  type Weapon = any;
  const DataLocator: any = resolve('data.DataLocator');
  type DataLocator = any;
  /** Read-only, HTML-safe projections. No gameplay objects or remote requests. */

  class PlayerInspectProjection {
    private static MAX_ROWS: number = 512;
    private static MAX_CHILDREN: number = 200;
    @bound
    public static sections(saved: any, live: Player = null): any[] {
      var result: any[] = [];
      var overview: any[] = [];
      PlayerInspectProjection.row(
        overview,
        live != null
          ? saved != null
            ? 'Source: saved PlayerObjects + current room snapshot'
            : 'Source: current room snapshot; saved record unavailable'
          : 'Source: saved PlayerObjects; no live ship snapshot',
      );
      PlayerInspectProjection.row(
        overview,
        'Player ID: ' +
          (live != null
            ? live.id
            : PlayerInspectProjection.scalar(PlayerInspectProjection.get(saved, 'key'))),
      );
      PlayerInspectProjection.row(
        overview,
        'Name: ' +
          (live != null
            ? live.name
            : PlayerInspectProjection.scalar(PlayerInspectProjection.get(saved, 'name'))),
      );
      PlayerInspectProjection.row(
        overview,
        'Level: ' +
          (live != null
            ? live.level
            : PlayerInspectProjection.scalar(PlayerInspectProjection.get(saved, 'level'))),
      );
      PlayerInspectProjection.row(
        overview,
        'Active skin: ' +
          PlayerInspectProjection.named('Skins', PlayerInspectProjection.activeSkin(saved, live)),
      );
      PlayerInspectProjection.savedFields(overview, saved, [
        'xp',
        'clanId',
        'clanName',
        'troons',
        'rating',
        'ranking',
        'playerKills',
        'enemyKills',
        'playerDeaths',
        'techPoints',
      ]);
      result.push({ label: 'Overview', rows: overview });
      var weapons: any[] = [];
      var fleet: any = PlayerInspectProjection.currentFleet(saved, live);
      if (live != null) {
        PlayerInspectProjection.weaponRows(
          weapons,
          'Room owned weapons (active ship)',
          live.weapons,
          live.weaponsState,
          live.weaponsHotkeys,
          PlayerInspectProjection.get(fleet, 'activeWeapon'),
        );
        if (live.ship != null) {
          PlayerInspectProjection.row(
            weapons,
            'Weapon numbers below are the current client ship snapshot.',
          );
          for (var weapon of Object.values<any>(live.ship.weapons)) {
            if (weapon == null) continue;
            var description: string = PlayerInspectProjection.named('Weapons', weapon.key);
            PlayerInspectProjection.row(
              weapons,
              description +
                ': reload ' +
                weapon.reloadTime +
                ' ms; range ' +
                weapon.range +
                '; speed ' +
                weapon.speed +
                '; projectiles ' +
                weapon.multiNrOfP +
                '; power cost ' +
                weapon.heatCost,
            );
            if (weapon.dmg != null)
              PlayerInspectProjection.row(weapons, description + ': damage ' + weapon.dmg.dmg());
            var dps: any = PlayerInspectViewModel.weaponDPS(weapon);
            PlayerInspectProjection.row(
              weapons,
              description +
                (dps != null
                  ? ': nominal DPS ' + Number(dps).toFixed(1)
                  : ': DPS unavailable (no room stats)'),
            );
          }
        }
      }
      var savedFleet: any = PlayerInspectProjection.currentFleet(saved, null);
      if (PlayerInspectProjection.has(savedFleet, 'weapons')) {
        PlayerInspectProjection.weaponRows(
          weapons,
          'Saved owned weapons (active ship)',
          PlayerInspectProjection.get(savedFleet, 'weapons'),
          PlayerInspectProjection.get(savedFleet, 'weaponsState'),
          PlayerInspectProjection.get(savedFleet, 'weaponsHotkeys'),
          PlayerInspectProjection.get(savedFleet, 'activeWeapon'),
        );
      }
      if (PlayerInspectProjection.has(saved, 'weapons')) {
        PlayerInspectProjection.weaponRows(
          weapons,
          'Saved weapon records',
          PlayerInspectProjection.get(saved, 'weapons'),
          PlayerInspectProjection.get(saved, 'weaponsState'),
          PlayerInspectProjection.get(saved, 'weaponsHotkeys'),
          PlayerInspectProjection.get(saved, 'activeWeapon'),
        );
      } else if (!PlayerInspectProjection.has(savedFleet, 'weapons') && live == null) {
        PlayerInspectProjection.row(weapons, 'Owned weapons unavailable in this saved record.');
      }
      if (live != null)
        PlayerInspectProjection.flatten(
          weapons,
          'Room weapon tech',
          PlayerInspectProjection.techSnapshot(live.techSkills),
          'Weapons',
        );
      if (PlayerInspectProjection.has(savedFleet, 'techSkills'))
        PlayerInspectProjection.flatten(
          weapons,
          'Saved ship tech',
          PlayerInspectProjection.get(savedFleet, 'techSkills'),
          'Weapons',
        );
      if (PlayerInspectProjection.has(saved, 'techSkills'))
        PlayerInspectProjection.flatten(
          weapons,
          'Saved tech records',
          PlayerInspectProjection.get(saved, 'techSkills'),
          'Weapons',
        );
      result.push({ label: 'Weapons', rows: weapons });
      var stats: any[] = [];
      var ship: PlayerShip = live == null ? null : live.ship;
      if (ship == null) {
        PlayerInspectProjection.row(
          stats,
          'Live combat stats unavailable. Saved configuration is not a simulated ship.',
        );
      } else {
        PlayerInspectProjection.row(
          stats,
          'Current client ship snapshot; temporary effects may be included.',
        );
        PlayerInspectProjection.row(
          stats,
          'Alive: ' +
            ship.alive +
            '; health ' +
            ship.hp +
            ' / ' +
            read(ship, 'hpMax') +
            '; shield ' +
            ship.shieldHp +
            ' / ' +
            read(ship, 'shieldHpMax'),
        );
        PlayerInspectProjection.row(
          stats,
          'Armor: ' +
            ship.armorThreshold +
            '; health regen ' +
            ship.hpRegen +
            '; shield regen ' +
            ship.shieldRegen,
        );
        PlayerInspectProjection.row(
          stats,
          'Power maximum modifier: ' +
            ship.maxPower +
            '; regeneration bonus: ' +
            ship.powerRegBonus,
        );
        if (ship.weaponHeat != null)
          PlayerInspectProjection.row(
            stats,
            'Power: ' + read(ship.weaponHeat, 'heat') + ' / ' + read(ship.weaponHeat, 'max'),
          );
        if (ship.engine != null)
          PlayerInspectProjection.row(
            stats,
            'Engine: speed ' +
              ship.engine.speed +
              '; acceleration ' +
              ship.engine.acceleration +
              '; rotation speed ' +
              ship.engine.rotationSpeed,
          );
        if (ship.resistances != null && ship.resistances.length >= 3) {
          PlayerInspectProjection.row(
            stats,
            'Resistances: kinetic ' +
              ship.resistances[0] +
              '; energy ' +
              ship.resistances[1] +
              '; corrosive ' +
              ship.resistances[2],
          );
        }
      }
      PlayerInspectProjection.savedFields(stats, saved, [
        'stats',
        'shipStats',
        'hp',
        'hpMax',
        'shieldHp',
        'shieldHpMax',
        'armor',
        'resistances',
      ]);
      result.push({ label: 'Stats', rows: stats });
      var sets: any[] = [];
      PlayerInspectProjection.row(
        sets,
        'Active setup index: ' +
          (live != null
            ? live.activeArtifactSetup
            : PlayerInspectProjection.scalar(
                PlayerInspectProjection.has(saved, 'activeArtifactSetup')
                  ? PlayerInspectProjection.get(saved, 'activeArtifactSetup')
                  : PlayerInspectProjection.get(fleet, 'activeArtifactSetup'),
              )),
      );
      if (live != null && live.isMe) {
        PlayerInspectProjection.artifactSetRows(
          sets,
          'Room artifact sets',
          live.artifactSetups,
          live.activeArtifactSetup,
        );
      } else if (live != null) {
        PlayerInspectProjection.row(
          sets,
          "Other players' artifact sets are not included in the room snapshot.",
        );
      }
      if (PlayerInspectProjection.has(saved, 'artifactSetups') || live == null || !live.isMe) {
        PlayerInspectProjection.artifactSetRows(
          sets,
          'Saved artifact sets',
          PlayerInspectProjection.get(saved, 'artifactSetups'),
          PlayerInspectProjection.has(saved, 'activeArtifactSetup')
            ? PlayerInspectProjection.get(saved, 'activeArtifactSetup')
            : PlayerInspectProjection.get(savedFleet, 'activeArtifactSetup'),
        );
      }
      PlayerInspectProjection.row(
        sets,
        'Artifact IDs are references; full artifact data is loaded separately.',
      );
      result.push({ label: 'Artifact sets', rows: sets });
      var resources: any[] = [];
      PlayerInspectProjection.row(
        resources,
        "Saved resources only; room Player objects do not expose another player's wallet or cargo.",
      );
      var foundResources: boolean = false;

      for (var resourceField of Object.values<any>([
        'resources',
        'cargo',
        'items',
        'commodities',
        'minerals',
        'flux',
        'credits',
      ])) {
        if (PlayerInspectProjection.has(saved, resourceField)) {
          foundResources = true;
          PlayerInspectProjection.flatten(
            resources,
            'Saved ' + resourceField,
            PlayerInspectProjection.get(saved, resourceField),
            'Commodities',
          );
        }
      }
      if (!foundResources)
        PlayerInspectProjection.row(
          resources,
          'Resources unavailable in this saved record (not zero).',
        );
      result.push({ label: 'Resources', rows: resources });
      var ships: any[] = [];
      if (live != null) {
        if (live.fleet.length == 0) PlayerInspectProjection.row(ships, 'Room fleet: empty.');
        for (var entry of Object.values<any>(live.fleet)) {
          if (entry == null) continue;
          PlayerInspectProjection.flatten(
            ships,
            PlayerInspectProjection.named('Skins', entry.skin) +
              (entry.skin == live.activeSkin ? ' [active]' : ''),
            PlayerInspectProjection.fleetSnapshot(entry),
            'Skins',
          );
        }
      } else {
        PlayerInspectProjection.flatten(
          ships,
          'Saved fleet',
          PlayerInspectProjection.get(saved, 'fleet'),
          'Skins',
        );
      }
      result.push({ label: 'Fleet', rows: ships });
      return result;
    }
    @bound
    public static activeSkin(saved: any, live: Player = null): string {
      if (live != null && live.activeSkin != null && live.activeSkin != '') return live.activeSkin;
      var value: any = PlayerInspectProjection.get(saved, 'activeSkin');
      return typeof value === 'string' ? String(value) : '';
    }
    /** A detached live FleetObj snapshot, or the matching read-only saved record. */
    @bound
    public static currentFleet(saved: any, live: Player = null): any {
      var skin: string = PlayerInspectProjection.activeSkin(saved, live);
      if (skin == '') return null;
      if (live != null) {
        for (var entry of Object.values<any>(live.fleet)) {
          if (entry == null) continue;
          if (entry.skin == skin) return PlayerInspectProjection.fleetSnapshot(entry);
        }
      }
      var fleet: any = PlayerInspectProjection.get(saved, 'fleet');
      if (fleet == null || typeof fleet != 'object') return null;
      if (PlayerInspectProjection.has(fleet, skin))
        return <any>PlayerInspectProjection.get(fleet, skin);
      for (var candidate of Object.values<any>(fleet)) {
        if (
          candidate != null &&
          (PlayerInspectProjection.get(candidate, 'skin') === skin ||
            PlayerInspectProjection.get(candidate, 'key') === skin)
        ) {
          return <any>candidate;
        }
      }
      return null;
    }
    @bound
    public static artifactIds(saved: any, live: Player = null): any[] {
      var result: any[] = [];
      if (live != null && live.isMe) {
        for (const artifact of live.artifacts) {
          if (artifact != null) PlayerInspectProjection.addId(result, artifact.id);
        }
        PlayerInspectProjection.collectIds(live.artifactSetups, result, 0);
      }
      PlayerInspectProjection.collectIds(
        PlayerInspectProjection.get(saved, 'artifactSetups'),
        result,
        0,
      );
      PlayerInspectProjection.collectIds(
        PlayerInspectProjection.get(saved, 'artifacts'),
        result,
        0,
      );
      return result;
    }
    @bound
    private static collectIds(value: any, result: any[], depth: number): void {
      if (value == null || depth > 5 || result.length >= 5000) return;
      if (typeof value === 'string') {
        PlayerInspectProjection.addId(result, String(value));
      } else if (value instanceof Array) {
        for (const child of value) PlayerInspectProjection.collectIds(child, result, depth + 1);
      } else if (typeof value == 'object') {
        for (var field of Object.values<any>(['artifactId', 'artifact', 'id', 'key'])) {
          if (typeof PlayerInspectProjection.get(value, field) === 'string') {
            PlayerInspectProjection.addId(
              result,
              String(PlayerInspectProjection.get(value, field)),
            );
            return;
          }
        }

        for (field of Object.values(['artifacts', 'items', 'slots', 'artifactIds'])) {
          if (PlayerInspectProjection.has(value, field))
            PlayerInspectProjection.collectIds(
              PlayerInspectProjection.get(value, field),
              result,
              depth + 1,
            );
        }
        // Numeric-keyed setup maps and nested setup records are also common
        // saved shapes. Do not treat arbitrary metadata strings as IDs.
        var count: number = 0;
        var key: string;
        for (key in value) {
          if (++count > 1000) break;
          var nested: any = PlayerInspectProjection.get(value, key);
          if (
            /^\d+$/.test(key) ||
            nested instanceof Array ||
            (nested != null && typeof nested == 'object')
          ) {
            PlayerInspectProjection.collectIds(nested, result, depth + 1);
          }
        }
      }
    }
    @bound
    private static addId(result: any[], id: string): void {
      if (
        id != null &&
        id.length > 0 &&
        id.length <= 256 &&
        result.indexOf(id) == -1 &&
        result.length < 5000
      )
        result.push(id);
    }
    @bound
    private static fleetSnapshot(value: FleetObj): any {
      return {
        skin: value.skin,
        activeWeapon: value.activeWeapon,
        activeArtifactSetup: value.activeArtifactSetup,
        weapons: value.weapons == null ? null : value.weapons.concat(),
        weaponsState: value.weaponsState == null ? null : value.weaponsState.concat(),
        weaponsHotkeys: value.weaponsHotkeys == null ? null : value.weaponsHotkeys.concat(),
        techSkills: PlayerInspectProjection.techSnapshot(value.techSkills),
        lastUsed: value.lastUsed,
        shipHue: value.shipHue,
        shipBrightness: value.shipBrightness,
        shipSaturation: value.shipSaturation,
        shipContrast: value.shipContrast,
        engineHue: value.engineHue,
      };
    }
    @bound
    private static techSnapshot(values: TechSkill[]): any[] {
      var result: any[] = [];
      if (values == null) return result;
      for (var tech of Object.values<any>(values)) {
        result.push({
          tech: tech.tech,
          table: tech.table,
          name: tech.name,
          level: tech.level,
          activeEliteTech: tech.activeEliteTech,
          activeEliteTechLevel: tech.activeEliteTechLevel,
        });
      }
      return result;
    }
    @bound
    private static weaponRows(
      rows: any[],
      heading: string,
      values: any,
      states: any,
      hotkeys: any,
      selected: any,
    ): void {
      PlayerInspectProjection.row(rows, heading + ':');
      if (values == null || typeof values != 'object') {
        PlayerInspectProjection.row(
          rows,
          'Owned weapons: ' + PlayerInspectProjection.scalar(values),
        );
        return;
      }
      var count: number = 0;
      var slot: string;
      for (slot in values) {
        if (++count > PlayerInspectProjection.MAX_CHILDREN) {
          PlayerInspectProjection.row(rows, 'Further owned weapons omitted.');
          break;
        }
        var value: any = PlayerInspectProjection.get(values, slot);
        var id: any =
          typeof value === 'string' ? value : PlayerInspectProjection.get(value, 'weapon');
        if (!(typeof id === 'string')) id = PlayerInspectProjection.get(value, 'key');
        if (!(typeof id === 'string') && !/^\d+$/.test(slot)) id = slot;
        var name: string =
          typeof id === 'string'
            ? PlayerInspectProjection.named('Weapons', String(id))
            : 'Weapon ' + count;
        var state: any = PlayerInspectProjection.has(states, slot)
          ? PlayerInspectProjection.get(states, slot)
          : PlayerInspectProjection.get(value, 'equipped');
        if (state === undefined) state = PlayerInspectProjection.get(value, 'active');
        var hotkey: any = PlayerInspectProjection.has(hotkeys, slot)
          ? PlayerInspectProjection.get(hotkeys, slot)
          : PlayerInspectProjection.get(value, 'hotkey');
        var description: string =
          name +
          ' — ' +
          (typeof state === 'boolean'
            ? state
              ? 'equipped'
              : 'not equipped'
            : 'equipped: ' + PlayerInspectProjection.scalar(state));
        description +=
          '; hotkey ' + (hotkey === 0 ? 'none' : PlayerInspectProjection.scalar(hotkey));
        if (typeof id === 'string' && typeof selected === 'string' && selected === id)
          description += '; selected';
        PlayerInspectProjection.row(rows, description);
        // Preserve extra saved gameplay fields without scattering the core
        // ownership/equipped/hotkey relationship across unrelated rows.
        if (value != null && typeof value == 'object') {
          var field: string;
          for (field in value) {
            if (['weapon', 'key', 'equipped', 'active', 'hotkey'].indexOf(field) == -1) {
              PlayerInspectProjection.flatten(
                rows,
                name + ' / ' + field,
                PlayerInspectProjection.get(value, field),
              );
            }
          }
        }
      }
      if (count == 0) PlayerInspectProjection.row(rows, 'Owned weapons: empty.');
    }
    @bound
    private static artifactSetRows(rows: any[], heading: string, values: any, active: any): void {
      PlayerInspectProjection.row(rows, heading + ':');
      if (values == null || typeof values != 'object') {
        PlayerInspectProjection.row(rows, 'Sets: ' + PlayerInspectProjection.scalar(values));
        return;
      }
      var count: number = 0;
      var index: string;
      for (index in values) {
        if (++count > PlayerInspectProjection.MAX_CHILDREN) {
          PlayerInspectProjection.row(rows, 'Further artifact sets omitted.');
          break;
        }
        var setup: any = PlayerInspectProjection.get(values, index);
        var label: string = /^\d+$/.test(index) ? 'Set ' + (Number(index) + 1) : 'Set ' + index;
        if (active !== undefined && active !== null && String(active) == index)
          label += ' [active]';
        if (PlayerInspectProjection.has(setup, 'name'))
          label +=
            ' — ' + PlayerInspectProjection.scalar(PlayerInspectProjection.get(setup, 'name'));
        PlayerInspectProjection.row(rows, label);
        var slots: any = setup;

        for (var container of Object.values<any>(['artifacts', 'slots', 'artifactIds', 'items'])) {
          if (PlayerInspectProjection.has(setup, container)) {
            slots = PlayerInspectProjection.get(setup, container);
            break;
          }
        }
        if (slots == null || typeof slots != 'object') {
          PlayerInspectProjection.row(rows, 'Slots: ' + PlayerInspectProjection.scalar(slots));
          continue;
        }
        var slotCount: number = 0;
        var slot: string;
        for (slot in slots) {
          if (slot == 'name') continue;
          if (++slotCount > PlayerInspectProjection.MAX_CHILDREN) {
            PlayerInspectProjection.row(rows, 'Further artifact slots omitted.');
            break;
          }
          var item: any = PlayerInspectProjection.get(slots, slot);
          var id: any = item;
          if (item != null && typeof item == 'object') {
            id = undefined;

            for (var idField of Object.values<any>(['artifactId', 'artifact', 'id', 'key'])) {
              if (PlayerInspectProjection.has(item, idField)) {
                id = PlayerInspectProjection.get(item, idField);
                break;
              }
            }
          }
          var slotLabel: string = /^\d+$/.test(slot)
            ? 'Slot ' + (Number(slot) + 1)
            : 'Slot ' + slot;
          PlayerInspectProjection.row(rows, slotLabel + ': ' + PlayerInspectProjection.scalar(id));
          if (item != null && typeof item == 'object')
            PlayerInspectProjection.flatten(rows, slotLabel + ' details', item);
        }
        if (slotCount == 0) PlayerInspectProjection.row(rows, 'Slots: empty.');
      }
      if (count == 0) PlayerInspectProjection.row(rows, 'Artifact sets: empty.');
    }
    @bound
    private static savedFields(rows: any[], saved: any, fields: any[]): void {
      for (const field of fields) {
        if (PlayerInspectProjection.has(saved, field))
          PlayerInspectProjection.flatten(
            rows,
            'Saved ' + field,
            PlayerInspectProjection.get(saved, field),
          );
      }
    }
    @bound
    private static flatten(
      rows: any[],
      label: string,
      value: any,
      table: string = '',
      depth: number = 0,
      visited: any[] | null = null,
    ): void {
      if (rows.length >= PlayerInspectProjection.MAX_ROWS) return;
      if (value == null || typeof value != 'object') {
        PlayerInspectProjection.row(
          rows,
          label +
            ': ' +
            (typeof value === 'string' && table != ''
              ? PlayerInspectProjection.named(table, String(value))
              : PlayerInspectProjection.scalar(value)),
        );
        return;
      }
      if (depth > 4) {
        PlayerInspectProjection.row(rows, label + ': [nested details omitted]');
        return;
      }
      if (visited == null) visited = [];
      if (visited.indexOf(value) != -1) {
        PlayerInspectProjection.row(rows, label + ': [repeated object]');
        return;
      }
      visited.push(value);
      var count: number = 0;
      var key: string;
      for (key in value) {
        if (++count > PlayerInspectProjection.MAX_CHILDREN) {
          PlayerInspectProjection.row(rows, label + ': [additional entries omitted]');
          break;
        }
        var childTable: string =
          key == 'weapon' || key == 'activeWeapon' ? 'Weapons' : key == 'skin' ? 'Skins' : table;
        var displayKey: string = table != '' ? PlayerInspectProjection.named(table, key) : key;
        PlayerInspectProjection.flatten(
          rows,
          label + '.' + displayKey,
          PlayerInspectProjection.get(value, key),
          childTable,
          depth + 1,
          visited,
        );
      }
      if (count == 0) PlayerInspectProjection.row(rows, label + ': empty');
      visited.pop();
    }
    @bound
    private static named(table: string, key: string): string {
      if (key == null || key == '') return 'unavailable';
      try {
        // Check cached table membership first: loadKey logs every unknown
        // field/ID, which would flood the console for defensive projections.
        var records: any = DataLocator.getService().loadTable(table);
        var cached: any = <any>PlayerInspectProjection.get(records, key);
        if (
          cached != null &&
          PlayerInspectProjection.has(cached, 'name') &&
          PlayerInspectProjection.get(cached, 'name') != ''
        ) {
          return String(PlayerInspectProjection.get(cached, 'name')) + ' [' + key + ']';
        }
      } catch (error: any) {}
      return key;
    }
    @bound
    private static has(value: any, field: string): boolean {
      if (value == null || typeof value != 'object') return false;
      try {
        return field in value;
      } catch (error: any) {
        return false;
      }
      return false;
    }
    @bound
    private static get(value: any, field: string): any {
      if (!PlayerInspectProjection.has(value, field)) return undefined;
      try {
        return value[field];
      } catch (error: any) {
        return undefined;
      }
      return undefined;
    }
    @bound
    private static scalar(value: any): string {
      if (value === undefined) return 'unavailable';
      if (value === null) return 'null (not provided)';
      if (typeof value === 'number' && !isFinite(Number(value))) return 'unavailable';
      if (value === '') return 'empty';
      return String(value);
    }
    @bound
    private static row(rows: any[], text: string): void {
      if (rows.length >= PlayerInspectProjection.MAX_ROWS) return;
      // Escape AFTER splitting, so rows never split an HTML entity. A raw
      // 400-character slice expands to at most 2400 characters when escaped.
      // Normal weapon and slot rows stay together, including their IDs.
      for (
        var start: number = 0;
        start < text.length && rows.length < PlayerInspectProjection.MAX_ROWS;
        start += 400
      ) {
        if (rows.length == PlayerInspectProjection.MAX_ROWS - 1) {
          rows.push('[Further details omitted]');
          return;
        }
        rows.push(
          text
            .substr(start, 400)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;'),
        );
      }
    }
  }

  return PlayerInspectProjection;
}
