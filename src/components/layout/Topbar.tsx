export function Topbar() {
  return (
    <header
      style={{
        height: 56,
        borderBottom: "1px solid #ddd",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 700 }}>MathDiagram Studio</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button>New</button>
        <button>Open</button>
        <button>Save</button>
        <button>Export</button>
      </div>
    </header>
  );
}