import type { SceneObject } from "../../types/objects";
import { rgbaToCss } from "../../types/styles";
import { sampleFunctionPoints } from "../../utils/graph";

type Props = {
  object: SceneObject;
  isSelected: boolean;
  toScreenX: (x: number) => number;
  toScreenY: (y: number) => number;
  onSelect: (id: string) => void;
};

export function ObjectRenderer({
  object,
  isSelected,
  toScreenX,
  toScreenY,
  onSelect,
}: Props) {
  if (!object.visible) return null;

  if (object.type === "point2d") {
    return (
      <g onClick={() => onSelect(object.id)} style={{ cursor: "pointer" }}>
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
    return (
      <g onClick={() => onSelect(object.id)} style={{ cursor: "pointer" }}>
        <line
          x1={toScreenX(object.x1)}
          y1={toScreenY(object.y1)}
          x2={toScreenX(object.x2)}
          y2={toScreenY(object.y2)}
          stroke={rgbaToCss(object.stroke.color)}
          strokeWidth={object.stroke.width}
          strokeDasharray={(object.stroke.dashArray ?? []).join(" ")}
        />
        {isSelected && (
          <line
            x1={toScreenX(object.x1)}
            y1={toScreenY(object.y1)}
            x2={toScreenX(object.x2)}
            y2={toScreenY(object.y2)}
            stroke="#ff9800"
            strokeWidth={object.stroke.width + 6}
            strokeOpacity={0.15}
          />
        )}
      </g>
    );
  }

  if (object.type === "function2d") {
    let d = "";

    try {
      const points = sampleFunctionPoints(
        object.expression,
        object.domain,
        object.samples,
      );

      d = points
        .map((p, index) => {
          const x = toScreenX(p.x);
          const y = toScreenY(p.y);
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
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

  return null;
}