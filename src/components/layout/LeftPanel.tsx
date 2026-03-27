export function LeftPanel() {
  return (
    <aside
      style={{
        width: 260,
        borderRight: "1px solid #ddd",
        padding: 16,
        background: "#fff",
      }}
    >
      <h3>Insert</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button>+ Point</button>
        <button>+ Line</button>
        <button>+ Function</button>
        <button>+ Text</button>
      </div>
    </aside>
  );
}