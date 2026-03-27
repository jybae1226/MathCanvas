import { compile } from "mathjs";

export type PlotPoint = {
  x: number;
  y: number;
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
    const y = compiled.evaluate({ x });

    if (typeof y === "number" && Number.isFinite(y)) {
      pts.push({ x, y });
    }
  }

  return pts;
};