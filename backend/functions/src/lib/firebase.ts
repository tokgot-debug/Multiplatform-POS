import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Functions can be loaded more than once during tests and emulator discovery.
// Reuse the existing Admin app so every module shares one trusted connection.
const adminApp = getApps()[0] ?? initializeApp();

export const db = getFirestore(adminApp);
