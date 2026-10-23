import { useState } from "react";
import type { SceneObject } from "../../types/objects";
import { useProjectStore } from "../../store/projectStore";
import {
  analyzeBoundedAreas,
  areaFingerprint,
  AREA_COLORS,
  supportsBoundedAreas,
  type BoundedAreaAnalysis,
} from "../../utils/boundedAreas";
import { evaluateCurveY } from "../../utils/graph";
import { isValidRange } from "../../utils/scene";
import { NumberInput } from "./NumberInput";

export function BoundedAreasPanel({
  a,
  b,
  notify,
}: {
  a?: SceneObject;
  b?: SceneObject;
  notify: (text: string) => void;
}) {
  const scene = useProjectStore((s) => s.scene);
  const addRegions = useProjectStore((s) => s.addBoundedRegions);
  const updateScene = useProjectStore((s) => s.updateScene);
  const [followView, setFollowView] = useState(true);
  const [lower, setLower] = useState(scene.xRange[0]),
    [upper, setUpper] = useState(scene.xRange[1]);
  const [calculation, setCalculation] = useState<{
    key: string;
    analysis: BoundedAreaAnalysis;
  } | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const range: [number, number] = followView ? scene.xRange : [lower, upper];
  const supported =
    a &&
    b &&
    a.id !== b.id &&
    supportsBoundedAreas(a) &&
    supportsBoundedAreas(b);
  const key = a && b ? areaFingerprint(a, b, range) : "";
  const analysis = calculation?.key === key ? calculation.analysis : null;
  const selected =
    analysis?.segments.filter((s) => s.area && !excluded.has(s.index)) ?? [];
  const selectedSum = selected.reduce((sum, s) => sum + s.area!.value, 0);
  const format = (n: number) => Number(n.toPrecision(7)).toString();
  return (
    <section className="inspector-section bounded-areas">
      <h3>교점 사이 넓이 · 자동 분할</h3>
      <p className="hint">
        함수·직선의 교점을 x 순서로 찾아, 이웃한 교점 사이를 각각 계산합니다.
        위아래가 바뀌어도 넓이는 양수로 더합니다.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={followView}
          onChange={(e) => setFollowView(e.target.checked)}
        />
        현재 화면의 x 범위에서 찾기
      </label>
      {!followView && (
        <div className="field-pair">
          <label className="field">
            교점 탐색 시작
            <NumberInput value={lower} onCommit={setLower} />
          </label>
          <label className="field">
            교점 탐색 끝<NumberInput value={upper} onCommit={setUpper} />
          </label>
        </div>
      )}
      <button
        className="wide primary"
        disabled={!supported || !isValidRange(range)}
        onClick={() => {
          if (!a || !b) return;
          const result = analyzeBoundedAreas(a, b, range);
          setCalculation({ key, analysis: result });
          setExcluded(new Set());
          notify(
            result.segments.length
              ? `교점 ${result.intersections.length}개 사이의 ${result.segments.length}개 구간을 계산했습니다.`
              : "이 x 범위에서 영역을 닫는 교점이 두 개 이상 필요합니다. 탐색 범위와 수식을 확인하세요.",
          );
        }}
      >
        교점 찾기 · 구간별 넓이 계산
      </button>
      {!supported && (
        <p className="hint">
          이 자동 분할은 y=f(x) 함수와 수직이 아닌 선에 적용합니다. 원·음함수는
          아래의 내부 조건 또는 가지 선택을 사용하세요.
        </p>
      )}
      {calculation && !analysis && (
        <p className="hint">수식·구간이 바뀌었습니다. 다시 계산하세요.</p>
      )}
      {analysis && (
        <>
          <p className="hint">
            교점 {analysis.intersections.length}개 · 닫힌 구간{" "}
            {analysis.segments.length}개 · x={format(range[0])} ~{" "}
            {format(range[1])}
          </p>
          <div className="area-rows">
            {analysis.segments.map((s) => (
              <label className="area-row" key={s.index}>
                <input
                  type="checkbox"
                  aria-label={`A${s.index + 1} 선택`}
                  disabled={!s.area}
                  checked={!!s.area && !excluded.has(s.index)}
                  onChange={(e) =>
                    setExcluded((old) => {
                      const next = new Set(old);
                      if (e.target.checked) next.delete(s.index);
                      else next.add(s.index);
                      return next;
                    })
                  }
                />
                <span
                  className="area-swatch"
                  style={{
                    background: AREA_COLORS[s.index % AREA_COLORS.length],
                  }}
                />
                <span>
                  <b>
                    A{s.index + 1} ·{" "}
                    {s.area ? `≈ ${format(s.area.value)}` : "계산 불가"}
                  </b>
                  <small>
                    {format(s.start.x)} ≤ x ≤ {format(s.end.x)}
                  </small>
                  <small>
                    {s.upper === "mixed"
                      ? "구간 내부에 추가 교점이 있을 수 있습니다"
                      : `위쪽: ${s.upper === "a" ? a?.name : b?.name}`}
                  </small>
                </span>
              </label>
            ))}
          </div>
          {!!analysis.segments.length && (
            <>
              <output className="result-box" data-testid="area-totals">
                전체 넓이 합계:{" "}
                {analysis.total === null
                  ? "계산 불가 구간 있음"
                  : `≈ ${format(analysis.total)}`}
                <br />
                선택 {selected.length}개 합계: ≈ {format(selectedSum)}
              </output>
              <button
                className="wide primary"
                disabled={!selected.length}
                onClick={() => {
                  if (!a || !b) return;
                  addRegions(a.id, b.id, selected, range);
                  notify(
                    `선택한 ${selected.length}개 영역을 칠했습니다. 같은 두 곡선의 이전 자동 영역은 교체됩니다.`,
                  );
                }}
              >
                선택한 구간 색칠 · 값 표시
              </button>
              <button
                className="wide"
                disabled={!selected.length}
                onClick={() => {
                  if (!a || !b) return;
                  const min = selected[0].start.x,
                    max = selected.at(-1)!.end.x;
                  const ys: number[] = [];
                  for (let i = 0; i <= 300; i++)
                    for (const curve of [a, b]) {
                      const y = evaluateCurveY(
                        curve,
                        min + ((max - min) * i) / 300,
                      );
                      if (y !== null) ys.push(y);
                    }
                  if (!ys.length) return;
                  let xs = Math.max(max - min, 1),
                    ymin = Math.min(...ys),
                    ymax = Math.max(...ys),
                    ysSpan = Math.max(ymax - ymin, 1);
                  const cx = (min + max) / 2,
                    cy = (ymin + ymax) / 2;
                  xs =
                    Math.max(xs, (ysSpan * scene.width) / scene.height) * 1.2;
                  ysSpan = (xs * scene.height) / scene.width;
                  ymin = cy - ysSpan / 2;
                  ymax = cy + ysSpan / 2;
                  if (
                    !isValidRange([cx - xs / 2, cx + xs / 2]) ||
                    !isValidRange([ymin, ymax])
                  ) {
                    notify(
                      "영역이 너무 커서 자동 화면 맞춤을 적용할 수 없습니다.",
                    );
                    return;
                  }
                  setLower(range[0]);
                  setUpper(range[1]);
                  setFollowView(false);
                  updateScene({
                    xRange: [cx - xs / 2, cx + xs / 2],
                    yRange: [ymin, ymax],
                  });
                }}
              >
                선택 영역에 화면 맞추기
              </button>
            </>
          )}
          <p className="hint">
            탐색 끝과 첫·마지막 교점 바깥은 닫힌 영역에 포함하지 않습니다.
            극점·정의역 구멍·수렴 실패 구간은 합산하지 않습니다. 수치 근삿값이며
            모든 교점 검출을 보장하지 않습니다.
          </p>
        </>
      )}
    </section>
  );
}
