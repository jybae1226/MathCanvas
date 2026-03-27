import { useRef } from "react";
import { useProjectStore } from "../../store/projectStore";

export function Topbar() {
  const exportProjectJson = useProjectStore((s) => s.exportProjectJson);
  const importProjectJson = useProjectStore((s) => s.importProjectJson);
  const resetProject = useProjectStore((s) => s.resetProject);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = () => {
    const json = exportProjectJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "math-diagram-project.json";
    a.click();

    URL.revokeObjectURL(url);
  };

  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    importProjectJson(text);
    event.target.value = "";
  };

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
        <button onClick={resetProject}>New</button>
        <button onClick={handleOpenClick}>Open</button>
        <button onClick={handleSave}>Save</button>
        <button>Export</button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </header>
  );
}