import type { API } from '../api/Types';
import { GameReflection } from '../api/GameReflection';
import { DataManager } from '../game/Bindings';

export type DataRow = Record<string, unknown>;
export type DataTable = Record<string, DataRow>;

/** Cache matching keys, not result objects or rows: callers retain native ownership. */
export function installRangeIndex(api: API): void {
  const reflection = new GameReflection(api);
  let tables = new WeakMap<DataTable, Map<string, Map<string, string[]>>>();
  reflection.around(DataManager.prototype, 'loadRange', function (next, table, field, value) {
    if (!Object.hasOwn(this.json, table)) return next(table, field, value);
    const rows = this.json[table];
    let fields = tables.get(rows);
    if (!fields) tables.set(rows, (fields = new Map()));
    let values = fields.get(field);
    if (!values) fields.set(field, (values = new Map()));
    let keys = values.get(value);
    if (!keys) {
      keys = Object.keys(rows).filter((key) => {
        const row = rows[key];
        // Original AS3 and current Haxe both coerce the string query here.
        return Object.hasOwn(row, field) && row[field] == value;
      });
      values.set(value, keys);
    }
    return Object.fromEntries(keys.map((key) => [key, rows[key]]));
  });
  reflection.after(DataManager.prototype, 'cacheCommonData', function () {
    tables = new WeakMap();
  });
}
