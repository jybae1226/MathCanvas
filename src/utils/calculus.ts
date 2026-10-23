import type {
  Function2DObject,
  Region2DObject,
  SceneObject,
} from "../types/objects";
import {
  evaluateCurveY,
  getImplicitEvaluator,
  isImplicitExpression,
  isPolarExpression,
} from "./graph";

type Interval = [number, number];
export type NumericResult = { value: number; error: number };

export function integrate(
  f: (x: number) => number | null,
  a: number,
  b: number,
  tolerance = 1e-6,
): NumericResult | null {
  if (![a, b].every(Number.isFinite) || a === b)
    return a === b ? { value: 0, error: 0 } : null;
  let evaluations = 0;
  let error = 0;
  const sample = (x: number) => {
    evaluations++;
    const y = f(x);
    if (evaluations > 30000 || y === null || !Number.isFinite(y))
      throw new Error("未収束");
    return y;
  };
  const simpson = (
    left: number,
    right: number,
    fl: number,
    fm: number,
    fr: number,
  ) => ((right - left) * (fl + 4 * fm + fr)) / 6;
  const recurse = (
    left: number,
    right: number,
    fl: number,
    fm: number,
    fr: number,
    whole: number,
    tol: number,
    depth: number,
  ): number => {
    const mid = (left + right) / 2;
    const f1 = sample((left + mid) / 2),
      f2 = sample((mid + right) / 2);
    const first = simpson(left, mid, fl, f1, fm),
      second = simpson(mid, right, fm, f2, fr);
    const delta = first + second - whole;
    if (Math.abs(delta) <= 15 * tol) {
      error += Math.abs(delta) / 15;
      return first + second + delta / 15;
    }
    if (depth <= 0) throw new Error("未収束");
    return (
      recurse(left, mid, fl, f1, fm, first, tol / 2, depth - 1) +
      recurse(mid, right, fm, f2, fr, second, tol / 2, depth - 1)
    );
  };
  try {
    // Split the interval first to avoid aliasing oscillatory functions on one Simpson panel.
    let value = 0;
    for (let i = 0; i < 32; i++) {
      const left = a + ((b - a) * i) / 32,
        right = a + ((b - a) * (i + 1)) / 32;
      const fl = sample(left),
        fm = sample((left + right) / 2),
        fr = sample(right);
      value += recurse(
        left,
        right,
        fl,
        fm,
        fr,
        simpson(left, right, fl, fm, fr),
        tolerance / 32,
        18,
      );
    }
    return { value, error };
  } catch {
    return null;
  }
}

export function derivative(curve: Function2DObject, x: number): number | null {
  const h = 1e-4 * Math.max(1, Math.abs(x));
  const values = [-2, -1, 1, 2].map((k) => evaluateCurveY(curve, x + k * h));
  if (values.some((n) => n === null)) return null;
  const [a, b, c, d] = values as number[];
  const center = evaluateCurveY(curve, x);
  if (center === null) return null;
  const slope = (a - 8 * b + 8 * c - d) / (12 * h);
  const left = (center - b) / h;
  const right = (c - center) / h;
  return Number.isFinite(slope) &&
    Math.abs(left - right) <= 0.01 * Math.max(1, Math.abs(slope))
    ? slope
    : null;
}

export function rootsInRange(
  f: (y: number) => number | null,
  range: Interval,
  steps = 180,
): number[] {
  const roots: number[] = [];
  const add = (root: number) => {
    if (!roots.some((v) => Math.abs(v - root) < 1e-6)) roots.push(root);
  };
  let prevX = range[0],
    prev = f(prevX);
  for (let i = 1; i <= steps; i++) {
    const x = range[0] + ((range[1] - range[0]) * i) / steps,
      value = f(x);
    if (prev !== null && value !== null) {
      if (Math.abs(prev) < 1e-10) add(prevX);
      if (Math.abs(value) < 1e-10) add(x);
      if (prev * value < 0) {
        let lo = prevX,
          hi = x,
          vlo = prev;
        for (let j = 0; j < 45; j++) {
          const mid = (lo + hi) / 2,
            vm = f(mid);
          if (vm === null) break;
          if (vlo * vm <= 0) hi = mid;
          else {
            lo = mid;
            vlo = vm;
          }
        }
        const root = (lo + hi) / 2,
          residual = f(root);
        if (residual !== null && Math.abs(residual) < 1e-5) add(root);
      }
    }
    prevX = x;
    prev = value;
  }
  return roots.sort((a, b) => a - b);
}

export function curveRoots(
  curve: SceneObject,
  x: number,
  yRange: Interval,
): number[] {
  if (curve.type === "circle2d") {
    const square = curve.radius ** 2 - (x - curve.cx) ** 2;
    if (square < -1e-10) return [];
    const dy = Math.sqrt(Math.max(0, square));
    return dy < 1e-10 ? [curve.cy] : [curve.cy - dy, curve.cy + dy];
  }
  if (curve.type === "function2d" && isImplicitExpression(curve.expression)) {
    if (curve.domain && (x < curve.domain[0] || x > curve.domain[1])) return [];
    const f = getImplicitEvaluator(curve.expression, curve.angleUnit);
    return f ? rootsInRange((y) => f(x, y), yRange) : [];
  }
  const y = evaluateCurveY(curve, x);
  return y === null ? [] : [y];
}

