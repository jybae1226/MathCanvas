import type { Line2DObject } from "../types/objects";

export function lineEndpoints(
  line: Line2DObject,
  xr: [number, number],
  yr: [number, number],
) {
  let lo = line.lineKind === "line" ? -Infinity : 0;
  let hi = !line.lineKind || line.lineKind === "segment" ? 1 : Infinity;
  for (const [p, delta, range] of [
    [line.x1, line.x2 - line.x1, xr],
    [line.y1, line.y2 - line.y1, yr],
  ] as const) {
    if (Math.abs(delta) < 1e-12) {
      if (p < range[0] || p > range[1]) return null;
      continue;
    }
    const a = (range[0] - p) / delta,
      b = (range[1] - p) / delta;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  if (hi < lo || !Number.isFinite(lo + hi)) return null;
  return {
    x1: line.x1 + (line.x2 - line.x1) * lo,
    y1: line.y1 + (line.y2 - line.y1) * lo,
    x2: line.x1 + (line.x2 - line.x1) * hi,
    y2: line.y1 + (line.y2 - line.y1) * hi,
  };
}
