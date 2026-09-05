"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const NON_SERVICE_KEYS = new Set(["hub", "logging", "singleProjectMode", "ui"]);

function localConnectHost(configuredHost) {
  if (!configuredHost || configuredHost === "0.0.0.0" || configuredHost === "::") {
    return "127.0.0.1";
  }
  return configuredHost;
}

function loadEmulatorConfiguration(repositoryRoot) {
  const configPath = path.join(repositoryRoot, "firebase.json");
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${configPath}: ${error.message}`);
  }

  if (!config.emulators || typeof config.emulators !== "object") {
    throw new Error("firebase.json does not define an emulators configuration.");
  }

  const services = Object.entries(config.emulators)
    .filter(([name, value]) => !NON_SERVICE_KEYS.has(name) && value && typeof value === "object")
    .filter(([, value]) => Number.isInteger(value.port))
    .map(([name, value]) => ({
      name,
      host: localConnectHost(value.host),
      port: value.port,
    }));

  if (services.length === 0) {
    throw new Error("firebase.json does not configure any emulated services with ports.");
  }

  const hubConfig = config.emulators.hub ?? {};
  return {
    configPath,
    services,
    hub: {
      host: localConnectHost(hubConfig.host),
      port: Number.isInteger(hubConfig.port) ? hubConfig.port : 4400,
    },
  };
}

function getJson(url, timeoutMilliseconds = 1_500) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMilliseconds }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Emulator Hub returned HTTP ${response.statusCode}.`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Emulator Hub returned invalid JSON: ${error.message}`));
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("Emulator Hub request timed out.")));
    request.on("error", reject);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function assertEmulatorHubIsFree(hub) {
  const hubUrl = `http://${hub.host}:${hub.port}/emulators`;
  try {
    await getJson(hubUrl, 500);
  } catch {
    return;
  }
  throw new Error(
    `An emulator suite is already running at ${hub.host}:${hub.port}. `
      + "Stop it before using this managed startup command.",
  );
}

async function waitForEmulators({
  hub,
  services,
  timeoutMilliseconds,
  getChildStatus,
  onProgress = () => {},
}) {
  const hubUrl = `http://${hub.host}:${hub.port}/emulators`;
  const expectedNames = services.map((service) => service.name);
  const deadline = Date.now() + timeoutMilliseconds;
  let lastProgressAt = 0;
  let lastProblem = "Emulator Hub is not responding yet.";

  while (Date.now() < deadline) {
    const childStatus = getChildStatus();
    if (childStatus) {
      if (childStatus.error) {
        throw new Error(`Firebase CLI failed to start: ${childStatus.error.message}`);
      }
      throw new Error(
        `Firebase CLI exited before readiness (code ${childStatus.code ?? "none"}, `
          + `signal ${childStatus.signal ?? "none"}).`,
      );
    }

    try {
      const registry = await getJson(hubUrl);
      const missing = expectedNames.filter((name) => !registry[name]);
      if (missing.length === 0) {
        return registry;
      }
      lastProblem = `Waiting for: ${missing.join(", ")}.`;
    } catch (error) {
      lastProblem = error.message;
    }

    if (Date.now() - lastProgressAt >= 5_000) {
      onProgress(lastProblem);
      lastProgressAt = Date.now();
    }
    await delay(400);
  }

  throw new Error(
    `Firebase emulators were not ready within ${timeoutMilliseconds} ms. ${lastProblem}`,
  );
}

module.exports = {
  assertEmulatorHubIsFree,
  loadEmulatorConfiguration,
  localConnectHost,
  waitForEmulators,
};
