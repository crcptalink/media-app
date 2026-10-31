import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { ChoiceChips } from "@/components/ChoiceChips";
import { createVolunteerAction } from "./actions";

const SIZES = ["S", "M", "L", "XL", "XXL"];
const COUNTRIES = [
  { code: "+27", label: "South Africa (+27)" },
  { code: "+1", label: "United States (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+91", label: "India (+91)" },
];

export default async function NewVolunteerPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h1 className="h1">New Volunteer</h1>
      <p className="muted">Fill in your details. A leader confirms your role, department, and position before you can sign in.</p>
      <form action={createVolunteerAction} className="card space-y-4">
        <label className="block text-sm font-medium">First Name<input name="name" required className="input mt-1" /></label>
        <label className="block text-sm font-medium">Surname<input name="surname" required className="input mt-1" /></label>
        <label className="block text-sm font-medium">Email<input name="email" type="email" required className="input mt-1" /></label>
        <div>
          <p className="text-sm font-medium">WhatsApp</p>
          <div className="mt-1 flex gap-2">
            <select name="countryCode" defaultValue="+27" className="input w-40">
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <input name="phone" type="tel" placeholder="82 123 4567" required className="input flex-1" />
          </div>
        </div>
        <label className="block text-sm font-medium">Birthday<input name="birthday" type="date" required className="input mt-1" /></label>
        <label className="block text-sm font-medium">Zone Pastor<input name="zonePastor" className="input mt-1" /></label>
        <label className="block text-sm font-medium">Homecell Leader<input name="homecellLeader" className="input mt-1" /></label>
        <div>
          <p className="text-sm font-medium">Attending Homecell</p>
          <ChoiceChips name="attendingHomecell" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
        </div>
        <div>
          <p className="text-sm font-medium">Attending Sundays</p>
          <ChoiceChips name="services" multi options={[{ value: "08:30", label: "08:30" }, { value: "10:30", label: "10:30" }, { value: "18:00", label: "18:00" }]} />
        </div>
        <div>
          <p className="text-sm font-medium">Shirt Size</p>
          <ChoiceChips name="shirtSize" options={SIZES.map((s) => ({ value: s, label: s }))} />
        </div>
        <SubmitButton>Submit</SubmitButton>
      </form>
    </div>
  );
}
