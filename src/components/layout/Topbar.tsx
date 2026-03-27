import { useEffect, useRef } from "react";
import { useProjectStore } from "../../store/projectStore";

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function getCanvasSvgElement(): SVGSVGElement | null {
  return document.getElementById("math-diagram-svg") as SVGSVGElement | null;
}

function exportSvg() {
  const svgElement = getCanvasSvgElement();
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);

  if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
    source = source.replace(
      "<svg",
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
  }

  downloadTextFile("math-diagram.svg", source, "image/svg+xml;charset=utf-8");
}

function exportPng() {
  const svgElement = getCanvasSvgElement();
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);

  if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
    source = source.replace(
      "<svg",
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
  }

  const svgBlob = new Blob([source], {
    type: "image/svg+xml;charset=utf-8",
  });

  const url = URL.createObjectURL(svgBlob);
  const image = new Image();

  image.onload = () => {
    const width = Number(svgElement.getAttribute("width") ?? 900);
    const height = Number(svgElement.getAttribute("height") ?? 672);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        URL.revokeObjectURL(url);
        return;
      }

      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "math-diagram.png";
      a.click();

      URL.revokeObjectURL(pngUrl);
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
  };

  image.src = url;
}

export function Topbar() {
  const exportProjectJson = useProjectStore((s) => s.exportProjectJson);
  const importProjectJson = useProjectStore((s) => s.importProjectJson);
  const resetProject = useProjectStore((s) => s.resetProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const deleteSelectedObject = useProjectStore((s) => s.deleteSelectedObject);
  const setActiveTool = useProjectStore((s) => s.setActiveTool);
  const cancelDraftTool = useProjectStore((s) => s.cancelDraftTool);
  const finishPolygonTool = useProjectStore((s) => s.finishPolygonTool);
  const activeTool = useProjectStore((s) => s.activeTool);
  const historyPastLength = useProjectStore((s) => s.historyPast.length);
  const historyFutureLength = useProjectStore((s) => s.historyFuture.length);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = () => {
    const json = exportProjectJson();
    downloadTextFile(
      "math-diagram-project.json",
      json,
      "application/json;charset=utf-8",
    );
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete") {
        deleteSelectedObject();
      }

      if (event.key === "Escape") {
        cancelDraftTool();
      }

      if (event.key === "Enter" && activeTool === "polygon") {
        finishPolygonTool();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeTool,
    cancelDraftTool,
    deleteSelectedObject,
    finishPolygonTool,
    setActiveTool,
  ]);

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
      <div style={{ fontWeight: 700 }}>MathCanvas</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={resetProject}>New</button>
        <button onClick={handleOpenClick}>Open</button>
        <button onClick={handleSave}>Save</button>
        <button onClick={undo} disabled={historyPastLength === 0}>
          Undo
        </button>
        <button onClick={redo} disabled={historyFutureLength === 0}>
          Redo
        </button>
        <button onClick={exportSvg}>Export SVG</button>
        <button onClick={exportPng}>Export PNG</button>
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