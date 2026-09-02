/**
 * Staff identity administration.
 *
 * Firebase Authentication carries identity: a person signs in with an email and
 * a password they chose, and the tenant, staff id and role ride along as custom
 * claims on the ID token. No credential is ever seeded into the app bundle and
 * nothing is verified in the browser.
 *
 * Replaces the PIN flow, where every staff PIN shipped inside the published
 * JavaScript and the check that mattered ran client-side.
 */

import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "../../config/runtime";
import { db } from "../../lib/firebase";
import { deterministicId } from "../../shared/identifiers";
import { ADMIN_ROLES, canAssignRole, STAFF_ROLES } from "../../shared/roles";
import { asRecord, documentId, optionalText } from "../../shared/validation";

const BOOTSTRAP_SECRET = defineSecret("POS_BOOTSTRAP_SECRET");

// Firebase Auth's own floor is 6. Eight is the shortest that is not trivially
// guessable for an account that can void sales and read every takings figure.
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Actor {
  tenantId: string;
  staffId: string;
  role: string;
}

/** The verified administrator behind a request, or an error. */
function requireAdmin(auth: { token: Record<string, unknown> } | undefined): Actor {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in first.");

  const tenantId = typeof auth.token.tenant_id === "string" ? auth.token.tenant_id : null;
  const staffId = typeof auth.token.staff_id === "string" ? auth.token.staff_id : null;
  const role = typeof auth.token.staff_role === "string" ? auth.token.staff_role : null;
  if (!tenantId || !staffId || !role) {
    throw new HttpsError("permission-denied", "This session carries no staff claims.");
  }
  if (!ADMIN_ROLES.has(role)) {
    throw new HttpsError("permission-denied", "Only an owner or store manager can manage staff.");
  }

  return { tenantId, staffId, role };
}

function email(value: unknown): string {
  if (typeof value !== "string" || !EMAIL_PATTERN.test(value.trim()) || value.length > 254) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }
  return value.trim().toLowerCase();
}

function password(value: unknown): string {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH || value.length > 128) {
    throw new HttpsError(
      "invalid-argument",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  return value;
}

function role(value: unknown): string {
  if (typeof value !== "string" || !STAFF_ROLES.has(value)) {
    throw new HttpsError("invalid-argument", "Choose a valid staff role.");
  }
  return value;
}

/**
 * Creates a staff member: a Firebase Auth account, the claims that scope it to
 * one tenant and role, and the staff profile the app reads.
 *
 * Cashiers rarely have a work inbox, so the address only has to be unique and
 * well-formed - an owner typically issues `name@business.pos` and hands over
 * the password. Those accounts cannot self-serve a reset; an admin re-passwords
 * them with resetStaffPassword.
 */
export const createStaffUser = onCall(
  { region: FUNCTION_REGION },
  async (request) => {
    const actor = requireAdmin(request.auth);
    const input = asRecord(request.data, "Request data");

    const staffRole = role(input.role);
    if (!canAssignRole(actor.role, staffRole)) {
      throw new HttpsError("permission-denied", "Only an owner can create another owner.");
    }

    const address = email(input.email);
    const secret = password(input.password);
    const name = optionalText(input.name, "name", 120);
    if (!name) throw new HttpsError("invalid-argument", "Enter the staff member's name.");
    const phone = optionalText(input.phone, "phone", 20);

    // Deterministic so a retried create collides on the document rather than
    // silently minting a second profile for the same person.
    const staffId = deterministicId("staff", `${actor.tenantId}:${address}`);
    const staffRef = db.collection("staff").doc(staffId);
    if ((await staffRef.get()).exists) {
      throw new HttpsError("already-exists", "That email already belongs to a staff member.");
    }

    const auth = getAuth();
    let authUid: string;
    try {
      const created = await auth.createUser({
        email: address,
        password: secret,
        displayName: name,
      });
      authUid = created.uid;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "That email is already registered.");
      }
      throw error;
    }

    // Claims are the authorisation, so they are set before the profile exists:
    // a profile without claims is inert, claims without a profile are not.
    await auth.setCustomUserClaims(authUid, {
      tenant_id: actor.tenantId,
      staff_id: staffId,
      staff_role: staffRole,
    });

    const now = Timestamp.now();
    await staffRef.set({
      id: staffId,
      tenantId: actor.tenantId,
      authUid,
      name,
      email: address,
      phone: phone ?? null,
      role: staffRole,
      status: "active",
      createdAt: now,
      createdByStaffId: actor.staffId,
    });

    await db.collection("audit_logs").add({
      tenantId: actor.tenantId,
      branchId: null,
      actorStaffId: actor.staffId,
      action: "staff.created",
      entityType: "staff",
      entityId: staffId,
      metadata: { role: staffRole, email: address },
      createdAt: now,
    });

    return { staffId, email: address, role: staffRole };
  },
);

