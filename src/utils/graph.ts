import { compile } from "mathjs";
import type {
  Function2DObject,
  Line2DObject,
  Polygon2DObject,
  SceneObject,
} from "../types/objects";

export type PlotPoint = {
  x: number;
  y: number | null;
};

export const sampleFunctionPoints = (
  expression: string,
  domain: [number, number],
  samples: number,
): PlotPoint[] => {
  const compiled = compile(expression);
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

function evaluateFunctionY(
  obj: Function2DObject,
  x: number,
): number | null {
  if (obj.domain && (x < obj.domain[0] || x > obj.domain[1])) {
    return null;
  }

  try {
    const compiled = compile(obj.expression);
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

export function approximateRegionArea(
  curveA: SceneObject,
  curveB: SceneObject,
  xStart: number,
  xEnd: number,
  samples: number,
): number {
  const minX = Math.min(xStart, xEnd);
  const maxX = Math.max(xStart, xEnd);
  const dx = (maxX - minX) / samples;
  let area = 0;

  for (let i = 0; i < samples; i += 1) {
    const x0 = minX + i * dx;
    const x1 = x0 + dx;
    const yA0 = evaluateCurveY(curveA, x0);
    const yB0 = evaluateCurveY(curveB, x0);
    const yA1 = evaluateCurveY(curveA, x1);
    const yB1 = evaluateCurveY(curveB, x1);

    if (
      yA0 === null ||
      yB0 === null ||
      yA1 === null ||
      yB1 === null
    ) {
      continue;
    }

    const h0 = Math.abs(yA0 - yB0);
    const h1 = Math.abs(yA1 - yB1);
    area += ((h0 + h1) * 0.5) * dx;
  }

  return area;
}

export function buildPolygonPath(
  polygon: Polygon2DObject,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
): string {
  if (polygon.points.length < 2) return "";

  const commands = polygon.points.map((p, index) => {
    const sx = toScreenX(p.x);
    const sy = toScreenY(p.y);
    return `${index === 0 ? "M" : "L"} ${sx} ${sy}`;
  });

  commands.push("Z");
  return commands.join(" ");
}

export function polygonArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;

  let sum = 0;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }

  return Math.abs(sum) / 2;
}

export function polygonPerimeter(
  points: Array<{ x: number; y: number }>,
): number {
  if (points.length < 2) return 0;

  let total = 0;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }

  return total;
}