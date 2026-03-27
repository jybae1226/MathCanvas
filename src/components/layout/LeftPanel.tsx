import { useProjectStore } from "../../store/projectStore";

export function LeftPanel() {
  const addPoint = useProjectStore((s) => s.addPoint);
  const addLine = useProjectStore((s) => s.addLine);
  const addFunction = useProjectStore((s) => s.addFunction);
  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const selectObject = useProjectStore((s) => s.selectObject);

  return (
    <aside
      style={{
        width: 260,
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
          <button onClick={addLine}>+ Line</button>
          <button onClick={addFunction}>+ Function</button>
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
                background:
                  selectedObjectId === obj.id ? "#eff6ff" : "#fff",
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