# Нөхөн дүүргэлтийн үйл ажиллагааны систем (Replenishment Operations)

`/sms` таб — нэг оператор ~20 дэлгүүрийн бараа захиалгыг АВТОМАТ эсвэл ГАРААР
горимоор удирддаг систем. POS-оос борлуулалтын түүхийг татаж, тайлбарлагдахуйц
engine-ээр захиалгын санал гаргаж, бүх дэлгүүрийн шийдвэрийг visual diagram-аар
хянана.

## Архитектур (3 давхарга)

1. **Ingestion** (`lib/pos/`) — POS (MSSQL/DCSPS)-оос ӨДӨР ТУТМЫН борлуулалт +
   нөөц + (best-effort) хаягдал/нийлүүлэлтийг татаж `daily_metrics`-т бичнэ.
   Схем тодорхойгүй хүснэгтийг олон хувилбараар probe хийж, ажилласныг
   `store_schema_map`-д кэшилнэ (graceful degradation).
2. **Engine** (`lib/engine/`) — periodic-review order-up-to **(R, S)** бодлого:
   `μ` (recency-жинтэй, stockout өдрийг хассан) × гараг × трэнд × улирал →
   прогноз `D_P`; аюулгүйн нөөц `SS = z·σ·√P`; `S = D_P + SS`;
   захиалга `= max(0, S − IP)` → багц дугуйруулалт → min/max → shelf-life хязгаар.
   Бүх завсрын утга `DecisionFactors`-т хадгалагдаж диаграм/аудитыг тэжээнэ.
3. **UI/Diagram** (`app/sms/`, `components/sms/`, `lib/diagram/`) — зөвхөн
   хадгалсан шийдвэрийг уншина (live POS шаардахгүй). Fleet матриц/газрын зураг,
   дэлгүүрийн шийдвэрийн урсгал (SVG Sankey), ангилал→бараа засвар.

Бүх хадгалалт **SQLite** (`node:sqlite`, native build шаардахгүй) —
`lib/db/`. DB хандалт repository давхаргаар тусгаарлагдсан тул ирээдүйд
Postgres/better-sqlite3 руу шилжихэд зөвхөн тэр давхарга өөрчлөгдөнө.

## Config давхраалал (provenance-тэй)

`global → store → category → item` дарааллаар талбар тус бүрээр coalesce
(`lib/config/effective.ts`). Талбар бүр АЛЬ давхаргаас шийдэгдснийг тэмдэглэдэг
тул диаграм дээр "cover 5 — ангилал түвшинд" гэх мэт тайлбар гарна.

## Ажиллуулах

```bash
npm run dev            # хөгжүүлэлт
npm run build          # прод build
npm run smoke          # engine/DB/pipeline fixture тестүүд
```

`.env.local`: `POS_DB_*` (POS холболт), `REPLENISH_DB_PATH` (заавал биш).

### Урсгал (UI)
1. `/sms` — IP жагсаалт оруулж **"1 · POS-оос дата татах"** (ingest).
2. **"2 · Төлөвлөгөө гаргах"** (plan) — engine ажиллаж дэлгүүр бүрт санал үүснэ.
   Автомат горимтой + "шууд илгээх" сонгосон бол dev sink-ээр илгээгдэнэ.
3. Дэлгүүр рүү орж decision flow diagram-аас category→бараа руу орж эцсийн
   тоог гараар засаж, баталгаажуулж илгээх / CSV татах.

## API

| Route | Үйлдэл |
|-------|--------|
| `POST /api/ingest` | POS-оос дата татах (bootstrap + backfill) |
| `POST /api/plan` | Engine ажиллуулж захиалга үүсгэх (нэг/бүх дэлгүүр) |
| `GET  /api/stores` | Fleet тойм (матриц/зураг/дохио) |
| `GET  /api/stores/[id]` | Дэлгүүрийн сүүлийн захиалга + factor |
| `PATCH/POST /api/orders/[id]` | Мөр засах / илгээх / CSV export |
| `POST /api/config` | global/store/category/item config тохируулах |
| `GET  /api/analytics` | Fleet KPI + AUTO-vs-baseline нотолгоо (backtest) |
| `GET  /api/analytics?storeId=N` | Дэлгүүрийн backtest + health + tuning + seasonality |
| `GET/POST /api/tune` | Tuning түүх / зөвлөмж батлах |
| `POST /api/cycle` | Бүтэн мөчлөг (төлөвлөх + автомат SMS илгээх) |
| `GET  /api/outbox` | SMS/API захиалгын outbox (?storeId=N) |
| `GET/POST /api/schedule` | Автоматжуулалтын хуваарь (симуляц) |
| `POST /api/pos-schema` | POS схемийн нээлт (stock/waste/delivery хүснэгт олох) |
| `DELETE /api/stores/[id]` | Дэлгүүр устгах (`?data=1` бол зөвхөн дата цэвэрлэх) |
| `GET  /api/board` | **Шийдвэрийн зураглал** — verdict, метрик, trend (60сек кэш, `?refresh=1`) |
| `GET  /api/operators` | Оператор + хариуцах дэлгүүрийн тоо |
| `POST /api/whatif` | Параметр батлахаас өмнөх backtest туршилт |
| `GET  /api/audit` | Аудит + tuning түүхийн нэгдсэн урсгал |

