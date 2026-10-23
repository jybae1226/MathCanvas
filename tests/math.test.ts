import { beforeEach, describe, expect, it } from "vitest";
import type {
  Circle2DObject,
  Function2DObject,
  Line2DObject,
  Region2DObject,
} from "../src/types/objects";
import {
  defaultFill,
  defaultStroke,
  defaultTextStyle,
} from "../src/types/styles";
import {
  buildFunctionPath,
  buildImplicitPath,
  evaluateCurveY,
  evaluateExpression,
  expressionError,
  sampleFunctionPoints,
  samplePolarFunctionPoints,
} from "../src/utils/graph";
import { approximateCurveIntersections } from "../src/utils/intersections";
import {
  buildRegionGeometry,
  derivative,
  integrate,
  regionArea,
} from "../src/utils/calculus";
import { DEFAULT_3D, spatialMesh, spatialVolume } from "../src/utils/spatial";
import { makeTicks } from "../src/utils/scene";
import { parseProject } from "../src/utils/projectFile";
import { useProjectStore } from "../src/store/projectStore";

const base = { visible: true, locked: false, name: "test" };
const fn = (expression: string, id = expression): Function2DObject => ({
  ...base,
  id,
  type: "function2d",
  expression,
  domain: null,
  samples: 800,
  stroke: defaultStroke(),
});
const line = (patch: Partial<Line2DObject> = {}): Line2DObject => ({
  ...base,
  id: "line",
  type: "line2d",
  x1: -5,
  y1: 0,
  x2: 5,
  y2: 0,
  lineKind: "line",
  arrowEnd: "none",
  stroke: defaultStroke(),
  ...patch,
});
const circle = (patch: Partial<Circle2DObject> = {}): Circle2DObject => ({
  ...base,
  id: "circle",
  type: "circle2d",
  cx: 0,
  cy: 0,
  radius: 2,
  showCenter: false,
  stroke: defaultStroke(),
  fill: defaultFill(),
  ...patch,
});
const region = (patch: Partial<Region2DObject> = {}): Region2DObject => ({
  ...base,
  id: "region",
  type: "region2d",
  curveAId: "a",
  curveBId: "b",
  xStart: -2,
  xEnd: 2,
  samples: 400,
  fill: { enabled: true, color: { r: 255, g: 160, b: 0, a: 0.3 } },
  labelText: "",
  labelX: 0,
  labelY: 0,
  labelStyle: defaultTextStyle(),
  ...patch,
});

describe("수식과 그래프", () => {
  it.each([
    ["sin(x)", Math.PI / 2, 1],
    ["asin(x)", 1, Math.PI / 2],
    ["exp(x)", 0, 1],
    ["log(x)", Math.E, 1],
    ["sqrt(x)", 4, 2],
    ["x^3-2x", 2, 4],
    ["y=x^2", 3, 9],
    ["1/x", 2, 0.5],
    ["sin(π*x)", 0.5, 1],
  ])("%s를 계산한다", (expression, x, expected) => {
    expect(evaluateCurveY(fn(expression), x as number)).toBeCloseTo(
      expected as number,
      8,
    );
  });
  it("실수 정의역 밖과 잘못된 수식은 null이다", () => {
    expect(evaluateCurveY(fn("sqrt(x)"), -1)).toBeNull();
    expect(evaluateCurveY(fn("1/x"), 0)).toBeNull();
    expect(expressionError("sin(")).toBeTruthy();
    expect(expressionError("unknown(x)")).toBeTruthy();
    expect(expressionError("a*x")).toBeTruthy();
    expect(evaluateExpression("a=3", {})).toBeNull();
    expect(evaluateExpression("import(1)", {})).toBeNull();
  });
  it("도 단위를 삼각함수·역삼각함수에 적용한다", () => {
    expect(
      evaluateCurveY({ ...fn("sin(x)"), angleUnit: "deg" }, 90),
    ).toBeCloseTo(1, 10);
    expect(
      evaluateCurveY({ ...fn("asin(x)"), angleUnit: "deg" }, 1),
    ).toBeCloseTo(90, 10);
  });
  it("극좌표의 음수 반지름을 보존한다", () => {
    const p = samplePolarFunctionPoints("r=cos(theta)", [0, 2 * Math.PI], 4);
    expect(p[2].x).toBeCloseTo(1, 8);
    expect(p[2].y).not.toBeNull();
    const deg = samplePolarFunctionPoints("r=1+cos(theta)", [0, 360], 4, "deg");
    expect(deg[1].x).toBeCloseTo(0, 8);
    expect(deg[1].y).toBeCloseTo(1, 8);
  });
  it("음함수와 y=함수를 따로 그린다", () => {
    expect(
      buildImplicitPath(
        "x^2+y^2=4",
        [-3, 3],
        [-3, 3],
        80,
        80,
        (x) => x,
        (y) => y,
      ).length,
    ).toBeGreaterThan(100);
    expect(sampleFunctionPoints("y=sin(x)", [-1, 1], 20)).toHaveLength(21);
  });
  it("불연속점을 선으로 연결하지 않는다", () => {
    const d = buildFunctionPath(
      sampleFunctionPoints("1/x", [-1, 1], 100),
      (x) => x,
      (y) => y,
      10,
    );
    expect(d.match(/M /g)!.length).toBeGreaterThan(1);
  });
  it("매우 작은 눈금 간격에도 격자 수를 제한한다", () => {
    expect(makeTicks(-1e6, 1e6, 1e-10).length).toBeLessThanOrEqual(401);
  });
});

