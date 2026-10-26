"use client";

/**
 * Демо горим — GS25 танилцуулгын үед POS-ийн IP хаяг, устгах товч зэрэг
 * дотоод зүйлсийг нуух.
 *
 * `useSearchParams` ЗОРИУД хэрэглээгүй: тэр hook нь хамгийн доод Suspense
 * boundary хүртэл client-render шаардана, харин `/sms` хуудсанд boundary
 * байхгүй тул нэмэх шаардлагатай болно. `window.location.search`-ыг effect-д
 * унших нь ямар ч эрсдэлгүй.
 */
import { useEffect, useState } from "react";

const STORAGE_KEY = "sms.demoMode";

export function useDemoMode(): boolean {
  const envDefault = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
  const [demo, setDemo] = useState(envDefault);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("demo");
    if (q === "1" || q === "0") {
      const on = q === "1";
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
      setDemo(on);
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "1" || saved === "0") {
      setDemo(saved === "1");
      return;
    }
    setDemo(envDefault);
  }, [envDefault]);

  return demo;
}
