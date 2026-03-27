import { useEffect, useState } from "react";
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
  const addEllipse = useProjectStore((s) => s.addEllipse);
  const addPolygon = useProjectStore((s) => s.addPolygon);
  const startLineTool = useProjectStore((s) => s.startLineTool);
  const addFunction = useProjectStore((s) => s.addFunction);
  const addText = useProjectStore((s) => s.addText);
  const addFormula = useProjectStore((s) => s.addFormula);
  const addRegionFill = useProjectStore((s) => s.addRegionFill);

  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const selectObject = useProjectStore((s) => s.selectObject);

  const scene = useProjectStore((s) => s.scene);
  const updateScene = useProjectStore((s) => s.updateScene);

  const activeTool = useProjectStore((s) => s.activeTool);
  const lineDraftStart = useProjectStore((s) => s.lineDraftStart);

  const curveCandidates = objects.filter(
    (obj) => obj.type === "function2d" || obj.type === "line2d",
  );

  const [curveAId, setCurveAId] = useState("");
  const [curveBId, setCurveBId] = useState("");
  const [regionXStart, setRegionXStart] = useState(scene.xRange[0]);
  const [regionXEnd, setRegionXEnd] = useState(scene.xRange[1]);

  useEffect(() => {
    if (!curveAId && curveCandidates[0]) setCurveAId(curveCandidates[0].id);
    if (!curveBId && curveCandidates[1]) setCurveBId(curveCandidates[1].id);
  }, [curveCandidates, curveAId, curveBId]);

  return (
    <aside
      style={{
        width: 340,
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
          <button onClick={startLineTool}>
            + Line (캔버스에서 2점 클릭)
          </button>
          <button onClick={addCircle}>+ Circle</button>
          <button onClick={addEllipse}>+ Ellipse</button>
          <button onClick={addPolygon}>+ Polygon</button>
          <button onClick={addFunction}>+ Function</button>
          <button onClick={addText}>+ Text</button>
          <button onClick={addFormula}>+ Formula</button>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: "#555" }}>
          Tool: <strong>{activeTool}</strong>
          {activeTool === "line" && (
            <div style={{ marginTop: 4 }}>
              {lineDraftStart ? "두 번째 점을 클릭하세요." : "첫 번째 점을 클릭하세요."}
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
              checked={scene.snapToGrid}
              onChange={(e) => updateScene({ snapToGrid: e.target.checked })}
            />
            Snap to Grid
          </label>

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