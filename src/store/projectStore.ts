import { create } from "zustand";
import type { ProjectState, SceneObject } from "../types/objects";
import { defaultFill, defaultStroke, hexToRgba } from "../types/styles";
import { makeId } from "../utils/ids";

type ProjectActions = {
  addPoint: () => void;
  addLine: () => void;
  addFunction: () => void;
  selectObject: (id: string | null) => void;
  updateStrokeColor: (id: string, colorHex: string) => void;
  updateStrokeWidth: (id: string, width: number) => void;
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

export const useProjectStore = create<ProjectStore>((set) => ({
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

  selectObject: (id) =>
    set((state) => ({
      ...state,
      selectedObjectId: id,
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
}));