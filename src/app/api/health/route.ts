import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, db: "down", error: String((e as Error).message) }, { status: 503 });
  }
}