/**
 * Disables or re-enables a staff member.
 *
 * Disabling revokes refresh tokens as well as the account, so a till already
 * signed in loses access at its next token refresh rather than at end of shift.
 */
export const setStaffActive = onCall(
  { region: FUNCTION_REGION },
  async (request) => {
    const actor = requireAdmin(request.auth);
    const input = asRecord(request.data, "Request data");
    const staffId = documentId(input.staffId, "staffId");
    const active = input.active === true;

    if (staffId === actor.staffId) {
      throw new HttpsError("failed-precondition", "You cannot disable your own account.");
    }

    const staffRef = db.collection("staff").doc(staffId);
    const snapshot = await staffRef.get();
    const staff = snapshot.data();
    if (!snapshot.exists || staff?.tenantId !== actor.tenantId) {
      throw new HttpsError("not-found", "No such staff member.");
    }
    if (staff.role === "owner" && actor.role !== "owner") {
      throw new HttpsError("permission-denied", "Only an owner can disable an owner.");
    }

    // Losing the last owner locks everyone out of staff administration for good.
    if (!active && staff.role === "owner") {
      const owners = await db.collection("staff")
        .where("tenantId", "==", actor.tenantId)
        .where("role", "==", "owner")
        .where("status", "==", "active")
        .get();
      if (owners.size <= 1) {
        throw new HttpsError("failed-precondition", "This is the last active owner.");
      }
    }

    const auth = getAuth();
    if (typeof staff.authUid === "string") {
      await auth.updateUser(staff.authUid, { disabled: !active });
      if (!active) await auth.revokeRefreshTokens(staff.authUid);
    }

    const now = Timestamp.now();
    await staffRef.update({ status: active ? "active" : "disabled", updatedAt: now });
    await db.collection("audit_logs").add({
      tenantId: actor.tenantId,
      branchId: null,
      actorStaffId: actor.staffId,
      action: active ? "staff.enabled" : "staff.disabled",
      entityType: "staff",
      entityId: staffId,
      metadata: {},
      createdAt: now,
    });

    return { staffId, status: active ? "active" : "disabled" };
  },
);

/** Sets a new password for a staff member who cannot reset their own. */
export const resetStaffPassword = onCall(
  { region: FUNCTION_REGION },
  async (request) => {
    const actor = requireAdmin(request.auth);
    const input = asRecord(request.data, "Request data");
    const staffId = documentId(input.staffId, "staffId");
    const secret = password(input.password);

    const snapshot = await db.collection("staff").doc(staffId).get();
    const staff = snapshot.data();
    if (!snapshot.exists || staff?.tenantId !== actor.tenantId) {
      throw new HttpsError("not-found", "No such staff member.");
    }
    if (staff.role === "owner" && actor.role !== "owner") {
      throw new HttpsError("permission-denied", "Only an owner can re-password an owner.");
    }
    if (typeof staff.authUid !== "string") {
      throw new HttpsError("failed-precondition", "That staff member has no sign-in account.");
    }

    const auth = getAuth();
    await auth.updateUser(staff.authUid, { password: secret });
    // Force every other signed-in device for this person to re-authenticate.
    await auth.revokeRefreshTokens(staff.authUid);

    await db.collection("audit_logs").add({
      tenantId: actor.tenantId,
      branchId: null,
      actorStaffId: actor.staffId,
      action: "staff.password_reset",
      entityType: "staff",
      entityId: staffId,
      metadata: {},
      createdAt: Timestamp.now(),
    });

    return { staffId };
  },
);

