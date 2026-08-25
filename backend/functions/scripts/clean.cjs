const { rmSync } = require("node:fs");
const { basename, dirname, resolve } = require("node:path");

const projectRoot = resolve(__dirname, "..");
const buildDirectory = resolve(projectRoot, "lib");

if (dirname(buildDirectory) !== projectRoot || basename(buildDirectory) !== "lib") {
  throw new Error(`Refusing to clean unexpected build directory: ${buildDirectory}`);
}

rmSync(buildDirectory, { recursive: true, force: true });
