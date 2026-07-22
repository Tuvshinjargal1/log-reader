"use client";

import { useCallback, useRef } from "react";

interface IpListInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const IP_RE = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
const IP_ONLY = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

function stripQuotes(s: string): string {
  return s.trim().replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, "").trim();
}

function isLikelyIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => n >= 0 && n <= 255);
}

/**
 * CSV / paste форматуудыг дэмжинэ:
 * - 172.25.20.35
 * - "172.25.20.35"
 * - 172.25.20.35, Баянзүрх
 * - "172.25.20.35","172.25.32.148" (нэг мөрөнд олон)
 */
export function parseIpLines(text: string): { ip: string; label: string | null }[] {
  const out: { ip: string; label: string | null }[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const fields = line
      .split(/[,;\t|]+/)
      .map(stripQuotes)
      .filter(Boolean);

    if (fields.length === 0) continue;

    const firstMatch = fields[0].match(IP_ONLY);
    if (firstMatch && isLikelyIp(firstMatch[1])) {
      if (!seen.has(firstMatch[1])) {
        seen.add(firstMatch[1]);
        const labelField = fields.slice(1).find((f) => !IP_ONLY.test(f));
        out.push({ ip: firstMatch[1], label: labelField || null });
      }
      for (let i = 1; i < fields.length; i++) {
        const m = fields[i].match(IP_ONLY);
        if (!m || !isLikelyIp(m[1]) || seen.has(m[1])) continue;
        seen.add(m[1]);
        out.push({ ip: m[1], label: null });
      }
      continue;
    }

    // Quote / холимог мөр — бүх IP-г мөрөөс гаргана
    IP_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IP_RE.exec(line)) !== null) {
      const ip = match[1];
      if (!isLikelyIp(ip) || seen.has(ip)) continue;
      seen.add(ip);
      out.push({ ip, label: null });
    }
  }

  return out;
}

export function IpListInput({ value, onChange, disabled }: IpListInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = parseIpLines(value);

  const handleFile = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const text = await file.text();
      onChange(value.trim() ? value.trimEnd() + "\n" + text : text);
      if (fileRef.current) fileRef.current.value = "";
    },
    [value, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          POS серверүүдийн IP жагсаалт
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          CSV файл оруулах
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={6}
        spellCheck={false}
        placeholder={
          'Мөр бүрт нэг IP (quote-той ч болно):\n"172.25.20.35"\n172.25.32.148\n10.32.11.232, Туршилтын POS'
        }
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-800 placeholder:text-stone-400 focus:border-teal-500 focus:outline-none disabled:bg-stone-50"
      />
      <p className="text-xs text-stone-500">
        {parsed.length > 0 ? (
          <>
            <span className="font-semibold text-teal-700">{parsed.length}</span> IP
            танигдлаа. Quote (`"172.x.x.x"`), CSV, таслалтай жагсаалтыг дэмжинэ.
          </>
        ) : (
          'IP хаяг оруулаагүй байна. Жишээ: "172.25.20.35" эсвэл энгийн IP.'
        )}
      </p>
    </div>
  );
}
