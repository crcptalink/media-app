"use client";

import { useState } from "react";

export function CopyInvite({ url, name, failedSend }: { url: string; name?: string; failedSend?: boolean }) {
  const [copied, setCopied] = useState(false);
  const who = name ? ` for ${name}` : "";
  return (
    <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-950 ring-1 ring-blue-200">
      <p>
        {failedSend
          ? `The invite email could not be sent. Copy the invite link${who} and send it yourself.`
          : `SMTP is not set up. Copy the invite link${who} and send it yourself.`}{" "}
        It expires in 7 days.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input readOnly value={url} className="input" aria-label="Invite link" />
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
