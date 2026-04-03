import { compile } from "mathjs";

import type {
  Function2DObject,
  Line2DObject,
  SceneObject,
} from "../types/objects";

export type PlotPoint = {
  x: number;
  y: number | null;
};

type CompiledExpression = {
  evaluate: (scope: Record<string, unknown>) => unknown;
};

type XYPoint = {
  x: number;
  y: number;
};

type CurveBranch = XYPoint[];

const compiledCache = new Map<string, CompiledExpression>();

function getCompiled(expression: string): CompiledExpression {
  const cached = compiledCache.get(expression);
  if (cached) return cached;

  const compiled = compile(expression) as unknown as CompiledExpression;
  compiledCache.set(expression, compiled);
  return compiled;
}

function normalizeExplicitFunctionExpression(expression: string): string {
  const trimmed = expression.trim();
  if (!trimmed) return "";

  if (!trimmed.includes("=")) return trimmed;

  const parts = trimmed.split("=");
  if (parts.length !== 2) return trimmed;

  const left = parts[0].trim().replace(/\s+/g, "");
  const right = parts[1].trim();

  if (left === "y") return right;

  return trimmed;
}

export function isImplicitExpression(expression: string): boolean {
  const trimmed = expression.trim();
  if (!trimmed.includes("=")) return false;

  const parts = trimmed.split("=");
  if (parts.length !== 2) return false;

  const left = parts[0].trim().replace(/\s+/g, "");
  return left !== "y";
}

function parseImplicitExpression(expression: string): string {
  const trimmed = expression.trim();
  if (!trimmed) return "";

  if (!isImplicitExpression(trimmed)) return "";

  const [left, right] = trimmed.split("=");
  return `(${left}) - (${right})`;
}

function getImplicitEvaluator(expression: string) {
  const parsed = parseImplicitExpression(expression);
  if (!parsed) return null;

  try {
    const compiled = getCompiled(parsed);

    return (x: number, y: number): number | null => {
      try {
        const result = compiled.evaluate({ x, y });
        return typeof result === "number" && Number.isFinite(result)
          ? result
          : null;
      } catch {
        return null;
      }
    };
  } catch {
    return null;
  }
}

