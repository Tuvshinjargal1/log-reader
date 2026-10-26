import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
const SP = process.argv[2];
const db = new DatabaseSync('data/demo.db');
const one = (s,...a)=>db.prepare(s).get(...a);
const all = (s,...a)=>db.prepare(s).all(...a);

const out = {};
out.sms = one("select count(*) msgs, sum(segments) segs, sum(case when status='delivered' then 1 else 0 end) delivered from sms_outbox");
out.smsCols = db.prepare("select sql from sqlite_master where name='sms_outbox'").get().sql;
out.orders = one("select count(*) n, sum(total_qty) qty, sum(total_amount) amt, sum(case when status='submitted' then 1 else 0 end) submitted from orders");
out.lines = one("select count(*) n, sum(case when abs(final_qty-suggested_qty)>1e-6 then 1 else 0 end) touched from order_lines");
out.alerts = all("select severity, count(*) c from alerts where resolved_at is null group by severity");
out.ops = one("select count(*) c from operators");
out.schedules = all("select * from schedules limit 3");
fs.writeFileSync(SP+'/facts.json', JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
