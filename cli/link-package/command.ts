import { resolve } from "path";
import { execSync, execFileSync } from "child_process";
import { readFile } from "fs/promises";
import { styleText } from "node:util";

export async function linkPackage(packagePath: string) {
  const absolutePackagePath = resolve(packagePath);
  const extensionDir = process.cwd();

  const pkgPath = resolve(absolutePackagePath, "package.json");

  if (pkgPath.indexOf(absolutePackagePath) !== 0) {
    console.error(styleText(["red", "bold"], `Invalid --path: ${packagePath} is not within ${absolutePackagePath}`));
    process.exit(1);
  }

  let pkg: { name: string };
  try {
    pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  } catch {
    console.error(styleText(["red", "bold"], `Could not read ${pkgPath}. Is --path correct?`));
    process.exit(1);
  }

  console.log(styleText(["cyan", "bold"], `Building ${pkg.name}...`));
  execSync("npm run build", { cwd: absolutePackagePath, stdio: "inherit" });

  console.log(styleText(["cyan", "bold"], "Packing tarball..."));
  const tarball = execSync("npm pack", { cwd: absolutePackagePath, encoding: "utf8" }).trim();
  const tarballPath = resolve(absolutePackagePath, tarball);

  console.log(styleText(["cyan", "bold"], `Installing ${tarball} into ${extensionDir}...`));
  execFileSync("npm", ["install", tarballPath], { cwd: extensionDir, stdio: "inherit" });

  console.log(styleText(["green", "bold"], `Done! ${pkg.name} linked via tarball.`));
}
