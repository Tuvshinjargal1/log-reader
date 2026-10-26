/**
 * POS (DCSPS) SQL асуулгууд. stock/waste/delivery-ийн хүснэгт/баганын нэр POS
 * хувилбар бүрд өөр байж болзошгүй тул:
 *   1) .env-ээс тохируулсан хувилбарыг (POS_*_TABLE/DATE/ITEM/QTY) ЭХЭНД туршина;
 *   2) дараа нь мэдэгдэж буй нэрсийн хувилбаруудыг туршина (probe);
 * ажилласан хувилбарыг store_schema_map-д кэшилнэ. Аль нь ч таарахгүй бол
 * graceful degradation (тухайн dataset=false). Хүснэгтийн бодит нэрийг олоход
 * lib/pos/discover.ts (эсвэл GET /api/pos-schema) ашиглана.
 */

export interface QueryVariant {
  id: string;
  sql: string;
}

/**
 * Өдөр тутмын борлуулалт — `sale_dt`-ээр бүлэглэж ӨДРИЙН нарийвчлалтай.
 */
export const DAILY_SALES_QUERY = `
  SELECT i.sale_dt                            AS d,
         i.item_cd                            AS item_cd,
         m.item_nm                            AS item_nm,
         m.short_item_nm                      AS short_item_nm,
         m.sprc                               AS sprc,
         m.item_mcls_cd                        AS mcls_cd,
         mc.item_mcls_nm                       AS mcls_nm,
         m.item_scls_cd                        AS scls_cd,
         sc.item_scls_nm                       AS scls_nm,
         SUM(CAST(i.sell_qty AS FLOAT))        AS qty,
         SUM(CAST(i.sell_qty AS FLOAT) * CAST(ISNULL(m.sprc, 0) AS FLOAT)) AS amt
    FROM TP_TR_ITEM i WITH (NOLOCK)
    JOIN TP_TR_HDR h WITH (NOLOCK)
      ON h.sale_dt = i.sale_dt
     AND h.pos_no = i.pos_no
     AND h.sell_seqno = i.sell_seqno
    LEFT JOIN TP_MS_ITEM m WITH (NOLOCK) ON m.item_cd = i.item_cd
    LEFT JOIN TP_MS_MCLS mc WITH (NOLOCK) ON mc.item_mcls_cd = m.item_mcls_cd
    LEFT JOIN TP_MS_SCLS sc WITH (NOLOCK)
      ON sc.item_mcls_cd = m.item_mcls_cd
     AND sc.item_scls_cd = m.item_scls_cd
   WHERE i.sale_dt BETWEEN @from AND @to
     AND h.deal_sp_cd = '01'
     AND ISNULL(i.sku_cncl_yn, 'N') = 'N'
   GROUP BY i.sale_dt, i.item_cd, m.item_nm, m.short_item_nm, m.sprc,
            m.item_mcls_cd, mc.item_mcls_nm, m.item_scls_cd, sc.item_scls_nm
`;

/**
 * Өдөр тутмын SKU гүйцэтгэл (TP_ST_SKU_ACHIV) — нэг хүснэгтэд өдөр/бараагаар
 * борлуулалт, ХАЯГДАЛ (DISCD), НИЙЛҮҮЛЭЛТ (STKIN), ӨДРИЙН НӨӨЦ (PRES) багтдаг.
 * Энэ нь нөөц/хаягдал/нийлүүлэлт + өдрийн нөөц (stockout илрүүлэлт)-ийг нэгэн
 * зэрэг өгдөг тул тусдаа probe-уудаас илүү.
 */
export const ACHIV_QUERY = `
  SELECT STEV_DT                              AS d,
         ITEM_CD                              AS item_cd,
         SUM(CAST(ISNULL(DISCD_QTY, 0) AS FLOAT)) AS waste,
         SUM(CAST(ISNULL(STKIN_QTY, 0) AS FLOAT)) AS delivered,
         SUM(CAST(ISNULL(PRES_QTY, 0) AS FLOAT))  AS on_hand
    FROM TP_ST_SKU_ACHIV WITH (NOLOCK)
   WHERE STEV_DT BETWEEN @from AND @to
   GROUP BY STEV_DT, ITEM_CD
`;

/**
 * Гүйлгээний тоо — `TP_TR_HDR`-аас чек (борлуулалт) бүрийг тоолно.
 * Өдөр × цагаар бүлэглэснээр: өдрийн тоо, сарын нийт, нэг цагийн оргил,
 * өдрийн оргил гэсэн дөрвөн үзүүлэлтийг тооцоолж болно.
 */
