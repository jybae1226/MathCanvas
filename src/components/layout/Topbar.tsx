import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { saveFile } from "../../utils/files";
import { exportImage } from "../../utils/exportImage";
import { MAX_PROJECT_BYTES } from "../../utils/projectFile";

export function Topbar({
  view,
  onView,
  message,
  notify,
}: {
  view: "2d" | "3d";
  onView: (view: "2d" | "3d") => void;
  message: string;
  notify: (message: string) => void;
}) {
  const undo = useProjectStore((s) => s.undo),
    redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.historyPast.length > 0),
    canRedo = useProjectStore((s) => s.historyFuture.length > 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportBackground = useProjectStore(
    (s) => s.scene.exportBackground ?? "white",
  );
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : "작업을 완료하지 못했습니다.",
        );
      } finally {
        setBusy(false);
      }
    },
    [notify],
  );
  const save = useCallback(
    () =>
      run(async () => {
        if (
          await saveFile(
            "project",
            useProjectStore.getState().exportProjectJson(),
          )
        )
          notify("수업 파일을 저장했습니다.");
      }),
    [run, notify],
  );
  const open = useCallback(
    () =>
      run(async () => {
        if (!window.mathCanvas) {
          fileRef.current?.click();
          return;
        }
        const file = await window.mathCanvas.openProject();
        if (file) {
          useProjectStore.getState().importProjectJson(file.content);
          notify("수업 파일을 열었습니다.");
        }
      }),
    [run, notify],
  );
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const editing =
        event.target instanceof HTMLElement &&
        !!event.target.closest(
          "input, textarea, select, [contenteditable=true]",
        );
      if (event.key === "Escape") useProjectStore.getState().cancelDraftTool();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editing && event.target instanceof HTMLElement) event.target.blur();
        void save();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void open();
        return;
      }
      if (editing) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        useProjectStore.getState().deleteSelectedObject();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [save, open, undo, redo]);
  return (
    <header className="topbar">
      <div className="brand">
        <img src="./favicon.svg" alt="" />
        <div>
          MathCanvas<small>수학을 그리는 공간</small>
        </div>
      </div>
      <nav className="view-switch" aria-label="보기 선택">
        <button aria-pressed={view === "2d"} onClick={() => onView("2d")}>
          2D 그래프
        </button>
        <button aria-pressed={view === "3d"} onClick={() => onView("3d")}>
          3D · 회전체
        </button>
      </nav>
      <div className="file-actions">
        <button
          onClick={() => {
            if (
              (useProjectStore.getState().objects.length ||
                useProjectStore.getState().scene.view3d) &&
              !window.confirm(
                "현재 수업을 비우고 새로 시작할까요? 필요한 내용은 파일로 저장해주세요.",
              )
            )
              return;
            useProjectStore.getState().resetProject();
            notify("새 수업을 시작했습니다.");
          }}
        >
          새로
        </button>
        <button disabled={busy} onClick={() => void open()}>
          열기
        </button>
        <button className="primary" disabled={busy} onClick={() => void save()}>
          저장
        </button>
        <span className="toolbar-divider" />
        <button
          aria-label="실행 취소"
          title="실행 취소 Ctrl/⌘+Z"
          disabled={!canUndo}
          onClick={undo}
        >
          ↶
        </button>
        <button
          aria-label="다시 실행"
          title="다시 실행 Ctrl/⌘+Shift+Z"
          disabled={!canRedo}
          onClick={redo}
        >
          ↷
        </button>
        <select
          className="export-background"
          aria-label="내보내기 배경"
          value={exportBackground}
          onChange={(e) =>
            useProjectStore.getState().updateScene({
              exportBackground: e.target.value as "white" | "transparent",
            })
          }
        >
          <option value="white">흰 배경</option>
          <option value="transparent">투명 배경</option>
        </select>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (await exportImage("svg", exportBackground))
                notify("SVG 그림을 저장했습니다.");
            })
          }
        >
          SVG
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (await exportImage("png", exportBackground))
                notify("PNG 그림을 저장했습니다.");
            })
          }
        >
          PNG
        </button>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {message}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.mathcanvas,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            void run(async () => {
              if (file.size > MAX_PROJECT_BYTES)
                throw new Error("파일은 10MB 이하여야 합니다.");
              useProjectStore.getState().importProjectJson(await file.text());
              notify("수업 파일을 열었습니다.");
            });
        }}
      />
    </header>
  );
}
