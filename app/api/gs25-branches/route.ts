import { NextResponse } from "next/server";
import type { Gs25Branch } from "@/lib/load/types";

export const revalidate = 3600;

interface PayloadDoc {
  id: string;
  code?: string | number;
  name?: string;
  phone?: string;
  locationDetails?: { location?: [number, number] };
  services?: { isTwentyFourSeven?: boolean };
  _status?: string;
}

interface PayloadPage {
  docs: PayloadDoc[];
  hasNextPage: boolean;
}

/**
 * gs25.mn (Payload CMS) салбарын жагсаалтыг бүх хуудсаар нь татаж,
 * хялбарчилсан бүтцээр буцаана. CORS-оос зайлсхийхийн тулд proxy хийж байна.
 */
export async function GET() {
  try {
    const docs: PayloadDoc[] = [];
    let page = 1;

    while (page <= 10) {
      const res = await fetch(
        `https://gs25.mn/api/branches?limit=200&page=${page}&depth=0`,
        { next: { revalidate: 3600 } },
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: `gs25.mn хариу өгсөнгүй (HTTP ${res.status})` },
          { status: 502 },
        );
      }
      const data = (await res.json()) as PayloadPage;
      docs.push(...data.docs);
      if (!data.hasNextPage) break;
      page++;
    }

    const branches: Gs25Branch[] = docs
      .filter((d) => d._status !== "draft")
      .map((d) => {
        const loc = d.locationDetails?.location;
        return {
          id: d.id,
          code: String(d.code ?? "").trim(),
          name: d.name ?? "",
          // Payload дээр [lng, lat] дарааллаар хадгалагддаг
          lng: Array.isArray(loc) && loc.length === 2 ? loc[0] : null,
          lat: Array.isArray(loc) && loc.length === 2 ? loc[1] : null,
          phone: d.phone ?? null,
          isTwentyFourSeven: d.services?.isTwentyFourSeven ?? false,
        };
      })
      .filter((b) => b.code !== "");

    return NextResponse.json({ branches });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "gs25.mn-ээс татаж чадсангүй" },
      { status: 502 },
    );
  }
}
