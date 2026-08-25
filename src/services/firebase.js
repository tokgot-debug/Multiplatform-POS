/**
 * Firebase client for the till.
 *
 * The till stays offline-first: Dexie remains the system of record for the UI,
 * and this module is only the transport that drains the local outbox to the
 * trusted backend. Every export degrades to a no-op when Firebase is not
 * configured, so the app keeps selling on a laptop with no project attached.
 */

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const REGION = import.meta.env.VITE_FIREBASE_REGION || 'europe-west1';
export const TENANT_ID = import.meta.env.VITE_TENANT_ID || null;

/** True when enough config exists to reach a real project. */
export const firebaseConfigured = Boolean(cfg.apiKey && cfg.projectId && cfg.appId);

let bootPromise = null;

/**
 * Loads the Firebase SDK on first use. Kept as a dynamic import so a till with
 * no Firebase config never pays the bundle cost.
 */
async function boot() {
  const [{ initializeApp, getApps }, auth, firestore, functions] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
    import('firebase/functions')
  ]);

  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  const authInstance = auth.getAuth(app);
  const dbInstance = firestore.getFirestore(app);
  const fnInstance = functions.getFunctions(app, REGION);

  if (import.meta.env.VITE_USE_EMULATORS === '1') {
    auth.connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    firestore.connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
    functions.connectFunctionsEmulator(fnInstance, '127.0.0.1', 5001);
  }

  return { app, auth, authInstance, firestore, dbInstance, functions, fnInstance };
}

export function getFirebase() {
  if (!firebaseConfigured) return null;
  if (!bootPromise) bootPromise = boot();
  return bootPromise;
}

/**
 * Server-side verification of a staff PIN (scrypt, timing-safe compare, and a
 * five-attempt lockout). The browser never holds PIN material.
 *
 * NOTE: this is a *second factor*, not a way to obtain a session. The callable
 * rejects any caller whose token does not already carry tenant_id and staff_id
 * claims matching the profile. Establishing that first session still needs a
 * device-enrolment callable that mints a custom token; until it exists the till
 * runs local-only and the outbox simply does not drain.
 */
export async function authenticateStaffPin(staffId, pin, tenantId = TENANT_ID) {
  const fb = await getFirebase();
  if (!fb) throw new Error('Firebase is not configured on this till.');
  if (!fb.authInstance.currentUser) {
    throw new Error('This till has no Firebase session to verify a PIN against.');
  }

  const call = fb.functions.httpsCallable(fb.fnInstance, 'authenticateStaffPin');
  const { data } = await call({ tenantId, staffId, pin });
  return data;
}

/** Current signed-in user's custom claims, or null. */
export async function currentClaims() {
  const fb = await getFirebase();
  if (!fb || !fb.authInstance.currentUser) return null;
  const token = await fb.authInstance.currentUser.getIdTokenResult();
  return token.claims;
}

/**
 * True only when we hold a session the security rules will actually accept.
 * Sync uses this to decide whether draining the outbox is worth attempting.
 */
export async function hasTenantSession() {
  const claims = await currentClaims();
  return Boolean(claims && claims.tenant_id);
}

export async function signOutTill() {
  const fb = await getFirebase();
  if (fb && fb.authInstance.currentUser) await fb.auth.signOut(fb.authInstance);
}

/** Invokes a callable and returns its data payload. */
export async function callFunction(name, payload) {
  const fb = await getFirebase();
  if (!fb) throw new Error('Firebase is not configured on this till.');
  const call = fb.functions.httpsCallable(fb.fnInstance, name);
  const { data } = await call(payload);
  return data;
}
