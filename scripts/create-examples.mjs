import fs from "node:fs/promises";

const scene = {
  mode: "2d",
  width: 900,
  height: 600,
  captionHeight: 72,
  xRange: [-3, 3],
  yRange: [-1, 3],
  xTickStep: 1,
  yTickStep: 1,
  showGrid: true,
  showAxes: true,
  snapToGrid: false,
  captionText: "",
  captionFontSize: 16,
  captionColor: "#334155",
  angleUnit: "rad",
};
const black = { r: 30, g: 30, b: 30, a: 1 },
  blue = { r: 37, g: 90, b: 215, a: 1 };
const stroke = (color = black) => ({
  color,
  width: 2,
  dashArray: [],
  lineStyle: "solid",
});
const base = (id, name) => ({ id, name, visible: true, locked: false });
const func = (id, name, expression, color) => ({
  ...base(id, name),
  type: "function2d",
  expression,
  domain: null,
  samples: 1000,
  stroke: stroke(color),
  angleUnit: "rad",
});
const textStyle = { color: black, fontSize: 22, fontFamily: "Arial" };
const formula = (latex) => ({
  ...base("formula", "넓이 수식"),
  type: "formula2d",
  x: -2.7,
  y: 2.5,
  latex,
  textStyle,
});
const fill = (curveAId, curveBId, xStart, xEnd, options = {}) => ({
  ...base("region", "색칠한 영역"),
  type: "region2d",
  curveAId,
  curveBId,
  xStart,
  xEnd,
  samples: 500,
  fill: { enabled: true, color: { r: 255, g: 160, b: 0, a: 0.25 } },
  labelText: "",
  labelX: 0,
  labelY: 0.5,
  labelStyle: textStyle,
  ...options,
});
const output = async (name, patch, objects) =>
  fs.writeFile(
    `examples/${name}.mathcanvas`,
    JSON.stringify(
      {
        version: 1,
        scene: { ...scene, ...patch },
        objects,
        selectedObjectId: null,
      },
      null,
      2,
    ) + "\n",
  );
await fs.mkdir("examples", { recursive: true });
await output(
  "01-두-포물선-사이-넓이",
  { captionText: "y=x²와 y=2−x² 사이의 넓이 (−1≤x≤1)" },
  [
    func("a", "f(x)=x²", "x^2"),
    func("b", "g(x)=2−x²", "2-x^2", blue),
    fill("a", "b", -1, 1),
    formula("A=\\int_{-1}^{1}(2-2x^2)\\,dx=\\frac{8}{3}"),
  ],
);
await output(
  "02-두-원의-겹친-영역",
  {
    xRange: [-3, 6],
    yRange: [-3, 3],
    captionText: "반지름 2, 중심 거리 2인 두 원의 공통 내부",
  },
  [
    func("a", "원 C₁", "x^2+y^2=4"),
    func("b", "원 C₂", "(x-2)^2+y^2=4", blue),
    fill("a", "b", 0, 2, { regionMode: "overlap", signA: 1, signB: 1 }),
    { ...formula("A=\\frac{8\\pi}{3}-2\\sqrt{3}"), x: -2.7, y: 2.5 },
  ],
);
await output(
  "03-극좌표-심장형",
  {
    yRange: [-2, 2],
    captionText: "극좌표 심장형: 음수 반지름도 올바르게 처리합니다",
  },
  [
    func("a", "심장형", "r=1+cos(theta)", blue),
    { ...formula("r=1+\\cos\\theta"), y: 1.7 },
  ],
);
await output(
  "04-와셔법-부피-3D",
  {
    captionText: "3D · 회전체 탭을 열면 속이 빈 원기둥이 나타납니다",
    view3d: {
      kind: "revolution",
      expression: "2",
      innerExpression: "1",
      lower: 0,
      upper: 3,
      axis: "x",
      radius: 2,
      majorRadius: 3,
    },
  },
  [],
);
const automatic = (index, left, right, labelY, searchRange, color) =>
  fill("a", "b", left, right, {
    id: `auto-${index}`,
    name: `교점 사이 A${index + 1}`,
    labelText: `A${index + 1}`,
    labelX: (left + right) / 2,
    labelY,
    labelStyle: { ...textStyle, fontSize: 16 },
    regionMode: "between",
    showAreaValue: true,
    fill: { enabled: true, color: { ...color, a: 0.22 } },
    autoBounds: {
      index,
      searchRange,
      anchorX: (left + right) / 2,
      anchorY: labelY,
    },
  });
const amber = { r: 245, g: 158, b: 11 },
  violet = { r: 139, g: 92, b: 246 };
await output(
  "05-사차함수-교점별-넓이",
  {
    xRange: [-4.8, 4.8],
    yRange: [-2.4, 4],
    captionText:
      "교점 -2, -1, 1, 2 / A1=22/15, A2=76/15, A3=22/15 / 전체 넓이 8",
  },
  [
    func("a", "사차함수", "x^4-5*x^2+4"),
    func("b", "직선 y=0", "0"),
    automatic(0, -2, -1, -1.09375, [-3, 3], blue),
    automatic(1, -1, 1, 2, [-3, 3], amber),
    automatic(2, 1, 2, -1.09375, [-3, 3], violet),
  ],
);
await output(
  "06-삼각함수-교점별-넓이",
  {
    xRange: [-7, 7],
    yRange: [-4.6666667, 4.6666667],
    captionText:
      "라디안 / sin(x)와 x축 / 각 영역 넓이 2, 전체 8 / 첫·마지막 교점 바깥은 제외",
  },
  [
    func("a", "사인함수", "sin(x)"),
    func("b", "직선 y=0", "0"),
    ...[-2, -1, 0, 1].map((n, index) =>
      automatic(
        index,
        n * Math.PI,
        (n + 1) * Math.PI,
        Math.sin((n + 0.5) * Math.PI) / 2,
        [-7, 7],
        [blue, amber, violet, { r: 16, g: 185, b: 129 }][index],
      ),
    ),
  ],
);
console.log("Created six MathCanvas lesson examples in examples/");
