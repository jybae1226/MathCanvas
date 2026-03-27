import { compile } from "mathjs";

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