describe("교점", () => {
  it("포물선과 수평선", () => {
    const points = approximateCurveIntersections(
      fn("x^2"),
      fn("1"),
      [-3, 3],
      [-3, 5],
    );
    expect(points).toHaveLength(2);
    expect(points[0].x).toBeCloseTo(-1, 6);
    expect(points[1].x).toBeCloseTo(1, 6);
  });
  it("샘플 위치 밖의 접점", () => {
    const points = approximateCurveIntersections(
      fn("(x-0.12345)^2"),
      fn("0"),
      [-2, 2],
      [-2, 2],
    );
    expect(points).toHaveLength(1);
    expect(points[0].x).toBeCloseTo(0.12345, 5);
  });
  it("극점이 교점이 되지 않는다", () => {
    expect(
      approximateCurveIntersections(
        fn("1/(x-.123)"),
        fn("0"),
        [-2, 2],
        [-10, 10],
      ),
    ).toHaveLength(0);
  });
  it("음함수 원과 x축", () => {
    const points = approximateCurveIntersections(
      fn("x^2+y^2=4"),
      line(),
      [-3, 3],
      [-3, 3],
    );
    expect(points).toHaveLength(2);
    expect(points[0].x).toBeCloseTo(-2, 5);
    expect(points[1].x).toBeCloseTo(2, 5);
  });
  it("음함수 원과 y축", () => {
    const points = approximateCurveIntersections(
      fn("x^2+y^2=4"),
      line({ x1: 0, y1: -5, x2: 0, y2: 5 }),
      [-3, 3],
      [-3, 3],
    );
    expect(points).toHaveLength(2);
    expect(points.map((p) => p.y).sort()).toEqual(
      expect.arrayContaining([expect.closeTo(-2, 5), expect.closeTo(2, 5)]),
    );
  });
  it("수직 음함수도 교점을 찾는다", () => {
    const points = approximateCurveIntersections(
      fn("x=1"),
      fn("y=x^2"),
      [-3, 3],
      [-3, 3],
    );
    expect(points).toHaveLength(1);
    expect(points[0].y).toBeCloseTo(1, 6);
  });
  it("원 도구와 두 원의 교점", () => {
    const points = approximateCurveIntersections(
      circle(),
      circle({ id: "circle2", cx: 2 }),
      [-4, 4],
      [-4, 4],
    );
    expect(points).toHaveLength(2);
    expect(points[0].x).toBeCloseTo(1, 5);
  });
  it("선분의 바깥 연장선 교점을 제외한다", () => {
    expect(
      approximateCurveIntersections(
        line({ lineKind: "segment", x1: 0, x2: 1 }),
        fn("x-2"),
        [-3, 3],
        [-3, 3],
      ),
    ).toHaveLength(0);
  });
  it("반직선의 반대 방향을 제외한다", () => {
    expect(
      approximateCurveIntersections(
        line({ lineKind: "ray", x1: 0, x2: 1 }),
        fn("x+1"),
        [-3, 3],
        [-3, 3],
      ),
    ).toHaveLength(0);
  });
  it("일치하는 곡선을 무수한 교점으로 표시하지 않는다", () => {
    expect(
      approximateCurveIntersections(fn("x^2", "a"), fn("x^2", "b"), [-2, 2]),
    ).toHaveLength(0);
  });
});

