import type { FillStyle, StrokeStyle, TextStyle } from "./styles";

export type BaseObject = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};

export type LabelPosition =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left";

export type Point2DObject = BaseObject & {
  type: "point2d";
  x: number;
  y: number;
  radius: number;
  stroke: StrokeStyle;
  fill: FillStyle;
  label?: string;
  showLabel: boolean;
  labelPosition: LabelPosition;
};

export type Line2DObject = BaseObject & {
  type: "line2d";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: StrokeStyle;
  arrowEnd: boolean;
};

export type Circle2DObject = BaseObject & {
  type: "circle2d";
  cx: number;
  cy: number;
  radius: number;
  stroke: StrokeStyle;
  fill: FillStyle;
  showCenter: boolean;
};

export type Function2DObject = BaseObject & {
  type: "function2d";
  expression: string;
  domain: [number, number] | null;
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

export type Formula2DObject = BaseObject & {
  type: "formula2d";
  x: number;
  y: number;
  latex: string;
  textStyle: TextStyle;
};

export type Region2DObject = BaseObject & {
  type: "region2d";
  curveAId: string;
  curveBId: string;
  xStart: number;
  xEnd: number;
  samples: number;
  fill: FillStyle;
  labelText: string;
  labelX: number;
  labelY: number;
  labelStyle: TextStyle;
};

export type SceneObject =
  | Point2DObject
  | Line2DObject
  | Circle2DObject
  | Function2DObject
  | Text2DObject
  | Formula2DObject
  | Region2DObject;

export type ProjectScene = {
  mode: "2d";
  width: number;
  height: number;
  captionHeight: number;
  xRange: [number, number];
  yRange: [number, number];
  xTickStep: number;
  yTickStep: number;
  showGrid: boolean;
  showAxes: boolean;
  snapToGrid: boolean;
  captionText: string;
  captionFontSize: number;
  captionColor: string;
};

export type ProjectState = {
  scene: ProjectScene;
  objects: SceneObject[];
  selectedObjectId: string | null;
};