export function regionIntervals(
  region: Region2DObject,
  a: SceneObject,
  b: SceneObject,
  x: number,
  yRange: Interval,
): Interval[] {
  if (
    x < Math.min(region.xStart, region.xEnd) ||
    x > Math.max(region.xStart, region.xEnd)
  )
    return [];
  const mode = region.regionMode ?? "between";
  if (mode === "between") {
    const rootsA = curveRoots(a, x, yRange),
      rootsB = curveRoots(b, x, yRange);
    const ya = region.branchA === "lower" ? rootsA[0] : rootsA.at(-1);
    const yb = region.branchB === "lower" ? rootsB[0] : rootsB.at(-1);
    return ya === undefined || yb === undefined
      ? []
      : [[Math.min(ya, yb), Math.max(ya, yb)]];
  }
  const fa = curveEquation(a),
    fb = mode === "overlap" ? curveEquation(b) : null;
  if (!fa || (mode === "overlap" && !fb)) return [];
  const boundaries = [
    yRange[0],
    ...curveRoots(a, x, yRange),
    ...(fb ? curveRoots(b, x, yRange) : []),
    yRange[1],
  ]
    .filter((y) => y >= yRange[0] && y <= yRange[1])
    .sort((u, v) => u - v);
  const result: Interval[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const low = boundaries[i],
      high = boundaries[i + 1],
      mid = (low + high) / 2;
    const va = fa(x, mid),
      vb = fb?.(x, mid);
    if (
      high - low > 1e-10 &&
      va !== null &&
      va * (region.signA ?? 1) <= 0 &&
      (!fb ||
        (vb !== null && vb !== undefined && vb * (region.signB ?? 1) <= 0))
    )
      result.push([low, high]);
  }
  return result;
}

export function curveEquation(
  curve: SceneObject,
): ((x: number, y: number) => number | null) | null {
  if (curve.type === "circle2d")
    return (x, y) =>
      (x - curve.cx) ** 2 + (y - curve.cy) ** 2 - curve.radius ** 2;
  if (curve.type === "function2d") {
    if (isPolarExpression(curve.expression)) return null;
    if (isImplicitExpression(curve.expression))
      return getImplicitEvaluator(curve.expression, curve.angleUnit);
    return (x, y) => {
      const v = evaluateCurveY(curve, x);
      return v === null ? null : y - v;
    };
  }
  if (curve.type === "line2d")
    return (x, y) =>
      (curve.x2 - curve.x1) * (y - curve.y1) -
      (curve.y2 - curve.y1) * (x - curve.x1);
  return null;
}

export function buildRegionGeometry(
  region: Region2DObject,
  a: SceneObject,
  b: SceneObject,
  yRange: Interval,
  sx: (x: number) => number,
  sy: (y: number) => number,
): string {
  const count = Math.min(600, Math.max(80, region.samples));
  const lo = Math.min(region.xStart, region.xEnd),
    hi = Math.max(region.xStart, region.xEnd);
  const commands: string[] = [];
  let previous: Interval[] = [];
  let px = lo;
  for (let i = 0; i <= count; i++) {
    const x = lo + ((hi - lo) * i) / count;
    const current = regionIntervals(region, a, b, x, yRange);
    // Join only overlapping vertical components; do not bridge holes or asymptotes.
    for (const p of previous)
      for (const c of current) {
        if (
          Math.max(p[0], c[0]) >
          Math.min(p[1], c[1]) + (yRange[1] - yRange[0]) * 0.05
        )
          continue;
        if (
          [...p, ...c].some(
            (v) =>
              Math.abs(v) >
              Math.max(Math.abs(yRange[0]), Math.abs(yRange[1])) * 100,
          )
        )
          continue;
        commands.push(
          `M ${sx(px)} ${sy(p[0])} L ${sx(x)} ${sy(c[0])} L ${sx(x)} ${sy(c[1])} L ${sx(px)} ${sy(p[1])} Z`,
        );
      }
    previous = current;
    px = x;
  }
  return commands.join(" ");
}

export function regionArea(
  region: Region2DObject,
  a: SceneObject,
  b: SceneObject,
  yRange: Interval,
): NumericResult | null {
  return integrate(
    (x) => {
      const spans = regionIntervals(region, a, b, x, yRange);
      if ((region.regionMode ?? "between") === "between" && spans.length === 0)
        return null;
      return spans.reduce((sum, [lo, hi]) => sum + hi - lo, 0);
    },
    Math.min(region.xStart, region.xEnd),
    Math.max(region.xStart, region.xEnd),
    1e-4,
  );
}
