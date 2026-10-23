import { useEffect, useMemo, useRef } from "react";
import { useProjectStore } from "../../store/projectStore";
import { ObjectRenderer } from "./ObjectRenderer";
import { makeTicks } from "../../utils/scene";
import katex from "katex";

const axisLabels = {
  x: katex.renderToString("x", { output: "html" }),
  y: katex.renderToString("y", { output: "html" }),
};
const formatTick = (value: number): string =>
  Number(value.toPrecision(8)).toString();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  const handleCanvasWorldClick = useProjectStore(
    (s) => s.handleCanvasWorldClick,
  );
  const updateSceneDirect = useProjectStore((s) => s.updateSceneDirect);
  const coordinateProbe = useProjectStore((s) => s.coordinateProbe);

  const svgRef = useRef<SVGSVGElement>(null);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    const preventScroll = (event: WheelEvent) => event.preventDefault();
    svg?.addEventListener("wheel", preventScroll, { passive: false });
    return () => {
      svg?.removeEventListener("wheel", preventScroll);
      if (zoomTimer.current) clearTimeout(zoomTimer.current);
      endInteractionHistory();
    };
  }, [endInteractionHistory]);

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

  const toWorldXFromSvg = (sx: number) =>
    xRange[0] + (sx - offsetX) / uniformScale;

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

  const verticalGrid = xTicks.map((x) => (
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

  const horizontalGrid = yTicks.map((y) => (
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
        {formatTick(x)}
      </text>
    ));

  const yLabels = yTicks
    .filter((y, index) => Math.abs(y) > 1e-10 && index % yLabelEvery === 0)
    .map((y) => (
      <text
        key={`yl-${y}`}
        x={yLabelX}
        y={clamp(toScreenY(y) + 4, 14, height - 4)}
        fontSize={12}
        fill="#555"
        textAnchor="end"
      >
        {formatTick(y)}
      </text>
    ));

  const regionObjects = objects.filter((obj) => obj.type === "region2d");
  const otherObjects = objects.filter((obj) => obj.type !== "region2d");

  return (
    <div className="canvas-wrap" style={{ width, maxWidth: "100%" }}>
      <svg
        ref={svgRef}
        id="math-diagram-svg"
        role="img"
        aria-label="수학 그래프 캔버스"
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
          const sx = ((e.clientX - rect.left) * width) / rect.width;
          const sy = ((e.clientY - rect.top) * totalHeight) / rect.height;

          if (sy > height) {
            if (isBackground) {
              selectObject(null);
            }
            return;
          }

          const wx = toWorldXFromSvg(sx);
          const wy = toWorldYFromSvg(sy);

          if (activeTool === "line" || activeTool === "coordinate") {
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
          const rect = e.currentTarget.getBoundingClientRect();
          if (((e.clientY - rect.top) * totalHeight) / rect.height > height)
            return;

          if (activeTool === "select" && e.button === 0) {
            e.currentTarget.setPointerCapture(e.pointerId);
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

          const rect = e.currentTarget.getBoundingClientRect();
          const dxPixels =
            ((e.clientX - dragRef.current.lastClientX) * width) / rect.width;
          const dyPixels =
            ((e.clientY - dragRef.current.lastClientY) * totalHeight) /
            rect.height;

          dragRef.current.lastClientX = e.clientX;
          dragRef.current.lastClientY = e.clientY;

          const dx = screenDxToWorld(dxPixels);
          const dy = screenDyToWorld(dyPixels);

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
        onPointerCancel={() => {
          dragRef.current.objectId = null;
          dragRef.current.mode = null;
          dragRef.current.meta = undefined;
          endInteractionHistory();
        }}
        onWheel={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const sx = ((e.clientX - rect.left) * width) / rect.width;
          const sy = ((e.clientY - rect.top) * totalHeight) / rect.height;
          if (sy > height) return;

          const wx = toWorldXFromSvg(sx);
          const wy = toWorldYFromSvg(sy);

          if (e.deltaY === 0) return;
          beginInteractionHistory();
          if (zoomTimer.current) clearTimeout(zoomTimer.current);
          zoomTimer.current = setTimeout(endInteractionHistory, 180);
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
            id="line-arrow-start"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path
              d="M 1 1 L 8 5 L 1 9"
              fill="none"
              stroke="context-stroke"
              strokeWidth="1.5"
            />
          </marker>
          <clipPath id="plot-clip">
            <rect
              x={offsetX}
              y={offsetY}
              width={usedWidth}
              height={usedHeight}
            />
          </clipPath>
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
            id="line-arrow-closed"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M 1 1 L 8 5 L 1 9 Z"
              fill="context-stroke"
              stroke="context-stroke"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>

          <marker
            id="line-arrow-both"
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
            <path
              d="M 15 1 L 8 5 L 15 9"
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
            <g pointerEvents="none">
              {verticalGrid}
              {horizontalGrid}
            </g>
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
                pointerEvents="none"
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
                pointerEvents="none"
              />
            )}

            <g pointerEvents="none">
              {axisY >= offsetY && axisY <= offsetY + usedHeight && (
                <foreignObject
                  x={offsetX + usedWidth - 20}
                  y={clamp(axisY - 27, 0, height - 25)}
                  width={24}
                  height={24}
                >
                  <div
                    style={{
                      display: "inline-block",
                      fontSize: 15,
                      color: "#475569",
                    }}
                    dangerouslySetInnerHTML={{ __html: axisLabels.x }}
                  />
                </foreignObject>
              )}
              {axisX >= offsetX && axisX <= offsetX + usedWidth && (
                <foreignObject
                  x={clamp(axisX + 8, 0, width - 25)}
                  y={offsetY + 5}
                  width={24}
                  height={24}
                >
                  <div
                    style={{
                      display: "inline-block",
                      fontSize: 15,
                      color: "#475569",
                    }}
                    dangerouslySetInnerHTML={{ __html: axisLabels.y }}
                  />
                </foreignObject>
              )}
            </g>
          </>
        )}

        {showAxes && (
          <>
            <g pointerEvents="none">
              {xLabels}
              {yLabels}
            </g>
          </>
        )}

        {lineDraftStart && (
          <circle
            data-export-ignore="true"
            cx={toScreenX(lineDraftStart.x)}
            cy={toScreenY(lineDraftStart.y)}
            r={5}
            fill="#ff9800"
            stroke="#ff9800"
            strokeWidth={1}
          />
        )}

        {coordinateProbe && (
          <g data-export-ignore="true">
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

        <g clipPath="url(#plot-clip)">
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
                if (activeTool !== "select" || object.locked || e.button !== 0)
                  return;
                svgRef.current?.setPointerCapture(e.pointerId);
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
                if (activeTool !== "select" || object.locked || e.button !== 0)
                  return;
                svgRef.current?.setPointerCapture(e.pointerId);
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
        </g>
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
