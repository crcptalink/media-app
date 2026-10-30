import { one, type SP } from "@/components/Flash";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { loadBoard } from "@/lib/today";
import { TvBoard } from "./TvBoard";

export const dynamic = "force-dynamic";

export default async function TvPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const token = one(sp.token) || "";
  if (!config.tvToken || token !== config.tvToken) {
    return <main className="min-h-screen bg-black p-10 text-center text-3xl text-white">TV link is missing or wrong. Open it from Admin → Setup.</main>;
  }
  return <TvBoard initial={await loadBoard(db)} token={token} />;
}
