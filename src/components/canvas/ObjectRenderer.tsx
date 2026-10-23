import { buildRegionGeometry } from "../../utils/calculus";
import { findCurve } from "../../utils/curves";
import { lineEndpoints } from "../../utils/geometry";
import { resolveAutomaticRegion } from "../../utils/boundedAreas";
import type { PointerEvent as ReactPointerEvent } from "react";
import katex from "katex";
import type { LabelPosition, SceneObject } from "../../types/objects";
import { rgbaToCss } from "../../types/styles";
import {
  buildFunctionPath,
  isImplicitExpression,
  buildImplicitPath,
  sampleFunctionPoints,
  samplePolarFunctionPoints,
} from "../../utils/graph";

type DragTarget =
  "move" | "line-start" | "line-end" | "circle-radius" | "region-label";

type Props = {
  object: SceneObject;
  allObjects: SceneObject[];
  isSelected: boolean;
  toScreenX: (x: number) => number;
  toScreenY: (y: number) => number;
  currentXRange: [number, number];
  currentYRange: [number, number];
  viewHeight: number;
  onSelect: (id: string) => void;
  onPointerDown: (
    event: ReactPointerEvent<SVGGElement>,
    id: string,
    target: DragTarget,
    meta?: number,
  ) => void;
};

function getLabelOffset(position: LabelPosition) {
  switch (position) {
    case "top":
      return { dx: 0, dy: -12, anchor: "middle" as const };
    case "bottom":
      return { dx: 0, dy: 18, anchor: "middle" as const };
    case "left":
      return { dx: -10, dy: 4, anchor: "end" as const };
    case "right":
      return { dx: 10, dy: 4, anchor: "start" as const };
    case "top-left":
      return { dx: -8, dy: -8, anchor: "end" as const };
    case "top-right":
      return { dx: 8, dy: -8, anchor: "start" as const };
    case "bottom-left":
      return { dx: -8, dy: 16, anchor: "end" as const };
    case "bottom-right":
    default:
      return { dx: 8, dy: 16, anchor: "start" as const };
  }
}

function getStrokeDashArray(object: Extract<SceneObject, { stroke: unknown }>) {
  const style = object.stroke.lineStyle ?? "solid";
  if (style === "dashed") return "10 6";
  if (style === "dotted") return "2 6";
  return (object.stroke.dashArray ?? []).join(" ");
}

function getDoubleLineSegments(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  gap = 3,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);

  if (length < 1e-6) {
    return [
      { x1, y1, x2, y2 },
      { x1, y1, x2, y2 },
    ];
  }

  const px = (-dy / length) * gap;
  const py = (dx / length) * gap;

  return [
    { x1: x1 + px, y1: y1 + py, x2: x2 + px, y2: y2 + py },
    { x1: x1 - px, y1: y1 - py, x2: x2 - px, y2: y2 - py },
  ];
}

