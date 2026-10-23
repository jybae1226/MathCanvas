import { useProjectStore } from "../store/projectStore";

const KEY = "mathcanvas-recovery-v1";
export function startPersistence(report: (message: string) => void) {
  try {
    const json = localStorage.getItem(KEY);
    if (json) {
      useProjectStore.getState().importProjectJson(json);
      useProjectStore.setState({
        historyPast: [],
        historyFuture: [],
        selectedObjectId: null,
      });
      report("지난 작업을 복구했습니다.");
    }
  } catch {
    report("이전 자동 저장을 읽지 못했습니다. 수업 파일을 직접 열어주세요.");
  }
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let linkedTimer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    try {
      localStorage.setItem(KEY, useProjectStore.getState().exportProjectJson());
    } catch {
      report("자동 저장 공간이 부족합니다. 파일로 저장해주세요.");
    }
  };
  const unsubscribe = useProjectStore.subscribe((state, previous) => {
    if (state.objects !== previous.objects || state.scene !== previous.scene) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 600);
      const signature = (objects: typeof state.objects) =>
        JSON.stringify(
          objects.filter(
            (o) =>
              o.type === "line2d" ||
              o.type === "function2d" ||
              o.type === "circle2d",
          ),
        );
      if (
        signature(state.objects) !== signature(previous.objects) &&
        state.objects.some((o) => o.type === "point2d" && o.intersection)
      ) {
        clearTimeout(linkedTimer);
        linkedTimer = setTimeout(
          () => useProjectStore.getState().refreshIntersections(),
          250,
        );
      }
    }
  });
  window.addEventListener("beforeunload", save);
  return () => {
    clearTimeout(saveTimer);
    clearTimeout(linkedTimer);
    unsubscribe();
    window.removeEventListener("beforeunload", save);
    save();
  };
}
