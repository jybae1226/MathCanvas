import { useProjectStore } from "../../store/projectStore";

export function LeftPanel() {
  const addPoint = useProjectStore((s) => s.addPoint);
  const startLineTool = useProjectStore((s) => s.startLineTool);
  const addFunction = useProjectStore((s) => s.addFunction);
  const addText = useProjectStore((s) => s.addText);

  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const selectObject = useProjectStore((s) => s.selectObject);

  const scene = useProjectStore((s) => s.scene);
  const updateScene = useProjectStore((s) => s.updateScene);

  const activeTool = useProjectStore((s) => s.activeTool);
  const lineDraftStart = useProjectStore((s) => s.lineDraftStart);

  return (
    <aside
      style={{
        width: 300,
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
          <button onClick={addFunction}>+ Function</button>
          <button onClick={addText}>+ Text</button>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: "#555" }}>
          Tool: <strong>{activeTool}</strong>
          {activeTool === "line" && (
            <div style={{ marginTop: 4 }}>
              {lineDraftStart ? "두 번째 점을 클릭하세요." : "첫 번째 점을 클릭하세요."}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Scene</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>X Range</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                value={scene.xRange[0]}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) {
                    updateScene({ xRange: [next, scene.xRange[1]] });
                  }
                }}
              />
              <input
                type="number"
                value={scene.xRange[1]}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) {
                    updateScene({ xRange: [scene.xRange[0], next] });
                  }
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Y Range</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                value={scene.yRange[0]}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) {
                    updateScene({ yRange: [next, scene.yRange[1]] });
                  }
                }}
              />
              <input
                type="number"
                value={scene.yRange[1]}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next)) {
                    updateScene({ yRange: [scene.yRange[0], next] });
                  }
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>X Tick Step</label>
            <input
              type="number"
              step="any"
              value={scene.xTickStep}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next) && next > 0) {
                  updateScene({ xTickStep: next });
                }
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Y Tick Step</label>
            <input
              type="number"
              step="any"
              value={scene.yTickStep}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next) && next > 0) {
                  updateScene({ yTickStep: next });
                }
              }}
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