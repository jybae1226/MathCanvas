import type { ProjectScene } from "../types/objects";

export function isValidRange(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(Number.isFinite) &&
    value[1] - value[0] >= 1e-6 &&
    value[1] - value[0] <= 1e8 &&
    value.every((n: number) => Math.abs(n) <= 1e10)
  );
}

export function validateScene(scene: ProjectScene): ProjectScene {
  if (
    scene?.angleUnit !== undefined &&
    !["rad", "deg"].includes(scene.angleUnit)
  )
    throw new Error("각도 단위가 올바르지 않습니다.");
  if (
    scene?.exportBackground !== undefined &&
    !["white", "transparent"].includes(scene.exportBackground)
  )
    throw new Error("내보내기 배경이 올바르지 않습니다.");
  if (scene?.view3d !== undefined) {
    const v = scene.view3d;
    if (
      !v ||
      !["revolution", "surface", "sphere", "cone", "torus"].includes(v.kind) ||
      !["x", "y"].includes(v.axis) ||
      typeof v.expression !== "string" ||
      v.expression.length > 2000 ||
      !isValidRange([v.lower, v.upper]) ||
      (v.innerExpression !== undefined &&
        (typeof v.innerExpression !== "string" ||
          v.innerExpression.length > 2000)) ||
      !Number.isFinite(v.radius) ||
      v.radius <= 0 ||
      v.radius > 1000 ||
      !Number.isFinite(v.majorRadius) ||
      v.majorRadius <= 0 ||
      v.majorRadius > 1000
    )
      throw new Error("3D 설정이 올바르지 않습니다.");
  }
  if (
    !scene ||
    scene.mode !== "2d" ||
    !isValidRange(scene.xRange) ||
    !isValidRange(scene.yRange)
  ) {
    throw new Error(
      "좌표 범위는 유한한 수이며 최솟값보다 최댓값이 커야 합니다.",
    );
  }
  for (const field of ["width", "height"] as const) {
    if (
      !Number.isFinite(scene[field]) ||
      scene[field] < 100 ||
      scene[field] > 4096
    ) {
      throw new Error("캔버스 크기는 100~4096 사이여야 합니다.");
    }
  }
  if (
    !Number.isFinite(scene.captionHeight) ||
    scene.captionHeight < 0 ||
    scene.captionHeight > 512 ||
    !Number.isFinite(scene.captionFontSize) ||
    scene.captionFontSize < 8 ||
    scene.captionFontSize > 144 ||
    typeof scene.captionText !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(scene.captionColor)
  ) {
    throw new Error("설명 영역 설정이 올바르지 않습니다.");
  }
  if (
    ![scene.xTickStep, scene.yTickStep].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    ![scene.showAxes, scene.showGrid, scene.snapToGrid].every(
      (n) => typeof n === "boolean",
    )
  ) {
    throw new Error("격자 설정이 올바르지 않습니다.");
  }
  return scene;
}

export function makeTicks(min: number, max: number, step: number): number[] {
  if (![min, max, step].every(Number.isFinite) || step <= 0 || max <= min)
    return [];
  // Keep the requested grid interval, thinning by a whole multiple at large zoom levels.
  const stride = Math.max(1, Math.ceil((max - min) / step / 400));
  const effectiveStep = step * stride;
  const start = Math.ceil(min / effectiveStep) * effectiveStep;
  const count = Math.min(
    401,
    Math.floor((max - start) / effectiveStep + 1e-8) + 1,
  );
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    Number((start + i * effectiveStep).toPrecision(12)),
  );
}
