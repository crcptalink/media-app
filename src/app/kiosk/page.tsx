import { one, type SP } from "@/components/Flash";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { loadBoard } from "@/lib/today";
import { KioskBoard } from "./KioskBoard";

export const dynamic = "force-dynamic";

export default async function KioskPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const token = one(sp.token) || "";
  if (!config.kioskToken || token !== config.kioskToken) {
    return <main className="p-10 text-center text-xl">Check-in display link is missing or wrong. Open it from Setup.</main>;
  }
  const board = await loadBoard(db);
  return <KioskBoard board={board} token={token} />;
}
