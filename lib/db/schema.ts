/**
 * Нөхөн дүүргэлтийн үйл ажиллагааны SQLite схем.
 *
 * Схемийг TS модульд шингээсэн (тусдаа .sql файл болгосонгүй) — Next-ийн
 * server bundle дотор файлын зам найдваргүй болдгийг тойрч, схемийг код
 * дундаа авч явахад хялбар. Бүх хүснэгт `IF NOT EXISTS` тул дахин ажиллуулахад
 * аюулгүй; хувилбарыг `PRAGMA user_version`-оор хянана (lib/db/index.ts).
 *
 * Config давхраалал (global → store → category → item) нь тусдаа хүснэгтүүдэд
 * SPARSE (nullable) override баганаар хадгалагдана. "effective config"-ыг
 * уншихдаа lib/config/effective.ts дотор coalesce хийж тооцно.
 */
export const SCHEMA_VERSION = 4;

export const SCHEMA_SQL = /* sql */ `
-- Бүх дэлгүүрийн суурь тохиргоо (ганц мөр, id=1)
CREATE TABLE IF NOT EXISTS global_defaults (
  id                     INTEGER PRIMARY KEY CHECK (id = 1),
  mode                   TEXT    NOT NULL DEFAULT 'manual',   -- 'auto' | 'manual'
  review_period_days     INTEGER NOT NULL DEFAULT 1,          -- R: захиалгын давтамж (хоног)
  lead_time_days         INTEGER NOT NULL DEFAULT 1,          -- L: хүргэлтийн хугацаа
  cover_days             INTEGER NOT NULL DEFAULT 3,          -- энгийн нөөцлөх хоног (fallback)
  service_level          REAL    NOT NULL DEFAULT 0.95,       -- үйлчилгээний түвшин → z
  auto_submit_max_amount REAL,                                -- ₮ босго: доош авто, дээш approval; NULL = авто илгээхгүй
  updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Оператор (нэг хүн олон дэлгүүр хариуцна)
CREATE TABLE IF NOT EXISTS operators (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT,
  role       TEXT    NOT NULL DEFAULT 'operator',  -- 'admin' | 'operator' | 'viewer'
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Дэлгүүр (POS)
CREATE TABLE IF NOT EXISTS stores (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ip           TEXT    NOT NULL UNIQUE,
  bizpl_cd     TEXT,
  code         TEXT,                                -- gs25.mn-тэй тулгах нормчилсон код
  name         TEXT    NOT NULL,
  lat          REAL,
  lng          REAL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  last_sync_at TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS operator_stores (
  operator_id INTEGER NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  store_id    INTEGER NOT NULL REFERENCES stores(id)    ON DELETE CASCADE,
  PRIMARY KEY (operator_id, store_id)
);

-- Барааны каталог (дэлгүүр тус бүрд)
CREATE TABLE IF NOT EXISTS items (
  store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_cd         TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  mcls_cd         TEXT,
  mcls_nm         TEXT,
  scls_cd         TEXT,
  scls_nm         TEXT,
  price           REAL,
  order_multiple  INTEGER NOT NULL DEFAULT 1,       -- багц/кейс дугуйруулалт
  min_qty         INTEGER,
  max_qty         INTEGER,
  lead_time_days  INTEGER,
  shelf_life_days INTEGER,
  perishable      INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (store_id, item_cd)
);

-- Config override давхаргууд (бүх багана nullable = "override хийгээгүй")
CREATE TABLE IF NOT EXISTS store_config (
  store_id               INTEGER PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  mode                   TEXT,
  review_period_days     INTEGER,
  lead_time_days         INTEGER,
  cover_days             INTEGER,
  service_level          REAL,
  auto_submit_max_amount REAL,
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS category_config (
  store_id       INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_key   TEXT    NOT NULL,                  -- = items.mcls_cd (том ангилал)
  mode           TEXT,
  cover_days     INTEGER,
  service_level  REAL,
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (store_id, category_key)
);

CREATE TABLE IF NOT EXISTS item_config (
  store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_cd         TEXT    NOT NULL,
  mode            TEXT,
  cover_days      INTEGER,
  service_level   REAL,
  order_multiple  INTEGER,
  min_qty         INTEGER,
  max_qty         INTEGER,
  shelf_life_days INTEGER,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (store_id, item_cd)
);

-- Өдөр тутмын хэмжигдэхүүн (engine-ийн эх сурвалж)
CREATE TABLE IF NOT EXISTS daily_metrics (
  store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_cd       TEXT    NOT NULL,
  d             TEXT    NOT NULL,                   -- YYYYMMDD
  sold_qty      REAL    NOT NULL DEFAULT 0,
  sold_amt      REAL    NOT NULL DEFAULT 0,
  on_hand_end   REAL,
  waste_qty     REAL,
  delivered_qty REAL,
  stockout_flag INTEGER NOT NULL DEFAULT 0,         -- тухайн өдөр нөөц 0 болсон эсэх (censored demand)
  PRIMARY KEY (store_id, item_cd, d)
);
CREATE INDEX IF NOT EXISTS idx_daily_store_item ON daily_metrics(store_id, item_cd);
CREATE INDEX IF NOT EXISTS idx_daily_d          ON daily_metrics(d);

-- POS гүйлгээний цагийн нэгтгэл (TP_TR_HDR COUNT) — өдөр/цагийн оргил ачаалал
CREATE TABLE IF NOT EXISTS tx_hourly (
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  d        TEXT    NOT NULL,                   -- YYYYMMDD
  hour     INTEGER NOT NULL,                   -- 0-23
  tx_count INTEGER NOT NULL DEFAULT 0,
  amount   REAL    NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, d, hour)
);
CREATE INDEX IF NOT EXISTS idx_tx_hourly_store_d ON tx_hourly(store_id, d);

-- Улирлын профайл (DOW/сарын multiplier) — P2-д баяжина
CREATE TABLE IF NOT EXISTS seasonality_profile (
  store_id     INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  scope        TEXT    NOT NULL,                    -- 'dow' | 'month'
  bucket       INTEGER NOT NULL,                    -- dow: 0-6, month: 1-12
  multiplier   REAL    NOT NULL DEFAULT 1,
  sample_count INTEGER NOT NULL DEFAULT 0,
  confidence   REAL    NOT NULL DEFAULT 0,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (store_id, scope, bucket)
);

-- Захиалга (толгой)
CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status          TEXT    NOT NULL DEFAULT 'proposed', -- proposed|edited|confirmed|submitted|received|failed|cancelled
  mode            TEXT    NOT NULL,                     -- шийдвэр гаргах үеийн дэлгүүрийн горим
  order_date      TEXT    NOT NULL,                     -- YYYYMMDD
  total_qty       REAL    NOT NULL DEFAULT 0,
  total_amount    REAL    NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  submitted_at    TEXT,
  submitted_by    TEXT,
  sink_type       TEXT,
  external_ref    TEXT,
  idempotency_key TEXT UNIQUE,
  note            TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id, order_date);

-- Захиалгын мөр (шийдвэрийн өөрчлөгдөшгүй snapshot энд хадгалагдана)
CREATE TABLE IF NOT EXISTS order_lines (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_cd          TEXT    NOT NULL,
  name             TEXT    NOT NULL,
  category_key     TEXT,
  category_nm      TEXT,
  price            REAL,
  suggested_qty    REAL    NOT NULL,
  final_qty        REAL    NOT NULL,
  decided_by       TEXT    NOT NULL,                 -- 'auto' | 'manual'
  config_snapshot  TEXT,                             -- JSON: effective config + provenance
  factors_snapshot TEXT                              -- JSON: engine-ийн бүх factor (диаграмын эх сурвалж)
);
CREATE INDEX IF NOT EXISTS idx_lines_order ON order_lines(order_id);

-- Ingestion гүйлт бүрийн бүртгэл
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id    INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  started_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  status      TEXT    NOT NULL DEFAULT 'running',    -- running|ok|degraded|failed
  datasets    TEXT,                                  -- JSON {sales,stock,waste,delivery,tx}
  rows        INTEGER,
  error       TEXT
);

-- Аль probe query аль дэлгүүрт ажилласныг кэшлэх
CREATE TABLE IF NOT EXISTS store_schema_map (
  store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  dataset       TEXT    NOT NULL,                    -- 'stock'|'waste'|'delivery'|'bizpl'
  query_variant TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (store_id, dataset)
);

-- Аудит (хэн юуг хэзээ өөрчилсөн)
CREATE TABLE IF NOT EXISTS audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT NOT NULL DEFAULT (datetime('now')),
  actor     TEXT,
  action    TEXT NOT NULL,
  entity    TEXT,
  entity_id TEXT,
  before    TEXT,
  after     TEXT
);

-- Онцгой байдлын дохио (exception queue)
CREATE TABLE IF NOT EXISTS alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id    INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  kind        TEXT    NOT NULL,                      -- stockout_risk|offline|stale|spike|waste|low_confidence
  severity    TEXT    NOT NULL,                      -- info|warn|critical
  item_cd     TEXT,
  message     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

-- Tuning түүх (P2) — auto-tune зөвлөмжийг батлахад before→after лог
CREATE TABLE IF NOT EXISTS tuning_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  at           TEXT    NOT NULL DEFAULT (datetime('now')),
  store_id     INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  scope        TEXT    NOT NULL,                    -- 'store' | 'category' | 'item'
  scope_key    TEXT,                                -- category_key эсвэл item_cd
  param        TEXT    NOT NULL,                    -- 'coverDays' | 'serviceLevel' | ...
  from_value   TEXT,
  to_value     TEXT,
  reason       TEXT,
  applied_by   TEXT
);
CREATE INDEX IF NOT EXISTS idx_tuning_store ON tuning_history(store_id);

-- SMS/API захиалгын outbox (P3 симуляц) — илгээсэн мессеж бүрийн бүртгэл
CREATE TABLE IF NOT EXISTS sms_outbox (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  store_id     INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  to_number    TEXT    NOT NULL,
  segments     INTEGER NOT NULL DEFAULT 1,
  body         TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'sent',   -- queued|sent|delivered|failed
  gateway_ref  TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT,
  error        TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_store ON sms_outbox(store_id);
CREATE INDEX IF NOT EXISTS idx_outbox_order ON sms_outbox(order_id);

-- Автоматжуулалтын хуваарь (P3 — одоохондоо ганц мөр, симуляц)
CREATE TABLE IF NOT EXISTS schedules (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  enabled      INTEGER NOT NULL DEFAULT 0,
  time_of_day  TEXT    NOT NULL DEFAULT '09:00',
  auto_submit  INTEGER NOT NULL DEFAULT 1,
  last_run_at  TEXT,
  next_run_at  TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Суурь мөрүүдийг баталгаажуулна
INSERT OR IGNORE INTO global_defaults (id) VALUES (1);
INSERT OR IGNORE INTO schedules (id) VALUES (1);
`;
