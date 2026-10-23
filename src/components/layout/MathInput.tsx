import { useRef, useState } from "react";
import katex from "katex";

export function MathInput({
  value,
  onCommit,
  formula = false,
}: {
  value: string;
  onCommit: (text: string) => void;
  formula?: boolean;
}) {
  const [draft, setDraft] = useState<{ source: string; text: string } | null>(
    null,
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const text = draft?.source === value ? draft.text : value;
  const commit = () => {
    if (text !== value) onCommit(text);
    setDraft(null);
  };
  const insert = (token: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length,
      end = input?.selectionEnd ?? start;
    setDraft({
      source: value,
      text: text.slice(0, start) + token + text.slice(end),
    });
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const tokens = formula
    ? [
        "\\frac{}{}",
        "\\sqrt{}",
        "\\int_{}^{}",
        "\\sum_{}^{}",
        "\\pi",
        "\\theta",
        "^{}",
        "_{}",
      ]
    : [
        "sin(",
        "cos(",
        "tan(",
        "asin(",
        "log(",
        "sqrt(",
        "exp(",
        "^",
        "pi",
        "theta",
        "(",
        ")",
      ];
  return (
    <div className="math-input">
      <textarea
        ref={inputRef}
        aria-label={formula ? "LaTeX 수식" : "함수 수식"}
        spellCheck={false}
        value={text}
        onChange={(e) => setDraft({ source: value, text: e.target.value })}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={formula ? "\\int_0^1 x^2\\,dx" : "sin(x) 또는 x^2+y^2=4"}
      />
      <div className="math-keys">
        {tokens.map((token) => (
          <button
            key={token}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(token)}
          >
            {token}
          </button>
        ))}
      </div>
      <p className="hint">Enter 또는 다른 곳을 클릭하면 적용됩니다.</p>
      {formula && (
        <div
          className="formula-preview"
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(text.slice(0, 2000), {
              throwOnError: false,
              strict: "ignore",
              maxExpand: 1000,
              maxSize: 20,
            }),
          }}
        />
      )}
    </div>
  );
}
