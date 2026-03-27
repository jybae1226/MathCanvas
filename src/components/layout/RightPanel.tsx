import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { approximateRegionArea, polygonArea, polygonPerimeter } from "../../utils/graph";
import { rgbaToHex } from "../../types/styles";

function NumberInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    if (text.trim() === "" || text.trim() === "-") {
      onCommit(0);
      return;
    }

    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
      onCommit(parsed);
    } else {
      setText(String(value));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
        }
      }}
    />
  );
}

export function RightPanel() {
  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const scene = useProjectStore((s) => s.scene);

  const updateStrokeColor = useProjectStore((s) => s.updateStrokeColor);
  const updateStrokeWidth = useProjectStore((s) => s.updateStrokeWidth);

  const updateTextContent = useProjectStore((s) => s.updateTextContent);
  const updateFormulaContent = useProjectStore((s) => s.updateFormulaContent);
  const updateTextColor = useProjectStore((s) => s.updateTextColor);
  const updateTextSize = useProjectStore((s) => s.updateTextSize);

  const updateFunctionExpression = useProjectStore(
    (s) => s.updateFunctionExpression,
  );
  const updateFunctionDomain = useProjectStore((s) => s.updateFunctionDomain);

  const updatePointLabel = useProjectStore((s) => s.updatePointLabel);
  const updatePointFilled = useProjectStore((s) => s.updatePointFilled);

  const updateRegionFillColor = useProjectStore((s) => s.updateRegionFillColor);
  const updateRegionOpacity = useProjectStore((s) => s.updateRegionOpacity);
  const updateRegionXStart = useProjectStore((s) => s.updateRegionXStart);
  const updateRegionXEnd = useProjectStore((s) => s.updateRegionXEnd);

  const deleteSelectedObject = useProjectStore((s) => s.deleteSelectedObject);

  const selected = useMemo(
    () => objects.find((obj) => obj.id === selectedObjectId) ?? null,
    [objects, selectedObjectId],
  );

  const selectedMeasurement = useMemo(() => {
    if (!selected) return null;

    if (selected.type === "line2d") {
      return {
        label: "Length",
        value: Math.hypot(selected.x2 - selected.x1, selected.y2 - selected.y1),
      };
    }

    if (selected.type === "circle2d") {
      return {
        label: "Area / Circumference",
        value: `${(Math.PI * selected.radius * selected.radius).toFixed(4)} / ${(2 * Math.PI * selected.radius).toFixed(4)}`,
      };
    }

    if (selected.type === "ellipse2d") {
      const area = Math.PI * selected.rx * selected.ry;
      return {
        label: "Area",
        value: area.toFixed(4),
      };
    }

    if (selected.type === "polygon2d") {
      return {
        label: "Area / Perimeter",
        value: `${polygonArea(selected.points).toFixed(4)} / ${polygonPerimeter(selected.points).toFixed(4)}`,
      };
    }

    if (selected.type === "region2d") {
      const curveA = objects.find((obj) => obj.id === selected.curveAId);
      const curveB = objects.find((obj) => obj.id === selected.curveBId);

      if (!curveA || !curveB) return null;

      return {
        label: "Approx. Area",
        value: approximateRegionArea(
          curveA,
          curveB,
          selected.xStart,
          selected.xEnd,
          selected.samples,
        ).toFixed(4),
      };
    }

    return null;
  }, [selected, objects]);

  return (
    <aside
      style={{
        width: 360,
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

          {selectedMeasurement && (
            <div
              style={{
                padding: "10px 12px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <strong>{selectedMeasurement.label}:</strong>{" "}
              {typeof selectedMeasurement.value === "number"
                ? selectedMeasurement.value.toFixed(4)
                : selectedMeasurement.value}
            </div>
          )}

          {selected.type === "point2d" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Point Name</label>
                <input
                  type="text"
                  value={selected.label ?? ""}
                  onChange={(e) =>
                    updatePointLabel(selected.id, e.target.value)
                  }
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selected.fill.enabled}
                  onChange={(e) =>
                    updatePointFilled(selected.id, e.target.checked)
                  }
                />
                Filled Circle
              </label>
            </>
          )}

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
                    <NumberInput
                      value={selected.domain[0]}
                      onCommit={(next) =>
                        updateFunctionDomain(selected.id, [
                          next,
                          selected.domain![1],
                        ])
                      }
                    />
                    <NumberInput
                      value={selected.domain[1]}
                      onCommit={(next) =>
                        updateFunctionDomain(selected.id, [
                          selected.domain![0],
                          next,
                        ])
                      }
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

          {selected.type === "formula2d" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>LaTeX</label>
                <input
                  type="text"
                  value={selected.latex}
                  onChange={(e) =>
                    updateFormulaContent(selected.id, e.target.value)
                  }
                />
              </div>

              <div
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <label>Formula Color</label>
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

          {selected.type === "region2d" && (
            <>
              <div
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <label>Fill Color</label>
                <input
                  type="color"
                  value={rgbaToHex(selected.fill.color)}
                  onChange={(e) =>
                    updateRegionFillColor(selected.id, e.target.value)
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
                <label>Opacity</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selected.fill.color.a}
                  onChange={(e) =>
                    updateRegionOpacity(selected.id, Number(e.target.value))
                  }
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>X Start</label>
                <NumberInput
                  value={selected.xStart}
                  onCommit={(next) => updateRegionXStart(selected.id, next)}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>X End</label>
                <NumberInput
                  value={selected.xEnd}
                  onCommit={(next) => updateRegionXEnd(selected.id, next)}
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