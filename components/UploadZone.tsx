"use client";

import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  busy?: boolean;
}

export function UploadZone({ onFiles, busy }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const takeFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list).filter(
        (f) =>
          f.name.toLowerCase().endsWith(".log") ||
          f.name.toLowerCase().endsWith(".txt") ||
          f.type.startsWith("text/"),
      );
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onClick={() => !busy && inputRef.current?.click()}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) takeFiles(e.dataTransfer.files);
      }}
      className={[
        "cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging
          ? "border-teal-600 bg-teal-50"
          : "border-stone-300 bg-stone-50 hover:border-teal-500 hover:bg-teal-50/40",
        busy ? "pointer-events-none opacity-60" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".log,.txt,text/plain"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) takeFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-lg font-semibold text-stone-800">
        {busy ? "Файл уншиж байна…" : "Лог файл оруулах"}
      </p>
      <p className="mt-2 text-sm text-stone-500">
        Файл чирж тавих эсвэл дарж сонгоно уу.{" "}
        <code className="rounded bg-stone-200 px-1 text-xs">smartpos.log</code>{" "}
        эсвэл{" "}
        <code className="rounded bg-stone-200 px-1 text-xs">
          smartpos.YYYYMMDD__HH.log
        </code>{" "}
        зэрэг сонгож болно.
      </p>
      <p className="mt-1 text-xs text-stone-400">
        Файл зөвхөн таны компьютер дээр боловсруулагдана — серверт илгээгдэхгүй.
      </p>
    </div>
  );
}
