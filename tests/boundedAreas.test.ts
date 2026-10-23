import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import type { Function2DObject, Line2DObject } from "../src/types/objects";
import { defaultStroke } from "../src/types/styles";
import {
  analyzeBoundedAreas,
  resolveAutomaticRegion,
} from "../src/utils/boundedAreas";
import { useProjectStore } from "../src/store/projectStore";
import { parseProject } from "../src/utils/projectFile";

const fn = (expression: string, id: string): Function2DObject => ({
  id,
  name: id,
  visible: true,
  locked: false,
  type: "function2d",
  expression,
  domain: null,
  samples: 800,
  stroke: defaultStroke(),
});
describe("교점마다 나누는 넓이", () => {
  it("삼차함수의 위아래가 바뀌는 두 구간을 양수로 더한다", () => {
    const result = analyzeBoundedAreas(fn("x^3-x", "a"), fn("0", "b"), [-2, 2]);
    expect(result.intersections).toHaveLength(3);
    expect(result.segments).toHaveLength(2);
    expect(result.segments.map((s) => s.upper)).toEqual(["a", "b"]);
    for (const segment of result.segments)
      expect(segment.area!.value).toBeCloseTo(1 / 4, 7);
    expect(result.total).toBeCloseTo(1 / 2, 7);
  });
  it("사차함수의 세 영역과 합계", () => {
    const result = analyzeBoundedAreas(
      fn("x^4-5x^2+4", "a"),
      fn("0", "b"),
      [-3, 3],
    );
    expect(result.segments).toHaveLength(3);
    expect(result.segments.map((s) => s.area!.value)).toEqual([
      expect.closeTo(22 / 15, 6),
      expect.closeTo(76 / 15, 6),
      expect.closeTo(22 / 15, 6),
    ]);
    expect(result.total).toBeCloseTo(8, 6);
  });
  it("기울어진 실제 직선 도구와 삼차함수의 영역", () => {
    const line: Line2DObject = {
      id: "line",
      name: "y=x",
      visible: true,
      locked: false,
      type: "line2d",
      x1: -1,
      y1: -1,
      x2: 1,
      y2: 1,
      lineKind: "line",
      arrowEnd: "none",
      stroke: defaultStroke(),
    };
    const result = analyzeBoundedAreas(fn("x^3-2*x", "a"), line, [-3, 3]);
    expect(result.intersections).toHaveLength(3);
    expect(result.segments.map((s) => s.area!.value)).toEqual([
      expect.closeTo(9 / 4, 6),
      expect.closeTo(9 / 4, 6),
    ]);
    expect(result.total).toBeCloseTo(9 / 2, 6);
  });
  it("삼각함수에서 연속한 네 닫힌 영역", () => {
    const result = analyzeBoundedAreas(
      fn("sin(x)", "a"),
      fn("0", "b"),
      [-7, 7],
    );
    expect(result.segments).toHaveLength(4);
    for (const s of result.segments) expect(s.area!.value).toBeCloseTo(2, 6);
    expect(result.total).toBeCloseTo(8, 6);
  });
  it("화면의 y 절단으로 교점을 놓치지 않는다", () => {
    const result = analyzeBoundedAreas(
      fn("x^2+100", "a"),
      fn("101", "b"),
      [-2, 2],
    );
    expect(result.segments).toHaveLength(1);
    expect(result.total).toBeCloseTo(4 / 3, 6);
  });
  it("정의역 구멍과 극점 사이를 유한한 넓이라고 표시하지 않는다", () => {
    const result = analyzeBoundedAreas(
      fn("(x^2-1)/(x-0.3)", "a"),
      fn("0", "b"),
      [-2, 2],
    );
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].area).toBeNull();
    expect(result.total).toBeNull();
  });
  it("교점 바깥의 열린 끝은 자동 영역에서 제외한다", () => {
    expect(
      analyzeBoundedAreas(fn("x^2+1", "a"), fn("0", "b"), [-2, 2]).segments,
    ).toHaveLength(0);
  });
  it("선택한 영역을 한 번의 실행 취소로 추가하고 함수 변경에 따라 갱신한다", () => {
    const store = useProjectStore.getState();
    store.resetProject();
    const a = fn("x^2", "a"),
      b = fn("1", "b");
    store.addSceneObject(a);
    store.addSceneObject(b);
    useProjectStore.setState({ historyPast: [], historyFuture: [] });
    const segments = analyzeBoundedAreas(a, b, [-3, 3]).segments;
    store.addBoundedRegions("a", "b", segments, [-3, 3]);
    const region = useProjectStore
      .getState()
      .objects.find((o) => o.type === "region2d")!;
    expect(region.type).toBe("region2d");
    if (region.type !== "region2d") return;
    const moved = resolveAutomaticRegion(region, a, fn("4", "b"))!;
    expect(moved.xStart).toBeCloseTo(-2, 5);
    expect(moved.xEnd).toBeCloseTo(2, 5);
    expect(moved.labelText).toContain("10.6667");
    expect(useProjectStore.getState().historyPast).toHaveLength(1);
    store.undo();
    expect(
      useProjectStore.getState().objects.some((o) => o.type === "region2d"),
    ).toBe(false);
  });
  it("제공하는 예제 파일은 모두 유효하다", () => {
    for (const file of readdirSync("examples").filter((name) =>
      name.endsWith(".mathcanvas"),
    ))
      expect(() =>
        parseProject(readFileSync(`examples/${file}`, "utf8")),
      ).not.toThrow();
  });
});
