import { useMemo, useRef } from "react";
import { useProjectStore } from "../../store/projectStore";
import { ObjectRenderer } from "./ObjectRenderer";

function makeTicks(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(step) || step <= 0) return [];

  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;

  for (let value = start; value <= max + 1e-9; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }

  return ticks;
}

function getStepDecimals(step: number): number {
  const text = step.toString();
  if (!text.includes(".")) return 0;
  return text.split(".")[1].length;
}

function formatTick(value: number, step: number): string {
  const decimals = Math.min(6, getStepDecimals(step));
  const rounded = Number(value.toFixed(decimals));
  return rounded.toString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function Canvas2D() {
  const scene = useProjectStore((s) => s.scene);
  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const selectObject = useProjectStore((s) => s.selectObject);
  const moveObjectBy = useProjectStore((s) => s.moveObjectBy);
  const beginInteractionHistory = useProjectStore(
    (s) => s.beginInteractionHistory,
  );
  const endInteractionHistory = useProjectStore((s) => s.endInteractionHistory);
  const activeTool = useProjectStore((s) => s.activeTool);
  const lineDraftStart = useProjectStore((s) => s.lineDraftStart);
  const handleCanvasWorldClick = useProjectStore((s) => s.handleCanvasWorldClick);

  const dragRef = useRef<{
    objectId: string | null;
    lastClientX: number;
    lastClientY: number;
  }>({
    objectId: null,
    lastClientX: 0,
    lastClientY: 0,
  });

  const {
    width,
    height,
    xRange,
    yRange,
    xTickStep,
    yTickStep,
    showAxes,
    showGrid,
  } = scene;

  const xSpan = xRange[1] - xRange[0];
  const ySpan = yRange[1] - yRange[0];

  const uniformScale = Math.min(width / xSpan, height / ySpan);
  const usedWidth = xSpan * uniformScale;
  const usedHeight = ySpan * uniformScale;
  const offsetX = (width - usedWidth) / 2;
  const offsetY = (height - usedHeight) / 2;

  const toScreenX = (x: number) => offsetX + (x - xRange[0]) * uniformScale;

  const toScreenY = (y: number) =>
    offsetY + usedHeight - (y - yRange[0]) * uniformScale;

  const toWorldXFromSvg = (sx: number) => xRange[0] + (sx - offsetX) / uniformScale;

  const toWorldYFromSvg = (sy: number) =>
    yRange[0] + (usedHeight - (sy - offsetY)) / uniformScale;

  const screenDxToWorld = (dxPixels: number) => dxPixels / uniformScale;
  const screenDyToWorld = (dyPixels: number) => -dyPixels / uniformScale;

  const xTicks = useMemo(
    () => makeTicks(xRange[0], xRange[1], xTickStep),
    [xRange, xTickStep],
  );
  const yTicks = useMemo(
    () => makeTicks(yRange[0], yRange[1], yTickStep),
    [yRange, yTickStep],
  );

  const verticalGrid = useMemo(() => {
    return xTicks.map((x) => (
      <line
        key={`vx-${x}`}
        x1={toScreenX(x)}
        y1={offsetY}
        x2={toScreenX(x)}
        y2={offsetY + usedHeight}
        stroke="#e9e9e9"
        strokeWidth={1}
      />
    ));
  }, [xTicks, offsetY, usedHeight]);

  const horizontalGrid = useMemo(() => {
    return yTicks.map((y) => (
      <line
        key={`hy-${y}`}
        x1={offsetX}
        y1={toScreenY(y)}
        x2={offsetX + usedWidth}
        y2={toScreenY(y)}
        stroke="#e9e9e9"
        strokeWidth={1}
      />
    ));
  }, [yTicks, offsetX, usedWidth]);

  const axisY = toScreenY(0);
  const axisX = toScreenX(0);

  const xLabelY = clamp(axisY + 18, 14, height - 4);
  const yLabelX = clamp(axisX - 8, 12, width - 8);

  const xLabelEvery = Math.max(1, Math.ceil(xTicks.length / 18));
  const yLabelEvery = Math.max(1, Math.ceil(yTicks.length / 18));

  const xLabels = xTicks
    .filter((value, index) => index % xLabelEvery === 0)
    .map((x) => (
      <text
        key={`xl-${x}`}
        x={toScreenX(x)}
        y={xLabelY}
        fontSize={12}
        fill="#555"
        textAnchor="middle"
      >
        {formatTick(x, xTickStep)}
      </text>
    ));

  const yLabels = yTicks
    .filter((value, index) => index % yLabelEvery === 0)
    .map((y) => (
      <text
        key={`yl-${y}`}
        x={yLabelX}
        y={toScreenY(y) + 4}
        fontSize={12}
        fill="#555"
        textAnchor="end"
      >
        {formatTick(y, yTickStep)}
      </text>
    ));

  return (
    <div className="canvas-wrap">
      <svg
        id="math-diagram-svg"
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="canvas-svg"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const wx = toWorldXFromSvg(sx);
          const wy = toWorldYFromSvg(sy);

          if (activeTool === "line") {
            handleCanvasWorldClick(wx, wy);
            return;
          }

          if (e.target === e.currentTarget) {
            selectObject(null);
          }
        }}
        onPointerMove={(e) => {
          const currentId = dragRef.current.objectId;
          if (!currentId) return;

          const dxPixels = e.clientX - dragRef.current.lastClientX;
          const dyPixels = e.clientY - dragRef.current.lastClientY;

          dragRef.current.lastClientX = e.clientX;
          dragRef.current.lastClientY = e.clientY;

          moveObjectBy(
            currentId,
            screenDxToWorld(dxPixels),
            screenDyToWorld(dyPixels),
          );
        }}
        onPointerUp={() => {
          dragRef.current.objectId = null;
          endInteractionHistory();
        }}
        onPointerLeave={() => {
          dragRef.current.objectId = null;
          endInteractionHistory();
        }}
      >
        <rect x={0} y={0} width={width} height={height} fill="white" />

        {showGrid && (
          <>
            {verticalGrid}
            {horizontalGrid}
          </>
        )}

        {showAxes && (
          <>
            {axisY >= offsetY && axisY <= offsetY + usedHeight && (
              <line
                x1={offsetX}
                y1={axisY}
                x2={offsetX + usedWidth}
                y2={axisY}
                stroke="#666"
                strokeWidth={1.5}
              />
            )}

            {axisX >= offsetX && axisX <= offsetX + usedWidth && (
              <line
                x1={axisX}
                y1={offsetY}
                x2={axisX}
                y2={offsetY + usedHeight}
                stroke="#666"
                strokeWidth={1.5}
              />
            )}
          </>
        )}

        {showAxes && (
          <>
            {xLabels}
            {yLabels}
          </>
        )}

        {lineDraftStart && (
          <circle
            cx={toScreenX(lineDraftStart.x)}
            cy={toScreenY(lineDraftStart.y)}
            r={5}
            fill="#ff9800"
            stroke="#ff9800"
            strokeWidth={1}
          />
        )}

        {objects.map((object) => (
          <ObjectRenderer
            key={object.id}
            object={object}
            isSelected={selectedObjectId === object.id}
            toScreenX={toScreenX}
            toScreenY={toScreenY}
            currentXRange={xRange}
            viewHeight={height}
            onSelect={selectObject}
            onPointerDown={(e, id) => {
              if (activeTool !== "select") return;

              e.stopPropagation();
              dragRef.current.objectId = id;
              dragRef.current.lastClientX = e.clientX;
              dragRef.current.lastClientY = e.clientY;
              beginInteractionHistory();
              selectObject(id);
            }}
          />
        ))}
      </svg>
    </div>
  );
}