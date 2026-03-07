import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const packageJsonPath = path.join(repoRoot, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const appName = packageJson.productName ?? "Ableton Live Wizard";
const platform = process.env.WIZARD_PACKAGE_PLATFORM ?? process.platform;
const arch = process.env.WIZARD_PACKAGE_ARCH ?? process.arch;
const outputDir = path.join(repoRoot, "release", `${appName}-${platform}-${arch}`);

if (platform !== "darwin") {
  throw new Error(`Offline packager currently supports macOS only. Received platform=${platform}`);
}

const templateAppPath = path.join(repoRoot, "node_modules", "electron", "dist", "Electron.app");
const packagedAppPath = path.join(outputDir, `${appName}.app`);
const packagedContentsPath = path.join(packagedAppPath, "Contents");
const packagedResourcesPath = path.join(packagedContentsPath, "Resources");
const packagedMacOsPath = path.join(packagedContentsPath, "MacOS");
const packagedAppResourcesPath = path.join(packagedResourcesPath, "app");
const plistPath = path.join(packagedContentsPath, "Info.plist");

const runPlistBuddy = (command) => {
  const result = spawnSync("/usr/libexec/PlistBuddy", ["-c", command, plistPath], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
  });

  return result;
};

const shellQuote = (value) => JSON.stringify(String(value));

const upsertPlistValue = (key, type, value) => {
  const setResult = runPlistBuddy(`Set :${key} ${shellQuote(value)}`);
  if (setResult.status === 0) {
    return;
  }

  const addResult = runPlistBuddy(`Add :${key} ${type} ${shellQuote(value)}`);
  if (addResult.status !== 0) {
    throw new Error(
      addResult.stderr.trim() || addResult.stdout.trim() || `PlistBuddy failed to set ${key}=${String(value)}`,
    );
  }
};

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.cpSync(templateAppPath, packagedAppPath, { recursive: true });

fs.renameSync(path.join(packagedMacOsPath, "Electron"), path.join(packagedMacOsPath, appName));
fs.rmSync(path.join(packagedResourcesPath, "default_app.asar"), { force: true });
fs.mkdirSync(packagedAppResourcesPath, { recursive: true });

const packagedPackageJson = {
  name: packageJson.name,
  productName: appName,
  version: packageJson.version,
  description: packageJson.description,
  type: packageJson.type,
  main: packageJson.main,
};

fs.writeFileSync(path.join(packagedAppResourcesPath, "package.json"), `${JSON.stringify(packagedPackageJson, null, 2)}\n`);
fs.cpSync(path.join(repoRoot, "dist"), path.join(packagedAppResourcesPath, "dist"), { recursive: true });

upsertPlistValue("CFBundleDisplayName", "string", appName);
upsertPlistValue("CFBundleName", "string", appName);
upsertPlistValue("CFBundleExecutable", "string", appName);
upsertPlistValue("CFBundleIdentifier", "string", "com.iwa.ableton-live-wizard");
upsertPlistValue("CFBundleShortVersionString", "string", packageJson.version);
upsertPlistValue("CFBundleVersion", "string", packageJson.version);
upsertPlistValue("LSApplicationCategoryType", "string", "public.app-category.music");

console.log(`Packaged companion app: ${packagedAppPath}`);
