import { compile } from "mathjs";
import type { MathNode } from "mathjs";
import type {
  Function2DObject,
  Line2DObject,
  SceneObject,
} from "../types/objects";

export type PlotPoint = {
  x: number;
  y: number | null;
};

const compiledCache = new Map<string, MathNode["compile"] extends (...args: any[]) => infer R ? R : any>();

function getCompiled(expression: string) {
  const cached = compiledCache.get(expression);
  if (cached) return cached;

  const compiled = compile(expression);
  compiledCache.set(expression, compiled);
  return compiled;
}

export const sampleFunctionPoints = (
  expression: string,
  domain: [number, number],
  samples: number,
): PlotPoint[] => {
  if (!expression.trim()) return [];

  const compiled = getCompiled(expression);
  const [minX, maxX] = domain;
  const pts: PlotPoint[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const x = minX + ((maxX - minX) * i) / samples;

    try {
      const y = compiled.evaluate({ x });

      if (typeof y === "number" && Number.isFinite(y)) {
        pts.push({ x, y });
      } else {
        pts.push({ x, y: null });
      }
    } catch {
      pts.push({ x, y: null });
    }
  }

  return pts;
};

export const buildFunctionPath = (
  points: PlotPoint[],
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  viewHeight: number,
): string => {
  const commands: string[] = [];
  let prevScreenY: number | null = null;
  let started = false;

  for (const point of points) {
    if (point.y === null) {
      prevScreenY = null;
      started = false;
      continue;
    }

    const sx = toScreenX(point.x);
    const sy = toScreenY(point.y);

    if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
      prevScreenY = null;
      started = false;
      continue;
    }

    const shouldBreak =
      !started ||
      prevScreenY === null ||
      Math.abs(sy - prevScreenY) > viewHeight * 1.25;

    commands.push(`${shouldBreak ? "M" : "L"} ${sx} ${sy}`);

    started = true;
    prevScreenY = sy;
  }

  return commands.join(" ");
};

function parseImplicitExpression(expression: string): string {
  const trimmed = expression.trim();

  if (!trimmed) return "";

  if (trimmed.includes("=")) {
    const [left, right] = trimmed.split("=");
    return `(${left}) - (${right})`;
  }

  return trimmed;
}

function getImplicitEvaluator(expression: string) {
  const parsed = parseImplicitExpression(expression);
  if (!parsed) return null;

  try {
    const compiled = getCompiled(parsed);
    return (x: number, y: number): number | null => {
      try {
        const result = compiled.evaluate({ x, y });
        return typeof result === "number" && Number.isFinite(result) ? result : null;
      } catch {
        return null;
      }
    };
  } catch {
    return null;
  }
}

function interpolate(
  p1: { x: number; y: number; v: number },
  p2: { x: number; y: number; v: number },
) {
  const dv = p2.v - p1.v;
  if (Math.abs(dv) < 1e-12) {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }
  const t = -p1.v / dv;
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

export function buildImplicitPath(
  expression: string,
  xRange: [number, number],
  yRange: [number, number],
  resolutionX: number,
  resolutionY: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
): string {
  const evaluator = getImplicitEvaluator(expression);
  if (!evaluator) return "";

  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  const dx = (xMax - xMin) / resolutionX;
  const dy = (yMax - yMin) / resolutionY;
  const segments: string[] = [];

  for (let i = 0; i < resolutionX; i += 1) {
    for (let j = 0; j < resolutionY; j += 1) {
      const x0 = xMin + i * dx;
      const x1 = x0 + dx;
      const y0 = yMin + j * dy;
      const y1 = y0 + dy;

      const p00 = { x: x0, y: y0, v: evaluator(x0, y0) };
      const p10 = { x: x1, y: y0, v: evaluator(x1, y0) };
      const p11 = { x: x1, y: y1, v: evaluator(x1, y1) };
      const p01 = { x: x0, y: y1, v: evaluator(x0, y1) };

      if ([p00.v, p10.v, p11.v, p01.v].some((v) => v === null)) continue;

      const corners = [p00, p10, p11, p01] as Array<{
        x: number;
        y: number;
        v: number | null;
      }>;

      const edges: Array<{ x: number; y: number }> = [];

      const edgePairs: Array<[number, number]> = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
      ];

      for (const [aIdx, bIdx] of edgePairs) {
        const a = corners[aIdx];
        const b = corners[bIdx];
        if (a.v === null || b.v === null) continue;

        if ((a.v <= 0 && b.v >= 0) || (a.v >= 0 && b.v <= 0)) {
          edges.push(interpolate(a as any, b as any));
        }
      }

      if (edges.length === 2) {
        segments.push(
          `M ${toScreenX(edges[0].x)} ${toScreenY(edges[0].y)} L ${toScreenX(edges[1].x)} ${toScreenY(edges[1].y)}`,
        );
      } else if (edges.length === 4) {
        segments.push(
          `M ${toScreenX(edges[0].x)} ${toScreenY(edges[0].y)} L ${toScreenX(edges[1].x)} ${toScreenY(edges[1].y)}`,
        );
        segments.push(
          `M ${toScreenX(edges[2].x)} ${toScreenY(edges[2].y)} L ${toScreenX(edges[3].x)} ${toScreenY(edges[3].y)}`,
        );
      }
    }
  }

  return segments.join(" ");
}