## Захиалга илгээх (OrderSink)

`lib/ordering/` — `OrderSink` интерфейс + `DevOrderSink` (симуляц, external_ref
буцаана) + CSV export. Бодит GS25 SMS/API бэлэн болоход зөвхөн шинэ sink нэмнэ.

## P2 (хийгдсэн) — аналитик & auto-tune

- **Backtest engine** (`lib/engine/backtest.ts`) — walk-forward, (R,S) engine vs
  энгийн cover томьёог түүхэн борлуулалт дээр харьцуулж fill rate, service level,
  ₮-ээр алдагдсан борлуулалт/илүүдлийг хэмжинэ. Гол нотолгооны асет.
- **Seasonality** (`lib/engine/seasonality.ts`) — DOW/сарын multiplier +
  regime change илрүүлэлт → `seasonality_profile`.
- **Health score + зөвлөмж** (`lib/engine/health.ts`) — бараа тус бүрд 0-100
  оноо + "автомат хэвээр / нөөцлөлт нэмэх / бууруулах / гараар хянах" зөвлөмж.
- **Auto-tune** (`lib/engine/autotune.ts`) — serviceLevel/cover зөвлөмж; батлахад
  `tuning_history` + audit-д лог (чимээгүй өөрчлөхгүй).
- **Аналитик** (`lib/replenish/analytics.ts`) — дээрхийг бараа/дэлгүүр/fleet
  түвшинд нэгтгэж KPI + AUTO-vs-baseline тайлан.
- **ЧУХАЛ засвар:** POS-д бараа зарагдсан өдөр л мөр үүсдэг тул `densifyDaily`
  дутуу өдрийг 0 борлуулалтаар нөхөж, эрэлт/гараг/stockout-ыг зөв тооцно.
  Бодит датан дээр (14 хоног, 642 бараа): engine fill 92% vs энгийн 82%.

## P3 (хийгдсэн) — SMS/API симуляц & автоматжуулалт

- **SimulatedSmsSink** (`lib/ordering/smsSink.ts`) — захиалгыг GS25 захиалгын төв
  (дугаар 1348) руу SMS болгон "илгээнэ": олон бараатай бол 16-аар хэсэгчилж,
  Unicode segment тоо (кирилл 70/67), gateway лавлагаа, sent→delivered төлөв.
  Бодит датан дээр батлагдсан: 642 бараа → 41 SMS, 201 segment, бүгд delivered.
- **SMS/API консол** (`components/sms/SmsConsole.tsx`) — илгээсэн мессеж бүрийг
  бодит SMS gateway шиг харуулна (fleet болон дэлгүүрийн түвшинд). Танилцуулгын гол.
- **Автоматжуулалт** (`lib/replenish/cycle.ts`, `components/sms/AutomationPanel.tsx`)
  — "Бүтэн мөчлөг" = бүх дэлгүүрт төлөвлөж, автомат горимтойг нь SMS-ээр илгээх.
  Симуляц хуваарь (`schedules`): идэвх, өдрийн цаг, last/next run.
- **`sms_outbox`** хүснэгт бүх илгээлтийг хадгална; `defaultSink` нь одоо SMS симуляц.

**ТЭМДЭГЛЭЛ:** SMS/API нь СИМУЛЯЦ (танилцуулгад зориулсан). Бодит GS25 SMS/API
холбогдоход зөвхөн `lib/ordering/smsSink.ts`-ийг бодит хэрэгжүүлэлтээр солино.

## P4 (хийгдсэн) — Шийдвэрийн зураглал + демо дата

GS25-ийн захиралд танилцуулах шаардлагаас гарсан. Хариулах асуулт:
**"Автомат үед сайн байна уу, гараар үед сайн байна уу, эсвэл tune хийх
шаардлагатай байна уу?"** — 20 дэлгүүр × ~11 ангиллаар нэг дор.

