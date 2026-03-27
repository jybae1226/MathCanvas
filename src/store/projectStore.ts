import { create } from "zustand";
import type { ProjectState, SceneObject } from "../types/objects";
import {
  defaultFill,
  defaultStroke,
  defaultTextStyle,
  hexToRgba,
} from "../types/styles";
import { makeId } from "../utils/ids";

type HistorySnapshot = {
  scene: ProjectState["scene"];
  objects: ProjectState["objects"];
  selectedObjectId: ProjectState["selectedObjectId"];
};

type ToolMode = "select" | "line";

type ProjectActions = {
  addPoint: () => void;
  startLineTool: () => void;
  addFunction: () => void;
  addText: () => void;

  setActiveTool: (tool: ToolMode) => void;
  handleCanvasWorldClick: (x: number, y: number) => void;

  selectObject: (id: string | null) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;

  updateStrokeColor: (id: string, colorHex: string) => void;
  updateStrokeWidth: (id: string, width: number) => void;

  updateTextContent: (id: string, text: string) => void;
  updateTextColor: (id: string, colorHex: string) => void;
  updateTextSize: (id: string, fontSize: number) => void;

  updateFunctionExpression: (id: string, expression: string) => void;
  updateFunctionDomain: (id: string, domain: [number, number] | null) => void;

  updateScene: (patch: Partial<ProjectState["scene"]>) => void;

  moveObjectBy: (id: string, dx: number, dy: number) => void;
  beginInteractionHistory: () => void;
  endInteractionHistory: () => void;

  deleteSelectedObject: () => void;

  exportProjectJson: () => string;
  importProjectJson: (json: string) => void;
  resetProject: () => void;

  undo: () => void;
  redo: () => void;
};

type ProjectStore = ProjectState &
  ProjectActions & {
    historyPast: HistorySnapshot[];
    historyFuture: HistorySnapshot[];
    activeTool: ToolMode;
    lineDraftStart: { x: number; y: number } | null;
    interactionSnapshot: HistorySnapshot | null;
  };

const initialState: ProjectState = {
  scene: {
    mode: "2d",
    width: 900,
    height: 600,
    xRange: [-10, 10],
    yRange: [-10, 10],
    xTickStep: 1,
    yTickStep: 1,
    showGrid: true,
    showAxes: true,
  },
  objects: [],
  selectedObjectId: null,
};

const cloneSnapshot = (snapshot: HistorySnapshot): HistorySnapshot => ({
  scene: { ...snapshot.scene },
  objects: snapshot.objects.map((obj) => structuredClone(obj)),
  selectedObjectId: snapshot.selectedObjectId,
});

const getPresentSnapshot = (state: ProjectStore): HistorySnapshot => ({
  scene: { ...state.scene },
  objects: state.objects.map((obj) => structuredClone(obj)),
  selectedObjectId: state.selectedObjectId,
});

