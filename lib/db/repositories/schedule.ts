/** Автоматжуулалтын хуваарь (schedules, ганц мөр) repository — P3 симуляц. */
import type { Db } from "../index";

export interface Schedule {
  enabled: boolean;
  timeOfDay: string; // "HH:MM"
  autoSubmit: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export function getSchedule(db: Db): Schedule {
  const r = db.prepare("SELECT * FROM schedules WHERE id = 1").get() as
    | {
        enabled: number;
        time_of_day: string;
        auto_submit: number;
        last_run_at: string | null;
        next_run_at: string | null;
      }
    | undefined;
  if (!r) {
    return { enabled: false, timeOfDay: "09:00", autoSubmit: true, lastRunAt: null, nextRunAt: null };
  }
  return {
    enabled: r.enabled === 1,
    timeOfDay: r.time_of_day,
    autoSubmit: r.auto_submit === 1,
    lastRunAt: r.last_run_at,
    nextRunAt: r.next_run_at,
  };
}

export function updateSchedule(db: Db, patch: Partial<Schedule>): void {
  const cur = getSchedule(db);
  const n = { ...cur, ...patch };
  db.prepare(
    `UPDATE schedules
        SET enabled = ?, time_of_day = ?, auto_submit = ?, last_run_at = ?, next_run_at = ?,
            updated_at = datetime('now')
      WHERE id = 1`,
  ).run(
    n.enabled ? 1 : 0,
    n.timeOfDay,
    n.autoSubmit ? 1 : 0,
    n.lastRunAt,
    n.nextRunAt,
  );
}

/** timeOfDay-аас дараагийн ажиллах хугацааг (ISO) тооцно. */
export function computeNextRun(timeOfDay: string, from: Date): string {
  const [h, m] = timeOfDay.split(":").map(Number);
  const next = new Date(from);
  next.setHours(h || 0, m || 0, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next.toISOString();
}