### Шийдвэрийн 5 төлөв (`lib/replenish/board.ts`)

| Verdict | Утга | Үйлдэл |
|---|---|---|
| `AUTO_OK` | Автомат хэвээр | оролцох шаардлагагүй (гар горимд бол "автомат болго") |
| `TUNE` | Тохируулга шаардлагатай | `serviceLevel ±0.03` → `/api/tune` |
| `MANUAL` | Гараар үнэ цэнэ нэмж байна | операторыг үлдээ |
| `WATCH` | Хянах | шийдвэр гаргах хэмжээнд хүрээгүй |
| `DATA` | Дата дутуу | эхлээд дата цуглуул / холболт шалга |

**Гол статистик — `biasConsistency`** (`|Σδ| / Σ|δ|`):
- нэг талын өөрчлөлт (≥55%) = **параметр буруу** → TUNE
- хоёр талын өөрчлөлт (<55%) = **оператор моделд харагдахгүй зүйл мэднэ** → MANUAL

Үүнгүйгээр "надад tune хий" ба "хүнд итгэ" хоёр яг адилхан харагдана (хоёулаа
өндөр override + өндөр accuracy). Босгыг `scripts/smoke-board.ts` цоожилно.

⚠️ **Override-ыг хэмжихдээ нөөцийн байрлалыг ЗААВАЛ оруулна:**
`err = |IP + qty − realized|`. `suggested` нь `S − IP` (байгаа нөөцөө хассан) тул
IP-гүйгээр жишвэл "илүү их захиалсан нь үргэлж хожно" гэсэн хазайлт үүсэж,
хоёр талын оператор зоос шидсэнтэй адил харагдана.

### Демо дата (`scripts/demo/`, `scripts/seed-demo.ts`)

**Mock нь ЗӨВХӨН ОРЦ — engine бодит.** Дэлгүүрийг өдөр өдрөөр симуляц хийж
(`simulate.ts`), захиалгыг **бодит `computeSuggestion`**-оор гаргана. Тиймээс
`stockout_flag`, `on_hand_end`, `waste_qty`, `delivered_qty` бүгд нийцтэй, нөөц
дутагдал нь дутуу захиалгаас ӨӨРӨӨ үүснэ.

20 дэлгүүрийн архетип (`archetypes.ts`) → хүлээгдэх verdict:
8 `auto_healthy` · 2 `tune_up` · 2 `tune_down` · 4 `manual_value` ·
2 `data_problem` · 2 `offline`.

Seed нь дуусахдаа **бодит** verdict-ыг тооцоолж хэвлэдэг (хүлээснийг биш) —
зөрвөл `⚠` тэмдэглэнэ. Тул хураангуй ба дэлгэц хэзээ ч зөрөхгүй.

**Runbook (дараалал чухал):**
1. `next dev`-ийг **зогсоох** (seed бичих түгжээ авна; UI-аас planStore хийвэл `SQLITE_BUSY`).
2. `npm run seed:demo:reset` (~25-40 сек).
3. `.env.local`-д: `REPLENISH_DB_PATH=data/demo.db`, `NEXT_PUBLIC_DEMO_MODE=1`.
4. `npm run dev` — **ЗААВАЛ хүйтэн** эхлүүлэх. `DB_PATH` нь module-level const,
   `globalThis.__replenishDb` нь HMR-ийг даван гардаг тул reload хангалтгүй.
   **Танилцуулга унах хамгийн магадлалтай шалтгаан нь энэ.**
5. Танилцуулгын өглөө **дахин seed** — `asOf` = өчигдөр, өдөр бүр хөдөлдөг.
   Хоцорвол board нь `staleSeed` тэмдэглэж, дэлгэцэн дээр сануулна.
6. Production-д буцах: хоёр env мөрийг comment + хүйтэн restart.

**Бодит салбарын нэр/координат:** `npm run seed:demo -- --live-branches` нь
gs25.mn-ээс татаж, `branches.ts`-д хуулах TS literal хэвлэнэ (нэг удаа).
Гараар тавьсан координатыг GS25-ийн бодит хаяг гэж танилцуулж болохгүй.

**Демо горим** (`NEXT_PUBLIC_DEMO_MODE=1`) — POS IP тохиргоо, "Дата цэвэрлэх /
Устгах" товч нуугдана, gs25.mn руу гадаад дуудлага хийхгүй (венью wifi дээр
хүлээлт үүсгэхгүй), толгойд `ДЕМО` тэмдэг гарна. Тохиргоо руу хүрэх дуугүй зам
footer-т үлдэнэ.

