import type { FillStyle, StrokeStyle, TextStyle } from "./styles";

export type BaseObject = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};

export type Point2DObject = BaseObject & {
  type: "point2d";
  x: number;
  y: number;
  radius: number;
  stroke: StrokeStyle;
  fill: FillStyle;
  label?: string;
};

export type Line2DObject = BaseObject & {
  type: "line2d";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: StrokeStyle;
};

export type Function2DObject = BaseObject & {
  type: "function2d";
  expression: string;
  domain: [number, number];
  samples: number;
  stroke: StrokeStyle;
};

export type Text2DObject = BaseObject & {
  type: "text2d";
  x: number;
  y: number;
  text: string;
  textStyle: TextStyle;
};

export type SceneObject =
  | Point2DObject
  | Line2DObject
  | Function2DObject
  | Text2DObject;

export type ProjectScene = {
  mode: "2d";
  width: number;
  height: number;
  xRange: [number, number];
  yRange: [number, number];
  showGrid: boolean;
  showAxes: boolean;
};

export type ProjectState = {
  scene: ProjectScene;
  objects: SceneObject[];
  selectedObjectId: string | null;
};