import { Topbar } from "../components/layout/Topbar";
import { LeftPanel } from "../components/layout/LeftPanel";
import { RightPanel } from "../components/layout/RightPanel";
import { Canvas2D } from "../components/canvas/Canvas2D";

export default function App() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f3f4f6",
      }}
    >
      <Topbar />

      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
        }}
      >
        <LeftPanel />

        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            overflow: "auto",
          }}
        >
          <Canvas2D />
        </main>

        <RightPanel />
      </div>
    </div>
  );
} 