/**
 * Creates the first owner for a tenant that has none.
 *
 * There is no signed-in administrator to authorise the very first account, so
 * this is gated on the deployment's bootstrap secret and refuses to run once an
 * owner exists - it can create the first account, never a back door into a
 * tenant already in use.
 */
export const bootstrapOwner = onCall(
  { region: FUNCTION_REGION, secrets: [BOOTSTRAP_SECRET] },
  async (request) => {
    const input = asRecord(request.data, "Request data");
    const expected = BOOTSTRAP_SECRET.value();
    if (!expected) {
      throw new HttpsError("failed-precondition", "No bootstrap secret is configured.");
    }
    if (typeof input.bootstrapSecret !== "string" || input.bootstrapSecret !== expected) {
      throw new HttpsError("permission-denied", "Invalid bootstrap secret.");
    }

    const tenantId = documentId(input.tenantId, "tenantId");
    const address = email(input.email);
    const secret = password(input.password);
    const name = optionalText(input.name, "name", 120) ?? "Owner";

    const tenant = await db.collection("tenants").doc(tenantId).get();
    if (!tenant.exists) {
      throw new HttpsError("not-found", "Provision the tenant before its owner.");
    }

    const owners = await db.collection("staff")
      .where("tenantId", "==", tenantId)
      .where("role", "==", "owner")
      .where("status", "==", "active")
      .limit(1)
      .get();

    const auth = getAuth();

    // The retired PIN provisioning left an owner profile whose Auth password
    // was random and discarded, so it exists but nobody can sign in as it.
    // Adopting is how that account is recovered: it re-points the tenant's
    // existing owner at an address and password someone actually holds, rather
    // than quietly minting a second owner beside it.
    if (!owners.empty) {
      if (input.adoptExisting !== true) {
        throw new HttpsError(
          "already-exists",
          "This tenant already has an owner. Pass adoptExisting to take that account over, "
            + "or create further staff from the app.",
        );
      }

      const existing = owners.docs[0];
      const current = existing.data();
      let uid = typeof current.authUid === "string" ? current.authUid : null;

      if (uid) {
        await auth.updateUser(uid, {
          email: address,
          password: secret,
          displayName: name,
          disabled: false,
        });
      } else {
        const created = await auth.createUser({ email: address, password: secret, displayName: name });
        uid = created.uid;
      }

      await auth.setCustomUserClaims(uid, {
        tenant_id: tenantId,
        staff_id: existing.id,
        staff_role: "owner",
      });
      // Any session minted under the old identity stops working now.
      await auth.revokeRefreshTokens(uid);

      await existing.ref.update({
        authUid: uid,
        email: address,
        name,
        status: "active",
        updatedAt: Timestamp.now(),
      });

      return { staffId: existing.id, email: address, adopted: true };
    }

    const staffId = deterministicId("staff", `${tenantId}:${address}`);

    // The tenant may already carry a seeded Auth account on this address from
    // the retired PIN provisioning, which never had a usable password.
    let authUid: string;
    try {
      const existing = await auth.getUserByEmail(address);
      authUid = existing.uid;
      await auth.updateUser(authUid, { password: secret, displayName: name, disabled: false });
    } catch {
      const created = await auth.createUser({ email: address, password: secret, displayName: name });
      authUid = created.uid;
    }

    await auth.setCustomUserClaims(authUid, {
      tenant_id: tenantId,
      staff_id: staffId,
      staff_role: "owner",
    });

    const now = Timestamp.now();
    await db.collection("staff").doc(staffId).set({
      id: staffId,
      tenantId,
      authUid,
      name,
      email: address,
      phone: null,
      role: "owner",
      status: "active",
      createdAt: now,
      createdByStaffId: null,
    });

    return { staffId, email: address };
  },
);
