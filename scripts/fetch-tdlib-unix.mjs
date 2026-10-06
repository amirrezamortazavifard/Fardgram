import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const runtimeDirectory = path.resolve(rootDir, "src-tauri/tdlib");
const licenseDirectory = path.resolve(runtimeDirectory, "licenses");

if (!fs.existsSync(runtimeDirectory)) {
  fs.mkdirSync(runtimeDirectory, { recursive: true });
}
if (!fs.existsSync(licenseDirectory)) {
  fs.mkdirSync(licenseDirectory, { recursive: true });
}

console.log(`[TDLib Bootstrap] Preparing TDLib native runtime for ${process.platform} (${process.arch})...`);

try {
  // Install prebuilt-tdlib temporarily in node_modules if not present
  try {
    await import("prebuilt-tdlib");
  } catch {
    console.log("[TDLib Bootstrap] Installing prebuilt-tdlib helper...");
    execSync("npm install --no-save prebuilt-tdlib", {
      cwd: rootDir,
      stdio: "inherit",
    });
  }

  const { getTdjson } = await import("prebuilt-tdlib");
  const sourceBinaryPath = getTdjson();
  const binaryFileName = path.basename(sourceBinaryPath);
  const targetBinaryPath = path.join(runtimeDirectory, binaryFileName);

  fs.copyFileSync(sourceBinaryPath, targetBinaryPath);
  console.log(`[TDLib Bootstrap] Successfully copied ${binaryFileName} to ${targetBinaryPath}`);

  // Create a license notice if missing
  const licenseFile = path.join(licenseDirectory, "TDLib-LICENSE_1_0.txt");
  if (!fs.existsSync(licenseFile)) {
    fs.writeFileSync(
      licenseFile,
      "Boost Software License - Version 1.0\nhttps://www.boost.org/LICENSE_1_0.txt\n",
      "utf8",
    );
  }
} catch (error) {
  console.warn(`[TDLib Bootstrap] Warning: Could not auto-fetch Unix TDLib: ${error?.message || error}`);
  console.warn("[TDLib Bootstrap] Continuing build; ensure TDLib is present if running natively.");
}
