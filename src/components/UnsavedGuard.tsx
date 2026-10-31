"use client";

import { useEffect } from "react";

/** Warns before leaving the page if a field was changed and not submitted. */
export function UnsavedGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let dirty = false;
    const mark = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("form")) dirty = true;
    };
    const clear = () => {
      dirty = false;
    };
    const leave = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!dirty) return;
      const link = (event.target as HTMLElement | null)?.closest("a");
      if (!link) return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) event.preventDefault();
      else dirty = false;
    };
    document.addEventListener("input", mark);
    document.addEventListener("change", mark);
    document.addEventListener("submit", clear);
    document.addEventListener("click", click);
    window.addEventListener("beforeunload", leave);
    return () => {
      document.removeEventListener("input", mark);
      document.removeEventListener("change", mark);
      document.removeEventListener("submit", clear);
      document.removeEventListener("click", click);
      window.removeEventListener("beforeunload", leave);
    };
  }, []);
  return <>{children}</>;
}
