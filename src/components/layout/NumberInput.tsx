import { useState } from "react";

export function NumberInput({
  value,
  onCommit,
  step = "any",
}: {
  value: number;
  onCommit: (value: number) => void;
  step?: string;
}) {
  const [draft, setDraft] = useState<{ source: number; text: string } | null>(
    null,
  );
  const text = draft?.source === value ? draft.text : String(value);
  const commit = () => {
    const parsed = Number(text);
    if (text.trim() && Number.isFinite(parsed) && parsed !== value)
      onCommit(parsed);
    setDraft(null);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      step={step}
      value={text}
      onChange={(e) => setDraft({ source: value, text: e.target.value })}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(null);
        }
      }}
    />
  );
}
