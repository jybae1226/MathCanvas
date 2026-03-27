import type { PointerEvent as ReactPointerEvent } from "react";
import katex from "katex";
import type { SceneObject } from "../../types/objects";
import { rgbaToCss } from "../../types/styles";
import { buildFunctionPath, sampleFunctionPoints } from "../../utils/graph";

type DragTarget = "move" | "line-start" | "line-end";

type Props = {
  object: SceneObject;
  isSelected: boolean;
  toScreenX: (x: number) => number;
  toScreenY: (y: number) => number;
  currentXRange: [number, number];
  viewHeight: number;
  onSelect: (id: string) => void;
  onPointerDown: (
    event: ReactPointerEvent<SVGGElement>,
    id: string,
    target: DragTarget,
  ) => void;
};

export function ObjectRenderer({
  object,
  isSelected,
  toScreenX,
  toScreenY,
  currentXRange,
  viewHeight,
  onSelect,
  onPointerDown,
}: Props) {
  if (!object.visible) return null;

  if (object.type === "point2d") {
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
          fill={object.fill.enabled ? rgbaToCss(object.fill.color) : "none"}
        />
        {object.label && (
          <text
            x={toScreenX(object.x) + 8}
            y={toScreenY(object.y) - 8}
            fontSize={14}
            fill="#111"
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

  if (object.type === "function2d") {
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
            xmlns="http://www.w3.org/1999/xhtml"
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