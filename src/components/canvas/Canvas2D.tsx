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

function snapValue(value: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}

type DragMode =
  | null
  | "move"
  | "line-start"
  | "line-end"
  | "circle-radius"
  | "region-label"
  | "pan";

export function Canvas2D() {
  const scene = useProjectStore((s) => s.scene);
  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const selectObject = useProjectStore((s) => s.selectObject);
  const moveObjectBy = useProjectStore((s) => s.moveObjectBy);
  const moveLineEndpointBy = useProjectStore((s) => s.moveLineEndpointBy);
  const moveCircleRadiusBy = useProjectStore((s) => s.moveCircleRadiusBy);
  const moveRegionLabelBy = useProjectStore((s) => s.moveRegionLabelBy);
  const beginInteractionHistory = useProjectStore(
    (s) => s.beginInteractionHistory,
  );
  const endInteractionHistory = useProjectStore((s) => s.endInteractionHistory);
  const activeTool = useProjectStore((s) => s.activeTool);
  const lineDraftStart = useProjectStore((s) => s.lineDraftStart);
  const handleCanvasWorldClick = useProjectStore((s) => s.handleCanvasWorldClick);
  const updateSceneDirect = useProjectStore((s) => s.updateSceneDirect);
  const coordinateProbe = useProjectStore((s) => s.coordinateProbe);

  const dragRef = useRef<{
    objectId: string | null;
    mode: DragMode;
    lastClientX: number;
    lastClientY: number;
    meta?: number;
  }>({
    objectId: null,
    mode: null,
    lastClientX: 0,
    lastClientY: 0,
    meta: undefined,
  });

  const {
    width,
    height,
    captionHeight,
    captionText,
    captionFontSize,
    captionColor,
    xRange,
    yRange,
    xTickStep,
    yTickStep,
    showAxes,
    showGrid,
    snapToGrid,
  } = scene;

  const totalHeight = height + captionHeight;

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
    .filter((_, index) => index % xLabelEvery === 0)
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
    .filter((_, index) => index % yLabelEvery === 0)
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

  const regionObjects = objects.filter((obj) => obj.type === "region2d");
  const otherObjects = objects.filter((obj) => obj.type !== "region2d");

  return (
    <div className="canvas-wrap">
      <svg
        id="math-diagram-svg"
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={totalHeight}
        viewBox={`0 0 ${width} ${totalHeight}`}
        className="canvas-svg"
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const isBackground = target.dataset.role === "background";

          const rect = e.currentTarget.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;

          if (sy > height) {
            if (isBackground) {
              selectObject(null);
            }
            return;
          }

          let wx = toWorldXFromSvg(sx);
          let wy = toWorldYFromSvg(sy);

          if (snapToGrid) {
            wx = snapValue(wx, xTickStep);
            wy = snapValue(wy, yTickStep);
          }

          if (
            (activeTool === "line" || activeTool === "coordinate") &&
            isBackground
          ) {
            handleCanvasWorldClick(wx, wy);
            return;
          }

          if (isBackground) {
            selectObject(null);
          }
        }}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          const isBackground = target.dataset.role === "background";

          if (!isBackground) return;
          if (e.clientY - e.currentTarget.getBoundingClientRect().top > height) return;

          if (activeTool === "select") {
            beginInteractionHistory();
            dragRef.current.mode = "pan";
            dragRef.current.objectId = null;
            dragRef.current.lastClientX = e.clientX;
            dragRef.current.lastClientY = e.clientY;
            dragRef.current.meta = undefined;
          }
        }}
        onPointerMove={(e) => {
          const mode = dragRef.current.mode;
          if (!mode) return;

          const dxPixels = e.clientX - dragRef.current.lastClientX;
          const dyPixels = e.clientY - dragRef.current.lastClientY;

          dragRef.current.lastClientX = e.clientX;
          dragRef.current.lastClientY = e.clientY;

          let dx = screenDxToWorld(dxPixels);
          let dy = screenDyToWorld(dyPixels);

          if (snapToGrid && mode !== "pan" && mode !== "circle-radius") {
            dx = snapValue(dx, xTickStep);
            dy = snapValue(dy, yTickStep);
            if (dx === 0 && dy === 0) return;
          }

          if (mode === "pan") {
            updateSceneDirect({
              xRange: [xRange[0] - dx, xRange[1] - dx],
              yRange: [yRange[0] - dy, yRange[1] - dy],
            });
            return;
          }

          const currentId = dragRef.current.objectId;
          if (!currentId) return;

          if (mode === "move") {
            moveObjectBy(currentId, dx, dy);
            return;
          }

          if (mode === "line-start") {
            moveLineEndpointBy(currentId, "start", dx, dy);
            return;
          }

          if (mode === "line-end") {
            moveLineEndpointBy(currentId, "end", dx, dy);
            return;
          }

          if (mode === "circle-radius") {
            moveCircleRadiusBy(currentId, dx, dy);
            return;
          }

          if (mode === "region-label") {
            moveRegionLabelBy(currentId, dx, dy);
          }
        }}
        onPointerUp={() => {
          dragRef.current.objectId = null;
          dragRef.current.mode = null;
          dragRef.current.meta = undefined;
          endInteractionHistory();
        }}
        onPointerLeave={() => {
          dragRef.current.objectId = null;
          dragRef.current.mode = null;
          dragRef.current.meta = undefined;
          endInteractionHistory();
        }}
        onWheel={(e) => {
          e.preventDefault();

          const rect = e.currentTarget.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          if (sy > height) return;

          const wx = toWorldXFromSvg(sx);
          const wy = toWorldYFromSvg(sy);

          const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;

          const nextXMin = wx - (wx - xRange[0]) * zoomFactor;
          const nextXMax = wx + (xRange[1] - wx) * zoomFactor;
          const nextYMin = wy - (wy - yRange[0]) * zoomFactor;
          const nextYMax = wy + (yRange[1] - wy) * zoomFactor;

          updateSceneDirect({
            xRange: [nextXMin, nextXMax],
            yRange: [nextYMin, nextYMax],
          });
        }}
      >
        <defs>
          <marker
            id="line-arrow-open"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M 1 1 L 8 5 L 1 9"
              fill="none"
              stroke="context-stroke"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>

          <marker
            id="axis-arrow-open"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M 1 1 L 8 5 L 1 9"
              fill="none"
              stroke="#666"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>

        <rect
          data-role="background"
          x={0}
          y={0}
          width={width}
          height={height}
          fill="white"
        />

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
                markerEnd="url(#axis-arrow-open)"
              />
            )}

            {axisX >= offsetX && axisX <= offsetX + usedWidth && (
              <line
                x1={axisX}
                y1={offsetY + usedHeight}
                x2={axisX}
                y2={offsetY}
                stroke="#666"
                strokeWidth={1.5}
                markerEnd="url(#axis-arrow-open)"
              />
            )}

            {axisY >= offsetY && axisY <= offsetY + usedHeight && (
              <text
                x={offsetX + usedWidth - 12}
                y={axisY - 8}
                fontSize={14}
                fill="#444"
                textAnchor="end"
              >
                x
              </text>
            )}

            {axisX >= offsetX && axisX <= offsetX + usedWidth && (
              <text
                x={axisX + 10}
                y={offsetY + 16}
                fontSize={14}
                fill="#444"
              >
                y
              </text>
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

        {coordinateProbe && (
          <g>
            <circle
              cx={toScreenX(coordinateProbe.x)}
              cy={toScreenY(coordinateProbe.y)}
              r={5}
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <text
              x={toScreenX(coordinateProbe.x) + 8}
              y={toScreenY(coordinateProbe.y) - 8}
              fontSize={12}
              fill="#1d4ed8"
            >
              ({coordinateProbe.x.toFixed(3)}, {coordinateProbe.y.toFixed(3)})
            </text>
          </g>
        )}

        {regionObjects.map((object) => (
          <ObjectRenderer
            key={object.id}
            object={object}
            allObjects={objects}
            isSelected={selectedObjectId === object.id}
            toScreenX={toScreenX}
            toScreenY={toScreenY}
            currentXRange={xRange}
            currentYRange={yRange}
            viewHeight={height}
            onSelect={selectObject}
            onPointerDown={(e, id, target, meta) => {
              if (activeTool !== "select") return;
              e.stopPropagation();
              beginInteractionHistory();
              dragRef.current.objectId = id;
              dragRef.current.mode = target;
              dragRef.current.lastClientX = e.clientX;
              dragRef.current.lastClientY = e.clientY;
              dragRef.current.meta = meta;
              selectObject(id);
            }}
          />
        ))}

        {otherObjects.map((object) => (
          <ObjectRenderer
            key={object.id}
            object={object}
            allObjects={objects}
            isSelected={selectedObjectId === object.id}
            toScreenX={toScreenX}
            toScreenY={toScreenY}
            currentXRange={xRange}
            currentYRange={yRange}
            viewHeight={height}
            onSelect={selectObject}
            onPointerDown={(e, id, target, meta) => {
              if (activeTool !== "select") return;
              e.stopPropagation();
              beginInteractionHistory();
              dragRef.current.objectId = id;
              dragRef.current.mode = target;
              dragRef.current.lastClientX = e.clientX;
              dragRef.current.lastClientY = e.clientY;
              dragRef.current.meta = meta;
              selectObject(id);
            }}
          />
        ))}

        <rect
          data-role="background"
          x={0}
          y={height}
          width={width}
          height={captionHeight}
          fill="#ffffff"
          stroke="#e5e7eb"
        />

        {captionText && (
          <text
            x={width / 2}
            y={height + captionHeight / 2 + captionFontSize / 3}
            fontSize={captionFontSize}
            fill={captionColor}
            textAnchor="middle"
          >
            {captionText}
          </text>
        )}
      </svg>
    </div>
  );
}