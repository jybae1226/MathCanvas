import { useMemo } from "react";
import { useProjectStore } from "../../store/projectStore";
import { rgbaToHex } from "../../types/styles";

export function RightPanel() {
  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const scene = useProjectStore((s) => s.scene);

  const updateStrokeColor = useProjectStore((s) => s.updateStrokeColor);
  const updateStrokeWidth = useProjectStore((s) => s.updateStrokeWidth);

  const updateTextContent = useProjectStore((s) => s.updateTextContent);
  const updateTextColor = useProjectStore((s) => s.updateTextColor);
  const updateTextSize = useProjectStore((s) => s.updateTextSize);

  const updateFunctionExpression = useProjectStore(
    (s) => s.updateFunctionExpression,
  );
  const updateFunctionDomain = useProjectStore((s) => s.updateFunctionDomain);

  const deleteSelectedObject = useProjectStore((s) => s.deleteSelectedObject);

  const selected = useMemo(
    () => objects.find((obj) => obj.id === selectedObjectId) ?? null,
    [objects, selectedObjectId],
  );

  return (
    <aside
      style={{
        width: 320,
        borderLeft: "1px solid #ddd",
        padding: 16,
        background: "#fff",
        overflow: "auto",
      }}
    >
      <h3>Properties</h3>

      {!selected && <p>객체를 선택하세요.</p>}

      {selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <label>Name</label>
            <div>{selected.name}</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <label>Type</label>
            <div>{selected.type}</div>
          </div>

          {"stroke" in selected && (
            <>
              <div
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <label>Stroke</label>
                <input
                  type="color"
                  value={rgbaToHex(selected.stroke.color)}
                  onChange={(e) =>
                    updateStrokeColor(selected.id, e.target.value)
                  }
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <label>Width</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={selected.stroke.width}
                  onChange={(e) =>
                    updateStrokeWidth(selected.id, Number(e.target.value))
                  }
                />
              </div>
            </>
          )}

          {selected.type === "function2d" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Expression</label>
                <input
                  type="text"
                  value={selected.expression}
                  onChange={(e) =>
                    updateFunctionExpression(selected.id, e.target.value)
                  }
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selected.domain === null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateFunctionDomain(selected.id, null);
                      } else {
                        updateFunctionDomain(selected.id, [...scene.xRange]);
                      }
                    }}
                  />
                  Use current viewport range
                </label>
              </div>

              {selected.domain !== null && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label>Custom Domain</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="number"
                      step="any"
                      value={selected.domain[0]}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isFinite(next)) {
                          updateFunctionDomain(selected.id, [
                            next,
                            selected.domain![1],
                          ]);
                        }
                      }}
                    />
                    <input
                      type="number"
                      step="any"
                      value={selected.domain[1]}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isFinite(next)) {
                          updateFunctionDomain(selected.id, [
                            selected.domain![0],
                            next,
                          ]);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {selected.type === "text2d" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Text</label>
                <input
                  type="text"
                  value={selected.text}
                  onChange={(e) =>
                    updateTextContent(selected.id, e.target.value)
                  }
                />
              </div>

              <div
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <label>Text Color</label>
                <input
                  type="color"
                  value={rgbaToHex(selected.textStyle.color)}
                  onChange={(e) =>
                    updateTextColor(selected.id, e.target.value)
                  }
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <label>Font Size</label>
                <input
                  type="range"
                  min={10}
                  max={72}
                  step={1}
                  value={selected.textStyle.fontSize}
                  onChange={(e) =>
                    updateTextSize(selected.id, Number(e.target.value))
                  }
                />
              </div>
            </>
          )}

          <button
            onClick={deleteSelectedObject}
            style={{
              marginTop: 10,
              padding: "10px 12px",
              border: "1px solid #d33",
              background: "#fff5f5",
              color: "#b00020",
              cursor: "pointer",
            }}
          >
            Delete Selected
          </button>
        </div>
      )}
    </aside>
  );
}