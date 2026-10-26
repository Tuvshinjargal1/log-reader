/**
 * POS схемийн нээлт — stock/waste/delivery хүснэгтийн бодит нэрийг олоход тусална.
 * INFORMATION_SCHEMA-аас холбогдох хүснэгт/баганыг татаж ангилна. Гарсан нэрийг
 * .env-д (POS_WASTE_TABLE гэх мэт) эсвэл lib/pos/queries.ts-д тохируулна.
 */
import type sql from "mssql";

export interface TableInfo {
  table: string;
  columns: { name: string; type: string }[];
}

export interface SchemaDiscovery {
  stock: TableInfo[];
  waste: TableInfo[];
  delivery: TableInfo[];
  other: TableInfo[];
}

const DISCOVERY_SQL = `
  SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS c, c.DATA_TYPE AS dt
    FROM INFORMATION_SCHEMA.COLUMNS c
    JOIN INFORMATION_SCHEMA.TABLES tb
      ON tb.TABLE_NAME = c.TABLE_NAME AND tb.TABLE_TYPE = 'BASE TABLE'
   WHERE c.TABLE_NAME LIKE 'TP[_]ST%'
      OR c.TABLE_NAME LIKE '%DISP%'  OR c.TABLE_NAME LIKE '%LOSS%'
      OR c.TABLE_NAME LIKE '%DISUSE%' OR c.TABLE_NAME LIKE '%WASTE%'
      OR c.TABLE_NAME LIKE '%RECV%'  OR c.TABLE_NAME LIKE '%DELIV%'
      OR c.TABLE_NAME LIKE '%GRN%'   OR c.TABLE_NAME LIKE '%INBND%'
   ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
`;

function classify(name: string): "stock" | "waste" | "delivery" | "other" {
  if (/DISP|LOSS|DISUSE|WASTE|THROW|DUMP|EXPIR/i.test(name)) return "waste";
  if (/RECV|DELIV|DLV|GRN|INBND|_IN$|_IN_/i.test(name)) return "delivery";
  if (/STK|STOCK|INV|SKU/i.test(name)) return "stock";
  return "other";
}

export async function discoverSchema(
  pool: sql.ConnectionPool,
): Promise<SchemaDiscovery> {
  const res = await pool
    .request()
    .query<{ t: string; c: string; dt: string }>(DISCOVERY_SQL);

  const byTable = new Map<string, { name: string; type: string }[]>();
  for (const r of res.recordset) {
    const cols = byTable.get(r.t);
    const col = { name: r.c, type: r.dt };
    if (cols) cols.push(col);
    else byTable.set(r.t, [col]);
  }

  const out: SchemaDiscovery = { stock: [], waste: [], delivery: [], other: [] };
  for (const [table, columns] of byTable) {
    out[classify(table)].push({ table, columns });
  }
  return out;
}
