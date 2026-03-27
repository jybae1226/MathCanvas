import { useMemo, useRef } from "react";
import { useProjectStore } from "../../store/projectStore";
import { ObjectRenderer } from "./ObjectRenderer";

export function Canvas2D() {
  const scene = useProjectStore((s) => s.scene);
  const objects = useProjectStore((s) => s.objects);
  const selectedObjectId = useProjectStore((s) => s.selectedObjectId);
  const selectObject = useProjectStore((s) => s.selectObject);
  const moveObjectBy = useProjectStore((s) => s.moveObjectBy);

  const dragRef = useRef<{
    objectId: string | null;
    lastClientX: number;
    lastClientY: number;
  }>({
    objectId: null,
    lastClientX: 0,
    lastClientY: 0,
  });

  const { width, height, xRange, yRange, showAxes, showGrid } = scene;

  const toScreenX = (x: number) =>
    ((x - xRange[0]) / (xRange[1] - xRange[0])) * width;

  const toScreenY = (y: number) =>
    height - ((y - yRange[0]) / (yRange[1] - yRange[0])) * height;

  const screenDxToWorld = (dxPixels: number) =>
    (dxPixels / width) * (xRange[1] - xRange[0]);

  const screenDyToWorld = (dyPixels: number) =>
    -(dyPixels / height) * (yRange[1] - yRange[0]);

  const verticalGrid = useMemo(() => {
    const lines = [];
    for (let x = Math.ceil(xRange[0]); x <= Math.floor(xRange[1]); x += 1) {
      lines.push(
        <line
          key={`vx-${x}`}
          x1={toScreenX(x)}
          y1={0}
          x2={toScreenX(x)}
          y2={height}
          stroke="#e9e9e9"
          strokeWidth={1}
        />,
      );
    }
    return lines;
  }, [height, width, xRange]);

  const horizontalGrid = useMemo(() => {
    const lines = [];
    for (let y = Math.ceil(yRange[0]); y <= Math.floor(yRange[1]); y += 1) {
      lines.push(
        <line
          key={`hy-${y}`}
          x1={0}
          y1={toScreenY(y)}
          x2={width}
          y2={toScreenY(y)}
          stroke="#e9e9e9"
          strokeWidth={1}
        />,
      );
    }
    return lines;
  }, [height, width, yRange]);

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
        }}
        onPointerLeave={() => {
          dragRef.current.objectId = null;
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
            <line
              x1={0}
              y1={toScreenY(0)}
              x2={width}
              y2={toScreenY(0)}
              stroke="#666"
              strokeWidth={1.5}
            />
            <line
              x1={toScreenX(0)}
              y1={0}
              x2={toScreenX(0)}
              y2={height}
              stroke="#666"
              strokeWidth={1.5}
            />
          </>
        )}

        {objects.map((object) => (
          <ObjectRenderer
            key={object.id}
            object={object}
            isSelected={selectedObjectId === object.id}
            toScreenX={toScreenX}
            toScreenY={toScreenY}
            onSelect={selectObject}
            onPointerDown={(e, id) => {
              e.stopPropagation();
              dragRef.current.objectId = id;
              dragRef.current.lastClientX = e.clientX;
              dragRef.current.lastClientY = e.clientY;
              selectObject(id);
            }}
          />
        ))}
      </svg>
    </div>
  );
}