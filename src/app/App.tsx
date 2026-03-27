import { Topbar } from "../components/layout/Topbar";
import { LeftPanel } from "../components/layout/LeftPanel";
import { RightPanel } from "../components/layout/RightPanel";

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
          }}
        >
          <div
            style={{
              width: 900,
              height: 600,
              background: "#fff",
              border: "1px solid #ddd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Canvas Area
          </div>
        </main>

        <RightPanel />
      </div>
    </div>
  );
}