import { create } from "zustand";
import type {
  LabelPosition,
  ProjectState,
  SceneObject,
} from "../types/objects";
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

type ToolMode = "select" | "line" | "polygon";

type ProjectActions = {
  addPoint: () => void;
  addCircle: () => void;
  startLineTool: () => void;
  startPolygonTool: () => void;
  finishPolygonTool: () => void;
  addFunction: () => void;
  addText: () => void;
  addFormula: () => void;
  addRegionFill: (
    curveAId: string,
    curveBId: string,
    xStart: number,
    xEnd: number,
  ) => void;

  setActiveTool: (tool: ToolMode) => void;
  cancelDraftTool: () => void;
  handleCanvasWorldClick: (x: number, y: number) => void;

  selectObject: (id: string | null) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  updateObjectName: (id: string, name: string) => void;

  updateStrokeColor: (id: string, colorHex: string) => void;
  updateStrokeWidth: (id: string, width: number) => void;

  updateTextContent: (id: string, text: string) => void;
  updateFormulaContent: (id: string, latex: string) => void;
  updateTextColor: (id: string, colorHex: string) => void;
  updateTextSize: (id: string, fontSize: number) => void;

  updateFunctionExpression: (id: string, expression: string) => void;
  updateFunctionDomain: (id: string, domain: [number, number] | null) => void;

  updateScene: (patch: Partial<ProjectState["scene"]>) => void;
  updateSceneDirect: (patch: Partial<ProjectState["scene"]>) => void;
  updateCaptionText: (text: string) => void;
  updateCaptionFontSize: (fontSize: number) => void;
  updateCaptionColor: (color: string) => void;

  updatePointLabel: (id: string, label: string) => void;
  updatePointFilled: (id: string, filled: boolean) => void;
  updatePointShowLabel: (id: string, showLabel: boolean) => void;
  updatePointLabelPosition: (id: string, position: LabelPosition) => void;
  updatePointRadius: (id: string, radius: number) => void;

  updateCircleRadius: (id: string, radius: number) => void;
  updateCircleShowCenter: (id: string, showCenter: boolean) => void;
  updateShapeFillEnabled: (id: string, enabled: boolean) => void;
  updateShapeFillColor: (id: string, colorHex: string) => void;

  updateRegionFillColor: (id: string, colorHex: string) => void;
  updateRegionOpacity: (id: string, opacity: number) => void;
  updateRegionXStart: (id: string, xStart: number) => void;
  updateRegionXEnd: (id: string, xEnd: number) => void;
  updateRegionLabelText: (id: string, text: string) => void;
  updateRegionLabelX: (id: string, x: number) => void;
  updateRegionLabelY: (id: string, y: number) => void;
  updateRegionLabelColor: (id: string, colorHex: string) => void;
  updateRegionLabelSize: (id: string, fontSize: number) => void;

  moveObjectBy: (id: string, dx: number, dy: number) => void;
  moveLineEndpointBy: (
    id: string,
    endpoint: "start" | "end",
    dx: number,
    dy: number,
  ) => void;
  movePolygonVertexBy: (
    id: string,
    vertexIndex: number,
    dx: number,
    dy: number,
  ) => void;
  moveCircleRadiusBy: (id: string, dx: number, dy: number) => void;
  moveRegionLabelBy: (id: string, dx: number, dy: number) => void;

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
    polygonDraftPoints: Array<{ x: number; y: number }>;
    interactionSnapshot: HistorySnapshot | null;
  };

