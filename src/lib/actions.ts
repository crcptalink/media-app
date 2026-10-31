import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WorkflowError } from "./assignments";
import { db } from "./db";
import { kickOutbox } from "./outbox";

/** Run a form action, then redirect back with ?ok= or ?error= so the page can show a banner. */
export type ActionResult = string | void | { msg?: string; back?: string };

export async function runAction(form: FormData, fn: () => Promise<ActionResult>) {
  let back = safeBack(String(form.get("back") || "/my-schedule"));
  let msg: string | undefined = undefined;
  let error: string | null = null;
  try {
    const r = await fn();
    if (typeof r === "string") msg = r;
    else if (r) {
      msg = r.msg;
      if (r.back) back = safeBack(r.back);
    }
  } catch (e) {
    if (isRedirectError(e)) throw e;
    error = e instanceof WorkflowError || e instanceof Error ? e.message : "Something went wrong";
    if (!(e instanceof WorkflowError)) console.error(e);
  }
  kickOutbox(db);
  revalidatePath(back.split("?")[0] || "/my-schedule");
  const clean = back.replace(/([?&])(ok|error)=[^&]*&?/g, "$1").replace(/[?&]+$/, "");
  const sep2 = clean.includes("?") ? "&" : "?";
  if (error) redirect(`${clean}${sep2}error=${encodeURIComponent(error)}`);
  redirect(msg ? `${clean}${sep2}ok=${encodeURIComponent(msg)}` : clean);
}

function safeBack(p: string) {
  return p.startsWith("/") && !p.startsWith("//") ? p : "/me";
}

export function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
