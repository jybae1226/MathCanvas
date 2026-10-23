import type { Region2DObject, SceneObject } from "../types/objects";
import { integrate, type NumericResult } from "./calculus";
import {
  evaluateCurveY,
  isImplicitExpression,
  isPolarExpression,
} from "./graph";
import { approximateCurveIntersections } from "./intersections";

export const AREA_COLORS = [
  "#2563eb",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
  "#06b6d4",
];
export type BoundedSegment = {
  index: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  area: NumericResult | null;
  signed: NumericResult | null;
  upper: "a" | "b" | "mixed";
  labelX: number;
  labelY: number;
};
export type BoundedAreaAnalysis = {
  intersections: Array<{ x: number; y: number }>;
  segments: BoundedSegment[];
  total: number | null;
};
const cache = new Map<string, BoundedAreaAnalysis>();
export function supportsBoundedAreas(curve: SceneObject): boolean {
  return curve.type === "line2d"
    ? Math.abs(curve.x2 - curve.x1) > 1e-12
    : curve.type === "function2d" &&
        !!curve.expression.trim() &&
        !isImplicitExpression(curve.expression) &&
        !isPolarExpression(curve.expression);
}
function geometry(curve: SceneObject) {
  return curve.type === "function2d"
    ? [curve.id, curve.expression, curve.domain, curve.angleUnit]
    : curve.type === "line2d"
      ? [curve.id, curve.x1, curve.y1, curve.x2, curve.y2, curve.lineKind]
      : [curve.id, curve.type];
}
export function areaFingerprint(
  a: SceneObject,
  b: SceneObject,
  range: [number, number],
) {
  return JSON.stringify([geometry(a), geometry(b), range]);
}
export function analyzeBoundedAreas(
  a: SceneObject,
  b: SceneObject,
  range: [number, number],
): BoundedAreaAnalysis {
  const key = areaFingerprint(a, b, range);
  const cached = cache.get(key);
  if (cached) return cached;
  if (
    !supportsBoundedAreas(a) ||
    !supportsBoundedAreas(b) ||
    range[1] <= range[0]
  )
    return { intersections: [], segments: [], total: null };
  // The search is limited in x; intersections must not disappear because the plot is cropped in y.
  const intersections = approximateCurveIntersections(
    a,
    b,
    range,
    [-1e10, 1e10],
  );
  const segments: BoundedSegment[] = [];
  for (let index = 0; index < intersections.length - 1; index++) {
    const start = intersections[index],
      end = intersections[index + 1];
    if (end.x - start.x <= 1e-7) continue;
    const difference = (x: number) => {
      const ya = evaluateCurveY(a, x),
        yb = evaluateCurveY(b, x);
      return ya === null || yb === null ? null : ya - yb;
    };
    const signed = integrate(difference, start.x, end.x);
    const area = integrate(
      (x) => {
        const d = difference(x);
        return d === null ? null : Math.abs(d);
      },
      start.x,
      end.x,
    );
    const mid = (start.x + end.x) / 2,
      ya = evaluateCurveY(a, mid),
      yb = evaluateCurveY(b, mid);
    const mixed =
      signed &&
      area &&
      Math.abs(area.value - Math.abs(signed.value)) >
        1e-5 * Math.max(1, area.value);
    segments.push({
      index,
      start,
      end,
      area,
      signed,
      upper: mixed ? "mixed" : (ya ?? 0) >= (yb ?? 0) ? "a" : "b",
      labelX: mid,
      labelY:
        ya !== null && yb !== null ? (ya + yb) / 2 : (start.y + end.y) / 2,
    });
  }
  const analysis = {
    intersections,
    segments,
    total:
      segments.length && segments.every((s) => s.area)
        ? segments.reduce((sum, s) => sum + s.area!.value, 0)
        : null,
  };
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(key, analysis);
  return analysis;
}

export function resolveAutomaticRegion(
  region: Region2DObject,
  a: SceneObject,
  b: SceneObject,
): Region2DObject | null {
  if (!region.autoBounds) return region;
  const segment = analyzeBoundedAreas(
    a,
    b,
    region.autoBounds.searchRange,
  ).segments.find((s) => s.index === region.autoBounds!.index);
  if (!segment?.area) return null;
  return {
    ...region,
    xStart: segment.start.x,
    xEnd: segment.end.x,
    labelX: segment.labelX + region.labelX - region.autoBounds.anchorX,
    labelY: segment.labelY + region.labelY - region.autoBounds.anchorY,
    labelText: region.showAreaValue
      ? `${region.labelText} ≈ ${segment.area.value.toPrecision(6)}`
      : region.labelText,
  };
}
