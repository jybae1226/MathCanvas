const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  protocol,
  net,
  session,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "mathcanvas",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
const APP_URL = "mathcanvas://app/index.html";
let mainWindow;
if (process.env.MATHCANVAS_TEST_DATA)
  app.setPath("userData", process.env.MATHCANVAS_TEST_DATA);

function checkSender(event) {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame?.url !== APP_URL
  )
    throw new Error("허용되지 않은 요청입니다.");
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    title: "MathCanvas",
    backgroundColor: "#eef2f7",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== APP_URL) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => {
    if (!process.env.MATHCANVAS_SMOKE) mainWindow.show();
  });
  await mainWindow.loadURL(APP_URL);
}

app
  .whenReady()
  .then(async () => {
    const root = path.join(app.getAppPath(), "dist");
    protocol.handle("mathcanvas", (request) => {
      const url = new URL(request.url);
      const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (
        url.host !== "app" ||
        !file.startsWith(root + path.sep) ||
        request.method !== "GET"
      )
        return new Response("Forbidden", { status: 403 });
      return net.fetch(pathToFileURL(file).href);
    });
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
          ],
        },
      }),
    );

    ipcMain.handle("project:open", async (event) => {
      checkSender(event);
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "수업 파일 열기",
        properties: ["openFile"],
        filters: [
          { name: "MathCanvas 수업", extensions: ["mathcanvas", "json"] },
        ],
      });
      if (result.canceled) return null;
      const file = result.filePaths[0];
      if ((await fs.stat(file)).size > 10 * 1024 * 1024)
        throw new Error("파일은 10MB 이하여야 합니다.");
      return {
        name: path.basename(file),
        content: await fs.readFile(file, "utf8"),
      };
    });
    ipcMain.handle("file:save", async (event, payload) => {
      checkSender(event);
      const formats = {
        project: ["mathcanvas", "MathCanvas 수업"],
        svg: ["svg", "SVG 그림"],
        png: ["png", "PNG 그림"],
      };
      if (
        !payload ||
        !Object.hasOwn(formats, payload.kind) ||
        typeof payload.content !== "string" ||
        payload.content.length > 100 * 1024 * 1024
      )
        throw new Error("저장 요청이 올바르지 않습니다.");
      const [ext, name] = formats[payload.kind];
      let data = payload.content;
      if (payload.kind === "png") {
        if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data))
          throw new Error("PNG 형식이 올바르지 않습니다.");
        data = Buffer.from(data.split(",")[1], "base64");
      }
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "파일 저장",
        defaultPath: `수학 수업.${ext}`,
        filters: [{ name, extensions: [ext] }],
      });
      if (result.canceled || !result.filePath) return false;
      await fs.writeFile(result.filePath, data);
      return true;
    });
    const template = [
      ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
      {
        label: "편집",
        submenu: [
          { role: "cut", label: "잘라내기" },
          { role: "copy", label: "복사" },
          { role: "paste", label: "붙여넣기" },
          { role: "selectAll", label: "모두 선택" },
        ],
      },
      {
        label: "보기",
        submenu: [
          { role: "togglefullscreen", label: "전체 화면" },
          ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
        ],
      },
      {
        label: "창",
        submenu: [
          { role: "minimize", label: "최소화" },
          { role: "close", label: "닫기" },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    await createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  })
  .catch((error) => {
    dialog.showErrorBox("MathCanvas 실행 오류", error.message);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
