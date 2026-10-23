import { create } from "zustand";
import type {
  LabelPosition,
  Region2DObject,
  ProjectState,
  SceneObject,
} from "../types/objects";
import {
  defaultFill,
  defaultStroke,
  defaultTextStyle,
  hexToRgba,
  type LineStyle,
} from "../types/styles";
import { makeId } from "../utils/ids";
import { approximateCurveIntersections } from "../utils/intersections";
import { findCurve } from "../utils/curves";
import { parseProject, PROJECT_VERSION } from "../utils/projectFile";
import { isValidRange, validateScene } from "../utils/scene";
import { AREA_COLORS, type BoundedSegment } from "../utils/boundedAreas";

type HistorySnapshot = {
  scene: ProjectState["scene"];
  objects: ProjectState["objects"];
  selectedObjectId: ProjectState["selectedObjectId"];
};

type ToolMode = "select" | "line" | "coordinate";

type ProjectActions = {
  addSceneObject: (object: SceneObject) => void;
  addBoundedRegions: (
    curveAId: string,
    curveBId: string,
    segments: BoundedSegment[],
    range: [number, number],
  ) => void;
  removeAxisIntersections: (curveId: string, axisId: string) => void;
  addPoint: () => void;
  addCircle: () => void;
  startLineTool: () => void;
  startCoordinateTool: () => void;
  addFunction: () => void;
  addText: () => void;
  addFormula: () => void;
  addRegionFill: (
    curveAId: string,
    curveBId: string,
    xStart: number,
    xEnd: number,
    options?: Partial<
      Pick<
        Region2DObject,
        "regionMode" | "branchA" | "branchB" | "signA" | "signB"
      >
    >,
  ) => void;
  addIntersectionMarkers: (
    curveAId: string,
    curveBId: string,
    linked?: boolean,
  ) => void;
  refreshIntersections: () => void;

  setActiveTool: (tool: ToolMode) => void;
  cancelDraftTool: () => void;
  handleCanvasWorldClick: (x: number, y: number) => void;

  selectObject: (id: string | null) => void;
  updateObject: (id: string, patch: Partial<SceneObject>) => void;
  updateObjectName: (id: string, name: string) => void;

  updateStrokeColor: (id: string, colorHex: string) => void;
  updateStrokeWidth: (id: string, width: number) => void;
  updateLineStyle: (id: string, lineStyle: LineStyle) => void;
  updateLineArrow: (
    id: string,
    arrowEnd: "none" | "open" | "closed" | "both",
  ) => void;

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
  centerOrigin: () => void;

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
    interactionSnapshot: HistorySnapshot | null;
    coordinateProbe: { x: number; y: number } | null;
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
    historyPast: [...state.historyPast, current].slice(-100),
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
  coordinateProbe: null,

  addSceneObject: (object) =>
    set((state) =>
      withHistory(state, () => ({
        objects: [...state.objects, object],
        selectedObjectId: object.id,
      })),
    ),
  addBoundedRegions: (curveAId, curveBId, segments, range) =>
    set((state) =>
      withHistory(state, () => {
        const pair = [curveAId, curveBId].sort().join("::");
        const created: Region2DObject[] = segments
          .filter((s) => s.area)
          .map((s) => ({
            id: makeId("area"),
            name: `교점 사이 A${s.index + 1}`,
            type: "region2d",
            visible: true,
            locked: false,
            curveAId,
            curveBId,
            xStart: s.start.x,
            xEnd: s.end.x,
            samples: 400,
            fill: {
              enabled: true,
              color: hexToRgba(AREA_COLORS[s.index % AREA_COLORS.length], 0.22),
            },
            labelText: `A${s.index + 1}`,
            labelX: s.labelX,
            labelY: s.labelY,
            labelStyle: { ...defaultTextStyle(), fontSize: 16 },
            regionMode: "between",
            showAreaValue: true,
            autoBounds: {
              index: s.index,
              searchRange: [...range],
              anchorX: s.labelX,
              anchorY: s.labelY,
            },
          }));
        return {
          objects: [
            ...state.objects.filter(
              (o) =>
                !(
                  o.type === "region2d" &&
                  o.autoBounds &&
                  [o.curveAId, o.curveBId].sort().join("::") === pair
                ),
            ),
            ...created,
          ],
          selectedObjectId: created[0]?.id ?? state.selectedObjectId,
          activeTool: "select",
          lineDraftStart: null,
        };
      }),
    ),
  removeAxisIntersections: (curveId, axisId) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.filter(
          (o) =>
            !(
              o.type === "point2d" &&
              o.intersection?.curveAId === curveId &&
              o.intersection.curveBId === axisId
            ),
        ),
      })),
    ),

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
              name: "점",
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
              labelPosition: "top",
            },
          ],
          activeTool: "select",
          lineDraftStart: null,
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
              name: "원",
              type: "circle2d",
              visible: true,
              locked: false,
              cx: 0,
              cy: 0,
              radius: 2,
              stroke: {
                ...defaultStroke(),
                color: { r: 0, g: 0, b: 0, a: 1 },
              },
              fill: {
                enabled: false,
                color: { r: 0, g: 0, b: 0, a: 0.12 },
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
      selectedObjectId: null,
    })),

  startCoordinateTool: () =>
    set(() => ({
      activeTool: "coordinate",
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
              name: "함수",
              type: "function2d",
              visible: true,
              locked: false,
              expression: "",
              angleUnit: state.scene.angleUnit ?? "rad",
              domain: null,
              samples: 800,
              stroke: {
                ...defaultStroke(),
                color: { r: 0, g: 0, b: 0, a: 1 },
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
              name: "텍스트",
              type: "text2d",
              visible: true,
              locked: false,
              x: 0,
              y: 0,
              text: "텍스트",
              textStyle: defaultTextStyle(),
            },
          ],
          activeTool: "select",
          lineDraftStart: null,
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
              name: "수식",
              type: "formula2d",
              visible: true,
              locked: false,
              x: 0,
              y: 0,
              latex: "\\int_0^1 x^2 dx",
              textStyle: {
                ...defaultTextStyle(),
                fontSize: 24,
              },
            },
          ],
          activeTool: "select",
          lineDraftStart: null,
        };
      }),
    ),

  addRegionFill: (curveAId, curveBId, xStart, xEnd, options = {}) =>
    set((state) =>
      withHistory(state, () => {
        const id = makeId("region");
        return {
          selectedObjectId: id,
          objects: [
            ...state.objects,
            {
              id,
              name: "영역",
              type: "region2d",
              ...options,
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

  addIntersectionMarkers: (curveAId, curveBId, linked = false) =>
    set((state) =>
      withHistory(state, () => {
        const curveA = findCurve(state.objects, curveAId);
        const curveB = findCurve(state.objects, curveBId);

        if (!curveA || !curveB) return {};

        const curveAOk = ["function2d", "line2d", "circle2d"].includes(
          curveA.type,
        );
        const curveBOk = ["function2d", "line2d", "circle2d"].includes(
          curveB.type,
        );

        if (!curveAOk || !curveBOk) return {};

        const intersections = approximateCurveIntersections(
          curveA,
          curveB,
          state.scene.xRange,
          state.scene.yRange,
        );

        if (intersections.length === 0) return {};

        const createdObjects = intersections.map((p, index) => ({
          id: makeId("point"),
          name: `교점 ${index + 1}`,
          type: "point2d" as const,
          visible: true,
          locked: false,
          x: p.x,
          y: p.y,
          radius: 5,
          stroke: {
            ...defaultStroke(),
            color: { r: 220, g: 38, b: 38, a: 1 },
          },
          fill: {
            ...defaultFill(),
            enabled: true,
            color: { r: 220, g: 38, b: 38, a: 1 },
          },
          label: `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`,
          showLabel: true,
          labelPosition: "top-right" as LabelPosition,
          ...(linked ? { intersection: { curveAId, curveBId, index } } : {}),
        }));

        return {
          objects: [...state.objects, ...createdObjects],
          selectedObjectId: createdObjects[0]?.id ?? null,
        };
      }),
    ),

  refreshIntersections: () =>
    set((state) => {
      const groups = new Map<string, Array<{ x: number; y: number }>>();
      const objects = state.objects.map((o) => {
        if (o.type !== "point2d" || !o.intersection) return o;
        const { curveAId, curveBId, index } = o.intersection;
        const key = `${curveAId}:${curveBId}`;
        if (!groups.has(key)) {
          const a = findCurve(state.objects, curveAId),
            b = findCurve(state.objects, curveBId);
          groups.set(
            key,
            a && b
              ? approximateCurveIntersections(
                  a,
                  b,
                  state.scene.xRange,
                  state.scene.yRange,
                )
              : [],
          );
        }
        const p = groups.get(key)?.[index];
        return p
          ? {
              ...o,
              x: p.x,
              y: p.y,
              visible: true,
              label: `(${p.x.toFixed(4)}, ${p.y.toFixed(4)})`,
            }
          : { ...o, visible: false };
      });
      return { objects };
    }),

  setActiveTool: (tool) =>
    set(() => ({
      activeTool: tool,
      lineDraftStart: null,
      selectedObjectId: tool === "select" ? get().selectedObjectId : null,
    })),

  cancelDraftTool: () =>
    set(() => ({
      activeTool: "select",
      lineDraftStart: null,
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
              name: "화살표",
              type: "line2d",
              visible: true,
              locked: false,
              x1: state.lineDraftStart!.x,
              y1: state.lineDraftStart!.y,
              x2: x,
              y2: y,
              stroke: {
                ...defaultStroke(),
                color: { r: 220, g: 38, b: 38, a: 1 },
                lineStyle: "solid",
              },
              arrowEnd: "open",
            },
          ],
          selectedObjectId: id,
          lineDraftStart: null,
        }));
      }

      if (state.activeTool === "coordinate") {
        return {
          coordinateProbe: { x, y },
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

  updateLineStyle: (id, lineStyle) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) => {
          if (obj.id !== id || obj.type !== "line2d") return obj;

          return {
            ...obj,
            stroke: {
              ...obj.stroke,
              lineStyle,
            },
          };
        }),
      })),
    ),

  updateLineArrow: (id, arrowEnd) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) => {
          if (obj.id !== id || obj.type !== "line2d") return obj;

          return {
            ...obj,
            arrowEnd,
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
          obj.id === id && (obj.type === "text2d" || obj.type === "formula2d")
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
          obj.id === id && (obj.type === "text2d" || obj.type === "formula2d")
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
      domain !== null && !isValidRange(domain)
        ? {}
        : withHistory(state, () => ({
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
    set((state) => {
      const scene = { ...state.scene, ...patch };
      try {
        validateScene(scene);
      } catch {
        return {};
      }
      return withHistory(state, () => ({
        scene,
        ...(patch.angleUnit
          ? {
              objects: state.objects.map((o) =>
                o.type === "function2d"
                  ? { ...o, angleUnit: patch.angleUnit }
                  : o,
              ),
            }
          : {}),
      }));
    }),

  updateSceneDirect: (patch) =>
    set((state) => {
      const scene = { ...state.scene, ...patch };
      try {
        validateScene(scene);
      } catch {
        return {};
      }
      return { scene };
    }),

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

  centerOrigin: () =>
    set((state) =>
      withHistory(state, () => {
        const xSpan = state.scene.xRange[1] - state.scene.xRange[0];
        const ySpan = state.scene.yRange[1] - state.scene.yRange[0];

        return {
          scene: {
            ...state.scene,
            xRange: [-xSpan / 2, xSpan / 2],
            yRange: [-ySpan / 2, ySpan / 2],
          },
        };
      }),
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
          obj.id === id && obj.type === "point2d" ? { ...obj, showLabel } : obj,
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
          if (obj.id === id && obj.type === "circle2d") {
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
          if (obj.id === id && obj.type === "circle2d") {
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
          obj.id === id && obj.type === "region2d" ? { ...obj, xStart } : obj,
        ),
      })),
    ),

  updateRegionXEnd: (id, xEnd) =>
    set((state) =>
      withHistory(state, () => ({
        objects: state.objects.map((obj) =>
          obj.id === id && obj.type === "region2d" ? { ...obj, xEnd } : obj,
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
      };
    }),

  endInteractionHistory: () =>
    set((state) => {
      const snapshot = state.interactionSnapshot;
      if (!snapshot) return {};
      const changed =
        JSON.stringify([snapshot.scene, snapshot.objects]) !==
        JSON.stringify([state.scene, state.objects]);
      return {
        interactionSnapshot: null,
        ...(changed
          ? {
              historyPast: [...state.historyPast, snapshot].slice(-100),
              historyFuture: [],
            }
          : {}),
      };
    }),

  moveObjectBy: (id, dx, dy) =>
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id || obj.locked) return obj;

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
        if (obj.id !== id || obj.locked || obj.type !== "line2d") return obj;

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

  moveCircleRadiusBy: (id, dx, dy) =>
    set((state) => ({
      objects: state.objects.map((obj) => {
        if (obj.id !== id || obj.locked || obj.type !== "circle2d") return obj;

        void dy;
        return {
          ...obj,
          radius: Math.max(0.1, obj.radius + dx),
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
      if (
        !state.selectedObjectId ||
        state.objects.find((o) => o.id === state.selectedObjectId)?.locked
      )
        return state;

      return withHistory(state, () => ({
        objects: state.objects.filter(
          (obj) =>
            obj.id !== state.selectedObjectId &&
            !(
              obj.type === "region2d" &&
              (obj.curveAId === state.selectedObjectId ||
                obj.curveBId === state.selectedObjectId)
            ),
        ),
        selectedObjectId: null,
      }));
    }),

  exportProjectJson: () => {
    const state = get();

    return JSON.stringify(
      {
        version: PROJECT_VERSION,
        scene: state.scene,
        objects: state.objects,
        selectedObjectId: state.selectedObjectId,
      },
      null,
      2,
    );
  },

  importProjectJson: (json: string) => {
    const parsed = parseProject(json);

    set((state) =>
      withHistory(state, () => ({
        scene: parsed.scene,
        objects: parsed.objects,
        selectedObjectId: parsed.selectedObjectId ?? null,
        activeTool: "select",
        lineDraftStart: null,
        interactionSnapshot: null,
        coordinateProbe: null,
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
        coordinateProbe: null,
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
