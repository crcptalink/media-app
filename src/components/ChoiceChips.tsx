"use client";

import { useState } from "react";

export function ChoiceChips({
  name,
  options,
  defaultValue,
  multi = false,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | string[];
  multi?: boolean;
}) {
  const initial = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  const [selected, setSelected] = useState<string[]>(initial);

  function toggle(value: string) {
    if (multi) {
      setSelected((cur) => (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]));
    } else {
      setSelected([value]);
    }
  }

  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`rounded-md border px-2.5 py-1 text-sm ${on ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}
          >
            {o.label}
          </button>
        );
      })}
      {multi
        ? selected.map((v) => <input key={v} type="hidden" name={name} value={v} />)
        : selected[0] && <input type="hidden" name={name} value={selected[0]} />}
    </div>
  );
}
