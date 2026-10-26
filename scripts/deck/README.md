# Танилцуулга үүсгэгч (`docs/GS25-Replenishment-*.pptx`)

Слайд дээрх **бүх тоо ажиллаж буй системээс** гардаг — гараар бичсэн үзүүлэлт
байхгүй. Тиймээс демо датаг дахин seed хийсний дараа танилцуулгыг дахин
үүсгэхэд тоонууд өөрөө шинэчлэгдэнэ.

## Дахин үүсгэх

```bash
# 1) Демо дата шинэ эсэхийг батал (asOf = өчигдөр байх ёстой)
npm run seed:demo:reset

# 2) dev server-ыг ХҮЙТЭН эхлүүлээд (.env.local → data/demo.db) кэшийг шинэчил
npm run dev
curl -s "http://localhost:3000/api/board?refresh=1" -o scripts/deck/data/board.json
curl -s "http://localhost:3000/api/analytics"        -o scripts/deck/data/analytics.json

# 3) Сангаас шууд авдаг тоонууд (SMS, захиалга, дохио, хуваарь)
node scripts/deck/data/collect-facts.mjs scripts/deck/data

# 4) Дэлгүүрийн хүснэгт — board.json-оос эрэмбэлж бэлдэнэ
node -e "const fs=require('fs');const b=JSON.parse(fs.readFileSync('scripts/deck/data/board.json','utf8')).board;const rows=b.stores.map(s=>({code:s.code,name:s.name,mode:s.mode,v:s.verdictInfo.verdict,dir:s.verdictInfo.direction,svc:+(s.metrics.serviceRate*100).toFixed(1),ovr:+(s.metrics.overrideRate*100).toFixed(0),acc:s.metrics.overrideAccuracy==null?null:+(s.metrics.overrideAccuracy*100).toFixed(0),impact:s.verdictInfo.impactMnt,head:s.verdictInfo.headline,action:s.verdictInfo.action?s.verdictInfo.action.label:null}));const o={TUNE:0,WATCH:1,DATA:2,MANUAL:3,AUTO_OK:4};rows.sort((a,c)=>o[a.v]-o[c.v]||c.impact-a.impact);fs.writeFileSync('scripts/deck/data/stores.json',JSON.stringify(rows,null,1))"

# 4b) Backtest-ийн нэгтгэл (слайд 05) — ЗААВАЛ, /api/analytics-аар орлуулж БОЛОХГҮЙ
REPLENISH_DB_PATH=data/demo.db npx tsx scripts/deck/data/collect-backtest.ts

# 5) .pptx үүсгэх
pip install python-pptx           # нэг удаа
python scripts/deck/build_deck.py docs/GS25-Replenishment-2026-08.pptx
```

## PDF болгох (PowerPoint суулгаастай бол)

```powershell
$app = New-Object -ComObject PowerPoint.Application
$p = $app.Presentations.Open("<бүтэн зам>\GS25-Replenishment-2026-08.pptx", $true, $false, $false)
$p.SaveAs("<бүтэн зам>\GS25-Replenishment-2026-08.pdf", 32)
$p.Close(); $app.Quit()
```

## Анхаарах

- **Палитр нь `lib/board/verdict.ts`-тэй ижил** байх ёстой (CVD-ээр шалгасан
  teal/amber/indigo/rose + DATA нь хоосон чип). Өнгө солих бол хоёуланг нь зас.
- Слайд 05-ын "шударга байх ёстой зүйл" блок нь backtest-ийн `overstockReduced`
  СӨРӨГ гардгийг зориуд харуулна — engine илүү нөөц барьж үйлчилгээг авдаг.
  Энэ тоог нуувал танилцуулга худал болно.
- ⚠️ `/api/analytics`-ийн `overstockReduced` нь бүх ҮЕЧЛЭЛИЙН НИЙЛБЭР. Түүнийг
  ямар нэг дундаж үечлэлд хуваах нь БУРУУ — үечлэл бараа бүрт 6-68 хооронд
  хэлбэлзэнэ. Тиймээс `collect-backtest.ts` нь бараа тус бүрийн өдрийн дундажийг
  гаргаад нийлбэрлэдэг. (Анхны хувилбарт 76-д хуваасан нь 16.3 сая₮-ийг
  12.4 сая₮ гэж дутуу харуулж байсан.)
- Үсэг: **Segoe UI**. Өөр фонт сонговол монгол кирилл бүрэн дэмждэгийг шалга.
