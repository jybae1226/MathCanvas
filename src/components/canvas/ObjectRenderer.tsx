import type { PointerEvent as ReactPointerEvent } from "react";
import katex from "katex";
import type { LabelPosition, SceneObject } from "../../types/objects";
import { rgbaToCss } from "../../types/styles";
import {
  buildFunctionPath,
  buildImplicitPath,
  buildPolygonPath,
  buildRegionPath,
  sampleFunctionPoints,
} from "../../utils/graph";

type DragTarget = "move" | "line-start" | "line-end";

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
    const curveA = allObjects.find((obj) => obj.id === object.curveAId);
    const curveB = allObjects.find((obj) => obj.id === object.curveBId);

    if (!curveA || !curveB) return null;

    const d = buildRegionPath(
      curveA,
      curveB,
      object.xStart,
      object.xEnd,
      object.samples,
      toScreenX,
      toScreenY,
    );

    if (!d) return null;

    return (
      <g onClick={() => onSelect(object.id)} style={{ cursor: "pointer" }}>
        <path
          d={d}
          fill={rgbaToCss(object.fill.color)}
          stroke={isSelected ? "#ff9800" : "none"}
          strokeWidth={isSelected ? 2 : 0}
        />
        {object.labelText && (
          <text
            x={toScreenX(object.labelX)}
            y={toScreenY(object.labelY)}
            fill={rgbaToCss(object.labelStyle.color)}
            fontSize={object.labelStyle.fontSize}
            fontFamily={object.labelStyle.fontFamily}
            textAnchor="middle"
          >
            {object.labelText}
          </text>
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
    const x1 = toScreenX(object.x1);
    const y1 = toScreenY(object.y1);
    const x2 = toScreenX(object.x2);
    const y2 = toScreenY(object.y2);

    return (
      <g
        onClick={() => onSelect(object.id)}
        onPointerDown={(e) => onPointerDown(e, object.id, "move")}
        style={{ cursor: "pointer" }}
      >
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={rgbaToCss(object.stroke.color)}
          strokeWidth={object.stroke.width}
          strokeDasharray={(object.stroke.dashArray ?? []).join(" ")}
          markerEnd={object.arrowEnd ? "url(#line-arrow)" : undefined}
        />

        {isSelected && (
          <>
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
              cx={x1}
              cy={y1}
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
              cx={x2}
              cy={y2}
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
          </>
        )}
      </g>
    );
  }

  if (object.type === "circle2d") {
    const rPx = object.radius * Math.abs(toScreenX(1) - toScreenX(0));
    return (
      <g
        onClick={() => onSelect(object.id)}
        onPointerDown={(e) => onPointerDown(e, object.id, "move")}
        style={{ cursor: "pointer" }}
      >
        <circle
          cx={toScreenX(object.cx)}
          cy={toScreenY(object.cy)}
          r={rPx}
          stroke={rgbaToCss(object.stroke.color)}
          strokeWidth={object.stroke.width}
          fill={object.fill.enabled ? rgbaToCss(object.fill.color) : "none"}
        />
        {object.showCenter && (
          <circle
            cx={toScreenX(object.cx)}
            cy={toScreenY(object.cy)}
            r={3}
            fill={rgbaToCss(object.stroke.color)}
          />
        )}
        {isSelected && (
          <circle
            cx={toScreenX(object.cx)}
            cy={toScreenY(object.cy)}
            r={rPx + 5}
            fill="none"
            stroke="#ff9800"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
      </g>
    );
  }

  if (object.type === "polygon2d") {
    const d = buildPolygonPath(object, toScreenX, toScreenY);

    return (
      <g
        onClick={() => onSelect(object.id)}
        onPointerDown={(e) => onPointerDown(e, object.id, "move")}
        style={{ cursor: "pointer" }}
      >
        <path
          d={d}
          stroke={rgbaToCss(object.stroke.color)}
          strokeWidth={object.stroke.width}
          fill={object.fill.enabled ? rgbaToCss(object.fill.color) : "none"}
        />
        {isSelected && (
          <path
            d={d}
            stroke="#ff9800"
            strokeWidth={object.stroke.width + 3}
            fill="none"
            strokeOpacity={0.35}
          />
        )}
      </g>
    );
  }

  if (object.type === "function2d") {
    if (object.expression.includes("=")) {
      const d = buildImplicitPath(
        object.expression,
        currentXRange,
        currentYRange,
        120,
        120,
        toScreenX,
        toScreenY,
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
          strokeDasharray={(object.stroke.dashArray ?? []).join(" ")}
        />
        {isSelected && d && (
          <path
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
    const html = katex.renderToString(object.latex, {
      throwOnError: false,
      displayMode: false,
      output: "html",
    });

    const fontPx = object.textStyle.fontSize;
    const anchorX = toScreenX(object.x);
    const anchorY = toScreenY(object.y);

    return (
      <g
        onClick={() => onSelect(object.id)}
        onPointerDown={(e) => onPointerDown(e, object.id, "move")}
        style={{ cursor: "move" }}
      >
        <foreignObject
          x={anchorX}
          y={anchorY - fontPx}
          width={320}
          height={fontPx * 2.2}
          overflow="visible"
        >
          <div
            style={{
              color: rgbaToCss(object.textStyle.color),
              fontSize: `${fontPx}px`,
              lineHeight: 1.1,
              display: "inline-block",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </foreignObject>

        {isSelected && (
          <circle
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