#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  resolveFirebaseCli,
  resolveJavaRuntime,
  withJavaRuntime,
} = require("./lib/toolchain.cjs");
const {
  assertEmulatorHubIsFree,
  loadEmulatorConfiguration,
  waitForEmulators,
} = require("./lib/emulator-readiness.cjs");

const PROJECT_ID = "demo-tokgut-pos";
const DEFAULT_START_TIMEOUT_MS = 120_000;
const repositoryRoot = path.resolve(__dirname, "..");
const seedScript = path.join(repositoryRoot, "scripts", "seed-emulators.cjs");

function timeoutFromEnvironment() {
  const supplied = process.env.POS_EMULATOR_START_TIMEOUT_MS;
  if (!supplied) {
    return DEFAULT_START_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(supplied, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000) {
    throw new Error("POS_EMULATOR_START_TIMEOUT_MS must be an integer of at least 1000.");
  }
  return parsed;
}

function addressFor(services, name) {
  const service = services.find((entry) => entry.name === name);
  return service ? `${service.host}:${service.port}` : undefined;
}

function createSeedEnvironment(baseEnvironment, services) {
  const environment = {
    ...baseEnvironment,
    GCLOUD_PROJECT: PROJECT_ID,
    GOOGLE_CLOUD_PROJECT: PROJECT_ID,
    FIREBASE_CONFIG: JSON.stringify({ projectId: PROJECT_ID }),
  };
  const emulatorVariables = {
    FIREBASE_AUTH_EMULATOR_HOST: addressFor(services, "auth"),
    FIRESTORE_EMULATOR_HOST: addressFor(services, "firestore"),
    FIREBASE_STORAGE_EMULATOR_HOST: addressFor(services, "storage"),
    FIREBASE_FUNCTIONS_EMULATOR_HOST: addressFor(services, "functions"),
  };
  for (const [name, value] of Object.entries(emulatorVariables)) {
    if (value) {
      environment[name] = value;
    }
  }
  return environment;
}

function trackChild(command, args, options) {
  const child = spawn(command, args, options);
  let status = null;
  let resolveExit;
  const exited = new Promise((resolve) => {
    resolveExit = resolve;
  });
  child.once("error", (error) => {
    status = { error };
    resolveExit(status);
  });
  child.once("exit", (code, signal) => {
    status = { code, signal };
    resolveExit(status);
  });
  return {
    child,
    exited,
    getStatus: () => status,
  };
}

async function stopChild(trackedChild, signal = "SIGINT") {
  if (!trackedChild || trackedChild.getStatus()) {
    return;
  }

  // Windows delivers an interactive Ctrl+C to every attached console process.
  // Give the Firebase CLI time to handle that event and stop its Java children
  // before falling back to Node's forceful Windows signal implementation.
  let requestedSignal = signal;
  if (process.platform === "win32" && signal === "SIGINT") {
    const stoppedFromConsoleSignal = await Promise.race([
      trackedChild.exited.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (stoppedFromConsoleSignal) {
      return;
    }
    requestedSignal = "SIGTERM";
  }

  try {
    trackedChild.child.kill(requestedSignal);
  } catch {
    return;
  }

  const stopped = await Promise.race([
    trackedChild.exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 10_000)),
  ]);
  if (!stopped && !trackedChild.getStatus()) {
    try {
      trackedChild.child.kill("SIGKILL");
    } catch {
      // The child can exit between the status check and the fallback signal.
    }
  }
}

async function main() {
  const unsupportedArguments = process.argv.slice(2).filter((argument) => argument !== "--doctor");
  if (unsupportedArguments.length > 0) {
    throw new Error(`Unsupported argument(s): ${unsupportedArguments.join(", ")}`);
  }
  const doctorOnly = process.argv.includes("--doctor");
  if (!fs.existsSync(seedScript)) {
    throw new Error(`Required emulator seed is missing: ${seedScript}`);
  }

  const emulatorConfig = loadEmulatorConfiguration(repositoryRoot);
  const javaRuntime = resolveJavaRuntime();
  const firebaseCli = resolveFirebaseCli(repositoryRoot);
  const childEnvironment = withJavaRuntime(process.env, javaRuntime);
  const startTimeout = timeoutFromEnvironment();

  console.log(`[emulators] Java: ${javaRuntime.version} (${javaRuntime.home})`);
  console.log(`[emulators] Firebase CLI: ${firebaseCli.displayPath}`);
  console.log(`[emulators] Project: ${PROJECT_ID}`);
  console.log(`[emulators] Seed: ${seedScript}`);
  if (doctorOnly) {
    console.log("[emulators] Doctor checks passed; no processes were started.");
    return;
  }
  await assertEmulatorHubIsFree(emulatorConfig.hub);

  const firebaseArguments = [
    ...firebaseCli.argumentsPrefix,
    "emulators:start",
    "--project",
    PROJECT_ID,
    "--config",
    emulatorConfig.configPath,
  ];
  const trackedFirebase = trackChild(firebaseCli.command, firebaseArguments, {
    cwd: repositoryRoot,
    env: childEnvironment,
    stdio: "inherit",
    windowsHide: false,
    shell: firebaseCli.shell ?? false,
  });
  let stopSignal = null;
  let trackedSeed = null;
  const forwardSignal = (signal) => {
    stopSignal = signal;
    void stopChild(trackedSeed, signal);
    void stopChild(trackedFirebase, signal);
  };
  process.once("SIGINT", () => forwardSignal("SIGINT"));
  process.once("SIGTERM", () => forwardSignal("SIGTERM"));

  try {
    await waitForEmulators({
      ...emulatorConfig,
      timeoutMilliseconds: startTimeout,
      getChildStatus: trackedFirebase.getStatus,
      onProgress: (message) => console.log(`[emulators] ${message}`),
    });

    const seedEnvironment = createSeedEnvironment(childEnvironment, emulatorConfig.services);
    console.log("[emulators] Services are ready; running the emulator-only seed.");
    trackedSeed = trackChild(process.execPath, [seedScript], {
      cwd: repositoryRoot,
      env: seedEnvironment,
      stdio: "inherit",
      windowsHide: false,
    });
    const seedStatus = await trackedSeed.exited;
    if (seedStatus.error) {
      throw new Error(`Seed process failed to start: ${seedStatus.error.message}`);
    }
    if (seedStatus.code !== 0) {
      throw new Error(
        `Emulator seed failed (code ${seedStatus.code ?? "none"}, `
          + `signal ${seedStatus.signal ?? "none"}).`,
      );
    }

    console.log("[emulators] Seed complete. Generated credentials are shown above.");
    console.log("[emulators] Emulators remain active; press Ctrl+C to stop.");
    const firebaseStatus = await trackedFirebase.exited;
    if (stopSignal) {
      process.exitCode = stopSignal === "SIGINT" ? 130 : 143;
      return;
    }
    const detail = firebaseStatus.error?.message
      ?? `code ${firebaseStatus.code ?? "none"}, signal ${firebaseStatus.signal ?? "none"}`;
    throw new Error(`Firebase CLI stopped unexpectedly (${detail}).`);
  } catch (error) {
    await stopChild(trackedFirebase, stopSignal ?? "SIGINT");
    if (stopSignal) {
      process.exitCode = stopSignal === "SIGINT" ? 130 : 143;
      return;
    }
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[emulators] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  createSeedEnvironment,
  timeoutFromEnvironment,
};
