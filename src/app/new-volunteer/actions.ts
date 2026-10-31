"use server";
import { runAction, str } from "@/lib/actions";
import { db } from "@/lib/db";
import { WorkflowError } from "@/lib/assignments";

export async function createVolunteerAction(form: FormData) {
  await runAction(form, async () => {
    const email = str(form, "email").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new WorkflowError("Enter a valid email");
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw new WorkflowError("That email is already registered. Sign in instead.");
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
        shirtSize: str(form, "shirtSize") || null,
        appRole: "VOLUNTEER",
        active: true,
      },
    });
    return { msg: "Thanks. A leader will confirm your details.", back: "/login" };
  });
}
