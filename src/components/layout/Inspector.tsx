import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import type { LabelPosition, SceneObject } from "../../types/objects";
import { defaultStroke, rgbaToHex } from "../../types/styles";
import { derivative, integrate, regionArea } from "../../utils/calculus";
import {
  evaluateCurveY,
  expressionError,
  isImplicitExpression,
  isPolarExpression,
} from "../../utils/graph";
import { findCurve } from "../../utils/curves";
import { makeId } from "../../utils/ids";
import { MathInput } from "./MathInput";
import { NumberInput } from "./NumberInput";
import { resolveAutomaticRegion } from "../../utils/boundedAreas";

const positionLabels: Record<LabelPosition, string> = {
  top: "위",
  bottom: "아래",
  left: "왼쪽",
  right: "오른쪽",
  "top-left": "왼쪽 위",
  "top-right": "오른쪽 위",
  "bottom-left": "왼쪽 아래",
  "bottom-right": "오른쪽 아래",
};
export function RightPanel({ notify }: { notify: (text: string) => void }) {
  const state = useProjectStore();
  const selected = state.objects.find((o) => o.id === state.selectedObjectId);
  return (
    <aside className="right-panel">
      <div className="panel-heading">
        객체 속성<span className="badge">편집</span>
      </div>
      {selected ? (
        <ObjectInspector
          key={selected.id}
          selected={selected}
          notify={notify}
        />
      ) : (
        <div className="empty-state">
          <span className="empty-icon">↖</span>
          <b>객체를 선택하세요</b>
          <p>
            왼쪽 목록이나 그래프를 클릭하면
            <br />
            수식과 모양을 바꿀 수 있습니다.
          </p>
          <div className="shortcut-card">
            Ctrl / ⌘ + S <span>저장</span>
            <br />
            Ctrl / ⌘ + Z <span>실행 취소</span>
            <br />
            Esc <span>그리기 취소</span>
          </div>
        </div>
      )}
    </aside>
  );
}

