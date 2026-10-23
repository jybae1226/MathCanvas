import { parse } from "mathjs";

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

const compiledCache = new Map<string, CompiledExpression | null>();
const degrees = Math.PI / 180;
const degreeScope = {
  sin: (x: number) => Math.sin(x * degrees),
  cos: (x: number) => Math.cos(x * degrees),
  tan: (x: number) => Math.tan(x * degrees),
  sec: (x: number) => 1 / Math.cos(x * degrees),
  csc: (x: number) => 1 / Math.sin(x * degrees),
  cot: (x: number) => 1 / Math.tan(x * degrees),
  asin: (x: number) => Math.asin(x) / degrees,
  acos: (x: number) => Math.acos(x) / degrees,
  atan: (x: number) => Math.atan(x) / degrees,
  atan2: (y: number, x: number) => Math.atan2(y, x) / degrees,
};
const evalCompiled = (
  compiled: CompiledExpression,
  scope: Record<string, unknown>,
  unit?: "rad" | "deg",
) => compiled.evaluate(unit === "deg" ? { ...degreeScope, ...scope } : scope);

function getCompiled(expression: string): CompiledExpression | null {
  expression = expression
    .replace(/π/g, "pi")
    .replace(/θ/g, "theta")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\bln\(/g, "log(")
    .replace(/\barcsin\(/g, "asin(")
    .replace(/\barccos\(/g, "acos(")
    .replace(/\barctan\(/g, "atan(");
  if (compiledCache.has(expression)) {
    return compiledCache.get(expression) ?? null;
  }

  try {
    if (expression.length > 2000) throw new Error("수식이 너무 깁니다.");
    const node = parse(expression);
    node.traverse((child) => {
      if (
        child.type === "SymbolNode" &&
        "name" in child &&
        !/^(x|y|t|theta|angle|pi|e|sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|sec|csc|cot|abs|sqrt|cbrt|exp|log|log10|log2|pow|floor|ceil|round|sign|min|max)$/.test(
          String(child.name),
        )
      ) {
        throw new Error("알 수 없는 기호입니다.");
      }
      if (
        ![
          "OperatorNode",
          "ConstantNode",
          "SymbolNode",
          "FunctionNode",
          "ParenthesisNode",
          "ConditionalNode",
        ].includes(child.type)
      ) {
        throw new Error("그래프에는 수치 수식만 사용할 수 있습니다.");
      }
      if (
        child.type === "FunctionNode" &&
        "fn" in child &&
        !/^(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|sec|csc|cot|abs|sqrt|cbrt|exp|log|log10|log2|pow|floor|ceil|round|sign|min|max)$/.test(
          String(child.fn),
        )
      ) {
        throw new Error("지원하지 않는 함수입니다.");
      }
    });
    const compiled = node.compile() as unknown as CompiledExpression;
    if (compiledCache.size >= 128)
      compiledCache.delete(compiledCache.keys().next().value!);
    compiledCache.set(expression, compiled);
    return compiled;
  } catch {
    if (compiledCache.size >= 128)
      compiledCache.delete(compiledCache.keys().next().value!);
    compiledCache.set(expression, null);
    return null;
  }
}

export function evaluateExpression(
  expression: string,
  scope: Record<string, number>,
  unit?: "rad" | "deg",
): number | null {
  try {
    const compiled = getCompiled(expression);
    const value = compiled ? evalCompiled(compiled, scope, unit) : null;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function expressionError(expression: string): string | null {
  if (!expression.trim()) return null;
  const normalized = isPolarExpression(expression)
    ? expression.split("=")[1]
    : isImplicitExpression(expression)
      ? parseImplicitExpression(expression)
      : normalizeExplicitFunctionExpression(expression);
  return getCompiled(normalized)
    ? null
    : "수식을 확인하세요. 예: sin(x), log(x), x^2+y^2=4, r=1+cos(theta)";
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

export function isPolarExpression(expression: string): boolean {
  const trimmed = expression.trim();
  if (!trimmed.includes("=")) return false;

  const parts = trimmed.split("=");
  if (parts.length !== 2) return false;

  const left = parts[0].trim().replace(/\s+/g, "");
  return left === "r";
}

export function samplePolarFunctionPoints(
  expression: string,
  domain: [number, number],
  samples: number,
  angleUnit?: "rad" | "deg",
): PlotPoint[] {
  if (!isPolarExpression(expression)) return [];

  const rightSide = expression.split("=")[1]?.trim() || "";

  const compiled = getCompiled(rightSide);
  if (!compiled) return [];

  const [minAngle, maxAngle] = domain;
  const pts: PlotPoint[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const angle = minAngle + ((maxAngle - minAngle) * i) / samples;

    try {
      const scope: Record<string, unknown> = {
        theta: angle,
        t: angle,
        angle,
        θ: angle,
      };
      const r = evalCompiled(compiled, scope, angleUnit);

      if (typeof r === "number" && Number.isFinite(r)) {
        const radians = angleUnit === "deg" ? angle * degrees : angle;
        const x = r * Math.cos(radians);
        const y = r * Math.sin(radians);
        pts.push({ x, y });
      } else {
        pts.push({ x: angle, y: null });
      }
    } catch {
      pts.push({ x: angle, y: null });
    }
  }

  return pts;
}

export function isImplicitExpression(expression: string): boolean {
  const trimmed = expression.trim();
  if (!trimmed.includes("=")) return false;

  const parts = trimmed.split("=");
  if (parts.length !== 2) return false;

  const left = parts[0].trim().replace(/\s+/g, "");
  return left !== "y" && left !== "r";
}

function parseImplicitExpression(expression: string): string {
  const trimmed = expression.trim();
  if (!trimmed) return "";

  if (!isImplicitExpression(trimmed)) return "";

  const [left, right] = trimmed.split("=");
  return `(${left}) - (${right})`;
}

export function getImplicitEvaluator(
  expression: string,
  angleUnit?: "rad" | "deg",
) {
  const parsed = parseImplicitExpression(expression);
  if (!parsed) return null;

  const compiled = getCompiled(parsed);
  if (!compiled) return null;

  return (x: number, y: number): number | null => {
    try {
      const result = evalCompiled(compiled, { x, y }, angleUnit);
      return typeof result === "number" && Number.isFinite(result)
        ? result
        : null;
    } catch {
      return null;
    }
  };
}

export const sampleFunctionPoints = (
  expression: string,
  domain: [number, number],
  samples: number,
  angleUnit?: "rad" | "deg",
): PlotPoint[] => {
  const normalized = normalizeExplicitFunctionExpression(expression);
  if (!normalized || normalized.includes("=")) return [];

  const compiled = getCompiled(normalized);
  if (!compiled) return [];

  const [minX, maxX] = domain;
  const pts: PlotPoint[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const x = minX + ((maxX - minX) * i) / samples;

    try {
      const y = evalCompiled(compiled, { x }, angleUnit);

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

export function sampleImplicitSegments(
  expression: string,
  xRange: [number, number],
  yRange: [number, number],
  resolutionX: number,
  resolutionY: number,
  angleUnit?: "rad" | "deg",
): Array<[XYPoint, XYPoint]> {
  const f = getImplicitEvaluator(expression, angleUnit);
  if (!f || xRange[1] <= xRange[0] || yRange[1] <= yRange[0]) return [];
  const nx = Math.min(300, Math.max(16, Math.round(resolutionX))),
    ny = Math.min(300, Math.max(16, Math.round(resolutionY)));
  const dx = (xRange[1] - xRange[0]) / nx,
    dy = (yRange[1] - yRange[0]) / ny;
  const values = Array.from({ length: nx + 1 }, (_, i) =>
    Array.from({ length: ny + 1 }, (_, j) =>
      f(xRange[0] + i * dx, yRange[0] + j * dy),
    ),
  );
  const segments: Array<[XYPoint, XYPoint]> = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const corners = [
        { x: xRange[0] + i * dx, y: yRange[0] + j * dy, v: values[i][j] },
        {
          x: xRange[0] + (i + 1) * dx,
          y: yRange[0] + j * dy,
          v: values[i + 1][j],
        },
        {
          x: xRange[0] + (i + 1) * dx,
          y: yRange[0] + (j + 1) * dy,
          v: values[i + 1][j + 1],
        },
        {
          x: xRange[0] + i * dx,
          y: yRange[0] + (j + 1) * dy,
          v: values[i][j + 1],
        },
      ];
      if (corners.some((c) => c.v === null) || corners.every((c) => c.v === 0))
        continue;
      const points: XYPoint[] = [];
      for (let edge = 0; edge < 4; edge++) {
        const a = corners[edge],
          b = corners[(edge + 1) % 4];
        if (a.v === null || b.v === null) continue;
        if (
          a.v === 0 &&
          !points.some((p) => Math.hypot(p.x - a.x, p.y - a.y) < 1e-10)
        )
          points.push({ x: a.x, y: a.y });
        if (a.v * b.v < 0) {
          const point = interpolateZero(a.x, a.y, a.v, b.x, b.y, b.v);
          const residual = f(point.x, point.y);
          if (
            residual !== null &&
            Math.abs(residual) <= Math.max(Math.abs(a.v), Math.abs(b.v))
          )
            points.push(point);
        }
      }
      if (points.length === 2) segments.push([points[0], points[1]]);
      else if (points.length === 4) {
        const mid = f(
          (corners[0].x + corners[2].x) / 2,
          (corners[0].y + corners[2].y) / 2,
        );
        if (mid !== null && mid * corners[0].v! > 0)
          segments.push([points[0], points[1]], [points[2], points[3]]);
        else segments.push([points[0], points[3]], [points[1], points[2]]);
      }
    }
  return segments;
}

export function buildImplicitPath(
  expression: string,
  xRange: [number, number],
  yRange: [number, number],
  resolutionX: number,
  resolutionY: number,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  angleUnit?: "rad" | "deg",
): string {
  return sampleImplicitSegments(
    expression,
    xRange,
    yRange,
    resolutionX,
    resolutionY,
    angleUnit,
  )
    .map(
      ([a, b]) =>
        "M " +
        toScreenX(a.x) +
        " " +
        toScreenY(a.y) +
        " L " +
        toScreenX(b.x) +
        " " +
        toScreenY(b.y),
    )
    .join(" ");
}

function evaluateFunctionY(obj: Function2DObject, x: number): number | null {
  const normalized = normalizeExplicitFunctionExpression(obj.expression);

  if (!normalized) return null;
  if (normalized.includes("=")) return null;

  if (obj.domain && (x < obj.domain[0] || x > obj.domain[1])) {
    return null;
  }

  try {
    const compiled = getCompiled(normalized);
    if (!compiled) return null;
    const y = evalCompiled(compiled, { x }, obj.angleUnit);

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
  const t = (x - obj.x1) / dx;
  if ((obj.lineKind ?? "segment") === "segment" && (t < -1e-9 || t > 1 + 1e-9))
    return null;
  if (obj.lineKind === "ray" && t < -1e-9) return null;

  const slope = (obj.y2 - obj.y1) / dx;
  return obj.y1 + slope * (x - obj.x1);
}

export function evaluateCurveY(obj: SceneObject, x: number): number | null {
  if (obj.type === "function2d") {
    return evaluateFunctionY(obj, x);
  }

  if (obj.type === "line2d") {
    return evaluateLineY(obj, x);
  }

  return null;
}
