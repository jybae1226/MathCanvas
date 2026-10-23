import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { axes, findCurve } from "../../utils/curves";
import { approximateCurveIntersections } from "../../utils/intersections";
import { NumberInput } from "./NumberInput";
import { BoundedAreasPanel } from "./BoundedAreasPanel";

export function LeftPanel({ notify }: { notify: (text: string) => void }) {
  const state = useProjectStore();
  const [tab, setTab] = useState("objects");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [start, setStart] = useState(-2);
  const [end, setEnd] = useState(2);
  const [mode, setMode] = useState<"between" | "inside" | "overlap">("between");
  const [branchA, setBranchA] = useState<"upper" | "lower">("upper");
  const [branchB, setBranchB] = useState<"upper" | "lower">("lower");
  const [signA, setSignA] = useState<1 | -1>(1),
    [signB, setSignB] = useState<1 | -1>(1);
  const [linked, setLinked] = useState(true);
  const curves = [
    ...state.objects.filter(
      (o) =>
        o.type === "function2d" || o.type === "line2d" || o.type === "circle2d",
    ),
    ...axes,
  ];
  const aid = curves.some((o) => o.id === a) ? a : (curves[0]?.id ?? "");
  const bid = curves.some((o) => o.id === b) ? b : (curves[1]?.id ?? "");
  const curveSelect = (
    value: string,
    change: (id: string) => void,
    label: string,
  ) => (
    <label className="field">
      {label}
      <select value={value} onChange={(e) => change(e.target.value)}>
        {curves.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.type === "function2d" && o.expression
              ? ` · ${o.expression}`
              : ""}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <aside className="left-panel">
      <div className="panel-heading">
        <span>그리기 도구</span>
        <span className="badge">2D</span>
      </div>
      <div className="tool-grid">
        <button onClick={state.addPoint}>
          <b>•</b>점
        </button>
        <button
          aria-pressed={state.activeTool === "line"}
          onClick={state.startLineTool}
        >
          <b>↗</b>선 · 화살표
        </button>
        <button onClick={state.addCircle}>
          <b>○</b>원
        </button>
        <button onClick={state.addFunction}>
          <b>ƒ</b>함수 · 음함수
        </button>
        <button onClick={state.addText}>
          <b>T</b>텍스트
        </button>
        <button onClick={state.addFormula}>
          <b>∫</b>수식
        </button>
        <button
          aria-pressed={state.activeTool === "coordinate"}
          onClick={state.startCoordinateTool}
        >
          <b>⌖</b>좌표 확인
        </button>
        <button
          aria-pressed={state.activeTool === "select"}
          onClick={state.cancelDraftTool}
        >
          <b>↖</b>선택 · 이동
        </button>
      </div>
      <div className="tool-hint">
        {state.activeTool === "line"
          ? state.lineDraftStart
            ? "끝점을 클릭하세요 · Esc 취소"
            : "시작점을 클릭하세요 · Esc 취소"
          : state.activeTool === "coordinate"
            ? "그림 위를 클릭하면 좌표를 확인합니다"
            : "휠로 확대 · 빈 공간을 끌어 이동"}
      </div>
      <div className="panel-tabs" role="tablist" aria-label="작업 패널">
        {[
          ["objects", "객체"],
          ["math", "영역 · 교점"],
          ["scene", "화면"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="panel-content">
        {tab === "objects" && (
          <>
            <div className="section-title">
              수업의 객체 <span>{state.objects.length}</span>
            </div>
            {state.objects.length === 0 && (
              <div className="empty-state">
                <b>첫 그래프를 그려보세요</b>
                <p>
                  위의 ‘함수 · 음함수’를 누르고
                  <br />
                  오른쪽에서 수식을 입력하세요.
                </p>
                <code>sin(x)</code>
                <code>x^2+y^2=4</code>
              </div>
            )}
            <div className="object-list">
              {state.objects.map((o) => (
                <div
                  className={`object-row ${o.id === state.selectedObjectId ? "selected" : ""}`}
                  key={o.id}
                >
                  <button
                    className="object-name"
                    onClick={() => state.selectObject(o.id)}
                  >
                    <span>
                      {
                        {
                          point2d: "•",
                          line2d: "↗",
                          circle2d: "○",
                          function2d: "ƒ",
                          formula2d: "∫",
                          text2d: "T",
                          region2d: "▧",
                        }[o.type]
                      }
                    </span>
                    <div>
                      {o.name}
                      <small>
                        {o.type === "function2d"
                          ? o.expression || "수식을 입력하세요"
                          : o.type === "point2d" && o.intersection
                            ? "연동 교점"
                            : (
                                {
                                  point2d: "점",
                                  line2d: "선",
                                  circle2d: "원",
                                  formula2d: "수식",
                                  text2d: "텍스트",
                                  region2d: "칠한 영역",
                                } as Record<string, string>
                              )[o.type]}
                      </small>
                    </div>
                  </button>
                  <button
                    className="icon-button"
                    title={o.visible ? "숨기기" : "표시"}
                    aria-label={`${o.name} ${o.visible ? "숨기기" : "표시"}`}
                    onClick={() =>
                      state.updateObject(o.id, { visible: !o.visible })
                    }
                  >
                    {o.visible ? "◉" : "○"}
                  </button>
                  <button
                    className="icon-button"
                    title={o.locked ? "잠금 해제" : "잠그기"}
                    onClick={() =>
                      state.updateObject(o.id, { locked: !o.locked })
                    }
                  >
                    {o.locked ? "🔒" : "·"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "math" && (
          <>
            <h3>곡선 선택</h3>
            {curveSelect(aid, setA, "곡선 A")}
            {curveSelect(bid, setB, "곡선 B")}
            <section className="inspector-section">
              <h3>만나는 점</h3>
              <label className="check">
                <input
                  type="checkbox"
                  checked={linked}
                  onChange={(e) => setLinked(e.target.checked)}
                />
                함수 변경 시 교점도 갱신
              </label>
              <button
                className="wide"
                disabled={!aid || !bid || aid === bid}
                onClick={() => {
                  const ca = findCurve(state.objects, aid),
                    cb = findCurve(state.objects, bid);
                  if (!ca || !cb) return;
                  const points = approximateCurveIntersections(
                    ca,
                    cb,
                    state.scene.xRange,
                    state.scene.yRange,
                  );
                  if (!points.length) {
                    notify(
                      "현재 화면에서 고립된 교점을 찾지 못했습니다. 일치하는 곡선은 제외합니다.",
                    );
                    return;
                  }
                  state.addIntersectionMarkers(aid, bid, linked);
                  notify(
                    `${points.length}개의 교점을 표시했습니다. 좌표는 근삿값입니다.`,
                  );
                }}
              >
                교점 표시
              </button>
              <p className="hint">
                좌표축도 선택할 수 있습니다. 계산은 현재 화면 범위에서
                수행합니다.
              </p>
            </section>
            <BoundedAreasPanel
              a={findCurve(state.objects, aid)}
              b={findCurve(state.objects, bid)}
              notify={notify}
            />
            <section className="inspector-section">
              <h3>영역 채우기 · 직접 지정</h3>
              <label className="field">
                영역 방식
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                >
                  <option value="between">A와 B의 선택한 가지 사이</option>
                  <option value="inside">A의 내부 조건</option>
                  <option value="overlap">A와 B 내부 조건의 교집합</option>
                </select>
              </label>
              {mode === "between" ? (
                <div className="field-pair">
                  {[
                    [branchA, setBranchA, "A 가지"],
                    [branchB, setBranchB, "B 가지"],
                  ].map(([value, change, label]) => (
                    <label className="field" key={String(label)}>
                      {String(label)}
                      <select
                        value={value as string}
                        onChange={(e) =>
                          (change as typeof setBranchA)(
                            e.target.value as "upper" | "lower",
                          )
                        }
                      >
                        <option value="upper">위쪽</option>
                        <option value="lower">아래쪽</option>
                      </select>
                    </label>
                  ))}
                </div>
              ) : (
                <>
                  <label className="field">
                    A 조건
                    <select
                      value={signA}
                      onChange={(e) =>
                        setSignA(Number(e.target.value) as 1 | -1)
                      }
                    >
                      <option value={1}>왼쪽 식 − 오른쪽 식 ≤ 0</option>
                      <option value={-1}>왼쪽 식 − 오른쪽 식 ≥ 0</option>
                    </select>
                  </label>
                  {mode === "overlap" && (
                    <label className="field">
                      B 조건
                      <select
                        value={signB}
                        onChange={(e) =>
                          setSignB(Number(e.target.value) as 1 | -1)
                        }
                      >
                        <option value={1}>왼쪽 식 − 오른쪽 식 ≤ 0</option>
                        <option value={-1}>왼쪽 식 − 오른쪽 식 ≥ 0</option>
                      </select>
                    </label>
                  )}
                </>
              )}
              <div className="field-pair">
                <label className="field">
                  x 시작
                  <NumberInput value={start} onCommit={setStart} />
                </label>
                <label className="field">
                  x 끝<NumberInput value={end} onCommit={setEnd} />
                </label>
              </div>
              <button
                className="wide primary"
                disabled={!aid || (!bid && mode !== "inside") || start >= end}
                onClick={() => {
                  state.addRegionFill(
                    aid,
                    mode === "inside" ? aid : bid,
                    start,
                    end,
                    { regionMode: mode, branchA, branchB, signA, signB },
                  );
                  notify(
                    "영역을 추가했습니다. 오른쪽에서 넓이를 계산할 수 있습니다.",
                  );
                }}
              >
                영역 채우기
              </button>
              <p className="hint">
                원 내부: x²+y²=4와 ‘A 내부’. 두 원의 겹침: ‘교집합’. y=f(x)는
                조건에서 y−f(x)로 해석합니다. 음함수는 화면의 y 범위 안에서
                칠합니다.
              </p>
            </section>
          </>
        )}
        {tab === "scene" && (
          <>
            <h3>좌표와 격자</h3>
            <label className="check">
              <input
                type="checkbox"
                checked={state.scene.showGrid}
                onChange={(e) =>
                  state.updateScene({ showGrid: e.target.checked })
                }
              />
              격자 표시
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={state.scene.showAxes}
                onChange={(e) =>
                  state.updateScene({ showAxes: e.target.checked })
                }
              />
              좌표축 표시
            </label>
            <label className="field">
              각도 단위
              <select
                value={state.scene.angleUnit ?? "rad"}
                onChange={(e) =>
                  state.updateScene({
                    angleUnit: e.target.value as "rad" | "deg",
                  })
                }
              >
                <option value="rad">라디안 (rad)</option>
                <option value="deg">도 (°)</option>
              </select>
            </label>
            {(["x", "y"] as const).map((axis) => (
              <div key={axis}>
                <div className="field-pair">
                  <label className="field">
                    {axis} 최솟값
                    <NumberInput
                      value={state.scene[`${axis}Range`][0]}
                      onCommit={(v) => {
                        if (v >= state.scene[`${axis}Range`][1]) {
                          notify("최솟값은 최댓값보다 작아야 합니다.");
                          return;
                        }
                        state.updateScene({
                          [`${axis}Range`]: [v, state.scene[`${axis}Range`][1]],
                        });
                      }}
                    />
                  </label>
                  <label className="field">
                    {axis} 최댓값
                    <NumberInput
                      value={state.scene[`${axis}Range`][1]}
                      onCommit={(v) => {
                        if (v <= state.scene[`${axis}Range`][0]) {
                          notify("최댓값은 최솟값보다 커야 합니다.");
                          return;
                        }
                        state.updateScene({
                          [`${axis}Range`]: [state.scene[`${axis}Range`][0], v],
                        });
                      }}
                    />
                  </label>
                </div>
                <label className="field">
                  {axis} 눈금 간격
                  <NumberInput
                    value={state.scene[`${axis}TickStep`]}
                    onCommit={(v) =>
                      state.updateScene({ [`${axis}TickStep`]: v })
                    }
                  />
                </label>
              </div>
            ))}
            <button className="wide" onClick={state.centerOrigin}>
              원점을 가운데로
            </button>
            <section className="inspector-section">
              <h3>그림 설명</h3>
              <textarea
                aria-label="그림 설명"
                value={state.scene.captionText}
                onChange={(e) => state.updateCaptionText(e.target.value)}
                placeholder="예: 두 곡선 사이의 넓이"
              />
              <label className="field">
                글자 크기 · {state.scene.captionFontSize}px
                <input
                  type="range"
                  min={10}
                  max={28}
                  value={state.scene.captionFontSize}
                  onChange={(e) =>
                    state.updateCaptionFontSize(Number(e.target.value))
                  }
                />
              </label>
              <label className="field">
                설명 색
                <input
                  type="color"
                  value={state.scene.captionColor}
                  onChange={(e) => state.updateCaptionColor(e.target.value)}
                />
              </label>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
