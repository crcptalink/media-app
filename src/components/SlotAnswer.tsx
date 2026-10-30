"use client";

import { useRef } from "react";
import { declineAction, respondAction } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";

export function SlotAnswer({
  assignmentId,
  back,
  canAccept,
  canDecline,
  closed,
}: {
  assignmentId: string;
  back: string;
  canAccept: boolean;
  canDecline: boolean;
  closed: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const showAccept = canAccept || closed;
  const showDecline = canDecline || closed;
  if (!showAccept && !showDecline) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {showAccept && (
        <form action={respondAction}>
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="answer" value="yes" />
          <SubmitButton className="btn-green" disabled={!canAccept}>Accept</SubmitButton>
        </form>
      )}
      {showDecline && (
        <>
          <button type="button" className="btn-ghost" disabled={!canDecline} onClick={() => dialog.current?.showModal()}>
            Decline
          </button>
          <dialog ref={dialog} className="w-[min(100%,24rem)] rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-lg backdrop:bg-slate-900/40">
            <form action={declineAction} className="space-y-3">
              <p className="text-sm font-semibold">Decline this slot</p>
              <input type="hidden" name="assignmentId" value={assignmentId} />
              <input type="hidden" name="back" value={back} />
              <label className="block text-sm">Reason
                <textarea name="reason" required rows={3} className="input mt-1" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()}>Cancel</button>
                <SubmitButton className="btn-red">Decline</SubmitButton>
              </div>
            </form>
          </dialog>
        </>
      )}
    </div>
  );
}
