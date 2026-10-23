import type { SpatialSettings } from "../types/objects";
import { evaluateExpression } from "./graph";
import { integrate } from "./calculus";

export const DEFAULT_3D: SpatialSettings = {
  kind: "revolution",
  expression: "sqrt(4-t^2)",
  lower: -2,
  upper: 2,
  axis: "x",
  radius: 2,
  majorRadius: 3,
};
export type Vertex = { x: number; y: number; z: number };
export type Face = Vertex[];

function radii(
  settings: SpatialSettings,
  t: number,
  angleUnit?: "rad" | "deg",
): [number, number] | null {
  const f = evaluateExpression(
    settings.expression.replace(/^\s*r\s*=\s*/, ""),
    { t, x: t, y: t },
    angleUnit,
  );
  if (f === null) return null;
  if (settings.innerExpression === undefined) return [0, Math.abs(f)];
  const g = evaluateExpression(
    settings.innerExpression,
    { t, x: t, y: t },
    angleUnit,
  );
  if (g === null) return null;
  return [
    f * g <= 0 ? 0 : Math.min(Math.abs(f), Math.abs(g)),
    Math.max(Math.abs(f), Math.abs(g)),
  ];
}

export function spatialMesh(
  settings: SpatialSettings,
  angleUnit?: "rad" | "deg",
): Face[] {
  const { kind, radius, majorRadius, lower, upper, axis, expression } =
    settings;
  const nu = 56,
    nv = 44;
  const point = (i: number, j: number, inner = false): Vertex | null => {
    const u = i / nu,
      v = j / nv;
    if (kind === "surface") {
      const x = lower + (upper - lower) * u,
        y = lower + (upper - lower) * v;
      const z = evaluateExpression(
        expression.replace(/^\s*z\s*=\s*/, ""),
        { x, y },
        angleUnit,
      );
      return z === null || Math.abs(z) > 1e4 ? null : { x, y, z };
    }
    const theta = 2 * Math.PI * u;
    if (kind === "sphere") {
      const phi = Math.PI * v;
      return {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
      };
    }
    if (kind === "torus") {
      const phi = 2 * Math.PI * v;
      const r = majorRadius + radius * Math.cos(phi);
      return {
        x: r * Math.cos(theta),
        y: r * Math.sin(theta),
        z: radius * Math.sin(phi),
      };
    }
    if (kind === "cone") {
      const r = radius * (1 - v);
      return {
        x: r * Math.cos(theta),
        y: r * Math.sin(theta),
        z: (upper - lower) * v,
      };
    }
    const t = lower + (upper - lower) * v;
    const pair = radii(settings, t, angleUnit);
    if (!pair || pair[1] > 1e4) return null;
    const r = pair[inner ? 0 : 1];
    return axis === "x"
      ? { x: t, y: r * Math.cos(theta), z: r * Math.sin(theta) }
      : { x: r * Math.cos(theta), y: t, z: r * Math.sin(theta) };
  };
  const points = Array.from({ length: nu + 1 }, (_, i) =>
    Array.from({ length: nv + 1 }, (_, j) => point(i, j)),
  );
  const innerPoints =
    kind === "revolution" && settings.innerExpression !== undefined
      ? Array.from({ length: nu + 1 }, (_, i) =>
          Array.from({ length: nv + 1 }, (_, j) => point(i, j, true)),
        )
      : null;
  const faces: Face[] = [];
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const vertices = [
        points[i][j],
        points[i + 1][j],
        points[i + 1][j + 1],
        points[i][j + 1],
      ];
      if (vertices.every((p): p is Vertex => p !== null)) faces.push(vertices);
      if (innerPoints) {
        const inner = [
          innerPoints[i][j],
          innerPoints[i + 1][j],
          innerPoints[i + 1][j + 1],
          innerPoints[i][j + 1],
        ];
        if (inner.every((p): p is Vertex => p !== null)) faces.push(inner);
      }
    }
  // Close the end disks for a solid of revolution or cone.
  if (kind === "revolution" || kind === "cone")
    for (const j of [0, nv])
      for (let i = 0; i < nu; i++) {
        const a = points[i][j],
          b = points[i + 1][j];
        if (!a || !b) continue;
        const center: Vertex =
          kind === "cone"
            ? { x: 0, y: 0, z: a.z }
            : axis === "x"
              ? { x: a.x, y: 0, z: 0 }
              : { x: 0, y: a.y, z: 0 };
        const innerA = innerPoints?.[i][j],
          innerB = innerPoints?.[i + 1][j];
        faces.push(innerA && innerB ? [innerA, a, b, innerB] : [center, a, b]);
      }
  return faces;
}

export function spatialVolume(
  settings: SpatialSettings,
  angleUnit?: "rad" | "deg",
): number | null {
  const { kind, radius, majorRadius, lower, upper } = settings;
  if (kind === "sphere") return (4 * Math.PI * radius ** 3) / 3;
  if (kind === "cone") return (Math.PI * radius ** 2 * (upper - lower)) / 3;
  if (kind === "torus")
    return majorRadius > radius
      ? 2 * Math.PI ** 2 * majorRadius * radius ** 2
      : null;
  if (kind === "surface") return null;
  const result = integrate(
    (t) => {
      const pair = radii(settings, t, angleUnit);
      return pair ? Math.PI * (pair[1] ** 2 - pair[0] ** 2) : null;
    },
    lower,
    upper,
  );
  return result?.value ?? null;
}