function ObjectInspector({
  selected: o,
  notify,
}: {
  selected: SceneObject;
  notify: (text: string) => void;
}) {
  const state = useProjectStore();
  const [tangentX, setTangentX] = useState(1),
    [lower, setLower] = useState(0),
    [upper, setUpper] = useState(1);
  const signature = JSON.stringify([
    o,
    state.objects.filter(
      (obj) =>
        obj.type === "line2d" ||
        obj.type === "function2d" ||
        obj.type === "circle2d",
    ),
    state.scene.yRange,
  ]);
  const [calculation, setCalculation] = useState({ source: "", text: "" });
  const setResult = (text: string) =>
    setCalculation({ source: signature, text });
  const result = calculation.source === signature ? calculation.text : "";
  const update = (patch: Partial<SceneObject>) =>
    state.updateObject(o.id, patch);
  const num = (label: string, value: number, onCommit: (v: number) => void) => (
    <label className="field">
      {label}
      <NumberInput value={value} onCommit={onCommit} />
    </label>
  );
  const stroke = "stroke" in o ? o.stroke : null;
  const textStyle = "textStyle" in o ? o.textStyle : null;
  const regionView = (() => {
    if (o.type !== "region2d") return null;
    const a = findCurve(state.objects, o.curveAId),
      b = findCurve(state.objects, o.curveBId);
    return a && b ? resolveAutomaticRegion(o, a, b) : null;
  })();
  return (
    <div className="panel-content inspector">
      <label className="field">
        이름
        <input
          type="text"
          value={o.name}
          onChange={(e) => state.updateObjectName(o.id, e.target.value)}
        />
      </label>
      {o.locked && (
        <p className="hint">
          이 객체의 이동·삭제가 잠겨 있습니다. 왼쪽 자물쇠로 해제하세요.
        </p>
      )}
      {o.type === "function2d" && (
        <>
          <h3>함수 입력</h3>
          <MathInput
            value={o.expression}
            onCommit={(text) => {
              state.updateFunctionExpression(o.id, text);
              setResult("");
            }}
          />
          {expressionError(o.expression) && (
            <p className="error-text">{expressionError(o.expression)}</p>
          )}
          <p className="hint">
            거듭제곱 x^2 · 자연로그 log(x) · 상용로그 log10(x)
            <br />
            음함수 x^2+y^2=4 · 극좌표 r=1+cos(theta)
            <br />
            asin(x)는 역삼각함수이며 각도는 화면 설정을 따릅니다.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={o.domain !== null}
              onChange={(e) =>
                state.updateFunctionDomain(
                  o.id,
                  e.target.checked
                    ? isPolarExpression(o.expression)
                      ? [0, o.angleUnit === "deg" ? 360 : 2 * Math.PI]
                      : [...state.scene.xRange]
                    : null,
                )
              }
            />
            정의역 직접 지정
          </label>
          {o.domain && (
            <div className="field-pair">
              {num("정의역 시작", o.domain[0], (v) =>
                state.updateFunctionDomain(o.id, [v, o.domain![1]]),
              )}
              {num("정의역 끝", o.domain[1], (v) =>
                state.updateFunctionDomain(o.id, [o.domain![0], v]),
              )}
            </div>
          )}
          <section className="inspector-section">
            <h3>좌표축과의 교점</h3>
            {[
              ["axis-x", "x축 교점 표시"],
              ["axis-y", "y축 교점 표시"],
            ].map(([id, label]) => (
              <label className="check" key={id}>
                <input
                  type="checkbox"
                  checked={state.objects.some(
                    (p) =>
                      p.type === "point2d" &&
                      p.intersection?.curveAId === o.id &&
                      p.intersection.curveBId === id,
                  )}
                  onChange={(e) => {
                    if (e.target.checked)
                      state.addIntersectionMarkers(o.id, id, true);
                    else state.removeAxisIntersections(o.id, id);
                  }}
                />
                {label}
              </label>
            ))}
          </section>
          {!isImplicitExpression(o.expression) &&
            !isPolarExpression(o.expression) && (
              <section className="inspector-section">
                <h3>미분 · 정적분</h3>
                {num("접점의 x 좌표", tangentX, setTangentX)}
                <button
                  className="wide"
                  onClick={() => {
                    const slope = derivative(o, tangentX),
                      y = evaluateCurveY(o, tangentX);
                    if (slope === null || y === null) {
                      notify(
                        "이 점에서 유한한 미분계수를 확인하지 못했습니다.",
                      );
                      return;
                    }
                    state.addSceneObject({
                      id: makeId("tangent"),
                      name: `접선 · x=${tangentX}`,
                      visible: true,
                      locked: false,
                      type: "line2d",
                      x1: tangentX,
                      y1: y,
                      x2: tangentX + 1,
                      y2: y + slope,
                      lineKind: "line",
                      arrowEnd: "none",
                      stroke: {
                        ...defaultStroke(),
                        color: { r: 220, g: 38, b: 38, a: 1 },
                      },
                    });
                    notify(
                      `미분계수 ≈ ${slope.toPrecision(7)} · 접선을 추가했습니다.`,
                    );
                  }}
                >
                  접선 · 미분계수 표시
                </button>
                <div className="field-pair">
                  {num("적분 시작", lower, setLower)}
                  {num("적분 끝", upper, setUpper)}
                </div>
                <button
                  className="wide"
                  disabled={lower >= upper}
                  onClick={() => {
                    const signed = integrate(
                      (x) => evaluateCurveY(o, x),
                      lower,
                      upper,
                    );
                    const area = integrate(
                      (x) => {
                        const y = evaluateCurveY(o, x);
                        return y === null ? null : Math.abs(y);
                      },
                      lower,
                      upper,
                    );
                    setResult(
                      signed && area
                        ? `정적분 ≈ ${signed.value.toPrecision(8)}\n넓이 ∫|f(x)|dx ≈ ${area.value.toPrecision(8)}`
                        : "계산이 수렴하지 않습니다. 정의역·불연속점을 확인하세요.",
                    );
                  }}
                >
                  정적분 · 넓이 계산
                </button>
                <button
                  className="wide"
                  disabled={lower >= upper}
                  onClick={() => {
                    state.addRegionFill(o.id, "axis-x", lower, upper);
                    notify("x축과 함수 사이 영역을 추가했습니다.");
                  }}
                >
                  적분 구간 색칠
                </button>
                {result && <output className="result-box">{result}</output>}
                <p className="hint">
                  수치 미분·적분 근삿값입니다. 이상적분은 지원하지 않습니다.
                </p>
              </section>
            )}
        </>
      )}
      {o.type === "point2d" && (
        <>
          <div className="field-pair">
            {num("x 좌표", o.x, (v) => update({ x: v }))}
            {num("y 좌표", o.y, (v) => update({ y: v }))}
          </div>
          <label className="field">
            점 이름
            <input
              type="text"
              value={o.label ?? ""}
              onChange={(e) => state.updatePointLabel(o.id, e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={o.showLabel}
              onChange={(e) =>
                state.updatePointShowLabel(o.id, e.target.checked)
              }
            />
            점 이름 표시
          </label>
          <label className="field">
            점 이름 위치
            <select
              value={o.labelPosition}
              onChange={(e) =>
                state.updatePointLabelPosition(
                  o.id,
                  e.target.value as LabelPosition,
                )
              }
            >
              {Object.entries(positionLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {num("점 크기", o.radius, (v) => {
            if (v > 0 && v <= 40) state.updatePointRadius(o.id, v);
          })}
          <label className="check">
            <input
              type="checkbox"
              checked={o.fill.enabled}
              onChange={(e) => state.updatePointFilled(o.id, e.target.checked)}
            />
            채운 점
          </label>
          {o.intersection && (
            <>
              <p className="hint">
                연동 교점입니다. 함수 변경 시 좌표를 다시 계산합니다. 복수
                교점은 x·y 순서로 연결하며 교점의 생성·소멸 시 순서가 바뀔 수
                있습니다.
              </p>
              <button onClick={() => update({ intersection: undefined })}>
                현재 좌표에 고정
              </button>
            </>
          )}
        </>
      )}
      {o.type === "line2d" && (
        <>
          <label className="field">
            선 범주
            <select
              value={o.lineKind ?? "segment"}
              onChange={(e) =>
                update({
                  lineKind: e.target.value as "segment" | "line" | "ray",
                })
              }
            >
              <option value="segment">선분</option>
              <option value="line">직선</option>
              <option value="ray">반직선</option>
            </select>
          </label>
          <div className="field-pair">
            {num("시작 x", o.x1, (v) => update({ x1: v }))}
            {num("시작 y", o.y1, (v) => update({ y1: v }))}
          </div>
          <div className="field-pair">
            {num("끝 x", o.x2, (v) => update({ x2: v }))}
            {num("끝 y", o.y2, (v) => update({ y2: v }))}
          </div>
          <label className="field">
            화살표
            <select
              value={o.arrowEnd}
              onChange={(e) =>
                state.updateLineArrow(o.id, e.target.value as typeof o.arrowEnd)
              }
            >
              <option value="none">없음</option>
              <option value="open">열린 화살표 →</option>
              <option value="closed">채운 화살표 ▶</option>
              <option value="both">양끝 화살표 ↔</option>
            </select>
          </label>
        </>
      )}
      {o.type === "circle2d" && (
        <>
          <div className="field-pair">
            {num("중심 x", o.cx, (v) => update({ cx: v }))}
            {num("중심 y", o.cy, (v) => update({ cy: v }))}
          </div>
          {num("반지름", o.radius, (v) => {
            if (v > 0 && v < 1e6) state.updateCircleRadius(o.id, v);
          })}
          <label className="check">
            <input
              type="checkbox"
              checked={o.showCenter}
              onChange={(e) =>
                state.updateCircleShowCenter(o.id, e.target.checked)
              }
            />
            중심점 표시
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={o.fill.enabled}
              onChange={(e) =>
                state.updateShapeFillEnabled(o.id, e.target.checked)
              }
            />
            내부 채우기
          </label>
          <label className="field">
            채우기 색
            <input
              type="color"
              value={rgbaToHex(o.fill.color)}
              onChange={(e) => state.updateShapeFillColor(o.id, e.target.value)}
            />
          </label>
        </>
      )}
      {o.type === "text2d" && (
        <label className="field">
          텍스트
          <textarea
            value={o.text}
            onChange={(e) => state.updateTextContent(o.id, e.target.value)}
          />
        </label>
      )}
      {o.type === "formula2d" && (
        <>
          <h3>LaTeX 수식</h3>
          <MathInput
            formula
            value={o.latex}
            onCommit={(v) => state.updateFormulaContent(o.id, v)}
          />
        </>
      )}
      {(o.type === "text2d" || o.type === "formula2d") && (
        <div className="field-pair">
          {num("x 위치", o.x, (v) => update({ x: v }))}
          {num("y 위치", o.y, (v) => update({ y: v }))}
        </div>
      )}
      {textStyle && (
        <section className="inspector-section">
          <h3>글자 모양</h3>
          <label className="field">
            글자 크기 · {textStyle.fontSize}px
            <input
              type="range"
              min={10}
              max={72}
              value={textStyle.fontSize}
              onChange={(e) =>
                state.updateTextSize(o.id, Number(e.target.value))
              }
            />
          </label>
          <label className="field">
            글자 색
            <input
              type="color"
              value={rgbaToHex(textStyle.color)}
              onChange={(e) => state.updateTextColor(o.id, e.target.value)}
            />
          </label>
        </section>
      )}
      {o.type === "region2d" && (
        <>
          <h3>영역 속성</h3>
          {o.autoBounds && (
            <>
              <p className="hint">
                교점 순서에 연결된 자동 영역입니다. 수식이 바뀌면 경계·넓이를
                갱신합니다. 교점 개수가 바뀌면 자동 분할을 다시 실행하세요.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={o.showAreaValue ?? false}
                  onChange={(e) => update({ showAreaValue: e.target.checked })}
                />
                그림에 넓이 값 표시
              </label>
              <button
                className="wide"
                onClick={() => {
                  const a = findCurve(state.objects, o.curveAId),
                    b = findCurve(state.objects, o.curveBId);
                  const r = a && b ? resolveAutomaticRegion(o, a, b) : null;
                  if (!r) {
                    notify(
                      "연결된 구간을 찾지 못했습니다. 다시 자동 분할하세요.",
                    );
                    return;
                  }
                  update({
                    xStart: r.xStart,
                    xEnd: r.xEnd,
                    labelX: r.labelX,
                    labelY: r.labelY,
                    autoBounds: undefined,
                  });
                }}
              >
                현재 구간에 고정
              </button>
            </>
          )}
          <fieldset className="readonly-fields" disabled={!!o.autoBounds}>
            <div className="field-pair">
              {num("영역 x 시작", regionView?.xStart ?? o.xStart, (v) =>
                state.updateRegionXStart(o.id, v),
              )}
              {num("영역 x 끝", regionView?.xEnd ?? o.xEnd, (v) =>
                state.updateRegionXEnd(o.id, v),
              )}
            </div>
          </fieldset>
          <label className="field">
            채우기 색
            <input
              type="color"
              value={rgbaToHex(o.fill.color)}
              onChange={(e) =>
                state.updateRegionFillColor(o.id, e.target.value)
              }
            />
          </label>
          <label className="field">
            불투명도 · {Math.round(o.fill.color.a * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={o.fill.color.a}
              onChange={(e) =>
                state.updateRegionOpacity(o.id, Number(e.target.value))
              }
            />
          </label>
          <label className="field">
            영역 이름
            <input
              type="text"
              value={o.labelText}
              onChange={(e) =>
                state.updateRegionLabelText(o.id, e.target.value)
              }
            />
          </label>
          <label className="field">
            글자 크기 · {o.labelStyle.fontSize}px
            <input
              type="range"
              min={10}
              max={48}
              value={o.labelStyle.fontSize}
              onChange={(e) =>
                state.updateRegionLabelSize(o.id, Number(e.target.value))
              }
            />
          </label>
          <div className="field-pair">
            {num("이름 x 위치", regionView?.labelX ?? o.labelX, (v) =>
              state.updateRegionLabelX(
                o.id,
                v - (regionView?.labelX ?? o.labelX) + o.labelX,
              ),
            )}
            {num("이름 y 위치", regionView?.labelY ?? o.labelY, (v) =>
              state.updateRegionLabelY(
                o.id,
                v - (regionView?.labelY ?? o.labelY) + o.labelY,
              ),
            )}
          </div>
          <button
            className="wide primary"
            onClick={() => {
              const a = findCurve(state.objects, o.curveAId),
                b = findCurve(state.objects, o.curveBId);
              const resolved = a && b ? resolveAutomaticRegion(o, a, b) : null;
              const area =
                a && b && resolved
                  ? regionArea(resolved, a, b, state.scene.yRange)
                  : null;
              setResult(
                area
                  ? `넓이 ≈ ${area.value.toPrecision(8)}`
                  : "이 범위의 넓이를 확인하지 못했습니다. 가지·정의역·불연속점을 확인하세요.",
              );
            }}
          >
            {"넓이 계산"}
          </button>
          {result && <output className="result-box">{result}</output>}
          <p className="hint">
            음함수의 넓이는 현재 y 범위 안의 수치 근삿값입니다. 화면에 잘린
            영역은 전체 넓이와 다릅니다.
          </p>
        </>
      )}
      {stroke && (
        <section className="inspector-section">
          <h3>선 모양</h3>
          <label className="field">
            선 색
            <input
              type="color"
              value={rgbaToHex(stroke.color)}
              onChange={(e) => state.updateStrokeColor(o.id, e.target.value)}
            />
          </label>
          <label className="field">
            선 두께 · {stroke.width}px
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={stroke.width}
              onChange={(e) =>
                state.updateStrokeWidth(o.id, Number(e.target.value))
              }
            />
          </label>
          <label className="field">
            선 종류
            <select
              value={stroke.lineStyle ?? "solid"}
              onChange={(e) =>
                state.updateLineStyle(
                  o.id,
                  e.target.value as "solid" | "dashed" | "dotted" | "double",
                )
              }
            >
              <option value="solid">실선</option>
              <option value="dashed">파선</option>
              <option value="dotted">점선</option>
              {o.type === "line2d" && <option value="double">이중선</option>}
            </select>
          </label>
        </section>
      )}
      <button
        className="wide danger"
        disabled={o.locked}
        onClick={state.deleteSelectedObject}
      >
        선택한 객체 삭제
      </button>
    </div>
  );
}
