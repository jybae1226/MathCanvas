import type { SceneObject } from "../types/objects";
import {
  evaluateCurveY,
  isImplicitExpression,
  isPolarExpression,
  sampleFunctionPoints,
  sampleImplicitSegments,
  samplePolarFunctionPoints,
} from "./graph";
import { curveEquation, rootsInRange } from "./calculus";

type Point = { x: number; y: number };
type Segment = [Point, Point];

function inLine(curve: SceneObject, p: Point) {
  if (curve.type !== "line2d") return true;
  const dx = curve.x2 - curve.x1,
    dy = curve.y2 - curve.y1;
  const denominator = dx * dx + dy * dy;
  if (denominator < 1e-20) return false;
  const t = ((p.x - curve.x1) * dx + (p.y - curve.y1) * dy) / denominator;
  return (
    curve.lineKind === "line" ||
    (t >= -1e-7 && (curve.lineKind === "ray" || t <= 1 + 1e-7))
  );
}

function segments(
  curve: SceneObject,
  xr: [number, number],
  yr: [number, number],
): Segment[] {
  if (curve.type === "circle2d") {
    const points = Array.from({ length: 721 }, (_, i) => ({
      x: curve.cx + curve.radius * Math.cos((i * Math.PI) / 360),
      y: curve.cy + curve.radius * Math.sin((i * Math.PI) / 360),
    }));
    return points.slice(1).map((p, i) => [points[i], p]);
  }
  if (curve.type === "line2d") {
    const extent = Math.max(xr[1] - xr[0], yr[1] - yr[0]) * 4;
    const length = Math.hypot(curve.x2 - curve.x1, curve.y2 - curve.y1);
    if (length < 1e-12) return [];
    const scale = Math.max(
      1,
      (extent + Math.hypot(curve.x1 - xr[0], curve.y1 - yr[0])) / length,
    );
    const dx = curve.x2 - curve.x1,
      dy = curve.y2 - curve.y1;
    const start = curve.lineKind === "line" ? -scale : 0;
    const end = !curve.lineKind || curve.lineKind === "segment" ? 1 : scale;
    return [
      [
        { x: curve.x1 + dx * start, y: curve.y1 + dy * start },
        { x: curve.x1 + dx * end, y: curve.y1 + dy * end },
      ],
    ];
  }
  if (curve.type !== "function2d" || !curve.expression.trim()) return [];
  const polar = isPolarExpression(curve.expression);
  const domain: [number, number] =
    curve.domain ??
    (polar ? [0, curve.angleUnit === "deg" ? 360 : Math.PI * 2] : xr);
  if (isImplicitExpression(curve.expression)) {
    const range: [number, number] = [
      Math.max(xr[0], domain[0]),
      Math.min(xr[1], domain[1]),
    ];
    return sampleImplicitSegments(
      curve.expression,
      range,
      yr,
      160,
      160,
      curve.angleUnit,
    );
  }
  const points = polar
    ? samplePolarFunctionPoints(curve.expression, domain, 1000, curve.angleUnit)
    : sampleFunctionPoints(curve.expression, domain, 1000, curve.angleUnit);
  const result: Segment[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (
      a.y === null ||
      b.y === null ||
      Math.abs(a.y - b.y) > (yr[1] - yr[0]) * 1.25
    )
      continue;
    result.push([
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ]);
  }
  return result;
}

function crossing([a, b]: Segment, [c, d]: Segment): Point | null {
  if (
    Math.max(a.x, b.x) + 1e-10 < Math.min(c.x, d.x) ||
    Math.max(c.x, d.x) + 1e-10 < Math.min(a.x, b.x) ||
    Math.max(a.y, b.y) + 1e-10 < Math.min(c.y, d.y) ||
    Math.max(c.y, d.y) + 1e-10 < Math.min(a.y, b.y)
  )
    return null;
  const ux = b.x - a.x,
    uy = b.y - a.y,
    vx = d.x - c.x,
    vy = d.y - c.y;
  const den = ux * vy - uy * vx;
  if (Math.abs(den) < 1e-14) return null;
  const t = ((c.x - a.x) * vy - (c.y - a.y) * vx) / den;
  const u = ((c.x - a.x) * uy - (c.y - a.y) * ux) / den;
  return t >= -1e-8 && t <= 1 + 1e-8 && u >= -1e-8 && u <= 1 + 1e-8
    ? { x: a.x + t * ux, y: a.y + t * uy }
    : null;
}