function evaluateFunctionY(
  obj: Function2DObject,
  x: number,
): number | null {
  if (!obj.expression.trim()) return null;
  if (obj.expression.includes("=")) return null;

  if (obj.domain && (x < obj.domain[0] || x > obj.domain[1])) {
    return null;
  }

  try {
    const compiled = getCompiled(obj.expression);
    const y = compiled.evaluate({ x });

    if (typeof y === "number" && Number.isFinite(y)) {
      return y;
    }

    return null;
  } catch {
    return null;
  }
}

function evaluateLineY(obj: Line2DObject, x: number): number | null {
  const dx = obj.x2 - obj.x1;
  const dy = obj.y2 - obj.y1;

  if (Math.abs(dx) < 1e-12) return null;

  const slope = dy / dx;
  return obj.y1 + slope * (x - obj.x1);
}

export function evaluateCurveY(
  obj: SceneObject,
  x: number,
): number | null {
  if (obj.type === "function2d") {
    return evaluateFunctionY(obj, x);
  }

  if (obj.type === "line2d") {
    return evaluateLineY(obj, x);
  }

  return null;
}

export function buildRegionPath(
  curveA: SceneObject,
  curveB: SceneObject,
  xStart: number,
  xEnd: number,
  samples: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
): string {
  const top: Array<{ x: number; y: number }> = [];
  const bottom: Array<{ x: number; y: number }> = [];

  const minX = Math.min(xStart, xEnd);
  const maxX = Math.max(xStart, xEnd);

  for (let i = 0; i <= samples; i += 1) {
    const x = minX + ((maxX - minX) * i) / samples;
    const yA = evaluateCurveY(curveA, x);
    const yB = evaluateCurveY(curveB, x);

    if (yA === null || yB === null) continue;
    if (!Number.isFinite(yA) || !Number.isFinite(yB)) continue;

    top.push({ x, y: yA });
    bottom.push({ x, y: yB });
  }

  if (top.length < 2 || bottom.length < 2) return "";

  const commands: string[] = [];

  top.forEach((p, index) => {
    commands.push(
      `${index === 0 ? "M" : "L"} ${toScreenX(p.x)} ${toScreenY(p.y)}`,
    );
  });

  [...bottom].reverse().forEach((p) => {
    commands.push(`L ${toScreenX(p.x)} ${toScreenY(p.y)}`);
  });

  commands.push("Z");
  return commands.join(" ");
}

export function approximateCurveIntersections(
  a: SceneObject,
  b: SceneObject,
  xRange: [number, number],
  samples = 1000,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const [xMin, xMax] = xRange;
  const dx = (xMax - xMin) / samples;

  let prevX = xMin;
  let prevYA = evaluateCurveY(a, prevX);
  let prevYB = evaluateCurveY(b, prevX);

  for (let i = 1; i <= samples; i += 1) {
    const x = xMin + i * dx;
    const yA = evaluateCurveY(a, x);
    const yB = evaluateCurveY(b, x);

    if (
      prevYA !== null &&
      prevYB !== null &&
      yA !== null &&
      yB !== null
    ) {
      const d0 = prevYA - prevYB;
      const d1 = yA - yB;

      if (d0 === 0) {
        points.push({ x: prevX, y: prevYA });
      } else if (d0 * d1 < 0) {
        const t = Math.abs(d0) / (Math.abs(d0) + Math.abs(d1));
        const xr = prevX + (x - prevX) * t;
        const yrA = evaluateCurveY(a, xr);
        const yrB = evaluateCurveY(b, xr);

        if (yrA !== null && yrB !== null) {
          points.push({ x: xr, y: (yrA + yrB) / 2 });
        }
      }
    }

    prevX = x;
    prevYA = yA;
    prevYB = yB;
  }

  const unique: Array<{ x: number; y: number }> = [];

  for (const p of points) {
    const exists = unique.some(
      (q) => Math.abs(q.x - p.x) < 1e-3 && Math.abs(q.y - p.y) < 1e-3,
    );
    if (!exists) unique.push(p);
  }

  return unique;
}