### Chart дизайны шийдвэрүүд (заавал уншина)

Палитрыг **тооцоолж** баталгаажуулсан (нүдээр биш), `dataviz` skill-ийн
`validate_palette.js`-ээр:

- `AUTO_OK` нь аппын ердийн **emerald БИШ, teal `#0d9488`**. Учир: emerald
  `#059669` ↔ rose `#e11d48` хосын CVD ΔE нь **5.8** (deuteranopia) — 6.0
  давхаргаас ч доогуур, өөрөөр хэлбэл "сайн/муу" нь эрэгтэйчүүдийн ~8%-д
  ялгагдахгүй. Teal болгоход **10.2** → PASS.
- `DATA` нь 5 дахь ӨНГӨ БИШ — **хоосон чип**. Саарал нэмбэл chroma floor-оос
  унаад teal-тэй ΔE 5.0 болж мөргөлдөнө.
- Амберын контраст 2.15:1 (<3:1) — нүдэн доторх **тэмдэг** ба **хүснэгт
  харагдац** гэсэн хоёр туслах сувгаар зайлуулагдана. Эдгээр нь заавал шиппэгдэнэ.

**Шийдвэрийн зураг нь ГУРВАН бүстэй, дөрөв БИШ.** Зүүн талыг (оролцоо <15%)
50%-ийн шугамаар хуваавал 4-6 мөрөөс тооцоолсон шуугиан дээр тулгуурлан сайн
ажиллаж байгаа 8 дэлгүүрийг "ХЯНАХ" гэж тэмдэглэнэ — эхний хувилбарт яг ингэж
болсон.

**Trend нь small multiples, dual-axis БИШ.** Нөөц дуусалт (тоо) ба гараар
өөрчлөлт (хувь) нь масштаб нь өөр тул хоёр тусдаа зураг, x-тэнхлэг ба хуанлийн
эгнээг хуваалцана. Нөхөлтийг (fill rate) харуулаагүй шалтгаан: 99-100% хооронд
хэлбэлздэг тул ямар ч масштабаар хавтгай шугам болно.

## Цаашид (P5+)

- Бодит GS25 SMS/API sink (одоо симуляц).
- Scheduling — Windows Task Scheduler / cron → `POST /api/cycle` (өдөр бүр).
- Auth/RBAC — `operators`/`operator_stores` хүснэгт ба `/api/operators` бэлэн,
  session/login хараахан алга (одоо хамрах хүрээг сонгодог л).
- Alerts push (одоо exception queue + дохио хүснэгтэд).
- `alerts` хүснэгт хязгааргүй өсдөг: `clearStoreAlerts` нь `resolved_at` тавьдаг,
  устгадаггүй. Зөв засал: 7 хоногоос хойшхи шийдэгдсэн дохиог DELETE.
- Postgres сонголт (repository давхарга бэлэн).

## POS схем тааруулах (хийгдсэн)

- `POST /api/pos-schema {ip}` — INFORMATION_SCHEMA-аас stock/waste/delivery хүснэгт
  олно (`lib/pos/discover.ts`).
- **Олдсон:** GS25 DCSPS-д **`TP_ST_SKU_ACHIV`** нь өдөр/бараагаар `SELL_QTY`,
  `DISCD_QTY` (хаягдал), `STKIN_QTY` (нийлүүлэлт), `PRES_QTY` (өдрийн нөөц),
  `ORDER_QTY`-г агуулна. Ingest эхлээд үүнийг уншиж нөөц/хаягдал/нийлүүлэлт +
  өдрийн нөөцийг авна (`lib/pos/queries.ts` → `ACHIV_QUERY`). Байхгүй бол хуучин
  probe-ууд руу шилжинэ.
- Схем өөр бол `.env`-ээс дарж болно: `POS_STOCK/WASTE/DELIVERY_TABLE/DATE/ITEM/QTY`.
- **Тэмдэглэл:** `PRES_QTY` нь өдрийн эцсийн үлдэгдэл тул 0 байхыг stockout гэж
  үзэхгүй (эрэлт хэт хасагдана); stockout-ыг борлуулалтын `inferStockouts` тодорхойлно.

## Дата устгах (хийгдсэн)

- Дэлгүүрийн дэлгэрэнгүй хуудсанд **"Дата цэвэрлэх"** (метрик/захиалга/SMS устгаж,
  дэлгүүр+тохиргоо үлдээнэ) ба **"Дэлгүүр устгах"** (бүрэн, cascade) товч.
