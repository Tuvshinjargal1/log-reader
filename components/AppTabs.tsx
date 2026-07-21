"use client";

export type AppTab = "overview" | "deals" | "raw";

interface AppTabsProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  dealCount: number;
  errorCount: number;
}

const TABS: { id: AppTab; label: string }[] = [
  { id: "overview", label: "Тойм" },
  { id: "deals", label: "Борлуулалт" },
  { id: "raw", label: "Дэлгэрэнгүй лог" },
];

export function AppTabs({ active, onChange, dealCount, errorCount }: AppTabsProps) {
  return (
    <div className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        let badge: string | null = null;
        if (tab.id === "deals" && dealCount > 0) badge = String(dealCount);
        if (tab.id === "overview" && errorCount > 0) badge = String(errorCount);

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-50 hover:text-stone-900",
            ].join(" ")}
          >
            {tab.label}
            {badge && (
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                  isActive
                    ? tab.id === "overview" && errorCount > 0
                      ? "bg-red-500 text-white"
                      : "bg-white/20 text-white"
                    : tab.id === "overview" && errorCount > 0
                      ? "bg-red-100 text-red-700"
                      : "bg-stone-100 text-stone-600",
                ].join(" ")}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
