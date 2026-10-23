import type { ProjectState, SceneObject } from "../types/objects";
import { validateScene } from "./scene";
import { findCurve } from "./curves";
import { isValidRange } from "./scene";

export const PROJECT_VERSION = 1;
export const MAX_PROJECT_BYTES = 10 * 1024 * 1024;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("프로젝트 형식이 올바르지 않습니다.");
  return value as Record<string, unknown>;
}
function finite(value: unknown, min = -1e10, max = 1e10) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error("프로젝트에 잘못된 숫자가 있습니다.");
}
function text(value: unknown) {
  if (typeof value !== "string" || value.length > 20000)
    throw new Error("프로젝트에 잘못된 텍스트가 있습니다.");
}
function color(value: unknown) {
  const c = record(value);
  for (const key of ["r", "g", "b"]) finite(c[key], 0, 255);
  finite(c.a, 0, 1);
}
function textStyle(value: unknown) {
  const style = record(value);
  color(style.color);
  finite(style.fontSize, 1, 200);
  text(style.fontFamily);
}
function validateObject(value: unknown): SceneObject {
  const o = record(value);
  text(o.id);
  text(o.name);
  if (!o.id || typeof o.visible !== "boolean" || typeof o.locked !== "boolean")
    throw new Error("객체의 기본 속성이 올바르지 않습니다.");
  if (
    ["point2d", "line2d", "circle2d", "function2d"].includes(String(o.type))
  ) {
    const stroke = record(o.stroke);
    color(stroke.color);
    finite(stroke.width, 0, 50);
    if (
      stroke.lineStyle !== undefined &&
      !["solid", "dashed", "dotted", "double"].includes(
        String(stroke.lineStyle),
      )
    )
      throw new Error("선 종류가 올바르지 않습니다.");
    if (
      stroke.dashArray !== undefined &&
      (!Array.isArray(stroke.dashArray) ||
        stroke.dashArray.length > 20 ||
        !stroke.dashArray.every(
          (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
        ))
    )
      throw new Error("점선 설정이 올바르지 않습니다.");
  }
  if (["point2d", "circle2d", "region2d"].includes(String(o.type))) {
    const fill = record(o.fill);
    color(fill.color);
    if (typeof fill.enabled !== "boolean")
      throw new Error("채우기 설정이 올바르지 않습니다.");
  }
  switch (o.type) {
    case "point2d":
      finite(o.x);
      finite(o.y);
      finite(o.radius, 0.1, 100);
      if (o.label !== undefined) text(o.label);
      if (
        typeof o.showLabel !== "boolean" ||
        ![
          "top",
          "bottom",
          "left",
          "right",
          "top-right",
          "top-left",
          "bottom-right",
          "bottom-left",
        ].includes(String(o.labelPosition))
      )
        throw new Error("점 이름 설정이 올바르지 않습니다.");
      break;
    case "line2d":
      for (const key of ["x1", "y1", "x2", "y2"]) finite(o[key]);
      if (!["none", "open", "closed", "both"].includes(String(o.arrowEnd)))
        throw new Error("화살표 설정이 올바르지 않습니다.");
      if (
        o.lineKind !== undefined &&
        !["segment", "line", "ray"].includes(String(o.lineKind))
      )
        throw new Error("선 범주가 올바르지 않습니다.");
      break;
    case "circle2d":
      finite(o.cx);
      finite(o.cy);
      finite(o.radius, 0.001);
      if (typeof o.showCenter !== "boolean")
        throw new Error("원 설정이 올바르지 않습니다.");
      break;
    case "function2d":
      text(o.expression);
      finite(o.samples, 10, 4000);
      if (
        o.angleUnit !== undefined &&
        !["rad", "deg"].includes(String(o.angleUnit))
      )
        throw new Error("각도 단위가 올바르지 않습니다.");
      if (o.domain !== null) {
        if (!Array.isArray(o.domain) || o.domain.length !== 2)
          throw new Error("정의역이 올바르지 않습니다.");
        finite(o.domain[0]);
        finite(o.domain[1]);
        if (o.domain[0] >= o.domain[1])
          throw new Error("정의역의 최솟값보다 최댓값이 커야 합니다.");
      }
      break;
    case "text2d":
    case "formula2d":
      finite(o.x);
      finite(o.y);
      text(o.type === "text2d" ? o.text : o.latex);
      textStyle(o.textStyle);
      break;
    case "region2d":
      if (o.autoBounds !== undefined) {
        const bounds = record(o.autoBounds);
        finite(bounds.index, 0, 1000);
        finite(bounds.anchorX);
        finite(bounds.anchorY);
        if (
          !Number.isInteger(bounds.index) ||
          !isValidRange(bounds.searchRange)
        )
          throw new Error("자동 영역의 교점 범위가 올바르지 않습니다.");
      }
      if (o.showAreaValue !== undefined && typeof o.showAreaValue !== "boolean")
        throw new Error("넓이 표시 설정이 올바르지 않습니다.");
      text(o.curveAId);
      text(o.curveBId);
      finite(o.xStart);
      finite(o.xEnd);
      finite(o.samples, 10, 2000);
      text(o.labelText);
      finite(o.labelX);
      finite(o.labelY);
      textStyle(o.labelStyle);
      break;
    default:
      throw new Error("지원하지 않는 객체 종류입니다.");
  }
  return o as SceneObject;
}

export function parseProject(json: string): ProjectState {
  if (json.length > MAX_PROJECT_BYTES)
    throw new Error("프로젝트 파일은 10MB 이하여야 합니다.");
  const parsed = record(JSON.parse(json));
  if (parsed.version !== undefined && parsed.version !== PROJECT_VERSION)
    throw new Error("이 버전에서 지원하지 않는 프로젝트입니다.");
  const scene = validateScene(parsed.scene as ProjectState["scene"]);
  if (!Array.isArray(parsed.objects) || parsed.objects.length > 1000)
    throw new Error("객체는 최대 1000개까지 열 수 있습니다.");
  const objects = parsed.objects.map(validateObject);
  const ids = new Set(objects.map((o) => o.id));
  if (ids.size !== objects.length) throw new Error("객체 ID가 중복됩니다.");
  for (const o of objects) {
    if (
      o.type === "region2d" &&
      [o.curveAId, o.curveBId].some((id) => !findCurve(objects, id))
    ) {
      throw new Error("영역이 참조하는 곡선이 없습니다.");
    }
  }
  return {
    scene,
    objects,
    selectedObjectId:
      typeof parsed.selectedObjectId === "string" &&
      ids.has(parsed.selectedObjectId)
        ? parsed.selectedObjectId
        : null,
  };
}
