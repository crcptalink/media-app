import Link from "next/link";

export default function CheckEmail() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 text-center">
      <div className="text-5xl">📬</div>
      <h1 className="h1 mt-3">Check your email</h1>
      <p className="mt-2 text-slate-600">We sent you a sign-in link from crcptalink@gmail.com. Open it on this device while you&apos;re on church Wi-Fi.</p>
      <Link href="/login" className="btn-ghost mt-6">Back</Link>
    </main>
  );
}
