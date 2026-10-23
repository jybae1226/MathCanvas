import type { Line2DObject, SceneObject } from "../types/objects";
import { defaultStroke } from "../types/styles";

export const axes: Line2DObject[] = [
  {
    id: "axis-x",
    name: "x축",
    type: "line2d",
    visible: false,
    locked: true,
    x1: 0,
    y1: 0,
    x2: 1,
    y2: 0,
    lineKind: "line",
    arrowEnd: "none",
    stroke: defaultStroke(),
  },
  {
    id: "axis-y",
    name: "y축",
    type: "line2d",
    visible: false,
    locked: true,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    lineKind: "line",
    arrowEnd: "none",
    stroke: defaultStroke(),
  },
];
export function findCurve(objects: SceneObject[], id: string) {
  return objects.find((o) => o.id === id) ?? axes.find((o) => o.id === id);
}
