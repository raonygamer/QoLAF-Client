import type { Resolve } from '../runtime/As3';
export function createMusicTrackCatalog(resolve: Resolve) {
  const DataLocator = resolve('data.DataLocator');
  /** Detached display metadata from the already-loaded DB cache; never loads audio. */

  class MusicTrackCatalog {
    public static getTracks(): any[] {
      let rows: any[] = [];
      let manager: any = DataLocator.getService();
      if (manager == null) return rows;
      let sounds: any = MusicTrackCatalog.cachedTable(manager, 'Sounds');
      if (sounds == null) return rows;
      let systems: any = MusicTrackCatalog.cachedTable(manager, 'SolarSystems');
      let key: string;
      for (key in sounds) {
        if (!sounds.hasOwnProperty(key) || !MusicTrackCatalog.validKey(key)) continue;
        let metadata: any = sounds[key];
        if (
          metadata == null ||
          metadata.type != 'music' ||
          !MusicTrackCatalog.validFileName(metadata.fileName)
        )
          continue;
        let fileName: string = metadata.fileName;
        let title: string = MusicTrackCatalog.cleanText(metadata.name);
        if (title.length == 0) title = MusicTrackCatalog.cleanText(metadata.title);
        if (title.length == 0) title = MusicTrackCatalog.fileTitle(fileName);
        let associated: any[] = MusicTrackCatalog.associatedSystems(systems, key);
        let subtitle: string =
          associated.length == 0
            ? 'File: ' + fileName
            : 'Systems: ' + associated.slice(0, 3).join(', ');
        if (associated.length > 3) subtitle += ' +' + (associated.length - 3) + ' more';
        rows.push({
          key: key,
          title: title,
          subtitle: subtitle,
          fileName: fileName,
          systems: associated,
        });
      }
      rows.sort(MusicTrackCatalog.compareTracks);
      return rows;
    }

    public static getTrack(key: string | null): any {
      if (!MusicTrackCatalog.validKey(key)) return null;
      let tracks: any[] = MusicTrackCatalog.getTracks();
      for (const row of tracks) {
        if (row.key == key) return row;
      }
      return null;
    }

    private static cachedTable(manager: any, table: string): any {
      try {
        // IDataManager.loadTable reads DataManager.json directly, unlike
        // load*FromBigDB. A not-yet-initialized cache can safely be absent.
        return manager.loadTable(table);
      } catch (error: any) {
        return null;
      }
      return null;
    }

    private static validKey(value: string | null): boolean {
      return (
        value != null && value.length > 0 && value.length <= 160 && !/[^A-Za-z0-9_-]/.test(value)
      );
    }

    private static validFileName(value: any): boolean {
      // A basename only: no paths, URLs, query strings, traversal or control
      // characters. Playback code constructs the trusted asset URL separately.
      return (
        typeof value === 'string' &&
        value.length <= 160 &&
        !/[^A-Za-z0-9 _.-]/.test(value) &&
        /^[A-Za-z0-9][A-Za-z0-9 _-]*\.mp3$/i.test(value)
      );
    }

    private static cleanText(value: any): string {
      if (!(typeof value === 'string')) return '';
      return value
        .replace(/[\x00-\x1f\x7f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^\s+|\s+$/g, '')
        .substr(0, 160);
    }

    private static fileTitle(fileName: string): string {
      let stem: string = fileName.replace(/\.mp3$/i, '').toLowerCase();
      if (stem == 'theme' || stem == 'oldtheme' || stem == 'old_theme') return 'Original Theme';
      // These are recognizable playlist labels, not asserted official song
      // titles: Playlist.THEME_DURIAN/FULZAR identify these two filenames.
      if (stem == 'theme_jorgen') return 'Durian (Jorgen)';
      if (stem == 'theme_steve') return 'Fulzar (Steve)';
      stem = stem.replace(/^theme[_ -]+/, '').replace(/[_-]+/g, ' ');
      let words: any[] = stem.split(/\s+/);
      for (let i: number = 0; i < words.length; i++) {
        let word: string = words[i];
        words[i] = word.charAt(0).toUpperCase() + word.substr(1);
      }
      return words.join(' ');
    }

    private static associatedSystems(table: any, key: string | null): any[] {
      let names: any[] = [];
      if (table == null) return names;
      let id: string;
      for (id in table) {
        if (!table.hasOwnProperty(id)) continue;
        let system: any = table[id];
        if (
          system == null ||
          (system.musicStandard != key && system.musicAction != key && system.musicQuiet != key)
        )
          continue;
        let name: string = MusicTrackCatalog.cleanText(system.name);
        if (name.length > 0 && names.indexOf(name) < 0) names.push(name);
      }
      names.sort(MusicTrackCatalog.compareText);
      return names;
    }

    private static compareText(left: string, right: string): number {
      let a: string = left.toLowerCase();
      let b: string = right.toLowerCase();
      if (a != b) return a < b ? -1 : 1;
      return left == right ? 0 : left < right ? -1 : 1;
    }

    private static compareTracks(left: any, right: any): number {
      let result: number = MusicTrackCatalog.compareText(left.title, right.title);
      return result == 0 ? MusicTrackCatalog.compareText(left.key, right.key) : result;
    }
  }

  return MusicTrackCatalog;
}
