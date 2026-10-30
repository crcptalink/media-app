import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function CheckEmail() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-slate-50 px-5 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700">
        <BrandLogo className="h-9" alt="" />
      </span>
      <h1 className="h1 mt-3">Check your email</h1>
      <p className="mt-2 text-slate-600">We sent you a sign-in link from crcptalink@gmail.com. Open it on this device while you&apos;re on church Wi-Fi.</p>
      <Link href="/login" className="btn-ghost mt-6">Back</Link>
    </main>
  );
}
