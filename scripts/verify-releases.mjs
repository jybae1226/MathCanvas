import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import yauzl from "yauzl";
import { extractFile, listPackage } from "@electron/asar";

const version = JSON.parse(await fs.readFile("package.json", "utf8")).version;
const names = [
  `MathCanvas-${version}-windows-x64-setup.exe`,
  `MathCanvas-${version}-windows-x64-portable.exe`,
  `MathCanvas-${version}-mac-arm64-unsigned.zip`,
];
const sha256 = async (file) => {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
};
const winAsar = "release/win-unpacked/resources/app.asar";
const winFiles = listPackage(winAsar).map((name) => name.replaceAll("\\", "/"));
assert.ok(winFiles.includes("/dist/index.html"));
assert.ok(
  extractFile(winAsar, "electron/main.cjs")
    .toString()
    .includes("sandbox: true"),
);
for (const name of names.slice(0, 2)) {
  const file = await fs.open(path.join("release", name));
  const bytes = Buffer.alloc(4096);
  await file.read(bytes, 0, bytes.length, 0);
  await file.close();
  assert.equal(bytes.subarray(0, 2).toString(), "MZ");
  assert.equal(bytes.readUInt32LE(bytes.readUInt32LE(0x3c)), 0x00004550);
}
const zip = await new Promise((resolve, reject) =>
  yauzl.open(
    path.join("release", names[2]),
    { autoClose: false },
    (error, result) => (error ? reject(error) : resolve(result)),
  ),
);
const entries = await new Promise((resolve, reject) => {
  const list = [];
  zip.on("entry", (entry) => list.push(entry));
  zip.on("end", () => resolve(list));
  zip.on("error", reject);
});
const read = (entry) =>
  new Promise((resolve, reject) =>
    zip.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      const parts = [];
      stream.on("data", (chunk) => parts.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(parts)));
      stream.on("error", reject);
    }),
  );
const paths = new Set(entries.map((entry) => entry.fileName));
const linkTargets = new Map();
for (const entry of entries)
  if (((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000)
    linkTargets.set(entry.fileName, (await read(entry)).toString());
const resolveLinks = (input) => {
  let resolved = input;
  for (let attempt = 0; attempt < 24; attempt++) {
    const parts = resolved.split("/");
    let changed = false;
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join("/");
      const target = linkTargets.get(prefix);
      if (target !== undefined) {
        assert.ok(!target.startsWith("/"));
        resolved = path.posix.normalize(
          path.posix.join(
            path.posix.dirname(prefix),
            target,
            ...parts.slice(i),
          ),
        );
        changed = true;
        break;
      }
    }
    if (!changed) return resolved;
  }
  throw new Error("Symlink cycle in Mac bundle");
};
let helpers = 0,
  links = 0;
for (const entry of entries) {
  if (entry.fileName.endsWith(".app/Contents/Info.plist")) {
    const plist = (await read(entry)).toString();
    const executable =
      /<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/.exec(
        plist,
      )?.[1];
    assert.ok(executable);
    assert.ok(
      paths.has(
        path.posix.join(
          path.posix.dirname(entry.fileName),
          "MacOS",
          executable,
        ),
      ),
      `Missing executable for ${entry.fileName}`,
    );
    if (entry.fileName.includes("Helper")) helpers++;
  }
  if (((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000) {
    const target = (await read(entry)).toString();
    const resolved = resolveLinks(
      path.posix.normalize(
        path.posix.join(path.posix.dirname(entry.fileName), target),
      ),
    );
    assert.ok(resolved.startsWith("MathCanvas.app/"));
    assert.ok(
      paths.has(resolved) ||
        paths.has(resolved + "/") ||
        entries.some((other) => other.fileName.startsWith(resolved + "/")),
      `Broken link: ${entry.fileName} -> ${target}`,
    );
    links++;
  }
}
assert.ok(helpers >= 4);
assert.ok(links >= 10);
zip.close();
const smoke = JSON.parse(
  await fs.readFile("artifacts/desktop-smoke-result.json", "utf8"),
);
assert.equal(smoke.success, true);
assert.equal(smoke.packaged, true);
assert.equal(smoke.version, version);
assert.equal(
  JSON.parse(extractFile(winAsar, "package.json").toString()).version,
  version,
);
const artifacts = await Promise.all(
  names.map(async (name) => ({
    file: name,
    bytes: (await fs.stat(path.join("release", name))).size,
    sha256: await sha256(path.join("release", name)),
  })),
);
await fs.writeFile(
  "release/checksums.json",
  JSON.stringify(
    {
      version,
      windowsPackagedSmokePassed: true,
      macExecutionVerified: false,
      macHelperBundlesVerified: helpers,
      macLinksVerified: links,
      artifacts,
    },
    null,
    2,
  ),
);
console.log(
  `Verified two Windows PE files, packaged app assets, ${helpers} Mac helper bundles, ${links} symlinks, and release SHA-256 checksums.`,
);
