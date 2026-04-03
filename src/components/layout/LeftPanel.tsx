import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";

function NumberInput({
  value,
  onCommit,
  step = "any",
}: {
  value: number;
  onCommit: (value: number) => void;
  step?: string;
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
      step={step}
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

export function LeftPanel() {
  const addPoint = useProjectStore((s) => s.addPoint);
  const addCircle = useProjectStore((s) => s.addCircle);
  const startLineTool = useProjectStore((s) => s.startLineTool);
  const startCoordinateTool = useProjectStore((s) => s.startCoordinateTool);
  const addFunction = useProjectStore((s) => s.addFunction);
  const addText = useProjectStore((s) => s.addText);
  const addFormula = useProjectStore((s) => s.addFormula);
  const addRegionFill = useProjectStore((s) => s.addRegionFill);
  const addIntersectionMarkers = useProjectStore((s) => s.addIntersectionMarkers);

  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const selectObject = useProjectStore((s) => s.selectObject);

  const scene = useProjectStore((s) => s.scene);
  const updateScene = useProjectStore((s) => s.updateScene);
  const updateCaptionText = useProjectStore((s) => s.updateCaptionText);
  const updateCaptionFontSize = useProjectStore((s) => s.updateCaptionFontSize);
  const updateCaptionColor = useProjectStore((s) => s.updateCaptionColor);
  const centerOrigin = useProjectStore((s) => s.centerOrigin);

  const activeTool = useProjectStore((s) => s.activeTool);
  const lineDraftStart = useProjectStore((s) => s.lineDraftStart);

  const curveCandidates = objects.filter(
    (obj) => obj.type === "function2d" || obj.type === "line2d",
  );

  const intersectionCandidates = useMemo(
    () =>
      objects.filter(
        (obj) => obj.type === "function2d" && obj.expression.trim(),
      ),
    [objects],
  );

  const [curveAId, setCurveAId] = useState("");
  const [curveBId, setCurveBId] = useState("");
  const [regionXStart, setRegionXStart] = useState(scene.xRange[0]);
  const [regionXEnd, setRegionXEnd] = useState(scene.xRange[1]);

  const [intersectionAId, setIntersectionAId] = useState("");
  const [intersectionBId, setIntersectionBId] = useState("");

  useEffect(() => {
    if (!curveAId && curveCandidates[0]) setCurveAId(curveCandidates[0].id);
    if (!curveBId && curveCandidates[1]) setCurveBId(curveCandidates[1].id);
  }, [curveCandidates, curveAId, curveBId]);

  useEffect(() => {
    if (!intersectionAId && intersectionCandidates[0]) {
      setIntersectionAId(intersectionCandidates[0].id);
    }
    if (!intersectionBId && intersectionCandidates[1]) {
      setIntersectionBId(intersectionCandidates[1].id);
    }
  }, [intersectionCandidates, intersectionAId, intersectionBId]);

  const xCenter = (scene.xRange[0] + scene.xRange[1]) / 2;
  const yCenter = (scene.yRange[0] + scene.yRange[1]) / 2;
  const xSpan = scene.xRange[1] - scene.xRange[0];
  const ySpan = scene.yRange[1] - scene.yRange[0];

  return (
    <aside
      style={{
        width: 360,
        borderRight: "1px solid #ddd",
        padding: 16,
        background: "#fff",
        overflow: "auto",
      }}
    >
      <section>
        <h3>Insert</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={addPoint}>+ Point</button>
          <button onClick={startLineTool}>+ Arrow</button>
          <button onClick={addCircle}>+ Circle</button>
          <button onClick={addFunction}>+ Function / Implicit Curve</button>
          <button onClick={addText}>+ Text</button>
          <button onClick={addFormula}>+ Formula</button>
          <button onClick={startCoordinateTool}>+ Coordinate</button>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: "#555" }}>
          Tool: <strong>{activeTool}</strong>
          {activeTool === "line" && (
            <div style={{ marginTop: 4 }}>
              {lineDraftStart ? "두 번째 점을 클릭하세요. (Esc 취소)" : "첫 번째 점을 클릭하세요. (Esc 취소)"}
            </div>
          )}
          {activeTool === "coordinate" && (
            <div style={{ marginTop: 4 }}>
              캔버스를 클릭하면 좌표가 표시됩니다.
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            Zoom: 마우스 휠
            <br />
            Pan: 빈 공간 드래그
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Intersections</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Function A</label>
            <select
              value={intersectionAId}
              onChange={(e) => setIntersectionAId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            >
              <option value="">선택</option>
              {intersectionCandidates.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Function B</label>
            <select
              value={intersectionBId}
              onChange={(e) => setIntersectionBId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            >
              <option value="">선택</option>
              {intersectionCandidates.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              if (!intersectionAId || !intersectionBId || intersectionAId === intersectionBId) return;
              addIntersectionMarkers(intersectionAId, intersectionBId);
            }}
          >
            + Create Intersections
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Region Fill</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Curve A</label>
            <select
              value={curveAId}
              onChange={(e) => setCurveAId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            >
              <option value="">선택</option>
              {curveCandidates.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.name} · {obj.type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Curve B</label>
            <select
              value={curveBId}
              onChange={(e) => setCurveBId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px" }}
            >
              <option value="">선택</option>
              {curveCandidates.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.name} · {obj.type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>X Start</label>
            <NumberInput value={regionXStart} onCommit={setRegionXStart} />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>X End</label>
            <NumberInput value={regionXEnd} onCommit={setRegionXEnd} />
          </div>

          <button
            onClick={() => {
              if (!curveAId || !curveBId || curveAId === curveBId) return;
              addRegionFill(curveAId, curveBId, regionXStart, regionXEnd);
            }}
          >
            + Create Region Fill
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Scene</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={scene.showGrid}
              onChange={(e) => updateScene({ showGrid: e.target.checked })}
            />
            Show Grid
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={scene.showAxes}
              onChange={(e) => updateScene({ showAxes: e.target.checked })}
            />
            Show Axes
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={scene.snapToGrid}
              onChange={(e) => updateScene({ snapToGrid: e.target.checked })}
            />
            Snap to Grid
          </label>

          <button onClick={centerOrigin}>원점 중앙으로</button>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>X Pan</label>
            <input
              type="range"
              min={-100}
              max={100}
              step={0.1}
              value={xCenter}
              onChange={(e) => {
                const nextCenter = Number(e.target.value);
                updateScene({
                  xRange: [nextCenter - xSpan / 2, nextCenter + xSpan / 2],
                });
              }}
            />
            <NumberInput
              value={xCenter}
              onCommit={(nextCenter) =>
                updateScene({
                  xRange: [nextCenter - xSpan / 2, nextCenter + xSpan / 2],
                })
              }
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Y Pan</label>
            <input
              type="range"
              min={-100}
              max={100}
              step={0.1}
              value={yCenter}
              onChange={(e) => {
                const nextCenter = Number(e.target.value);
                updateScene({
                  yRange: [nextCenter - ySpan / 2, nextCenter + ySpan / 2],
                });
              }}
            />
            <NumberInput
              value={yCenter}
              onCommit={(nextCenter) =>
                updateScene({
                  yRange: [nextCenter - ySpan / 2, nextCenter + ySpan / 2],
                })
              }
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>X Range</label>
            <div style={{ display: "flex", gap: 8 }}>
              <NumberInput
                value={scene.xRange[0]}
                onCommit={(next) =>
                  updateScene({ xRange: [next, scene.xRange[1]] })
                }
              />
              <NumberInput
                value={scene.xRange[1]}
                onCommit={(next) =>
                  updateScene({ xRange: [scene.xRange[0], next] })
                }
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Y Range</label>
            <div style={{ display: "flex", gap: 8 }}>
              <NumberInput
                value={scene.yRange[0]}
                onCommit={(next) =>
                  updateScene({ yRange: [next, scene.yRange[1]] })
                }
              />
              <NumberInput
                value={scene.yRange[1]}
                onCommit={(next) =>
                  updateScene({ yRange: [scene.yRange[0], next] })
                }
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>X Tick Step</label>
            <NumberInput
              value={scene.xTickStep}
              onCommit={(next) =>
                updateScene({ xTickStep: next <= 0 ? 1 : next })
              }
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Y Tick Step</label>
            <NumberInput
              value={scene.yTickStep}
              onCommit={(next) =>
                updateScene({ yTickStep: next <= 0 ? 1 : next })
              }
            />
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Caption</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            value={scene.captionText}
            onChange={(e) => updateCaptionText(e.target.value)}
            placeholder="예: Figure 1.1  sin(x) 그래프"
          />

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Caption Size</label>
            <input
              type="range"
              min={10}
              max={28}
              step={1}
              value={scene.captionFontSize}
              onChange={(e) => updateCaptionFontSize(Number(e.target.value))}
            />
            <div>{scene.captionFontSize}</div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Caption Color</label>
            <input
              type="color"
              value={scene.captionColor}
              onChange={(e) => updateCaptionColor(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Layers</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {objects.map((obj) => (
            <button
              key={obj.id}
              onClick={() => selectObject(obj.id)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                border: "1px solid #ddd",
                background: selectedObjectId === obj.id ? "#eff6ff" : "#fff",
              }}
            >
              {obj.name} · {obj.type}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}