export const sampleFunctionPoints = (
  expression: string,
  domain: [number, number],
  samples: number,
): PlotPoint[] => {
  const normalized = normalizeExplicitFunctionExpression(expression);
  if (!normalized || normalized.includes("=")) return [];

  const compiled = getCompiled(normalized);
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

function interpolateZero(
  x0: number,
  y0: number,
  v0: number,
  x1: number,
  y1: number,
  v1: number,
): XYPoint {
  const dv = v1 - v0;
  if (Math.abs(dv) < 1e-12) {
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  }

  const t = -v0 / dv;
  return {
    x: x0 + (x1 - x0) * t,
    y: y0 + (y1 - y0) * t,
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

      const v00 = evaluator(x0, y0);
      const v10 = evaluator(x1, y0);
      const v11 = evaluator(x1, y1);
      const v01 = evaluator(x0, y1);

      if ([v00, v10, v11, v01].some((v) => v === null)) continue;

      const corners = [
        { x: x0, y: y0, v: v00 as number },
        { x: x1, y: y0, v: v10 as number },
        { x: x1, y: y1, v: v11 as number },
        { x: x0, y: y1, v: v01 as number },
      ];

      const pts: XYPoint[] = [];
      const edges: Array<[number, number]> = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
      ];

      for (const [a, b] of edges) {
        const p0 = corners[a];
        const p1 = corners[b];

        if ((p0.v <= 0 && p1.v >= 0) || (p0.v >= 0 && p1.v <= 0)) {
          pts.push(interpolateZero(p0.x, p0.y, p0.v, p1.x, p1.y, p1.v));
        }
      }

      if (pts.length === 2) {
        segments.push(
          `M ${toScreenX(pts[0].x)} ${toScreenY(pts[0].y)} L ${toScreenX(pts[1].x)} ${toScreenY(pts[1].y)}`,
        );
      } else if (pts.length === 4) {
        segments.push(
          `M ${toScreenX(pts[0].x)} ${toScreenY(pts[0].y)} L ${toScreenX(pts[1].x)} ${toScreenY(pts[1].y)}`,
        );
        segments.push(
          `M ${toScreenX(pts[2].x)} ${toScreenY(pts[2].y)} L ${toScreenX(pts[3].x)} ${toScreenY(pts[3].y)}`,
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
  const normalized = normalizeExplicitFunctionExpression(obj.expression);

  if (!normalized) return null;
  if (normalized.includes("=")) return null;

  if (obj.domain && (x < obj.domain[0] || x > obj.domain[1])) {
    return null;
  }

  try {
    const compiled = getCompiled(normalized);
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
  if (Math.abs(dx) < 1e-12) return null;

  const slope = (obj.y2 - obj.y1) / dx;
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

function sampleImplicitRootsAtX(
  expression: string,
  x: number,
  yRange: [number, number],
  steps = 400,
): number[] {
  const evaluator = getImplicitEvaluator(expression);
  if (!evaluator) return [];

  const [yMin, yMax] = yRange;
  const dy = (yMax - yMin) / steps;
  const roots: number[] = [];

  let prevY = yMin;
  let prevV = evaluator(x, prevY);

  for (let i = 1; i <= steps; i += 1) {
    const y = yMin + i * dy;
    const v = evaluator(x, y);

    if (prevV !== null && v !== null) {
      if (prevV === 0) {
        roots.push(prevY);
      } else if (prevV * v < 0) {
        const root = interpolateZero(x, prevY, prevV, x, y, v).y;
        roots.push(root);
      }
    }

    prevY = y;
    prevV = v;
  }

  const unique: number[] = [];
  for (const r of roots) {
    if (!unique.some((q) => Math.abs(q - r) < 1e-3)) unique.push(r);
  }

  return unique.sort((a, b) => a - b);
}

function buildImplicitBranches(
  expression: string,
  xRange: [number, number],
  yRange: [number, number],
  samples = 400,
): CurveBranch[] {
  const [xMin, xMax] = xRange;
  const branches: CurveBranch[] = [];
  const active: CurveBranch[] = [];
  const ySpan = yRange[1] - yRange[0];
  const matchThreshold = Math.max(0.25, ySpan * 0.08);

  for (let i = 0; i <= samples; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const roots = sampleImplicitRootsAtX(expression, x, yRange, 320);

    const used = new Array(roots.length).fill(false);
    const matchedActive = new Set<number>();

    for (let a = 0; a < active.length; a += 1) {
      const branch = active[a];
      const last = branch[branch.length - 1];
      let bestIdx = -1;
      let bestDist = Infinity;

      for (let r = 0; r < roots.length; r += 1) {
        if (used[r]) continue;
        const dist = Math.abs(roots[r] - last.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = r;
        }
      }

      if (bestIdx >= 0 && bestDist <= matchThreshold) {
        branch.push({ x, y: roots[bestIdx] });
        used[bestIdx] = true;
        matchedActive.add(a);
      }
    }

    for (let r = 0; r < roots.length; r += 1) {
      if (used[r]) continue;
      const newBranch: CurveBranch = [{ x, y: roots[r] }];
      branches.push(newBranch);
      active.push(newBranch);
    }

    for (let a = active.length - 1; a >= 0; a -= 1) {
      if (!matchedActive.has(a)) {
        active.splice(a, 1);
      }
    }
  }

  return branches.filter((branch) => branch.length >= 2);
}

function buildCurveBranches(
  obj: SceneObject,
  xRange: [number, number],
  yRange: [number, number],
  samples = 500,
): CurveBranch[] {
  if (obj.type === "line2d") {
    return [[
      { x: obj.x1, y: obj.y1 },
      { x: obj.x2, y: obj.y2 },
    ]];
  }

  if (obj.type === "function2d") {
    const expr = obj.expression.trim();
    if (!expr) return [];

    if (isImplicitExpression(expr)) {
      return buildImplicitBranches(expr, xRange, yRange, samples);
    }

    const domain = obj.domain ?? xRange;
    const pts = sampleFunctionPoints(expr, domain, samples);

    const branch: CurveBranch = pts
      .filter((p): p is { x: number; y: number } => p.y !== null)
      .map((p) => ({ x: p.x, y: p.y }));

    return branch.length >= 2 ? [branch] : [];
  }

  return [];
}

function segmentIntersection(
  a1: XYPoint,
  a2: XYPoint,
  b1: XYPoint,
  b2: XYPoint,
): XYPoint | null {
  const den =
    (a1.x - a2.x) * (b1.y - b2.y) -
    (a1.y - a2.y) * (b1.x - b2.x);

  if (Math.abs(den) < 1e-12) return null;

  const t =
    ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / den;
  const u =
    ((a1.x - b1.x) * (a1.y - a2.y) - (a1.y - b1.y) * (a1.x - a2.x)) / den;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return {
    x: a1.x + t * (a2.x - a1.x),
    y: a1.y + t * (a2.y - a1.y),
  };
}

export function approximateCurveIntersections(
  a: SceneObject,
  b: SceneObject,
  xRange: [number, number],
  yRange?: [number, number],
  samples = 500,
): Array<{ x: number; y: number }> {
  const fallbackYRange: [number, number] = yRange ?? [-10, 10];

  const aBranches = buildCurveBranches(a, xRange, fallbackYRange, samples);
  const bBranches = buildCurveBranches(b, xRange, fallbackYRange, samples);

  const points: XYPoint[] = [];

  for (const branchA of aBranches) {
    for (const branchB of bBranches) {
      for (let i = 0; i < branchA.length - 1; i += 1) {
        for (let j = 0; j < branchB.length - 1; j += 1) {
          const hit = segmentIntersection(
            branchA[i],
            branchA[i + 1],
            branchB[j],
            branchB[j + 1],
          );
          if (hit) points.push(hit);
        }
      }
    }
  }

  const unique: XYPoint[] = [];
  for (const p of points) {
    if (!unique.some((q) => Math.abs(q.x - p.x) < 1e-3 && Math.abs(q.y - p.y) < 1e-3)) {
      unique.push(p);
    }
  }

  return unique;
}

function pickBandBranch(
  branches: CurveBranch[],
  xStart: number,
  xEnd: number,
): CurveBranch | null {
  if (branches.length === 0) return null;

  const minX = Math.min(xStart, xEnd);
  const maxX = Math.max(xStart, xEnd);

  const candidates = branches
    .map((branch) => branch.filter((p) => p.x >= minX && p.x <= maxX))
    .filter((branch) => branch.length >= 2);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function resampleBranchByX(
  branch: CurveBranch,
  xStart: number,
  xEnd: number,
  samples: number,
): CurveBranch {
  const minX = Math.min(xStart, xEnd);
  const maxX = Math.max(xStart, xEnd);
  const result: CurveBranch = [];

  for (let i = 0; i <= samples; i += 1) {
    const x = minX + ((maxX - minX) * i) / samples;

    for (let j = 0; j < branch.length - 1; j += 1) {
      const p0 = branch[j];
      const p1 = branch[j + 1];

      const within =
        (x >= Math.min(p0.x, p1.x) && x <= Math.max(p0.x, p1.x)) ||
        Math.abs(x - p0.x) < 1e-9 ||
        Math.abs(x - p1.x) < 1e-9;

      if (!within) continue;
      if (Math.abs(p1.x - p0.x) < 1e-12) continue;

      const t = (x - p0.x) / (p1.x - p0.x);
      const y = p0.y + t * (p1.y - p0.y);
      result.push({ x, y });
      break;
    }
  }

  return result;
}

export function buildRegionPath(
  curveA: SceneObject,
  curveB: SceneObject,
  xStart: number,
  xEnd: number,
  samples: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  yRange?: [number, number],
): string {
  const fallbackYRange: [number, number] = yRange ?? [-10, 10];
  const xBand: [number, number] = [Math.min(xStart, xEnd), Math.max(xStart, xEnd)];

  const branchesA = buildCurveBranches(curveA, xBand, fallbackYRange, Math.max(samples, 300));
  const branchesB = buildCurveBranches(curveB, xBand, fallbackYRange, Math.max(samples, 300));

  const branchA = pickBandBranch(branchesA, xStart, xEnd);
  const branchB = pickBandBranch(branchesB, xStart, xEnd);

  if (!branchA || !branchB) return "";

  const topRaw = resampleBranchByX(branchA, xStart, xEnd, samples);
  const bottomRaw = resampleBranchByX(branchB, xStart, xEnd, samples);

  if (topRaw.length < 2 || bottomRaw.length < 2) return "";

  const len = Math.min(topRaw.length, bottomRaw.length);
  const top: CurveBranch = [];
  const bottom: CurveBranch = [];

  for (let i = 0; i < len; i += 1) {
    const a = topRaw[i];
    const b = bottomRaw[i];

    if (a.y >= b.y) {
      top.push(a);
      bottom.push(b);
    } else {
      top.push(b);
      bottom.push(a);
    }
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