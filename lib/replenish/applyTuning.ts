/** Auto-tune зөвлөмжийг батлаж config-д бичих + tuning_history + audit. */
import type { Db } from "@/lib/db/index";
import {
  setCategoryConfig,
  setItemConfig,
  setStoreConfig,
} from "@/lib/db/repositories/config";
import { addTuningHistory } from "@/lib/db/repositories/tuning";
import { audit } from "@/lib/db/repositories/ops";

export interface ApplyTuningInput {
  storeId: number;
  scope: "store" | "category" | "item";
  scopeKey?: string | null; // category_key эсвэл item_cd
  param: "serviceLevel" | "coverDays";
  from: number;
  to: number;
  reason?: string;
  by?: string;
}

export function applyTuning(db: Db, input: ApplyTuningInput): void {
  const patch = { [input.param]: input.to };

  if (input.scope === "store") {
    setStoreConfig(db, input.storeId, patch);
  } else if (input.scope === "category") {
    if (!input.scopeKey) throw new Error("categoryKey шаардлагатай");
    setCategoryConfig(db, input.storeId, input.scopeKey, patch);
  } else {
    if (!input.scopeKey) throw new Error("itemCd шаардлагатай");
    setItemConfig(db, input.storeId, input.scopeKey, patch);
  }

  addTuningHistory(db, {
    storeId: input.storeId,
    scope: input.scope,
    scopeKey: input.scopeKey ?? null,
    param: input.param,
    fromValue: input.from,
    toValue: input.to,
    reason: input.reason ?? null,
    appliedBy: input.by ?? null,
  });

  audit(db, {
    actor: input.by ?? null,
    action: "apply_tuning",
    entity: input.scope,
    entityId: input.scopeKey ?? String(input.storeId),
    before: { [input.param]: input.from },
    after: { [input.param]: input.to },
  });
}
