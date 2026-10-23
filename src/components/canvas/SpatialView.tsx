import { useMemo, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import type { SpatialSettings } from "../../types/objects";
import {
  DEFAULT_3D,
  spatialMesh,
  spatialVolume,
  type Vertex,
} from "../../utils/spatial";
import { MathInput } from "../layout/MathInput";
import { NumberInput } from "../layout/NumberInput";

export function SpatialView() {
  const scene = useProjectStore((s) => s.scene),
    updateScene = useProjectStore((s) => s.updateScene);
  const settings = scene.view3d ?? DEFAULT_3D;
  const update = (patch: Partial<SpatialSettings>) =>
    updateScene({ view3d: { ...settings, ...patch } });
  const [rotation, setRotation] = useState({ yaw: -0.6, pitch: 0.5 }),
    [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const faces = useMemo(
    () => spatialMesh(settings, scene.angleUnit),
    [settings, scene.angleUnit],
  );
  const volume = useMemo(
    () => spatialVolume(settings, scene.angleUnit),
    [settings, scene.angleUnit],
  );
  const bounds = useMemo(() => {
    const points = faces.flat();
    const minimum = { x: Infinity, y: Infinity, z: Infinity },
      maximum = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const p of points)
      for (const key of ["x", "y", "z"] as const) {
        minimum[key] = Math.min(minimum[key], p[key]);
        maximum[key] = Math.max(maximum[key], p[key]);
      }
    if (!points.length) return { center: { x: 0, y: 0, z: 0 }, extent: 4 };
    return {
      center: {
        x: (minimum.x + maximum.x) / 2,
        y: (minimum.y + maximum.y) / 2,
        z: (minimum.z + maximum.z) / 2,
      },
      extent: Math.max(
        maximum.x - minimum.x,
        maximum.y - minimum.y,
        maximum.z - minimum.z,
        1,
      ),
    };
  }, [faces]);
  const project = (p: Vertex) => {
    const x = p.x - bounds.center.x,
      y = p.y - bounds.center.y,
      z = p.z - bounds.center.z;
    const rx = x * Math.cos(rotation.yaw) - y * Math.sin(rotation.yaw),
      ry = x * Math.sin(rotation.yaw) + y * Math.cos(rotation.yaw);
    const rz = z * Math.cos(rotation.pitch) - ry * Math.sin(rotation.pitch),
      depth = z * Math.sin(rotation.pitch) + ry * Math.cos(rotation.pitch);
    const scale = (410 * zoom) / bounds.extent;
    return { x: 450 + rx * scale, y: 305 - rz * scale, depth };
  };
  const polygons = faces
    .map((face, i) => {
      const points = face.map(project);
      const depth = points.reduce((s, p) => s + p.depth, 0) / points.length;
      return { i, points, depth };
    })
    .sort((a, b) => a.depth - b.depth);
  const axisSize = bounds.extent * 0.65;
  return (
    <div className="workspace">
      <aside className="left-panel">
        <div className="panel-heading">
          3D · 회전체<span className="badge">오프라인</span>
        </div>
        <div className="panel-content">
          <label className="field">
            입체 종류
            <select
              value={settings.kind}
              onChange={(e) => {
                const kind = e.target.value as SpatialSettings["kind"];
                update({
                  kind,
                  ...(kind === "surface"
                    ? { expression: "sin(x)*cos(y)", lower: -3, upper: 3 }
                    : kind === "revolution"
                      ? {
                          expression: "sqrt(4-t^2)",
                          innerExpression: undefined,
                          lower: -2,
                          upper: 2,
                        }
                      : {}),
                });
              }}
            >
              <option value="revolution">회전체 · 부피</option>
              <option value="surface">곡면 z=f(x,y)</option>
              <option value="sphere">구</option>
              <option value="cone">원뿔</option>
              <option value="torus">도넛 (원환면)</option>
            </select>
          </label>
          {(settings.kind === "revolution" || settings.kind === "surface") && (
            <>
              <h3>
                {settings.kind === "revolution"
                  ? "반지름 r=f(t)"
                  : "높이 z=f(x,y)"}
              </h3>
              <MathInput
                value={settings.expression}
                onCommit={(expression) => update({ expression })}
              />
              <p className="hint">
                {settings.kind === "revolution"
                  ? "t는 회전축 위의 좌표입니다. r=|f(t)|인 원판으로 채운 입체를 만듭니다."
                  : "x와 y의 함수로 곡면을 그립니다. 예: x^2+y^2"}
              </p>
            </>
          )}
          {settings.kind === "revolution" && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.innerExpression !== undefined}
                  onChange={(e) =>
                    update({
                      innerExpression: e.target.checked ? "1" : undefined,
                    })
                  }
                />
                두 함수 사이 회전 · 와셔법
              </label>
              {settings.innerExpression !== undefined && (
                <>
                  <h3>두 번째 경계 g(t)</h3>
                  <MathInput
                    value={settings.innerExpression}
                    onCommit={(innerExpression) => update({ innerExpression })}
                  />
                  <p className="hint">
                    절댓값이 큰 경계가 바깥 반지름입니다. 두 경계가 축의 양쪽에
                    있으면 안쪽 반지름은 0입니다.
                  </p>
                </>
              )}
            </>
          )}
          {["revolution", "surface", "cone"].includes(settings.kind) && (
            <div className="field-pair">
              <label className="field">
                구간 시작
                <NumberInput
                  value={settings.lower}
                  onCommit={(v) => {
                    if (v < settings.upper) update({ lower: v });
                  }}
                />
              </label>
              <label className="field">
                구간 끝
                <NumberInput
                  value={settings.upper}
                  onCommit={(v) => {
                    if (v > settings.lower) update({ upper: v });
                  }}
                />
              </label>
            </div>
          )}
          {settings.kind === "revolution" && (
            <label className="field">
              회전축
              <select
                value={settings.axis}
                onChange={(e) => update({ axis: e.target.value as "x" | "y" })}
              >
                <option value="x">x축 · x=t</option>
                <option value="y">y축 · y=t</option>
              </select>
            </label>
          )}
          {["sphere", "cone", "torus"].includes(settings.kind) && (
            <label className="field">
              {settings.kind === "torus" ? "관 반지름" : "반지름"}
              <NumberInput
                value={settings.radius}
                onCommit={(v) => {
                  if (v > 0 && v <= 1000) update({ radius: v });
                }}
              />
            </label>
          )}
          {settings.kind === "torus" && (
            <label className="field">
              중심 원의 반지름
              <NumberInput
                value={settings.majorRadius}
                onCommit={(v) => {
                  if (v > settings.radius && v <= 1000)
                    update({ majorRadius: v });
                }}
              />
            </label>
          )}
          <section className="inspector-section">
            <h3>부피</h3>
            <output className="result-box">
              {settings.kind === "surface"
                ? "곡면 보기에는 부피를 정의하지 않습니다."
                : volume === null
                  ? "계산이 수렴하지 않습니다. 수식과 구간을 확인하세요."
                  : `V ≈ ${volume.toPrecision(8)}`}
            </output>
            {settings.kind === "revolution" && (
              <p className="hint">
                {settings.innerExpression === undefined
                  ? "원판법 V=π∫[f(t)]²dt"
                  : "와셔법 V=π∫(R²−r²)dt"}{" "}
                · 유한 구간의 수치 근삿값입니다.
              </p>
            )}
          </section>
          <section className="inspector-section">
            <h3>수업 예제</h3>
            <button
              className="wide"
              onClick={() =>
                update({
                  kind: "revolution",
                  expression: "sqrt(4-t^2)",
                  innerExpression: undefined,
                  lower: -2,
                  upper: 2,
                  axis: "x",
                })
              }
            >
              반원 → 구
            </button>
            <button
              className="wide"
              onClick={() =>
                update({
                  kind: "revolution",
                  expression: "t",
                  innerExpression: undefined,
                  lower: 0,
                  upper: 3,
                  axis: "x",
                })
              }
            >
              직선 → 원뿔
            </button>
            <button
              className="wide"
              onClick={() =>
                update({
                  kind: "revolution",
                  expression: "2+sin(t)",
                  innerExpression: undefined,
                  lower: 0,
                  upper: scene.angleUnit === "deg" ? 360 : 2 * Math.PI,
                  axis: "x",
                })
              }
            >
              삼각함수 회전체
            </button>
          </section>
        </div>
      </aside>
      <main className="canvas-stage">
        <div className="stage-toolbar">
          <span>
            3차원 공간 <small>드래그하여 회전</small>
          </span>
          <button
            onClick={() => {
              setRotation({ yaw: -0.6, pitch: 0.5 });
              setZoom(1);
            }}
          >
            시점 초기화
          </button>
        </div>
        <div className="drawing-area">
          <div className="canvas-wrap" style={{ width: 900, maxWidth: "100%" }}>
            <svg
              id="math-diagram-svg"
              xmlns="http://www.w3.org/2000/svg"
              width={900}
              height={672}
              viewBox="0 0 900 672"
              className="canvas-svg spatial-svg"
              role="img"
              aria-label="3차원 수학 시각화"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const dx = e.clientX - drag.current.x,
                  dy = e.clientY - drag.current.y;
                drag.current = { x: e.clientX, y: e.clientY };
                setRotation((r) => ({
                  yaw: r.yaw + dx * 0.01,
                  pitch: Math.max(-1.5, Math.min(1.5, r.pitch + dy * 0.01)),
                }));
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <rect
                data-role="background"
                width={900}
                height={672}
                fill="white"
              />
              <defs>
                <clipPath id="spatial-clip">
                  <rect x={0} y={0} width={900} height={610} />
                </clipPath>
              </defs>
              <g clipPath="url(#spatial-clip)">
                {Array.from({ length: 11 }, (_, i) => {
                  const t = (axisSize * (i - 5)) / 5;
                  return [
                    [
                      { x: -axisSize, y: t, z: 0 },
                      { x: axisSize, y: t, z: 0 },
                    ],
                    [
                      { x: t, y: -axisSize, z: 0 },
                      { x: t, y: axisSize, z: 0 },
                    ],
                  ].map(([a, b], j) => {
                    const pa = project(a),
                      pb = project(b);
                    return (
                      <line
                        key={`${i}-${j}`}
                        x1={pa.x}
                        y1={pa.y}
                        x2={pb.x}
                        y2={pb.y}
                        stroke="#e2e8f0"
                        strokeWidth={1}
                      />
                    );
                  });
                })}
                {polygons.map(({ i, points, depth }) => (
                  <polygon
                    key={i}
                    points={points
                      .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
                      .join(" ")}
                    fill={`hsl(${215 + (15 * depth) / bounds.extent} 65% ${60 + (depth * 15) / bounds.extent}%)`}
                    stroke="#1e40af"
                    strokeOpacity={0.25}
                    strokeWidth={0.35}
                  />
                ))}
                {(["x", "y", "z"] as const).map((axis, i) => {
                  const end = { x: 0, y: 0, z: 0 };
                  end[axis] = axisSize;
                  const a = project({ x: 0, y: 0, z: 0 }),
                    b = project(end);
                  return (
                    <g key={axis}>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={["#dc2626", "#16a34a", "#7c3aed"][i]}
                        strokeWidth={2}
                      />
                      <text
                        x={b.x + 8}
                        y={b.y - 8}
                        fontSize={18}
                        fontFamily="Cambria, Georgia, serif"
                        fontStyle="italic"
                        fill={["#dc2626", "#16a34a", "#7c3aed"][i]}
                      >
                        {axis}
                      </text>
                    </g>
                  );
                })}
              </g>
              {!faces.length && (
                <text x={450} y={300} textAnchor="middle" fill="#64748b">
                  이 범위에서 입체를 그리지 못했습니다. 수식을 확인하세요.
                </text>
              )}
              <line x1={0} y1={610} x2={900} y2={610} stroke="#e2e8f0" />
              <text
                x={450}
                y={646}
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontSize={16}
                fill="#334155"
              >
                {settings.kind === "surface"
                  ? `z = ${settings.expression}`
                  : volume === null
                    ? "부피 계산 불가"
                    : `V ≈ ${volume.toPrecision(8)}`}
              </text>
            </svg>
          </div>
        </div>
        <div className="stage-footer">
          <span>직교 투영 · 표면은 유한 격자 근사</span>
          <label>
            확대{" "}
            <input
              aria-label="3D 확대"
              type="range"
              min={0.4}
              max={2.5}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
        </div>
      </main>
    </div>
  );
}
