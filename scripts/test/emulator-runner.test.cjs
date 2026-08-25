"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  loadEmulatorConfiguration,
  localConnectHost,
} = require("../lib/emulator-readiness.cjs");
const { parseJavaMajor } = require("../lib/toolchain.cjs");
const { createSeedEnvironment } = require("../start-emulators.cjs");

test("parses modern and legacy Java version formats", () => {
  assert.equal(parseJavaMajor('openjdk version "21.0.11"'), 21);
  assert.equal(parseJavaMajor('java version "1.8.0_402"'), 8);
  assert.equal(parseJavaMajor("unrecognized"), null);
});

test("loads all configured Firebase services", () => {
  const repositoryRoot = path.resolve(__dirname, "..", "..");
  const configuration = loadEmulatorConfiguration(repositoryRoot);
  assert.deepEqual(
    configuration.services.map((service) => service.name).sort(),
    ["auth", "firestore", "functions", "hosting", "storage"],
  );
  assert.deepEqual(configuration.hub, { host: "127.0.0.1", port: 4400 });
});

test("seed environment contains the guarded project and loopback endpoints", () => {
  const environment = createSeedEnvironment({}, [
    { name: "auth", host: "127.0.0.1", port: 9099 },
    { name: "firestore", host: "127.0.0.1", port: 8080 },
  ]);

  assert.equal(environment.GCLOUD_PROJECT, "demo-tokgut-pos");
  assert.equal(environment.GOOGLE_CLOUD_PROJECT, "demo-tokgut-pos");
  assert.deepEqual(JSON.parse(environment.FIREBASE_CONFIG), {
    projectId: "demo-tokgut-pos",
  });
  assert.equal(environment.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
  assert.equal(environment.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
  assert.equal(
    Object.keys(environment).some((name) => /password|pin|secret|credential/i.test(name)),
    false,
  );
});

test("wildcard listen hosts are converted to loopback client hosts", () => {
  assert.equal(localConnectHost(undefined), "127.0.0.1");
  assert.equal(localConnectHost("0.0.0.0"), "127.0.0.1");
  assert.equal(localConnectHost("::"), "127.0.0.1");
});