export function approximateCurveIntersections(
  a: SceneObject,
  b: SceneObject,
  xr: [number, number],
  yr: [number, number] = [-10, 10],
): Point[] {
  if (a.id === b.id) return [];
  if (
    a.type === "function2d" &&
    b.type === "function2d" &&
    a.expression.replace(/\s/g, "") === b.expression.replace(/\s/g, "") &&
    a.angleUnit === b.angleUnit
  )
    return [];
  if (
    a.type === "circle2d" &&
    b.type === "circle2d" &&
    a.cx === b.cx &&
    a.cy === b.cy &&
    a.radius === b.radius
  )
    return [];
  if (
    a.type === "line2d" &&
    b.type === "line2d" &&
    Math.abs((a.x2 - a.x1) * (b.y2 - b.y1) - (a.y2 - a.y1) * (b.x2 - b.x1)) <
      1e-12
  )
    return [];
  const result: Point[] = [];
  const fa = curveEquation(a),
    fb = curveEquation(b);
  const add = (point: Point) => {
    if (
      !inLine(a, point) ||
      !inLine(b, point) ||
      point.x < xr[0] - 1e-7 ||
      point.x > xr[1] + 1e-7 ||
      point.y < yr[0] - 1e-7 ||
      point.y > yr[1] + 1e-7
    )
      return;
    if (
      [a, b].some(
        (o) =>
          o.type === "function2d" &&
          o.domain &&
          !isPolarExpression(o.expression) &&
          (point.x < o.domain[0] || point.x > o.domain[1]),
      )
    )
      return;
    let p = { ...point };
    if (fa && fb) {
      for (let i = 0; i < 25; i++) {
        const u = fa(p.x, p.y),
          v = fb(p.x, p.y);
        if (u === null || v === null) return;
        if (Math.max(Math.abs(u), Math.abs(v)) < 1e-10) break;
        const h = 1e-5;
        const ax1 = fa(p.x + h, p.y),
          ax0 = fa(p.x - h, p.y),
          ay1 = fa(p.x, p.y + h),
          ay0 = fa(p.x, p.y - h);
        const bx1 = fb(p.x + h, p.y),
          bx0 = fb(p.x - h, p.y),
          by1 = fb(p.x, p.y + h),
          by0 = fb(p.x, p.y - h);
        if ([ax1, ax0, ay1, ay0, bx1, bx0, by1, by0].some((n) => n === null))
          return;
        const ax = (ax1! - ax0!) / (2 * h),
          ay = (ay1! - ay0!) / (2 * h),
          bx = (bx1! - bx0!) / (2 * h),
          by = (by1! - by0!) / (2 * h);
        const determinant = ax * by - ay * bx;
        if (Math.abs(determinant) < 1e-14) break;
        p = {
          x: p.x - (u * by - v * ay) / determinant,
          y: p.y - (ax * v - bx * u) / determinant,
        };
        if (!Number.isFinite(p.x + p.y)) return;
      }
      const u = fa(p.x, p.y),
        v = fb(p.x, p.y);
      if (u === null || v === null || Math.max(Math.abs(u), Math.abs(v)) > 1e-6)
        return;
    }
    if (
      p.x < xr[0] - 1e-7 ||
      p.x > xr[1] + 1e-7 ||
      p.y < yr[0] - 1e-7 ||
      p.y > yr[1] + 1e-7
    )
      return;
    if (
      !inLine(a, p) ||
      !inLine(b, p) ||
      !result.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 1e-4)
    )
      return;
    result.push(p);
  };
  const explicit = (o: SceneObject) =>
    o.type === "line2d"
      ? Math.abs(o.x2 - o.x1) > 1e-12
      : o.type === "function2d" &&
        !isImplicitExpression(o.expression) &&
        !isPolarExpression(o.expression);
  if (explicit(a) && explicit(b)) {
    const difference = (x: number) => {
      const va = evaluateCurveY(a, x),
        vb = evaluateCurveY(b, x);
      return va === null || vb === null ? null : va - vb;
    };
    // Coincident graphs have infinitely many intersections, not hundreds of isolated points.
    if (
      [0.17, 0.31, 0.53, 0.79].every((t) => {
        const v = difference(xr[0] + (xr[1] - xr[0]) * t);
        return v !== null && Math.abs(v) < 1e-12;
      })
    )
      return [];
    for (const x of rootsInRange(difference, xr, 1200)) {
      const y = evaluateCurveY(a, x);
      if (y !== null) add({ x, y });
    }
    // Refine local minima of |f-g| to find tangencies without a sign change.
    for (let i = 1; i < 400; i++) {
      let lo = xr[0] + ((xr[1] - xr[0]) * (i - 1)) / 400,
        hi = xr[0] + ((xr[1] - xr[0]) * (i + 1)) / 400;
      const center = difference((lo + hi) / 2),
        vl = difference(lo),
        vh = difference(hi);
      if (
        center === null ||
        vl === null ||
        vh === null ||
        Math.abs(center) >= Math.min(Math.abs(vl), Math.abs(vh))
      )
        continue;
      for (let j = 0; j < 45; j++) {
        const m1 = lo + (hi - lo) / 3,
          m2 = hi - (hi - lo) / 3;
        const v1 = difference(m1),
          v2 = difference(m2);
        if (v1 === null || v2 === null) break;
        if (Math.abs(v1) < Math.abs(v2)) hi = m2;
        else lo = m1;
      }
      const x = (lo + hi) / 2,
        residual = difference(x),
        y = evaluateCurveY(a, x);
      if (residual !== null && Math.abs(residual) < 1e-8 && y !== null)
        add({ x, y });
    }
  } else {
    const sa = segments(a, xr, yr),
      sb = segments(b, xr, yr);
    for (const first of sa)
      for (const second of sb) {
        const hit = crossing(first, second);
        if (hit) add(hit);
      }
    // Newton seeds also recover common tangencies of implicit curves.
    if (fa && fb)
      for (const [p] of sa) {
        const residual = fb(p.x, p.y);
        if (residual !== null && Math.abs(residual) < 0.05) add(p);
      }
  }
  return result.sort((p, q) => p.x - q.x || p.y - q.y);
}
