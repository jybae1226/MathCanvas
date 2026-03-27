import { create } from "zustand";
import type { ProjectState, SceneObject } from "../types/objects";
import {
  defaultFill,
  defaultStroke,
  defaultTextStyle,
  hexToRgba,
} from "../types/styles";
import { makeId } from "../utils/ids";

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

  moveObjectBy: (id: string, dx: number, dy: number) => void;

  exportProjectJson: () => string;
  importProjectJson: (json: string) => void;
  resetProject: () => void;
};

type ProjectStore = ProjectState & ProjectActions;

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

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...initialState,

  addPoint: () =>
    set((state) => {
      const id = makeId("point");
      return {
        ...state,
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

  addLine: () =>
    set((state) => {
      const id = makeId("line");
      return {
        ...state,
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

  addFunction: () =>
    set((state) => {
      const id = makeId("func");
      return {
        ...state,
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

  addText: () =>
    set((state) => {
      const id = makeId("text");
      return {
        ...state,
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

  selectObject: (id) =>
    set((state) => ({
      ...state,
      selectedObjectId: id,
    })),

  updateObject: (id, patch) =>
    set((state) => ({
      ...state,
      objects: state.objects.map((obj) =>
        obj.id === id ? ({ ...obj, ...patch } as SceneObject) : obj,
      ),
    })),

  updateStrokeColor: (id, colorHex) =>
    set((state) => ({
      ...state,
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

  updateStrokeWidth: (id, width) =>
    set((state) => ({
      ...state,
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

  updateTextContent: (id, text) =>
    set((state) => ({
      ...state,
      objects: state.objects.map((obj) =>
        obj.id === id && obj.type === "text2d" ? { ...obj, text } : obj,
      ),
    })),

  updateTextColor: (id, colorHex) =>
    set((state) => ({
      ...state,
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

  updateTextSize: (id, fontSize) =>
    set((state) => ({
      ...state,
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

  moveObjectBy: (id, dx, dy) =>
    set((state) => ({
      ...state,
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

    set(() => ({
      scene: parsed.scene,
      objects: parsed.objects,
      selectedObjectId: parsed.selectedObjectId ?? null,
    }));
  },

  resetProject: () => set(() => initialState),
}));