#!/usr/bin/env node
"use strict";

const { randomBytes, randomInt, scrypt } = require("node:crypto");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");
const { promisify } = require("node:util");

const { assertSafeEmulatorTarget } = require("./lib/emulator-safety.cjs");
const { STAFF_ID, createSeedDocuments } = require("./lib/emulator-seed-data.cjs");

const workspaceRoot = path.resolve(__dirname, "..");
const functionsRequire = createRequire(
  path.join(workspaceRoot, "backend", "functions", "package.json"),
);
const { deleteApp, initializeApp } = functionsRequire("firebase-admin/app");
const { getAuth } = functionsRequire("firebase-admin/auth");
const { Timestamp, getFirestore } = functionsRequire("firebase-admin/firestore");
const scryptAsync = promisify(scrypt);

async function clearAuth(auth) {
  const userIds = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1_000, pageToken);
    userIds.push(...page.users.map((user) => user.uid));
    pageToken = page.pageToken;
  } while (pageToken);

  for (let index = 0; index < userIds.length; index += 1_000) {
    const result = await auth.deleteUsers(userIds.slice(index, index + 1_000));
    if (result.failureCount > 0) {
      throw new Error(`Failed to clear ${result.failureCount} emulator Auth user(s).`);
    }
  }
}

async function clearFirestore(db) {
  const collections = await db.listCollections();
  for (const collection of collections) {
    await db.recursiveDelete(collection);
  }
}

async function writeDocuments(db, documents) {
  const batch = db.batch();
  for (const document of documents) {
    batch.set(db.collection(document.collection).doc(document.id), document.data);
  }
  await batch.commit();
}

function generateCredentials() {
  const suffix = randomBytes(6).toString("hex");
  return {
    displayName: "Local Emulator Owner",
    email: `owner-${suffix}@emulator.test`,
    password: randomBytes(18).toString("base64url"),
    pin: String(randomInt(0, 10_000)).padStart(4, "0"),
    role: "owner",
    staffId: STAFF_ID,
    uid: "emulator-owner-demo-tenant",
  };
}

async function main() {
  const target = assertSafeEmulatorTarget();
  const credentials = generateCredentials();
  const app = initializeApp({ projectId: target.projectId }, `emulator-seed-${Date.now()}`);

  try {
    const auth = getAuth(app);
    const db = getFirestore(app);
    const now = Timestamp.now();
    const salt = randomBytes(16);
    const pinHash = await scryptAsync(credentials.pin, salt, 32);

    process.stdout.write("Resetting guarded local emulator data...\n");
    await Promise.all([clearAuth(auth), clearFirestore(db)]);

    await auth.createUser({
      uid: credentials.uid,
      email: credentials.email,
      emailVerified: true,
      password: credentials.password,
      displayName: credentials.displayName,
      disabled: false,
    });
    await auth.setCustomUserClaims(credentials.uid, {
      tenant_id: target.tenantId,
      staff_id: credentials.staffId,
      staff_role: credentials.role,
    });

    const documents = createSeedDocuments({
      email: credentials.email,
      now,
      tenantId: target.tenantId,
    });
    documents.push({
      collection: "staff_pin_credentials",
      id: `${target.tenantId}_${credentials.staffId}`,
      data: {
        tenantId: target.tenantId,
        staffId: credentials.staffId,
        pinSaltBase64: salt.toString("base64"),
        pinHashBase64: Buffer.from(pinHash).toString("base64"),
        createdAt: now,
        updatedAt: now,
      },
    });
    await writeDocuments(db, documents);

    const credentialRecord = {
      generatedAt: now.toDate().toISOString(),
      projectId: target.projectId,
      tenantId: target.tenantId,
      emulatorHosts: {
        auth: target.authHost,
        firestore: target.firestoreHost,
      },
      account: credentials,
    };
    const outputDirectory = path.join(workspaceRoot, ".emulator");
    const outputPath = path.join(outputDirectory, "generated-credentials.json");
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(credentialRecord, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });

    process.stdout.write(`Seeded ${documents.length} Firestore documents and one Auth account.\n`);
    process.stdout.write(`Credentials written to ${outputPath}\n`);
    process.stdout.write(`${JSON.stringify(credentialRecord, null, 2)}\n`);
  } finally {
    await deleteApp(app);
  }
}

main().catch((error) => {
  process.stderr.write(`Emulator seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
