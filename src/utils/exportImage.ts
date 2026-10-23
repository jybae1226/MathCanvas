import { toPng } from "html-to-image";
import { saveFile } from "./files";

export async function exportImage(
  kind: "svg" | "png",
  background: "white" | "transparent" = "white",
) {
  await document.fonts.ready;
  const svg = document.getElementById(
    "math-diagram-svg",
  ) as SVGSVGElement | null;
  if (!svg) throw new Error("내보낼 그림이 없습니다.");
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (background === "transparent")
    clone.querySelectorAll('[data-role="background"]').forEach((node) => {
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", "none");
    });
  clone
    .querySelectorAll('[data-export-ignore="true"]')
    .forEach((node) => node.remove());
  clone
    .querySelectorAll('[data-region-path="true"]')
    .forEach((node) => node.setAttribute("stroke", "none"));
  const originals = Array.from(svg.querySelectorAll("foreignObject"));
  const copies = Array.from(clone.querySelectorAll("foreignObject"));
  for (let i = 0; i < originals.length; i++) {
    const live = originals[i].firstElementChild as HTMLElement | null;
    if (!live) continue;
    const url = await toPng(live, {
      backgroundColor: "transparent",
      pixelRatio: 3,
    });
    const bounds = live.getBoundingClientRect(),
      svgBounds = svg.getBoundingClientRect();
    const scale = svg.viewBox.baseVal.width / svgBounds.width;
    const image = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "image",
    );
    image.setAttribute("x", String((bounds.left - svgBounds.left) * scale));
    image.setAttribute("y", String((bounds.top - svgBounds.top) * scale));
    image.setAttribute("width", String(bounds.width * scale));
    image.setAttribute("height", String(bounds.height * scale));
    image.setAttribute("href", url);
    copies[i].replaceWith(image);
  }
  // Exported diagrams are standalone; KaTeX glyphs are embedded as images.
  const source = new XMLSerializer().serializeToString(clone);
  if (kind === "svg") return saveFile("svg", source);
  const image = new Image();
  const sourceUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("PNG 변환에 실패했습니다."));
    image.src = sourceUrl;
  });
  const canvas = document.createElement("canvas");
  const width = svg.viewBox.baseVal.width,
    height = svg.viewBox.baseVal.height;
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("그림 변환을 시작할 수 없습니다.");
  ctx.scale(2, 2);
  if (background === "white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);
  return saveFile("png", canvas.toDataURL("image/png"));
}
