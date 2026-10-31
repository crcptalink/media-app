"use server";
import { runAction, str } from "@/lib/actions";
import { db } from "@/lib/db";
import { WorkflowError } from "@/lib/assignments";

export async function createVolunteerAction(form: FormData) {
  await runAction(form, async () => {
    const email = str(form, "email").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new WorkflowError("Enter a valid email");
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw new WorkflowError("Ask a leader to confirm this email. If you already have a login, sign in.");
    const phone = [str(form, "countryCode") || "+27", str(form, "phone")].filter(Boolean).join(" ");
    await db.user.create({
      data: {
        email,
        name: str(form, "name") || null,
        surname: str(form, "surname") || null,
        phone: phone || null,
        birthday: str(form, "birthday") || null,
        zonePastor: str(form, "zonePastor") || null,
        homecellLeader: str(form, "homecellLeader") || null,
        attendingHomecell: form.get("attendingHomecell") === "yes",
        attendingSundays: form.getAll("services").map(String).filter((t) => t === "08:30" || t === "10:30" || t === "18:00").join(",") || null,
        shirtSize: str(form, "shirtSize") || null,
        appRole: "VOLUNTEER",
        active: false,
      },
    });
    return { msg: "Thanks. A leader will confirm your details.", back: "/login" };
  });
}