describe("미적분과 영역", () => {
  it("정적분과 미분계수", () => {
    expect(integrate((x) => x * x, 0, 1)?.value).toBeCloseTo(1 / 3, 8);
    expect(integrate((x) => Math.sin(x), 0, Math.PI)?.value).toBeCloseTo(2, 8);
    expect(derivative(fn("x^3"), 2)).toBeCloseTo(12, 6);
    expect(derivative(fn("abs(x)"), 0)).toBeNull();
    expect(integrate((x) => (x === 0 ? null : 1 / x), -1, 1)).toBeNull();
  });
  it("두 함수 사이 넓이", () => {
    const r = region({ xStart: 0, xEnd: 1 });
    expect(regionArea(r, fn("x"), fn("x^2"), [-2, 2])?.value).toBeCloseTo(
      1 / 6,
      6,
    );
    expect(
      buildRegionGeometry(
        r,
        fn("x"),
        fn("x^2"),
        [-2, 2],
        (x) => x,
        (y) => y,
      ),
    ).toContain(" Z");
  });
  it("음함수 원 내부", () => {
    expect(
      regionArea(
        region({ regionMode: "inside" }),
        fn("x^2+y^2=4"),
        fn("0"),
        [-3, 3],
      )?.value,
    ).toBeCloseTo(4 * Math.PI, 3);
  });
  it("원 위·아래 가지 사이", () => {
    expect(
      regionArea(
        region({ branchA: "upper", branchB: "lower" }),
        circle(),
        circle(),
        [-3, 3],
      )?.value,
    ).toBeCloseTo(4 * Math.PI, 3);
  });
  it("원과 직선 사이 반원", () => {
    expect(
      regionArea(region({ branchA: "upper" }), circle(), fn("0"), [-3, 3])
        ?.value,
    ).toBeCloseTo(2 * Math.PI, 3);
  });
  it("두 원이 겹치는 렌즈", () => {
    const expected = (8 * Math.PI) / 3 - 2 * Math.sqrt(3);
    expect(
      regionArea(
        region({ regionMode: "overlap", xStart: 0, xEnd: 2 }),
        circle(),
        circle({ id: "b", cx: 2 }),
        [-3, 3],
      )?.value,
    ).toBeCloseTo(expected, 3);
  });
  it("회전체 구의 부피와 원뿔", () => {
    expect(spatialVolume(DEFAULT_3D)).toBeCloseTo((32 * Math.PI) / 3, 6);
    expect(
      spatialVolume({ ...DEFAULT_3D, expression: "t", lower: 0, upper: 3 }),
    ).toBeCloseTo(9 * Math.PI, 6);
    expect(spatialMesh(DEFAULT_3D).length).toBeGreaterThan(1000);
  });
  it("와셔법과 축을 가로지르는 영역", () => {
    expect(
      spatialVolume({
        ...DEFAULT_3D,
        expression: "2",
        innerExpression: "1",
        lower: 0,
        upper: 3,
      }),
    ).toBeCloseTo(9 * Math.PI, 7);
    expect(
      spatialVolume({
        ...DEFAULT_3D,
        expression: "2",
        innerExpression: "-1",
        lower: 0,
        upper: 3,
      }),
    ).toBeCloseTo(12 * Math.PI, 7);
  });
});

describe("파일·상태 안정성", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    useProjectStore.setState({ historyPast: [], historyFuture: [] });
  });
  it("기존 JSON과 버전 파일을 읽고 잘못된 범위를 거부한다", () => {
    const json = useProjectStore.getState().exportProjectJson();
    expect(parseProject(json).objects).toHaveLength(0);
    const data = JSON.parse(json);
    delete data.version;
    expect(() => parseProject(JSON.stringify(data))).not.toThrow();
    data.scene.xRange = [1, 1];
    expect(() => parseProject(JSON.stringify(data))).toThrow();
    expect(() => parseProject('{"objects":[]}')).toThrow();
  });
  it("선택만 해서는 실행 취소가 늘어나지 않는다", () => {
    const store = useProjectStore.getState();
    store.beginInteractionHistory();
    store.endInteractionHistory();
    expect(useProjectStore.getState().historyPast).toHaveLength(0);
  });
  it("드래그 한 번은 실행 취소 한 번이다", () => {
    const store = useProjectStore.getState();
    store.addPoint();
    const id = useProjectStore.getState().selectedObjectId!;
    store.beginInteractionHistory();
    store.moveObjectBy(id, 1, 1);
    store.moveObjectBy(id, 1, 1);
    store.endInteractionHistory();
    expect(useProjectStore.getState().historyPast).toHaveLength(2);
    store.undo();
    expect(useProjectStore.getState().objects[0]).toMatchObject({ x: 2, y: 2 });
  });
  it("손상된 파일을 열어도 현재 작업은 보존한다", () => {
    const store = useProjectStore.getState();
    store.addPoint();
    expect(() => store.importProjectJson("{}")).toThrow();
    expect(useProjectStore.getState().objects).toHaveLength(1);
  });
  it("잠긴 점은 이동하지 않는다", () => {
    const store = useProjectStore.getState();
    store.addPoint();
    const id = useProjectStore.getState().selectedObjectId!;
    store.updateObject(id, { locked: true });
    store.moveObjectBy(id, 5, 5);
    expect(useProjectStore.getState().objects[0]).toMatchObject({ x: 2, y: 2 });
  });
});
