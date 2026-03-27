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

type ProjectActions = {
  addPoint: () => void;
  addLine: () => void;
  addFunction: () => void;
  addText: () => void;

  selectObject: (id: string | null) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;

  updateStrokeColor: (id: string, colorHex: string) => void;
  updateStrokeWidth: (id: string, width: number) => void;

  updateTextContent: (id: string, text: string) => void;
  updateTextColor: (id: string, colorHex: string) => void;
  updateTextSize: (id: string, fontSize: number) => void;

  updateFunctionExpression: (id: string, expression: string) => void;

  moveObjectBy: (id: string, dx: number, dy: number) => void;

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
  };

const initialState: ProjectState = {
  scene: {
    mode: "2d",
    width: 900,
    height: 600,
    xRange: [-10, 10],
    yRange: [-10, 10],
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
        };
      }),
    ),

  addLine: () =>
    set((state) =>
      withHistory(state, () => {
        const id = makeId("line");
        return {
          selectedObjectId: id,
          objects: [
            ...state.objects,
            {
              id,
              name: "Line",
              type: "line2d",
              visible: true,
              locked: false,
              x1: -4,
              y1: -2,
              x2: 4,
              y2: 3,
              stroke: {
                ...defaultStroke(),
                color: { r: 200, g: 40, b: 40, a: 1 },
              },
            },
          ],
        };
      }),
    ),

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
              domain: [-8, 8],
              samples: 300,
              stroke: {
                ...defaultStroke(),
                color: { r: 40, g: 90, b: 210, a: 1 },
              },
            },
          ],
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
        };
      }),
    ),

  selectObject: (id) =>
    set(() => ({
      selectedObjectId: id,
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

  moveObjectBy: (id, dx, dy) =>
    set((state) =>
      withHistory(state, () => ({
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
    ),

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
      })),
    );
  },

  resetProject: () =>
    set((state) =>
      withHistory(state, () => ({
        ...initialState,
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
      };
    }),
}));