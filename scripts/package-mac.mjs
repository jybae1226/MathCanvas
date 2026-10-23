// Manual packaging follows Electron's official application-distribution layout.
// The archive preserves Unix modes and symlinks without extracting them on Windows.
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { downloadArtifact } from "@electron/get";
import { createPackage, listPackage } from "@electron/asar";
import yauzl from "yauzl";
import yazl from "yazl";
import assert from "node:assert/strict";

const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
const electron = JSON.parse(
  await fs.readFile("node_modules/electron/package.json", "utf8"),
);
const checksums = JSON.parse(
  await fs.readFile("node_modules/electron/checksums.json", "utf8"),
);
await fs.mkdir("release", { recursive: true });
const staging = await fs.mkdtemp(path.resolve("release/.mac-build-"));
await fs.cp("dist", path.join(staging, "dist"), { recursive: true });
await fs.cp("electron", path.join(staging, "electron"), { recursive: true });
await fs.writeFile(
  path.join(staging, "package.json"),
  JSON.stringify({
    name: pkg.name,
    productName: "MathCanvas",
    version: pkg.version,
    main: pkg.main,
    description: pkg.description,
    author: pkg.author,
  }),
);
const asarPath = path.join(staging, "..", path.basename(staging) + ".asar");
await createPackage(staging, asarPath);
const asarEntries = listPackage(asarPath).map((name) =>
  name.replaceAll("\\", "/"),
);
assert.ok(asarEntries.includes("/electron/main.cjs"));
assert.ok(asarEntries.includes("/dist/index.html"));
console.log(
  `Downloading checksum-verified Electron ${electron.version} for macOS arm64...`,
);
let progressBucket = -1;
const runtime = await downloadArtifact({
  version: electron.version,
  artifactName: "electron",
  platform: "darwin",
  arch: "arm64",
  checksums,
  cacheRoot: path.resolve("release/.electron-cache"),
  downloadOptions: {
    getProgressCallback: async (progress) => {
      const bucket = Math.floor(progress.percent * 10);
      if (bucket !== progressBucket) {
        progressBucket = bucket;
        console.log(
          `Mac runtime download: ${Math.round(progress.percent * 100)}%`,
        );
      }
    },
  },
});
const openZip = (file) =>
  new Promise((resolve, reject) =>
    yauzl.open(file, { autoClose: false }, (error, zip) =>
      error ? reject(error) : resolve(zip),
    ),
  );
const collect = (zip) =>
  new Promise((resolve, reject) => {
    const entries = [];
    zip.on("entry", (entry) => entries.push(entry));
    zip.on("end", () => resolve(entries));
    zip.on("error", reject);
  });
const buffer = (zip, entry) =>
  new Promise((resolve, reject) =>
    zip.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      const parts = [];
      stream.on("data", (part) => parts.push(part));
      stream.on("end", () => resolve(Buffer.concat(parts)));
      stream.on("error", reject);
    }),
  );
