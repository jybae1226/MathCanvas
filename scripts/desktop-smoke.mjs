import { _electron as electron, expect as baseExpect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const artifacts = path.resolve("artifacts");
const version = JSON.parse(await fs.readFile("package.json", "utf8")).version;
const expect = baseExpect.configure({ timeout: 15000 });
await fs.mkdir(artifacts, { recursive: true });
for (const name of ["desktop-smoke-result.json", "transparent.png"])
  await fs.rm(path.join(artifacts, name), { force: true });
const testData = await fs.mkdtemp(path.join(artifacts, "desktop-profile-"));
const environment = {
  ...process.env,
  MATHCANVAS_SMOKE: "1",
  MATHCANVAS_TEST_DATA: testData,
};
delete environment.ELECTRON_RUN_AS_NODE;
const executable =
  process.env.MATHCANVAS_EXECUTABLE ??
  (process.argv.includes("--packaged")
    ? path.resolve("release/win-unpacked/MathCanvas.exe")
    : undefined);
const app = await electron.launch({
  args: executable ? [] : ["."],
  executablePath: executable,
  env: environment,
  timeout: 30000,
});
const errors = [];
let window;
const capture = async (name) => {
  await window.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const data = await app.evaluate(async ({ BrowserWindow }) =>
    (
      await BrowserWindow.getAllWindows()[0].webContents.capturePage(
        undefined,
        { stayHidden: true, stayAwake: true },
      )
    ).toDataURL(),
  );
  await fs.writeFile(
    path.join(artifacts, name),
    Buffer.from(data.split(",")[1], "base64"),
  );
};
try {
  window = await app.firstWindow();
  window.setDefaultTimeout(15000);
  assert.equal(await app.evaluate(({ app }) => app.getVersion()), version);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false),
  );
  window.on("pageerror", (error) => errors.push(error.message));
  await window
    .getByRole("button", { name: "함수 · 음함수", exact: false })
    .waitFor();
  assert.equal(
    await window.evaluate(() => typeof globalThis.require),
    "undefined",
  );
  assert.equal(
    await window.evaluate(() => typeof window.mathCanvas?.saveFile),
    "function",
  );
  await app.evaluate(({ BrowserWindow }) => {
    const preferences =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    if (
      !preferences.contextIsolation ||
      !preferences.sandbox ||
      preferences.nodeIntegration
    )
      throw new Error("Renderer isolation missing");
  });
  await capture("01-desktop-empty.png");
  console.log("Smoke: renderer ready");
  await window.getByRole("tab", { name: "화면", exact: true }).click();
  for (const [label, value] of [
    ["x 최솟값", "-3"],
    ["x 최댓값", "3"],
    ["y 최솟값", "-3"],
    ["y 최댓값", "3"],
  ]) {
    const input = window.getByLabel(label, { exact: true });
    await input.fill(value);
    await input.press("Enter");
  }
  await window.getByRole("tab", { name: "객체", exact: true }).click();
  const addFunction = async (expression, name) => {
    await window
      .getByRole("button", { name: "함수 · 음함수", exact: false })
      .click();
    const input = window.getByRole("textbox", { name: "함수 수식" });
    await input.fill(expression);
    await input.press("Enter");
    await window.getByRole("textbox", { name: "이름", exact: true }).fill(name);
  };
  await addFunction("x^2+y^2=4", "원 C");
  await addFunction("x^2-1", "포물선 P");
  await window.getByRole("textbox", { name: "함수 수식" }).press("End");
  await window.getByRole("textbox", { name: "함수 수식" }).press("Delete");
  await expect(window.locator(".object-row")).toHaveCount(2);
  await window.getByRole("tab", { name: "영역 · 교점" }).click();
  await window.getByLabel("곡선 A").selectOption({ label: "원 C · x^2+y^2=4" });
  await window.getByLabel("곡선 B").selectOption({ label: "포물선 P · x^2-1" });
  await window.getByRole("button", { name: "교점 표시", exact: true }).click();
  await expect(window.locator(".app-status")).toContainText("2개의 교점");
  await window.getByLabel("영역 방식").selectOption("overlap");
  await window.getByLabel("A 조건").selectOption("1");
  await window.getByLabel("B 조건").selectOption("-1");
  await window
    .getByRole("button", { name: "영역 채우기", exact: true })
    .click();
  await expect(window.locator("[data-region-path=true]")).toHaveAttribute(
    "d",
    /^M /,
  );
  await window.getByRole("button", { name: "넓이 계산", exact: true }).click();
  await expect(window.locator(".result-box")).toContainText("넓이 ≈");
  await capture("02-implicit-area.png");
  console.log("Smoke: implicit curves and region passed");
  await window
    .getByRole("button", { name: "수식", exact: false })
    .filter({ hasText: "수식" })
    .first()
    .click();
  const latex = window.getByRole("textbox", { name: "LaTeX 수식" });
  await latex.fill("\\int_{-2}^{2} \\sqrt{4-x^2}\\,dx = 2\\pi");
  await latex.press("Enter");
  await expect(
    window.locator("foreignObject[data-export-formula=true] .katex"),
  ).toHaveCount(1);
  await app.evaluate(({ dialog }, directory) => {
    dialog.showSaveDialog = async (_parent, options) => ({
      canceled: false,
      filePath: directory + "/" + options.defaultPath,
    });
  }, artifacts);
  await window.getByRole("button", { name: "SVG", exact: true }).click();
  await expect(window.locator(".app-status")).toContainText("SVG 그림을 저장");
  const exportedSvg = await fs.readFile(
    path.join(artifacts, "수학 수업.svg"),
    "utf8",
  );
  assert.ok(exportedSvg.includes("data:image/png;base64,"));
  assert.ok(!exportedSvg.includes("<foreignObject"));
  assert.ok(!exportedSvg.includes("data-export-ignore"));
  await window.getByRole("button", { name: "PNG", exact: true }).click();
  await expect(window.locator(".app-status")).toContainText("PNG 그림을 저장");
  const png = await fs.readFile(path.join(artifacts, "수학 수업.png"));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  await window.getByLabel("내보내기 배경").selectOption("transparent");
  await app.evaluate(({ dialog }, directory) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: directory + "/transparent.png",
    });
  }, artifacts);
  await window.getByRole("button", { name: "PNG", exact: true }).click();
  await expect
    .poll(async () =>
      fs
        .stat(path.join(artifacts, "transparent.png"))
        .then((s) => s.size)
        .catch(() => 0),
    )
    .toBeGreaterThan(100);
  const transparent = await fs.readFile(
    path.join(artifacts, "transparent.png"),
  );
  const alpha = await window.evaluate(async (base64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + base64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, 1, 1).data[3];
  }, transparent.toString("base64"));
  assert.equal(alpha, 0);
  await window.getByLabel("내보내기 배경").selectOption("white");
  await app.evaluate(({ dialog }, directory) => {
    dialog.showSaveDialog = async (_parent, options) => ({
      canceled: false,
      filePath: directory + "/" + options.defaultPath,
    });
  }, artifacts);
  const draftLatex = "\\int_0^1 x^2\\,dx=\\frac13";
  await latex.fill(draftLatex);
  await latex.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
  await expect(window.locator(".app-status")).toContainText("수업 파일을 저장");
  const projectPath = path.join(artifacts, "수학 수업.mathcanvas");
  const saved = JSON.parse(await fs.readFile(projectPath, "utf8"));
  assert.equal(saved.version, 1);
  assert.ok(
    saved.objects.some((o) => o.type === "formula2d" && o.latex === draftLatex),
  );
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, projectPath);
  await window.getByRole("button", { name: "열기", exact: true }).click();
  await expect(window.locator(".app-status")).toContainText(
    "수업 파일을 열었습니다",
  );
  await window
    .getByRole("button", { name: "3D · 회전체", exact: true })
    .click();
  await expect(window.locator(".result-box")).toContainText("33.510");
  await expect(window.locator("#math-diagram-svg polygon")).toHaveCount(2576);
  await capture("03-revolution.png");
  const box = await window.locator("#math-diagram-svg").boundingBox();
  await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await window.mouse.down();
  await window.mouse.move(
    box.x + box.width / 2 + 80,
    box.y + box.height / 2 + 30,
    { steps: 5 },
  );
  await window.mouse.up();
  await window
    .getByRole("checkbox", { name: "두 함수 사이 회전 · 와셔법" })
    .check();
  const radialInputs = window.getByRole("textbox", { name: "함수 수식" });
  await radialInputs.nth(0).fill("2");
  await radialInputs.nth(0).press("Enter");
  await radialInputs.nth(1).fill("1");
  await radialInputs.nth(1).press("Enter");
  await window.getByLabel("구간 시작", { exact: true }).fill("0");
  await window.getByLabel("구간 시작", { exact: true }).press("Enter");
  await window.getByLabel("구간 끝", { exact: true }).fill("3");
  await window.getByLabel("구간 끝", { exact: true }).press("Enter");
  await expect(window.locator(".result-box")).toContainText("28.274");
  await capture("03b-washer.png");
  await window.getByLabel("입체 종류").selectOption("torus");
  await expect(window.locator("#math-diagram-svg polygon")).toHaveCount(2464);
  await window.getByRole("button", { name: "2D 그래프", exact: true }).click();
  await window.getByRole("tab", { name: "화면", exact: true }).click();
  await window.getByLabel("각도 단위").selectOption("deg");
  await addFunction("sin(x)", "도 단위 함수");
  await window.getByRole("textbox", { name: "함수 수식" }).fill("sin(");
  await window.getByRole("textbox", { name: "함수 수식" }).press("Enter");
  await expect(window.locator(".error-text")).toBeVisible();
  await window
    .getByRole("textbox", { name: "함수 수식" })
    .fill("r=1+cos(theta)");
  await window.getByRole("textbox", { name: "함수 수식" }).press("Enter");
  await expect(window.locator(".error-text")).toHaveCount(0);
  await capture("04-polar.png");
  console.log("Smoke: export, save/open, 3D and polar passed");
  window.once("dialog", (dialog) => dialog.accept());
  await window.getByRole("button", { name: "새로", exact: true }).click();
  await addFunction("x^4-5x^2+4", "사차함수");
  await addFunction("0", "직선 y=0");
  await window.getByRole("tab", { name: "영역 · 교점", exact: true }).click();
  await window
    .getByLabel("곡선 A")
    .selectOption({ label: "사차함수 · x^4-5x^2+4" });
  await window.getByLabel("곡선 B").selectOption({ label: "직선 y=0 · 0" });
  await window
    .getByRole("button", { name: "교점 찾기 · 구간별 넓이 계산", exact: true })
    .click();
  await expect(window.locator(".area-row")).toHaveCount(3);
  await expect(window.getByTestId("area-totals")).toContainText("≈ 8");
  await window
    .getByRole("checkbox", { name: "A2 선택", exact: true })
    .uncheck();
  await expect(window.getByTestId("area-totals")).toContainText("2.933333");
  await window
    .getByRole("button", { name: "선택한 구간 색칠 · 값 표시", exact: true })
    .click();
  await expect(window.locator("[data-region-path=true]")).toHaveCount(2);
  await window.getByRole("checkbox", { name: "A2 선택", exact: true }).check();
  await window
    .getByRole("button", { name: "선택한 구간 색칠 · 값 표시", exact: true })
    .click();
  await expect(window.locator("[data-region-path=true]")).toHaveCount(3);
  await window
    .getByRole("button", { name: "선택 영역에 화면 맞추기", exact: true })
    .click();
  await window.getByTestId("area-totals").scrollIntoViewIfNeeded();
  await capture("05-intersection-areas.png");
  console.log("Smoke: selected intersection areas passed");
  await app.evaluate(({ dialog }, directory) => {
    dialog.showSaveDialog = async (_parent, options) => ({
      canceled: false,
      filePath:
        directory + "/auto-area." + options.defaultPath.split(".").at(-1),
    });
  }, artifacts);
  await window.getByRole("button", { name: "PNG", exact: true }).click();
  await expect
    .poll(() =>
      fs
        .stat(path.join(artifacts, "auto-area.png"))
        .then((s) => s.size)
        .catch(() => 0),
    )
    .toBeGreaterThan(100);
  await expect(
    window.getByRole("button", { name: "PNG", exact: true }),
  ).toBeEnabled();
  await window.getByRole("button", { name: /^○\s*원$/ }).click();
  await window.getByRole("tab", { name: "화면", exact: true }).click();
  for (const [label, value] of [
    ["y 최솟값", "-10"],
    ["y 최댓값", "10"],
  ]) {
    await window.getByLabel(label, { exact: true }).fill(value);
    await window.getByLabel(label, { exact: true }).press("Enter");
  }
  const [xmin, xmax] = await Promise.all(
    ["x 최솟값", "x 최댓값"].map((label) =>
      window.getByLabel(label, { exact: true }).inputValue().then(Number),
    ),
  );
  const ellipse = window.locator("#math-diagram-svg ellipse").first();
  const rx = Number(await ellipse.getAttribute("rx")),
    ry = Number(await ellipse.getAttribute("ry"));
  const radius = Number(await window.getByLabel("반지름", { exact: true }).inputValue());
  const expectedRadius = radius * Math.min(900 / (xmax - xmin), 600 / 20);
  assert.ok(Math.abs(rx - expectedRadius) < 1e-7);
  assert.ok(Math.abs(ry - expectedRadius) < 1e-7);
  // Render the code-native app icon at native resolution for platform packaging.
  const icon = await window.evaluate(async () => {
    const img = new Image();
    img.src = "./favicon.svg";
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    canvas.getContext("2d").drawImage(img, 0, 0, 512, 512);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await fs.mkdir("build", { recursive: true });
  const iconBytes = Buffer.from(icon, "base64");
  const currentIcon = await fs.readFile("build/icon.png").catch(() => null);
  if (!currentIcon?.equals(iconBytes))
    await fs.writeFile("build/icon.png", iconBytes);
  assert.deepEqual(errors, []);
  await fs.rm(path.join(artifacts, "failure.png"), { force: true });
  await fs.rm(path.join(artifacts, "failure-dom.txt"), { force: true });
  await fs.writeFile(
    path.join(artifacts, "desktop-smoke-result.json"),
    JSON.stringify(
      {
        success: true,
        version,
        packaged: !!executable,
        pageErrors: errors,
        checks: [
          "renderer isolation",
          "two function editing",
          "Delete inside formula",
          "implicit intersections",
          "implicit region + area",
          "KaTeX SVG and PNG export",
          "transparent PNG alpha",
          "uncommitted formula saved with Ctrl+S",
          "native save and open",
          "revolution volume",
          "washer UI and volume",
          "3D rotation and torus",
          "degrees + invalid input + polar",
          "quartic intersections, per-interval area and selected sum",
          "selected automatic regions and replacement",
          "circle uses equal unit lengths under unequal coordinate ranges",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Desktop smoke passed: math, export, native dialogs, 3D, isolation. Screenshots: artifacts/",
  );
} catch (error) {
  if (window) {
    await capture("failure.png");
    await fs.writeFile(
      path.join(artifacts, "failure-dom.txt"),
      await window.locator("body").innerText(),
    );
  }
  throw error;
} finally {
  await app.close();
}
