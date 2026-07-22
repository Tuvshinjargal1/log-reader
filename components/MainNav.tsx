"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Лог унших" },
  { href: "/load", label: "Салбарын ачаалал" },
  { href: "/sms", label: "SMS auto manager" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
            SmartPOS
          </h1>
          <p className="text-xs text-stone-500">GS25 POS хяналт, шинжилгээний хэрэгсэл</p>
        </div>
        <nav className="flex gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
          {LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-stone-900 text-white shadow-sm"
                    : "text-stone-600 hover:bg-white hover:text-stone-900",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