const sourceZip = await openZip(runtime);
const entries = await collect(sourceZip);
const destination = path.resolve(
  `release/MathCanvas-${pkg.version}-mac-arm64-unsigned.zip`,
);
const output = new yazl.ZipFile();
const completion = pipeline(
  output.outputStream,
  createWriteStream(destination),
);
output.on("error", (error) => output.outputStream.destroy(error));
let symlinks = 0;
const setString = (xml, key, value) => {
  const replacement = `<key>${key}</key><string>${value}</string>`;
  const pattern = new RegExp(`<key>${key}</key>\\s*<string>[^<]*</string>`);
  if (pattern.test(xml)) return xml.replace(pattern, replacement);
  const pos = xml.lastIndexOf("</dict>");
  assert.ok(pos >= 0);
  return xml.slice(0, pos) + replacement + xml.slice(pos);
};
console.log(
  "Packaging MathCanvas.app, preserving macOS executable and symlink attributes...",
);
for (const entry of entries) {
  const original = entry.fileName;
  if (
    original.endsWith("/Resources/default_app.asar") ||
    original.includes(".app/Contents/_CodeSignature/")
  )
    continue;
  let name = original.replace(/^Electron\.app\//, "MathCanvas.app/");
  name = name
    .replace(/\/Electron Helper/g, "/MathCanvas Helper")
    .replace(/\/Electron Login Helper/g, "/MathCanvas Login Helper");
  if (name === "MathCanvas.app/Contents/MacOS/Electron")
    name = "MathCanvas.app/Contents/MacOS/MathCanvas";
  const mode =
    entry.externalFileAttributes >>> 16 ||
    (original.endsWith("/") ? 0o40755 : 0o100644);
  if ((mode & 0o170000) === 0o120000) symlinks++;
  const options = { mode, mtime: entry.getLastModDate(), compressionLevel: 6 };
  if (original.endsWith("/"))
    output.addEmptyDirectory(name, { mode, mtime: options.mtime });
  else if (/\.app\/Contents\/Info\.plist$/.test(original)) {
    let xml = (await buffer(sourceZip, entry)).toString("utf8");
    assert.ok(xml.includes("<plist"));
    if (original === "Electron.app/Contents/Info.plist") {
      for (const [key, value] of Object.entries({
        CFBundleDisplayName: "MathCanvas",
        CFBundleName: "MathCanvas",
        CFBundleIdentifier: "kr.mathcanvas.desktop",
        CFBundleExecutable: "MathCanvas",
        CFBundleShortVersionString: pkg.version,
        CFBundleVersion: pkg.version,
        CFBundleIconFile: "MathCanvas.icns",
        LSApplicationCategoryType: "public.app-category.education",
      }))
        xml = setString(xml, key, value);
    } else {
      xml = xml.replace(/com\.github\.Electron/g, "kr.mathcanvas.desktop");
      const helper =
        /<key>CFBundleName<\/key>\s*<string>([^<]*)<\/string>/.exec(xml)?.[1] ??
        "Electron Helper";
      xml = setString(
        xml,
        "CFBundleName",
        helper.replace("Electron", "MathCanvas"),
      );
      xml = setString(
        xml,
        "CFBundleDisplayName",
        helper.replace("Electron", "MathCanvas"),
      );
      const helperExecutable = name
        .split("/")
        .at(-3)
        .replace(/\.app$/, "");
      xml = setString(xml, "CFBundleExecutable", helperExecutable);
      const subtype = /\(([^)]+)\)/.exec(helperExecutable)?.[1]?.toLowerCase();
      xml = setString(
        xml,
        "CFBundleIdentifier",
        "kr.mathcanvas.desktop.helper" + (subtype ? "." + subtype : ""),
      );
      xml = setString(xml, "CFBundleVersion", pkg.version);
    }
    output.addBuffer(Buffer.from(xml), name, options);
  } else
    output.addReadStreamLazy(name, options, (callback) =>
      sourceZip.openReadStream(entry, callback),
    );
}
output.addFile(asarPath, "MathCanvas.app/Contents/Resources/app.asar", {
  mode: 0o100644,
});
const png = await fs.readFile("build/icon.png");
const icon = Buffer.alloc(png.length + 16);
icon.write("icns", 0);
icon.writeUInt32BE(icon.length, 4);
icon.write("ic09", 8);
icon.writeUInt32BE(png.length + 8, 12);
png.copy(icon, 16);
output.addBuffer(icon, "MathCanvas.app/Contents/Resources/MathCanvas.icns", {
  mode: 0o100644,
});
const launcher = `#!/bin/bash
set -euo pipefail
task_directory="$(cd -- "$(dirname -- "$0")" && pwd)"
task_app="$task_directory/MathCanvas.app"
echo "MathCanvas: creating a local ad-hoc signature for this Mac."
/usr/bin/codesign --force --deep --sign - "$task_app"
/usr/bin/codesign --verify --deep --strict "$task_app"
/usr/bin/open "$task_app"
echo "MathCanvas started. You can now move MathCanvas.app to Applications."
`;
output.addBuffer(Buffer.from(launcher), "Start-MathCanvas.command", {
  mode: 0o100755,
});
output.addBuffer(
  Buffer.from(
    "이 패키지는 Windows에서 만든 Apple Silicon Mac 시험본입니다.\n처음에는 Start-MathCanvas.command를 Mac에서 실행해 로컬 ad-hoc 서명을 적용하세요.\n서명 검증이 성공하면 앱을 열고 Applications로 옮길 수 있습니다.\n개발자 서명·Apple 공증과 실제 Mac 실행 검증은 수행되지 않았습니다.\n보안 정책상 차단되면 Mac에서 원본 소스로 npm ci, npm run dist:mac을 실행해 빌드하세요.\n",
  ),
  "Mac-사용안내.txt",
  { mode: 0o100644 },
);
output.end();
await completion;
sourceZip.close();
assert.ok(symlinks > 0, "Mac framework symlinks must be preserved");

// Verify the actual output archive rather than the staging directory.
const archive = await openZip(destination);
const packaged = await collect(archive);
const executable = packaged.find(
  (entry) => entry.fileName === "MathCanvas.app/Contents/MacOS/MathCanvas",
);
assert.ok(executable);
assert.ok((executable.externalFileAttributes >>> 16) & 0o111);
const macho = await buffer(archive, executable);
assert.equal(macho.readUInt32LE(0), 0xfeedfacf);
assert.equal(macho.readUInt32LE(4), 0x0100000c, "Executable must be ARM64");
const preservedSymlinks = packaged.filter(
  (entry) => ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000,
).length;
assert.equal(preservedSymlinks, symlinks);
assert.ok(
  packaged.some(
    (entry) => entry.fileName === "MathCanvas.app/Contents/Resources/app.asar",
  ),
);
archive.close();
const digest = crypto
  .createHash("sha256")
  .update(await fs.readFile(destination))
  .digest("hex");
await fs.writeFile(
  "release/mac-arm64-package-report.json",
  JSON.stringify(
    {
      archive: path.basename(destination),
      sha256: digest,
      electron: electron.version,
      architecture: "arm64",
      symlinks: preservedSymlinks,
      entries: packaged.length,
      runtimeChecksumVerified: true,
      executableModeVerified: true,
      appArchiveVerified: true,
      requiresMacAdHocSigning: true,
      developerSigned: false,
      notarized: false,
      macExecutionVerified: false,
    },
    null,
    2,
  ),
);
console.log(
  `Created ${destination}. ARM64 header, executable mode and ${preservedSymlinks} symlinks verified. Mac signing and execution remain to be done on a Mac.`,
);
