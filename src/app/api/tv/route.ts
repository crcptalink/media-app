import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { loadBoard } from "@/lib/today";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!config.tvToken || token !== config.tvToken) return NextResponse.json({ error: "bad token" }, { status: 401 });
  return NextResponse.json(await loadBoard(db), { headers: { "Cache-Control": "no-store" } });
}