export const HOURLY_TX_QUERY = `
  SELECT sale_dt,
         DATEPART(HOUR, sell_end_dttm) AS hr,
         COUNT(*) AS tx_cnt,
         SUM(CAST(ISNULL(sum_amt, 0) AS BIGINT)) AS amt
    FROM TP_TR_HDR WITH (NOLOCK)
   WHERE sale_dt BETWEEN @from AND @to
     AND deal_sp_cd = '01'
   GROUP BY sale_dt, DATEPART(HOUR, sell_end_dttm)
`;

/** bizpl_cd унших хувилбарууд */
export const BIZPL_QUERIES: QueryVariant[] = [
  { id: "pos_cnf", sql: "SELECT TOP 1 fst_cvs_site_cd AS cd FROM TP_SS_POS_CNF WITH (NOLOCK)" },
  { id: "ms_site", sql: "SELECT TOP 1 cvs_site_cd AS cd FROM TP_MS_SITE WITH (NOLOCK)" },
];

const STOCK_DEFAULTS: QueryVariant[] = [
  { id: "sku_stk", sql: "SELECT item_cd AS item_cd, CAST(stk_qty AS FLOAT) AS qty FROM TP_ST_SKU_STK WITH (NOLOCK)" },
  { id: "sku_pres", sql: "SELECT item_cd AS item_cd, CAST(pres_qty AS FLOAT) AS qty FROM TP_ST_SKU_STK WITH (NOLOCK)" },
  { id: "goods_stk", sql: "SELECT goods_cd AS item_cd, CAST(stk_qty AS FLOAT) AS qty FROM TP_ST_SKU_STK WITH (NOLOCK)" },
  { id: "sku_cur", sql: "SELECT item_cd AS item_cd, CAST(cur_stk_qty AS FLOAT) AS qty FROM TP_ST_SKU WITH (NOLOCK)" },
];

const WASTE_DEFAULTS: QueryVariant[] = [
  { id: "disposal", sql: "SELECT disp_dt AS d, item_cd AS item_cd, CAST(disp_qty AS FLOAT) AS qty FROM TP_ST_DISPOSAL WITH (NOLOCK) WHERE disp_dt BETWEEN @from AND @to" },
  { id: "loss", sql: "SELECT loss_dt AS d, item_cd AS item_cd, CAST(loss_qty AS FLOAT) AS qty FROM TP_ST_LOSS WITH (NOLOCK) WHERE loss_dt BETWEEN @from AND @to" },
  { id: "disuse", sql: "SELECT disuse_dt AS d, item_cd AS item_cd, CAST(disuse_qty AS FLOAT) AS qty FROM TP_ST_DISUSE WITH (NOLOCK) WHERE disuse_dt BETWEEN @from AND @to" },
];

const DELIVERY_DEFAULTS: QueryVariant[] = [
  { id: "in", sql: "SELECT in_dt AS d, item_cd AS item_cd, CAST(in_qty AS FLOAT) AS qty FROM TP_ST_IN WITH (NOLOCK) WHERE in_dt BETWEEN @from AND @to" },
  { id: "recv", sql: "SELECT recv_dt AS d, item_cd AS item_cd, CAST(recv_qty AS FLOAT) AS qty FROM TP_ST_RECV WITH (NOLOCK) WHERE recv_dt BETWEEN @from AND @to" },
  { id: "gr", sql: "SELECT gr_dt AS d, item_cd AS item_cd, CAST(gr_qty AS FLOAT) AS qty FROM TP_ST_GR WITH (NOLOCK) WHERE gr_dt BETWEEN @from AND @to" },
];

/** .env-ээс тохируулсан хувилбар (байвал). */
function envVariant(prefix: string): QueryVariant | null {
  const table = process.env[`${prefix}_TABLE`];
  const itemCol = process.env[`${prefix}_ITEM`];
  const qtyCol = process.env[`${prefix}_QTY`];
  const dateCol = process.env[`${prefix}_DATE`];
  if (!table || !itemCol || !qtyCol) return null;
  const dSelect = dateCol ? `${dateCol} AS d, ` : "";
  const where = dateCol ? `WHERE ${dateCol} BETWEEN @from AND @to` : "";
  return {
    id: "env",
    sql: `SELECT ${dSelect}${itemCol} AS item_cd, CAST(${qtyCol} AS FLOAT) AS qty FROM ${table} WITH (NOLOCK) ${where}`,
  };
}

function withEnv(prefix: string, defaults: QueryVariant[]): QueryVariant[] {
  const e = envVariant(prefix);
  return e ? [e, ...defaults] : defaults;
}

export function stockQueries(): QueryVariant[] {
  return withEnv("POS_STOCK", STOCK_DEFAULTS);
}
export function wasteQueries(): QueryVariant[] {
  return withEnv("POS_WASTE", WASTE_DEFAULTS);
}
export function deliveryQueries(): QueryVariant[] {
  return withEnv("POS_DELIVERY", DELIVERY_DEFAULTS);
}