export function ObjectRenderer({
  object,
  allObjects,
  isSelected,
  toScreenX,
  toScreenY,
  currentXRange,
  currentYRange,
  viewHeight,
  onSelect,
  onPointerDown,
}: Props) {
  if (!object.visible) return null;

  if (object.type === "region2d") {
    const curveA = findCurve(allObjects, object.curveAId);
    const curveB = findCurve(allObjects, object.curveBId);

    if (!curveA || !curveB) return null;
    const region = resolveAutomaticRegion(object, curveA, curveB);
    if (!region) return null;

    const d = region.fill.enabled
      ? buildRegionGeometry(
          region,
          curveA,
          curveB,
          currentYRange,
          toScreenX,
          toScreenY,
        )
      : "";

    if (!d) return null;

    return (
      <g onClick={() => onSelect(object.id)} style={{ cursor: "pointer" }}>
        <path
          d={d}
          fill={rgbaToCss(region.fill.color)}
          data-region-path="true"
          stroke="none"
        />
        {region.labelText && (
          <g
            onPointerDown={(e) => {
              e.stopPropagation();
              onPointerDown(e, object.id, "region-label");
            }}
            style={{ cursor: "move" }}
          >
            <text
              x={toScreenX(region.labelX)}
              y={toScreenY(region.labelY)}
              fill={rgbaToCss(object.labelStyle.color)}
              fontSize={object.labelStyle.fontSize}
              fontFamily={object.labelStyle.fontFamily}
              textAnchor="middle"
              stroke="white"
              strokeWidth={4}
              strokeLinejoin="round"
              paintOrder="stroke fill"
            >
              {region.labelText}
            </text>
          </g>
        )}
      </g>
    );
  }

  if (object.type === "point2d") {
    const labelOffset = getLabelOffset(object.labelPosition);
    return (
      <g
        onClick={() => onSelect(object.id)}
        onPointerDown={(e) => onPointerDown(e, object.id, "move")}
        style={{ cursor: "pointer" }}
      >
        <circle
          cx={toScreenX(object.x)}
          cy={toScreenY(object.y)}
          r={object.radius}
          stroke={rgbaToCss(object.stroke.color)}
          strokeWidth={object.stroke.width}
          fill={
            object.fill.enabled ? rgbaToCss(object.stroke.color) : "#ffffff"
          }
        />
        {object.showLabel && object.label && (
          <text
            x={toScreenX(object.x) + labelOffset.dx}
            y={toScreenY(object.y) + labelOffset.dy}
            fontSize={14}
            fill="#111"
            textAnchor={labelOffset.anchor}
          >
            {object.label}
          </text>
        )}
        {isSelected && (
          <circle
            data-export-ignore="true"
            cx={toScreenX(object.x)}
            cy={toScreenY(object.y)}
            r={object.radius + 5}
            fill="none"
            stroke="#ff9800"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
      </g>
    );
  }

  if (object.type === "line2d") {
    const endpoints = lineEndpoints(object, currentXRange, currentYRange);
    if (!endpoints) return null;
    const x1 = toScreenX(endpoints.x1);
    const y1 = toScreenY(endpoints.y1);
    const x2 = toScreenX(endpoints.x2);
    const y2 = toScreenY(endpoints.y2);
    const strokeColor = rgbaToCss(object.stroke.color);
    const dashArray = getStrokeDashArray(object);
    const isDouble = (object.stroke.lineStyle ?? "solid") === "double";
    const doubleSegments = getDoubleLineSegments(x1, y1, x2, y2);

    const getMarkerUrl = (arrowType: string, isLast: boolean = true) => {
      if (!isLast || arrowType === "none") return undefined;
      if (arrowType === "open") return "url(#line-arrow-open)";
      if (arrowType === "closed") return "url(#line-arrow-closed)";
      if (arrowType === "both") return "url(#line-arrow-open)";
      return undefined;
    };

    return (
      <g
        onClick={() => onSelect(object.id)}
        onPointerDown={(e) => onPointerDown(e, object.id, "move")}
        style={{ cursor: "pointer" }}
      >
        {isDouble ? (
          <>
            {doubleSegments.map((seg, index) => (
              <line
                key={index}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={strokeColor}
                strokeWidth={object.stroke.width}
                markerStart={
                  object.arrowEnd === "both"
                    ? "url(#line-arrow-start)"
                    : undefined
                }
                markerEnd={getMarkerUrl(
                  object.arrowEnd,
                  index === doubleSegments.length - 1,
                )}
              />
            ))}
          </>
        ) : (
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={strokeColor}
            strokeWidth={object.stroke.width}
            strokeDasharray={dashArray}
            markerStart={
              object.arrowEnd === "both" ? "url(#line-arrow-start)" : undefined
            }
            markerEnd={getMarkerUrl(object.arrowEnd)}
          />
        )}

        {isSelected && (
          <g data-export-ignore="true">
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#ff9800"
              strokeWidth={object.stroke.width + 6}
              strokeOpacity={0.15}
            />

            <circle
              cx={toScreenX(object.x1)}
              cy={toScreenY(object.y1)}
              r={6}
              fill="#ffffff"
              stroke="#ff9800"
              strokeWidth={2}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPointerDown(e, object.id, "line-start");
              }}
              style={{ cursor: "grab" }}
            />

            <circle
              cx={toScreenX(object.x2)}
              cy={toScreenY(object.y2)}
              r={6}
              fill="#ffffff"
              stroke="#ff9800"
              strokeWidth={2}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPointerDown(e, object.id, "line-end");
              }}
              style={{ cursor: "grab" }}
            />
          </g>
        )}
      </g>
    );
  }

  if (object.type === "circle2d") {
    const cx = toScreenX(object.cx);
    const cy = toScreenY(object.cy);
    const rx = object.radius * Math.abs(toScreenX(1) - toScreenX(0));
    const ry = object.radius * Math.abs(toScreenY(1) - toScreenY(0));
    const handleX = toScreenX(object.cx + object.radius);
    const handleY = toScreenY(object.cy);

    return (
      <g
        onClick={() => onSelect(object.id)}
        onPointerDown={(e) => onPointerDown(e, object.id, "move")}
        style={{ cursor: "pointer" }}
      >
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={rgbaToCss(object.stroke.color)}
          strokeWidth={object.stroke.width}
          fill={object.fill.enabled ? rgbaToCss(object.fill.color) : "none"}
        />
        {object.showCenter && (
          <circle cx={cx} cy={cy} r={3} fill={rgbaToCss(object.stroke.color)} />
        )}
        {isSelected && (
          <g data-export-ignore="true">
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx + 5}
              ry={ry + 5}
              fill="none"
              stroke="#ff9800"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <circle
              cx={handleX}
              cy={handleY}
              r={6}
              fill="#ffffff"
              stroke="#ff9800"
              strokeWidth={2}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPointerDown(e, object.id, "circle-radius");
              }}
              style={{ cursor: "ew-resize" }}
            />
          </g>
        )}
      </g>
    );
  }

  if (object.type === "function2d") {
    if (!object.expression.trim()) return null;

    const isPolarExpr =
      object.expression.includes("=") &&
      object.expression.trim().split("=")[0].trim().replace(/\s+/g, "") === "r";

    if (isPolarExpr) {
      const resolvedDomain: [number, number] = object.domain ?? [
        0,
        object.angleUnit === "deg" ? 360 : Math.PI * 2,
      ];
      let d = "";

      try {
        const points = samplePolarFunctionPoints(
          object.expression,
          resolvedDomain,
          object.samples,
          object.angleUnit,
        );
        const polarD = buildFunctionPath(
          points,
          toScreenX,
          toScreenY,
          viewHeight,
        );
        d = polarD;
      } catch {
        return null;
      }

      return (
        <g onClick={() => onSelect(object.id)} style={{ cursor: "pointer" }}>
          <path
            d={d}
            fill="none"
            stroke={rgbaToCss(object.stroke.color)}
            strokeWidth={object.stroke.width}
          />
          {isSelected && d && (
            <path
              data-export-ignore="true"
              d={d}
              fill="none"
              stroke="#ff9800"
              strokeWidth={object.stroke.width + 4}
              strokeOpacity={0.2}
            />
          )}
        </g>
      );
    }

    if (isImplicitExpression(object.expression)) {
      const d = buildImplicitPath(
        object.expression,
        object.domain
          ? [
              Math.max(currentXRange[0], object.domain[0]),
              Math.min(currentXRange[1], object.domain[1]),
            ]
          : currentXRange,
        currentYRange,
        260,
        260,
        toScreenX,
        toScreenY,
        object.angleUnit,
      );

      return (
        <g onClick={() => onSelect(object.id)} style={{ cursor: "pointer" }}>
          <path
            d={d}
            fill="none"
            stroke={rgbaToCss(object.stroke.color)}
            strokeWidth={object.stroke.width}
          />
          {isSelected && d && (
            <path
              data-export-ignore="true"
              d={d}
              fill="none"
              stroke="#ff9800"
              strokeWidth={object.stroke.width + 4}
              strokeOpacity={0.2}
            />
          )}
        </g>
      );
    }

    const resolvedDomain = object.domain ?? currentXRange;
    let d = "";

    try {
      const points = sampleFunctionPoints(
        object.expression,
        resolvedDomain,
        object.samples,
        object.angleUnit,
      );

      d = buildFunctionPath(points, toScreenX, toScreenY, viewHeight);
    } catch {
      d = "";
    }

    return (
      <g onClick={() => onSelect(object.id)} style={{ cursor: "pointer" }}>
        <path
          d={d}
          fill="none"
          stroke={rgbaToCss(object.stroke.color)}
          strokeWidth={object.stroke.width}
          strokeDasharray={getStrokeDashArray(object)}
        />
        {isSelected && d && (
          <path
            data-export-ignore="true"
            d={d}
            fill="none"
            stroke="#ff9800"
            strokeWidth={object.stroke.width + 6}
            strokeOpacity={0.15}
          />
        )}
      </g>
    );
  }

  if (object.type === "text2d") {
    return (
      <g
        onClick={() => onSelect(object.id)}
        onPointerDown={(e) => onPointerDown(e, object.id, "move")}
        style={{ cursor: "move" }}
      >
        <text
          x={toScreenX(object.x)}
          y={toScreenY(object.y)}
          fill={rgbaToCss(object.textStyle.color)}
          fontSize={object.textStyle.fontSize}
          fontFamily={object.textStyle.fontFamily}
          fontWeight={object.textStyle.bold ? 700 : 400}
          fontStyle={object.textStyle.italic ? "italic" : "normal"}
        >
          {object.text}
        </text>

        {isSelected && (
          <circle
            data-export-ignore="true"
            cx={toScreenX(object.x)}
            cy={toScreenY(object.y)}
            r={6}
            fill="none"
            stroke="#ff9800"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
      </g>
    );
  }

  if (object.type === "formula2d") {
    const html = katex.renderToString(object.latex || "", {
      throwOnError: false,
      displayMode: false,
      output: "html",
      strict: "ignore",
      maxExpand: 1000,
      maxSize: 20,
    });

    const fontPx = object.textStyle.fontSize;
    const anchorX = toScreenX(object.x);
    const anchorY = toScreenY(object.y);
    const boxWidth = Math.max(240, object.latex.length * fontPx * 0.8);
    const boxHeight = fontPx * 2.4;

    return (
      <g
        onClick={() => onSelect(object.id)}
        onPointerDown={(e) => onPointerDown(e, object.id, "move")}
        style={{ cursor: "move" }}
      >
        <foreignObject
          x={anchorX}
          y={anchorY - fontPx}
          width={boxWidth}
          height={boxHeight}
          overflow="visible"
          data-export-formula="true"
          data-formula-id={object.id}
        >
          <div
            data-formula-source={object.id}
            style={{
              color: rgbaToCss(object.textStyle.color),
              lineHeight: 1.1,
              display: "inline-block",
              whiteSpace: "nowrap",
              userSelect: "none",
              background: "transparent",
              fontSize: `${fontPx}px`,
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </foreignObject>

        {isSelected && (
          <circle
            data-export-ignore="true"
            cx={anchorX}
            cy={anchorY}
            r={6}
            fill="none"
            stroke="#ff9800"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
      </g>
    );
  }

  return null;
}
