import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { approximateCurveIntersections } from "../../utils/graph";
import { rgbaToHex } from "../../types/styles";
import type { LabelPosition } from "../../types/objects";

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

const labelPositions: LabelPosition[] = [
  "top",
  "bottom",
  "left",
  "right",
  "top-right",
  "top-left",
  "bottom-right",
  "bottom-left",
];

export function RightPanel() {
  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const scene = useProjectStore((s) => s.scene);

  const updateObjectName = useProjectStore((s) => s.updateObjectName);
  const updateStrokeColor = useProjectStore((s) => s.updateStrokeColor);
  const updateStrokeWidth = useProjectStore((s) => s.updateStrokeWidth);
  const updateLineStyle = useProjectStore((s) => s.updateLineStyle);

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
  const updatePointShowLabel = useProjectStore((s) => s.updatePointShowLabel);
  const updatePointLabelPosition = useProjectStore(
    (s) => s.updatePointLabelPosition,
  );
  const updatePointRadius = useProjectStore((s) => s.updatePointRadius);

  const updateCircleRadius = useProjectStore((s) => s.updateCircleRadius);
  const updateCircleShowCenter = useProjectStore((s) => s.updateCircleShowCenter);
  const updateShapeFillEnabled = useProjectStore((s) => s.updateShapeFillEnabled);
  const updateShapeFillColor = useProjectStore((s) => s.updateShapeFillColor);

  const updateRegionFillColor = useProjectStore((s) => s.updateRegionFillColor);
  const updateRegionOpacity = useProjectStore((s) => s.updateRegionOpacity);
  const updateRegionXStart = useProjectStore((s) => s.updateRegionXStart);
  const updateRegionXEnd = useProjectStore((s) => s.updateRegionXEnd);
  const updateRegionLabelText = useProjectStore((s) => s.updateRegionLabelText);
  const updateRegionLabelX = useProjectStore((s) => s.updateRegionLabelX);
  const updateRegionLabelY = useProjectStore((s) => s.updateRegionLabelY);
  const updateRegionLabelColor = useProjectStore((s) => s.updateRegionLabelColor);
  const updateRegionLabelSize = useProjectStore((s) => s.updateRegionLabelSize);

  const deleteSelectedObject = useProjectStore((s) => s.deleteSelectedObject);

  const selected = useMemo(
    () => objects.find((obj) => obj.id === selectedObjectId) ?? null,
    [objects, selectedObjectId],
  );

  const intersections = useMemo(() => {
    if (!selected) return [];

    if (selected.type !== "function2d" && selected.type !== "line2d") {
      return [];
    }

    const candidates = objects.filter(
      (obj) =>
        obj.id !== selected.id &&
        (obj.type === "function2d" || obj.type === "line2d"),
    );

    return candidates.flatMap((obj) =>
      approximateCurveIntersections(
        selected,
        obj,
        scene.xRange,
        scene.yRange,
        900,
      ).map((p) => ({
        otherName: obj.name,
        x: p.x,
        y: p.y,
      })),
    );
  }, [selected, objects, scene.xRange, scene.yRange]);

  return (
    <aside
      style={{
        width: 380,
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Name</label>
            <input
              type="text"
              value={selected.name}
              onChange={(e) => updateObjectName(selected.id, e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <label>Type</label>
            <div>{selected.type}</div>
          </div>

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
                  checked={selected.showLabel}
                  onChange={(e) =>
                    updatePointShowLabel(selected.id, e.target.checked)
                  }
                />
                Show Label
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Label Position</label>
                <select
                  value={selected.labelPosition}
                  onChange={(e) =>
                    updatePointLabelPosition(
                      selected.id,
                      e.target.value as LabelPosition,
                    )
                  }
                >
                  {labelPositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
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

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Point Size</label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={selected.radius}
                  onChange={(e) =>
                    updatePointRadius(selected.id, Number(e.target.value))
                  }
                />
                <div>{selected.radius}</div>
              </div>
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
                <div style={{ flex: 1 }}>
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
                  <div>{selected.stroke.width}</div>
                </div>
              </div>
            </>
          )}

          {selected.type === "line2d" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Line Style</label>
                <select
                  value={selected.stroke.lineStyle ?? "solid"}
                  onChange={(e) =>
                    updateLineStyle(
                      selected.id,
                      e.target.value as "solid" | "dashed" | "dotted" | "double",
                    )
                  }
                >
                  <option value="solid">solid</option>
                  <option value="dashed">dashed</option>
                  <option value="dotted">dotted</option>
                  <option value="double">double</option>
                </select>
              </div>

              {intersections.length > 0 && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                  }}
                >
                  <strong>Intersections</strong>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {intersections.map((p, idx) => (
                      <div key={idx}>
                        with <strong>{p.otherName}</strong>: ({p.x.toFixed(4)}, {p.y.toFixed(4)})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {selected.type === "circle2d" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Radius</label>
                <NumberInput
                  value={selected.radius}
                  onCommit={(next) => updateCircleRadius(selected.id, next)}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selected.showCenter}
                  onChange={(e) =>
                    updateCircleShowCenter(selected.id, e.target.checked)
                  }
                />
                Show Center Point
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selected.fill.enabled}
                  onChange={(e) =>
                    updateShapeFillEnabled(selected.id, e.target.checked)
                  }
                />
                Fill Interior
              </label>

              <div
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <label>Fill Color</label>
                <input
                  type="color"
                  value={rgbaToHex(selected.fill.color)}
                  onChange={(e) =>
                    updateShapeFillColor(selected.id, e.target.value)
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
                  placeholder="예: sin(x), x^2, x^2 + y^2 = 4"
                />
              </div>

              <div style={{ fontSize: 12, color: "#555" }}>
                음함수는 예를 들어 <code>x^2 + y^2 = 4</code>처럼 입력하면 됩니다.
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

                {intersections.length > 0 && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                  }}
                >
                  <strong>Intersections</strong>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {intersections.map((p, idx) => (
                      <div key={idx}>
                        with <strong>{p.otherName}</strong>: ({p.x.toFixed(4)}, {p.y.toFixed(4)})
                      </div>
                    ))}
                  </div>
                </div>
                )}
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
                <div style={{ flex: 1 }}>
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
                  <div>{selected.textStyle.fontSize}</div>
                </div>
              </div>
            </>
          )}

          {selected.type === "formula2d" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Formula Text</label>
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
                <div style={{ flex: 1 }}>
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
                  <div>{selected.textStyle.fontSize}</div>
                </div>
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
                <div style={{ flex: 1 }}>
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
                  <div>{selected.fill.color.a.toFixed(2)}</div>
                </div>
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

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>Region Text</label>
                <input
                  type="text"
                  value={selected.labelText}
                  onChange={(e) =>
                    updateRegionLabelText(selected.id, e.target.value)
                  }
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 6 }}>Text X</label>
                  <NumberInput
                    value={selected.labelX}
                    onCommit={(next) => updateRegionLabelX(selected.id, next)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: 6 }}>Text Y</label>
                  <NumberInput
                    value={selected.labelY}
                    onCommit={(next) => updateRegionLabelY(selected.id, next)}
                  />
                </div>
              </div>

              <div
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <label>Text Color</label>
                <input
                  type="color"
                  value={rgbaToHex(selected.labelStyle.color)}
                  onChange={(e) =>
                    updateRegionLabelColor(selected.id, e.target.value)
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
                <label>Text Size</label>
                <div style={{ flex: 1 }}>
                  <input
                    type="range"
                    min={10}
                    max={48}
                    step={1}
                    value={selected.labelStyle.fontSize}
                    onChange={(e) =>
                      updateRegionLabelSize(selected.id, Number(e.target.value))
                    }
                  />
                  <div>{selected.labelStyle.fontSize}</div>
                </div>
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