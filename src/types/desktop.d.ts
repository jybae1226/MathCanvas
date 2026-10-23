export {};
declare global {
  interface Window {
    mathCanvas?: {
      openProject: () => Promise<{ name: string; content: string } | null>;
      saveFile: (
        kind: "project" | "svg" | "png",
        content: string,
      ) => Promise<boolean>;
    };
  }
}
