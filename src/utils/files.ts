export async function saveFile(
  kind: "project" | "svg" | "png",
  content: string,
) {
  if (window.mathCanvas) return window.mathCanvas.saveFile(kind, content);
  const mime = kind === "project" ? "application/json" : "image/svg+xml";
  const url =
    kind === "png"
      ? content
      : URL.createObjectURL(
          new Blob([content], { type: `${mime};charset=utf-8` }),
        );
  const a = document.createElement("a");
  a.href = url;
  a.download = `수학 수업.${kind === "project" ? "mathcanvas" : kind}`;
  a.click();
  if (kind !== "png") setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
