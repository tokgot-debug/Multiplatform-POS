"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MINIMUM_JAVA_MAJOR = 21;

function executableName(name) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isDirectory(candidate) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function realPath(candidate) {
  try {
    return fs.realpathSync.native(candidate);
  } catch {
    return path.resolve(candidate);
  }
}

function resolveOnPath(command, environment = process.env) {
  const pathValue = environment.PATH ?? environment.Path ?? environment.path ?? "";
  const pathEntries = pathValue
    .split(path.delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);

  const suppliedExtension = path.extname(command) !== "";
  const extensions = process.platform === "win32" && !suppliedExtension
    ? (environment.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
      .split(";")
      .filter(Boolean)
    : [""];

  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${command}${extension}`);
      if (isFile(candidate)) {
        return realPath(candidate);
      }
    }
  }

  return null;
}

function parseJavaMajor(versionOutput) {
  const match = versionOutput.match(/(?:java|openjdk) version\s+"(?:1\.)?(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function javaExecutable(javaHome) {
  return path.join(javaHome, "bin", executableName("java"));
}

function inspectJava(candidate) {
  if (!candidate.executable || !isFile(candidate.executable)) {
    return null;
  }

  const result = spawnSync(candidate.executable, ["-version"], {
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true,
  });
  const versionOutput = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim();
  const major = parseJavaMajor(versionOutput);

  if (result.error || result.status !== 0 || major === null) {
    return null;
  }

  const firstLine = versionOutput.split(/\r?\n/, 1)[0];
  return {
    ...candidate,
    executable: realPath(candidate.executable),
    major,
    version: firstLine,
  };
}

function childDirectories(root) {
  if (!root || !isDirectory(root)) {
    return [];
  }

  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name));
  } catch {
    return [];
  }
}

function commonJavaHomes(environment = process.env) {
  if (process.platform === "win32") {
    const programRoots = [
      environment.ProgramFiles,
      environment["ProgramFiles(x86)"],
      environment.LOCALAPPDATA && path.join(environment.LOCALAPPDATA, "Programs"),
    ].filter(Boolean);
    const vendorDirectories = [
      "Microsoft",
      "Eclipse Adoptium",
      "Java",
      "Amazon Corretto",
      "Zulu",
    ];

    return programRoots.flatMap((programRoot) => vendorDirectories.flatMap((vendor) => {
      const vendorRoot = path.join(programRoot, vendor);
      return [vendorRoot, ...childDirectories(vendorRoot)];
    }));
  }

  const unixRoots = ["/usr/lib/jvm", "/usr/java"];
  if (environment.HOME) {
    unixRoots.push(path.join(environment.HOME, ".sdkman", "candidates", "java"));
  }

  const homes = unixRoots.flatMap((root) => [root, ...childDirectories(root)]);
  if (process.platform === "darwin") {
    const macRoot = "/Library/Java/JavaVirtualMachines";
    homes.push(...childDirectories(macRoot).map((directory) => path.join(directory, "Contents", "Home")));
  }
  return homes;
}

function javaCandidateFromHome(home, source) {
  if (!home) {
    return null;
  }
  const normalizedHome = path.resolve(home);
  return {
    executable: javaExecutable(normalizedHome),
    home: normalizedHome,
    source,
  };
}

function deduplicateCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate) {
      return false;
    }
    const key = process.platform === "win32"
      ? candidate.executable.toLowerCase()
      : candidate.executable;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function resolveJavaRuntime(environment = process.env) {
  const override = environment.POS_JAVA_HOME;
  if (override) {
    const inspectedOverride = inspectJava(javaCandidateFromHome(override, "POS_JAVA_HOME"));
    if (!inspectedOverride || inspectedOverride.major < MINIMUM_JAVA_MAJOR) {
      throw new Error(
        `POS_JAVA_HOME must point to JDK ${MINIMUM_JAVA_MAJOR} or newer: ${override}`,
      );
    }
    return inspectedOverride;
  }

  const pathJava = resolveOnPath("java", environment);
  const pathCandidate = pathJava
    ? {
        executable: pathJava,
        home: path.dirname(path.dirname(pathJava)),
        source: "PATH",
      }
    : null;
  const candidates = deduplicateCandidates([
    javaCandidateFromHome(environment.JAVA_HOME, "JAVA_HOME"),
    pathCandidate,
    ...commonJavaHomes(environment).map((home) => javaCandidateFromHome(home, "installed JDK")),
  ]);
  const inspected = candidates.map(inspectJava).filter(Boolean);
  const compatible = inspected.filter((candidate) => candidate.major >= MINIMUM_JAVA_MAJOR);
  const selected = compatible.find((candidate) => candidate.major === MINIMUM_JAVA_MAJOR)
    ?? compatible[0];

  if (!selected) {
    const discovered = inspected.length > 0
      ? ` Found: ${inspected.map((candidate) => `${candidate.source}=${candidate.major}`).join(", ")}.`
      : " No Java runtime was found.";
    throw new Error(
      `Firebase emulators require JDK ${MINIMUM_JAVA_MAJOR} or newer.${discovered} `
        + "Install JDK 21 or set POS_JAVA_HOME to its installation directory.",
    );
  }

  return selected;
}

function withJavaRuntime(environment, runtime) {
  const nextEnvironment = { ...environment, JAVA_HOME: runtime.home };
  const pathKey = Object.keys(nextEnvironment)
    .find((key) => key.toLowerCase() === "path") ?? "PATH";
  const currentPath = nextEnvironment[pathKey] ?? "";
  const javaBin = path.dirname(runtime.executable);
  nextEnvironment[pathKey] = [javaBin, currentPath].filter(Boolean).join(path.delimiter);
  return nextEnvironment;
}

function resolveFirebaseCli(repositoryRoot, environment = process.env) {
  const localCli = path.join(
    repositoryRoot,
    "node_modules",
    "firebase-tools",
    "lib",
    "bin",
    "firebase.js",
  );
  if (isFile(localCli)) {
    return {
      command: process.execPath,
      argumentsPrefix: [localCli],
      displayPath: localCli,
    };
  }

  const firebaseExecutable = resolveOnPath("firebase", environment);
  if (!firebaseExecutable) {
    throw new Error(
      "Firebase CLI was not found. Install firebase-tools globally or in the repository root.",
    );
  }

  const globalCli = path.join(
    path.dirname(firebaseExecutable),
    "node_modules",
    "firebase-tools",
    "lib",
    "bin",
    "firebase.js",
  );
  if (isFile(globalCli)) {
    return {
      command: process.execPath,
      argumentsPrefix: [globalCli],
      displayPath: globalCli,
    };
  }

  return {
    command: firebaseExecutable,
    argumentsPrefix: [],
    displayPath: firebaseExecutable,
    shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(firebaseExecutable),
  };
}

module.exports = {
  MINIMUM_JAVA_MAJOR,
  parseJavaMajor,
  resolveFirebaseCli,
  resolveJavaRuntime,
  resolveOnPath,
  withJavaRuntime,
};
