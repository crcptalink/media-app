import type { Db } from "./db";
import { config } from "./env";

export async function getGraceMinutes(db: Db): Promise<number> {
  const s = await db.setting.findUnique({ where: { key: "checkin_grace_min" } });
  const n = s ? Number(s.value) : config.defaultGraceMin;
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

export async function setSetting(db: Db, key: string, value: string) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