const withHistory = (
  state: ProjectStore,
  updater: (state: ProjectStore) => Partial<ProjectStore>,
): Partial<ProjectStore> => {
  const current = cloneSnapshot(getPresentSnapshot(state));
  const nextPatch = updater(state);

  return {
    ...nextPatch,
    historyPast: [...state.historyPast, current],
    historyFuture: [],
  };
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,
  historyPast: [],
  historyFuture: [],
  activeTool: "select",
  lineDraftStart: null,
  interactionSnapshot: null,

  addPoint: () =>
    set((state) =>
      withHistory(state, () => {
        const id = makeId("point");
        return {
          selectedObjectId: id,
          objects: [
            ...state.objects,
            {
              id,
              name: "Point",
              type: "point2d",
              visible: true,
              locked: false,
              x: 2,
              y: 2,
              radius: 5,
              stroke: defaultStroke(),
              fill: {
                ...defaultFill(),
                enabled: true,
                color: { r: 255, g: 255, b: 255, a: 1 },
              },
              label: "A",
            },
          ],
          activeTool: "select",
          lineDraftStart: null,
        };
      }),
    ),

  startLineTool: () =>
    set(() => ({
      activeTool: "line",
      lineDraftStart: null,
      selectedObjectId: null,
    })),

  addFunction: () =>
    set((state) =>
      withHistory(state, () => {
        const id = makeId("func");
        return {
          selectedObjectId: id,
          objects: [
            ...state.objects,
            {
              id,
              name: "Function",
              type: "function2d",
              visible: true,
              locked: false,
              expression: "x^2 / 4",
              domain: null,
              samples: 600,
              stroke: {
                ...defaultStroke(),
                color: { r: 40, g: 90, b: 210, a: 1 },
              },
            },
          ],
          activeTool: "select",
          lineDraftStart: null,
        };
      }),
    ),

  addText: () =>
    set((state) =>
      withHistory(state, () => {
        const id = makeId("text");
        return {
          selectedObjectId: id,
          objects: [
            ...state.objects,
            {
              id,
              name: "Text",
              type: "text2d",
              visible: true,
              locked: false,
              x: 0,
              y: 0,
              text: "Text",
              textStyle: defaultTextStyle(),
            },
          ],
          activeTool: "select",
          lineDraftStart: null,
        };
      }),
    ),

  setActiveTool: (tool) =>
    set(() => ({
      activeTool: tool,
      lineDraftStart: null,
      selectedObjectId: tool === "select" ? get().selectedObjectId : null,
    })),

  handleCanvasWorldClick: (x, y) =>
    set((state) => {
      if (state.activeTool !== "line") {
        return {
          selectedObjectId: null,
        };
      }

      if (state.lineDraftStart === null) {
        return {
          lineDraftStart: { x, y },
          selectedObjectId: null,
        };
      }

      const id = makeId("line");

      return withHistory(state, () => ({
        objects: [
          ...state.objects,
          {
            id,
            name: "Line",
            type: "line2d",
            visible: true,
            locked: false,
            x1: state.lineDraftStart!.x,
            y1: state.lineDraftStart!.y,
            x2: x,
            y2: y,
            stroke: {
              ...defaultStroke(),
              color: { r: 200, g: 40, b: 40, a: 1 },
            },
          },
        ],
        selectedObjectId: id,
        lineDraftStart: null,
      }));
    }),

  selectObject: (id) =>
    set(() => ({
      selectedObjectId: id,
      activeTool: "select",
      lineDraftStart: null,
    })),

  updateObject: (id, patch) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id ? ({ ...obj, ...patch } as SceneObject) : obj,
        ),
      })),
    ),

  updateStrokeColor: (id, colorHex) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) => {
          if (obj.id !== id || !("stroke" in obj)) return obj;

          return {
            ...obj,
            stroke: {
              ...obj.stroke,
              color: hexToRgba(colorHex, obj.stroke.color.a),
            },
          };
        }),
      })),
    ),

  updateStrokeWidth: (id, width) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) => {
          if (obj.id !== id || !("stroke" in obj)) return obj;

          return {
            ...obj,
            stroke: {
              ...obj.stroke,
              width,
            },
          };
        }),
      })),
    ),

  updateTextContent: (id, text) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "text2d" ? { ...obj, text } : obj,
        ),
      })),
    ),

  updateTextColor: (id, colorHex) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "text2d"
            ? {
                ...obj,
                textStyle: {
                  ...obj.textStyle,
                  color: hexToRgba(colorHex, obj.textStyle.color.a),
                },
              }
            : obj,
        ),
      })),
    ),

  updateTextSize: (id, fontSize) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "text2d"
            ? {
                ...obj,
                textStyle: {
                  ...obj.textStyle,
                  fontSize,
                },
              }
            : obj,
        ),
      })),
    ),

  updateFunctionExpression: (id, expression) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "function2d"
            ? {
                ...obj,
                expression,
              }
            : obj,
        ),
      })),
    ),

  updateFunctionDomain: (id, domain) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "function2d"
            ? {
                ...obj,
                domain,
              }
            : obj,
        ),
      })),
    ),

  updateScene: (patch) =>
    set((state) =>
      withHistory(state, () => ({
        scene: {
          ...state.scene,
          ...patch,
        },
      })),
    ),

  beginInteractionHistory: () =>
    set((state) => {
      if (state.interactionSnapshot !== null) return state;

      const current = cloneSnapshot(getPresentSnapshot(state));

      return {
        interactionSnapshot: current,
        historyPast: [...state.historyPast, current],
        historyFuture: [],
      };
    }),

  endInteractionHistory: () =>
    set(() => ({
      interactionSnapshot: null,
    })),

  moveObjectBy: (id, dx, dy) =>
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id) return obj;

        if (obj.type === "point2d") {
          return {
            ...obj,
            x: obj.x + dx,
            y: obj.y + dy,
          };
        }

        if (obj.type === "line2d") {
          return {
            ...obj,
            x1: obj.x1 + dx,
            y1: obj.y1 + dy,
            x2: obj.x2 + dx,
            y2: obj.y2 + dy,
          };
        }

        if (obj.type === "text2d") {
          return {
            ...obj,
            x: obj.x + dx,
            y: obj.y + dy,
          };
        }

        return obj;
      }),
    })),

  deleteSelectedObject: () =>
    set((state) => {
      if (!state.selectedObjectId) return state;

      return withHistory(state, () => ({
        objects: state.objects.filter(
          (obj) => obj.id !== state.selectedObjectId,
        ),
        selectedObjectId: null,
      }));
    }),

  exportProjectJson: () => {
    const state = get();

    return JSON.stringify(
      {
        scene: state.scene,
        objects: state.objects,
        selectedObjectId: state.selectedObjectId,
      },
      null,
      2,
    );
  },

  importProjectJson: (json: string) => {
    const parsed = JSON.parse(json) as ProjectState;

    set((state) =>
      withHistory(state, () => ({
        scene: parsed.scene,
        objects: parsed.objects,
        selectedObjectId: parsed.selectedObjectId ?? null,
        activeTool: "select",
        lineDraftStart: null,
        interactionSnapshot: null,
      })),
    );
  },

  resetProject: () =>
    set((state) =>
      withHistory(state, () => ({
        ...initialState,
        activeTool: "select",
        lineDraftStart: null,
        interactionSnapshot: null,
      })),
    ),

  undo: () =>
    set((state) => {
      if (state.historyPast.length === 0) return state;

      const previous = state.historyPast[state.historyPast.length - 1];
      const current = cloneSnapshot(getPresentSnapshot(state));

      return {
        ...state,
        scene: cloneSnapshot(previous).scene,
        objects: cloneSnapshot(previous).objects,
        selectedObjectId: previous.selectedObjectId,
        historyPast: state.historyPast.slice(0, -1),
        historyFuture: [current, ...state.historyFuture],
        activeTool: "select" as ToolMode,
        lineDraftStart: null,
        interactionSnapshot: null,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyFuture.length === 0) return state;

      const next = state.historyFuture[0];
      const current = cloneSnapshot(getPresentSnapshot(state));

      return {
        ...state,
        scene: cloneSnapshot(next).scene,
        objects: cloneSnapshot(next).objects,
        selectedObjectId: next.selectedObjectId,
        historyPast: [...state.historyPast, current],
        historyFuture: state.historyFuture.slice(1),
        activeTool: "select" as ToolMode,
        lineDraftStart: null,
        interactionSnapshot: null,
      };
    }),
}));