"use client";

/**
 * Нөхөн дүүргэлтийн модулийн дахин ашиглагдах UI элементүүд — тогтвортой,
 * цэгцтэй харагдац. Tailwind (stone/teal палитр) дээр суурилсан.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------- Icons (inline SVG, dependency-гүй) ----------

type IconProps = { className?: string };
const base = "h-4 w-4";

export const Icon = {
  sync: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3" />
      <path d="M21 3v6h-6M3 21v-6h6" />
    </svg>
  ),
  chart: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M3 3v18h18" /><rect x="7" y="10" width="3" height="7" /><rect x="12" y="6" width="3" height="11" /><rect x="17" y="13" width="3" height="4" />
    </svg>
  ),
  sms: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  gear: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  store: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6" />
    </svg>
  ),
  alert: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  map: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15" />
    </svg>
  ),
  grid: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  list: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  play: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={p.className ?? base}><path d="M5 3l14 9-14 9V3z" /></svg>
  ),
  download: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  trash: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  ),
  chevron: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  close: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  target: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" />
    </svg>
  ),
  clock: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  print: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" />
    </svg>
  ),
  sliders: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  ),
  trend: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M3 17l6-6 4 4 7-7" /><path d="M14 8h6v6" />
    </svg>
  ),
  user: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  history: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={p.className ?? base}>
      <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" />
    </svg>
  ),
};

// ---------- Card ----------

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={cn("rounded-xl border border-stone-200 bg-white", className)}>
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  description,
  right,
  icon,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon && <span className="mt-0.5 text-teal-600">{icon}</span>}
        <div>
          <h3 className="text-base font-bold text-stone-900">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

// ---------- Button ----------

type Variant = "primary" | "dark" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-teal-600 text-white hover:bg-teal-500 disabled:bg-teal-600/50",
  dark: "bg-stone-900 text-white hover:bg-stone-700 disabled:bg-stone-900/50",
  outline: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
  ghost: "text-stone-600 hover:bg-stone-100",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
};
const SIZE: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
};

export function Button({
  variant = "outline",
  size = "md",
  loading,
  icon,
  children,
  className,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}

// ---------- Segmented (tabs / toggles) ----------

export interface SegOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: Size;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active
                ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200"
                : "text-stone-500 hover:text-stone-800",
            )}
          >
            {o.icon}
            {o.label}
            {o.badge != null && o.badge > 0 && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                  active ? "bg-teal-100 text-teal-800" : "bg-stone-200 text-stone-600",
                )}
              >
                {o.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- StatTile ----------

export function StatTile({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "danger";
  icon?: ReactNode;
}) {
  const valueColor =
    tone === "warn" ? "text-amber-600" : tone === "danger" ? "text-red-600" : tone === "ok" ? "text-emerald-600" : "text-stone-900";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", valueColor)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-400">{hint}</div>}
    </div>
  );
}

// ---------- Badge ----------

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "emerald" | "amber" | "red" | "sky";
}) {
  const map = {
    neutral: "bg-stone-100 text-stone-600",
    teal: "bg-teal-100 text-teal-800",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    sky: "bg-sky-100 text-sky-800",
  };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", map[tone])}>
      {children}
    </span>
  );
}

// ---------- Alert ----------

export function Alert({
  tone,
  children,
  onClose,
}: {
  tone: "info" | "error" | "success";
  children: ReactNode;
  onClose?: () => void;
}) {
  const map = {
    info: "border-teal-200 bg-teal-50 text-teal-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-4 py-3 text-sm", map[tone])}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}

// ---------- EmptyState ----------

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
      {icon && <div className="mb-3 text-stone-300">{icon}</div>}
      <h3 className="text-base font-semibold text-stone-800">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-stone-500">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ---------- HelpToggle ("Хэрхэн уншиж байх вэ?") ----------

/**
 * График бүрийн толгойд тавих `?` товч. Танилцуулагч ижил зүйлийг дахин дахин
 * тайлбарлах шаардлагагүй болно.
 */
export function HelpToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors",
          open ? "bg-teal-50 text-teal-700" : "text-stone-400 hover:bg-stone-100 hover:text-stone-700",
        )}
      >
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
          ?
        </span>
        Тайлбар
      </button>
      {open && (
        <div className="mt-3 w-full rounded-lg border border-teal-200 bg-teal-50/60 px-3.5 py-2.5 text-sm leading-relaxed text-teal-900">
          {children}
        </div>
      )}
    </>
  );
}

// ---------- Skeleton ----------

/** Геометр нь бодит агуулгатай ЯГ таарсан ачаалалтын хайрцаг (layout jump-гүй). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-stone-200/70", className)} />;
}

// ---------- Drawer (slide-over) ----------

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Баруун талаас гарах хавтас. Хуудас солихын оронд үүнийг ашигладаг шалтгаан:
 * шийдвэрийн зураглал арын дэвсгэрт ХАРАГДСААР үлдэх ёстой — хаах үед хэрэглэгч
 * яг байсан газраа буцна, board дахин ачаалагдахгүй.
 *
 * z-2000: FleetMap-ийн тайлбар нь z-[1000], Leaflet-ийн pane-ууд 800 хүрдэг.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    const raf = requestAnimationFrame(() => {
      setShown(true);
      panelRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKey);
      // Өмнөх утгыг сэргээнэ — "" гэж таамаглахгүй
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-2000">
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-stone-900/40 transition-opacity duration-200 motion-reduce:transition-none",
          shown ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute inset-x-0 bottom-0 top-16 flex flex-col rounded-t-2xl bg-white shadow-2xl outline-none",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:w-[min(660px,100vw)] sm:rounded-none sm:border-l sm:border-stone-200",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          shown ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full",
        )}
      >
        <div className="flex items-start gap-3 border-b border-stone-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-bold text-stone-900">{title}</h2>
              {badge}
            </div>
            {subtitle && <div className="mt-1 text-sm text-stone-500">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <Icon.close className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