const initialState: ProjectState = {
  scene: {
    mode: "2d",
    width: 900,
    height: 600,
    captionHeight: 72,
    xRange: [-10, 10],
    yRange: [-10, 10],
    xTickStep: 1,
    yTickStep: 1,
    showGrid: true,
    showAxes: true,
    snapToGrid: false,
    captionText: "",
    captionFontSize: 16,
    captionColor: "#333333",
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
  polygonDraftPoints: [],
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
                enabled: false,
                color: { r: 30, g: 30, b: 30, a: 1 },
              },
              label: "A",
              showLabel: true,
              labelPosition: "top-right",
            },
          ],
          activeTool: "select",
          lineDraftStart: null,
          polygonDraftPoints: [],
        };
      }),
    ),

  addCircle: () =>
    set((state) =>
      withHistory(state, () => {
        const id = makeId("circle");
        return {
          selectedObjectId: id,
          objects: [
            ...state.objects,
            {
              id,
              name: "Circle",
              type: "circle2d",
              visible: true,
              locked: false,
              cx: 0,
              cy: 0,
              radius: 2,
              stroke: {
                ...defaultStroke(),
                color: { r: 0, g: 102, b: 204, a: 1 },
              },
              fill: {
                enabled: false,
                color: { r: 0, g: 102, b: 204, a: 0.12 },
              },
              showCenter: false,
            },
          ],
        };
      }),
    ),

  startLineTool: () =>
    set(() => ({
      activeTool: "line",
      lineDraftStart: null,
      polygonDraftPoints: [],
      selectedObjectId: null,
    })),

  startPolygonTool: () =>
    set(() => ({
      activeTool: "polygon",
      lineDraftStart: null,
      polygonDraftPoints: [],
      selectedObjectId: null,
    })),

  finishPolygonTool: () =>
    set((state) => {
      if (state.polygonDraftPoints.length < 3) {
        return {
          activeTool: "select" as ToolMode,
          polygonDraftPoints: [],
        };
      }

      const id = makeId("polygon");

      return withHistory(state, () => ({
        activeTool: "select" as ToolMode,
        selectedObjectId: id,
        polygonDraftPoints: [],
        objects: [
          ...state.objects,
          {
            id,
            name: "Polygon",
            type: "polygon2d",
            visible: true,
            locked: false,
            points: state.polygonDraftPoints,
            stroke: {
              ...defaultStroke(),
              color: { r: 153, g: 51, b: 204, a: 1 },
            },
            fill: {
              enabled: true,
              color: { r: 153, g: 51, b: 204, a: 0.12 },
            },
          },
        ],
      }));
    }),

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
          polygonDraftPoints: [],
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
          polygonDraftPoints: [],
        };
      }),
    ),

  addFormula: () =>
    set((state) =>
      withHistory(state, () => {
        const id = makeId("formula");
        return {
          selectedObjectId: id,
          objects: [
            ...state.objects,
            {
              id,
              name: "Formula",
              type: "formula2d",
              visible: true,
              locked: false,
              x: 0,
              y: 0,
              latex: "\\int_0^1 x^2\\,dx",
              textStyle: {
                ...defaultTextStyle(),
                fontSize: 24,
              },
            },
          ],
          activeTool: "select",
          lineDraftStart: null,
          polygonDraftPoints: [],
        };
      }),
    ),

  addRegionFill: (curveAId, curveBId, xStart, xEnd) =>
    set((state) =>
      withHistory(state, () => {
        const id = makeId("region");
        return {
          selectedObjectId: id,
          objects: [
            ...state.objects,
            {
              id,
              name: "Region Fill",
              type: "region2d",
              visible: true,
              locked: false,
              curveAId,
              curveBId,
              xStart,
              xEnd,
              samples: 400,
              fill: {
                enabled: true,
                color: { r: 255, g: 160, b: 0, a: 0.28 },
              },
              labelText: "",
              labelX: (xStart + xEnd) / 2,
              labelY: 0,
              labelStyle: {
                ...defaultTextStyle(),
                fontSize: 18,
              },
            },
          ],
        };
      }),
    ),

  setActiveTool: (tool) =>
    set(() => ({
      activeTool: tool,
      lineDraftStart: null,
      polygonDraftPoints: [],
      selectedObjectId: tool === "select" ? get().selectedObjectId : null,
    })),

  cancelDraftTool: () =>
    set(() => ({
      activeTool: "select",
      lineDraftStart: null,
      polygonDraftPoints: [],
    })),

  handleCanvasWorldClick: (x, y) =>
    set((state) => {
      if (state.activeTool === "line") {
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
              arrowEnd: true,
            },
          ],
          selectedObjectId: id,
          lineDraftStart: null,
        }));
      }

      if (state.activeTool === "polygon") {
        return {
          polygonDraftPoints: [...state.polygonDraftPoints, { x, y }],
          selectedObjectId: null,
        };
      }

      return {
        selectedObjectId: null,
      };
    }),

  selectObject: (id) =>
    set(() => ({
      selectedObjectId: id,
      activeTool: "select",
      lineDraftStart: null,
      polygonDraftPoints: [],
    })),

  updateObject: (id, patch) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id ? ({ ...obj, ...patch } as SceneObject) : obj,
        ),
      })),
    ),

  updateObjectName: (id, name) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id ? { ...obj, name } : obj,
        ),
      })),
    ),

  updateStrokeColor: (id, colorHex) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) => {
          if (obj.id !== id || !("stroke" in obj)) {
            return obj;
          }

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
          if (obj.id !== id || !("stroke" in obj)) {
            return obj;
          }

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

  updateFormulaContent: (id, latex) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "formula2d" ? { ...obj, latex } : obj,
        ),
      })),
    ),

  updateTextColor: (id, colorHex) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id &&
          (obj.type === "text2d" || obj.type === "formula2d")
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
          obj.id === id &&
          (obj.type === "text2d" || obj.type === "formula2d")
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

  updateSceneDirect: (patch) =>
    set((state) => ({
      scene: {
        ...state.scene,
        ...patch,
      },
    })),

  updateCaptionText: (captionText) =>
    set((state) =>
      withHistory(state, () => ({
        scene: {
          ...state.scene,
          captionText,
        },
      })),
    ),

  updateCaptionFontSize: (captionFontSize) =>
    set((state) =>
      withHistory(state, () => ({
        scene: {
          ...state.scene,
          captionFontSize,
        },
      })),
    ),

  updateCaptionColor: (captionColor) =>
    set((state) =>
      withHistory(state, () => ({
        scene: {
          ...state.scene,
          captionColor,
        },
      })),
    ),

  updatePointLabel: (id, label) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "point2d"
            ? {
                ...obj,
                label,
              }
            : obj,
        ),
      })),
    ),

  updatePointFilled: (id, filled) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "point2d"
            ? {
                ...obj,
                fill: {
                  ...obj.fill,
                  enabled: filled,
                },
              }
            : obj,
        ),
      })),
    ),

  updatePointShowLabel: (id, showLabel) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "point2d"
            ? { ...obj, showLabel }
            : obj,
        ),
      })),
    ),

  updatePointLabelPosition: (id, position) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "point2d"
            ? { ...obj, labelPosition: position }
            : obj,
        ),
      })),
    ),

  updatePointRadius: (id, radius) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "point2d"
            ? { ...obj, radius: Math.max(1, radius) }
            : obj,
        ),
      })),
    ),

  updateCircleRadius: (id, radius) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "circle2d"
            ? { ...obj, radius: Math.max(0.1, radius) }
            : obj,
        ),
      })),
    ),

  updateCircleShowCenter: (id, showCenter) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "circle2d"
            ? { ...obj, showCenter }
            : obj,
        ),
      })),
    ),

  updateShapeFillEnabled: (id, enabled) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) => {
          if (
            obj.id === id &&
            (obj.type === "circle2d" || obj.type === "polygon2d")
          ) {
            return {
              ...obj,
              fill: {
                ...obj.fill,
                enabled,
              },
            };
          }
          return obj;
        }),
      })),
    ),

  updateShapeFillColor: (id, colorHex) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) => {
          if (
            obj.id === id &&
            (obj.type === "circle2d" || obj.type === "polygon2d")
          ) {
            return {
              ...obj,
              fill: {
                ...obj.fill,
                color: hexToRgba(colorHex, obj.fill.color.a),
              },
            };
          }
          return obj;
        }),
      })),
    ),

  updateRegionFillColor: (id, colorHex) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d"
            ? {
                ...obj,
                fill: {
                  ...obj.fill,
                  color: hexToRgba(colorHex, obj.fill.color.a),
                },
              }
            : obj,
        ),
      })),
    ),

  updateRegionOpacity: (id, opacity) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d"
            ? {
                ...obj,
                fill: {
                  ...obj.fill,
                  color: {
                    ...obj.fill.color,
                    a: opacity,
                  },
                },
              }
            : obj,
        ),
      })),
    ),

  updateRegionXStart: (id, xStart) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d"
            ? { ...obj, xStart }
            : obj,
        ),
      })),
    ),

  updateRegionXEnd: (id, xEnd) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d"
            ? { ...obj, xEnd }
            : obj,
        ),
      })),
    ),

  updateRegionLabelText: (id, text) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d"
            ? { ...obj, labelText: text }
            : obj,
        ),
      })),
    ),

  updateRegionLabelX: (id, x) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d"
            ? { ...obj, labelX: x }
            : obj,
        ),
      })),
    ),

  updateRegionLabelY: (id, y) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d"
            ? { ...obj, labelY: y }
            : obj,
        ),
      })),
    ),

  updateRegionLabelColor: (id, colorHex) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d"
            ? {
                ...obj,
                labelStyle: {
                  ...obj.labelStyle,
                  color: hexToRgba(colorHex, obj.labelStyle.color.a),
                },
              }
            : obj,
        ),
      })),
    ),

  updateRegionLabelSize: (id, fontSize) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d"
            ? {
                ...obj,
                labelStyle: {
                  ...obj.labelStyle,
                  fontSize,
                },
              }
            : obj,
        ),
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

        if (obj.type === "circle2d") {
          return {
            ...obj,
            cx: obj.cx + dx,
            cy: obj.cy + dy,
          };
        }

        if (obj.type === "polygon2d") {
          return {
            ...obj,
            points: obj.points.map((p) => ({
              x: p.x + dx,
              y: p.y + dy,
            })),
          };
        }

        if (obj.type === "text2d" || obj.type === "formula2d") {
          return {
            ...obj,
            x: obj.x + dx,
            y: obj.y + dy,
          };
        }

        if (obj.type === "region2d") {
          return {
            ...obj,
            labelX: obj.labelX + dx,
            labelY: obj.labelY + dy,
          };
        }

        return obj;
      }),
    })),

  moveLineEndpointBy: (id, endpoint, dx, dy) =>
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id || obj.type !== "line2d") return obj;

        if (endpoint === "start") {
          return {
            ...obj,
            x1: obj.x1 + dx,
            y1: obj.y1 + dy,
          };
        }

        return {
          ...obj,
          x2: obj.x2 + dx,
          y2: obj.y2 + dy,
        };
      }),
    })),

  movePolygonVertexBy: (id, vertexIndex, dx, dy) =>
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id || obj.type !== "polygon2d") return obj;

        return {
          ...obj,
          points: obj.points.map((p, index) =>
            index === vertexIndex ? { x: p.x + dx, y: p.y + dy } : p,
          ),
        };
      }),
    })),

  moveCircleRadiusBy: (id, dx, dy) =>
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id || obj.type !== "circle2d") return obj;

        const delta = Math.max(Math.abs(dx), Math.abs(dy));
        const sign = dx + dy >= 0 ? 1 : -1;
        return {
          ...obj,
          radius: Math.max(0.1, obj.radius + sign * delta),
        };
      }),
    })),

  moveRegionLabelBy: (id, dx, dy) =>
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id || obj.type !== "region2d") return obj;

        return {
          ...obj,
          labelX: obj.labelX + dx,
          labelY: obj.labelY + dy,
        };
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
        polygonDraftPoints: [],
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
        polygonDraftPoints: [],
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
        polygonDraftPoints: [],
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
        polygonDraftPoints: [],
        interactionSnapshot: null,
      };
    }),
}));