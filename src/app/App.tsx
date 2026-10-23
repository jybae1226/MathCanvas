import {
  Component,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Topbar } from "../components/layout/Topbar";
import { LeftPanel } from "../components/layout/LeftPanel";
import { RightPanel } from "../components/layout/RightPanel";
import { Canvas2D } from "../components/canvas/Canvas2D";
import { SpatialView } from "../components/canvas/SpatialView";
import { useProjectStore } from "../store/projectStore";
import { startPersistence } from "../utils/persistence";

class AppBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <div className="crash-state">
          <h1>그림을 표시하지 못했습니다</h1>
          <p>
            입력한 수식이나 파일을 확인해주세요. 마지막 자동 저장은 유지됩니다.
          </p>
          <button
            onClick={() => {
              useProjectStore.getState().resetProject();
              this.setState({ error: false });
            }}
          >
            빈 수업으로 돌아가기
          </button>
        </div>
      );
    return this.props.children;
  }
}

export default function App() {
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [message, setMessage] = useState(
    "수업 준비 완료 · 작업은 이 기기에 자동 저장됩니다",
  );
  const notify = useCallback((text: string) => setMessage(text), []);
  useEffect(() => startPersistence(notify), [notify]);
  return (
    <AppBoundary>
      <div className="app-shell">
        <Topbar
          view={view}
          onView={setView}
          message={message}
          notify={notify}
        />
        {view === "3d" ? (
          <SpatialView />
        ) : (
          <div className="workspace">
            <LeftPanel notify={notify} />
            <main className="canvas-stage">
              <div className="stage-toolbar">
                <span>
                  좌표 평면 <small>2D 수업 자료</small>
                </span>
                <button
                  onClick={() =>
                    useProjectStore
                      .getState()
                      .updateScene({ xRange: [-10, 10], yRange: [-10, 10] })
                  }
                >
                  기본 보기
                </button>
              </div>
              <div className="drawing-area">
                <Canvas2D />
              </div>
              <ZoomBar />
            </main>
            <RightPanel notify={notify} />
          </div>
        )}
        <footer className="app-status">
          <span className="status-dot" />
          <span role="status">{message}</span>
          <span className="app-version">
            MathCanvas 0.3 · {window.mathCanvas ? "데스크톱" : "웹 미리보기"}
          </span>
        </footer>
      </div>
    </AppBoundary>
  );
}

function ZoomBar() {
  const scene = useProjectStore((s) => s.scene),
    update = useProjectStore((s) => s.updateSceneDirect);
  const begin = useProjectStore((s) => s.beginInteractionHistory),
    end = useProjectStore((s) => s.endInteractionHistory);
  const span = scene.xRange[1] - scene.xRange[0];
  return (
    <div className="stage-footer">
      <span>
        {scene.angleUnit === "deg" ? "도 (°)" : "라디안"} · x:{" "}
        {scene.xRange[0].toPrecision(3)} ~ {scene.xRange[1].toPrecision(3)}
      </span>
      <label>
        −{" "}
        <input
          aria-label="그래프 확대"
          type="range"
          min={-4}
          max={6}
          step={0.05}
          value={Math.max(-4, Math.min(6, Math.log2(20 / span)))}
          onPointerDown={begin}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyUp={end}
          onBlur={end}
          onChange={(e) => {
            begin();
            const ratio = 20 / Math.pow(2, Number(e.target.value)) / span;
            const cx = (scene.xRange[0] + scene.xRange[1]) / 2,
              cy = (scene.yRange[0] + scene.yRange[1]) / 2,
              ys = (scene.yRange[1] - scene.yRange[0]) * ratio;
            update({
              xRange: [cx - (span * ratio) / 2, cx + (span * ratio) / 2],
              yRange: [cy - ys / 2, cy + ys / 2],
            });
          }}
        />{" "}
        ＋
      </label>
    </div>
  );
}
