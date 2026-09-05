import type { DocumentData, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import { db } from "../../lib/firebase";
import { SELLING_ROLES } from "./constants";
import type { BaseSaleContext, ParsedSaleInput } from "./types";

export async function loadBaseSaleContext(
  transaction: Transaction,
  input: ParsedSaleInput,
): Promise<BaseSaleContext> {
  const tenantRef = db.collection("tenants").doc(input.tenantId);
  const branchRef = db.collection("branches").doc(input.branchId);
  const deviceRef = db.collection("devices").doc(input.deviceId);
  const shiftRef = db.collection("shifts").doc(input.shiftId);
  const staffRef = db.collection("staff").doc(input.staffId);
  const customerRef = db.collection("customers").doc(input.customerId);
  const settingsRef = db.collection("tenant_settings").doc(input.tenantId);
  const counterRef = db
    .collection("counters")
    .doc(`sales_${input.tenantId}_${input.branchId}`);
  const productRefs = input.lines.map((line) =>
    db.collection("products").doc(line.productId),
  );

  const documents = await transaction.getAll(
    tenantRef,
    branchRef,
    deviceRef,
    shiftRef,
    staffRef,
    customerRef,
    settingsRef,
    counterRef,
    ...productRefs,
  );
  const [
    tenantDocument,
    branchDocument,
    deviceDocument,
    shiftDocument,
    staffDocument,
    customerDocument,
    settingsDocument,
    counterDocument,
    ...productDocuments
  ] = documents;

  if (!tenantDocument.exists || tenantDocument.data()?.status !== "active") {
    throw new HttpsError("failed-precondition", "Tenant is not active.");
  }

  const tenant = tenantDocument.data() ?? {};
  const branch = branchDocument.data() ?? {};
  const device = deviceDocument.data() ?? {};
  const shift = shiftDocument.data() ?? {};
  const staff = staffDocument.data() ?? {};
  const customer = customerDocument.data() ?? {};
  const settings = settingsDocument.data() ?? {};

  if (
    !branchDocument.exists
    || branch.tenantId !== input.tenantId
    || branch.status !== "active"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Branch is not active for this tenant.",
    );
  }
  if (typeof branch.code !== "string" || !branch.code.trim()) {
    throw new HttpsError("failed-precondition", "Branch code is missing.");
  }
  if (
    !deviceDocument.exists
    || device.tenantId !== input.tenantId
    || device.branchId !== input.branchId
    || device.status !== "active"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Device is not active for this branch.",
    );
  }
  if (
    !shiftDocument.exists
    || shift.tenantId !== input.tenantId
    || shift.branchId !== input.branchId
    || shift.deviceId !== input.deviceId
    || shift.staffId !== input.staffId
    || shift.status !== "open"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Staff member has no matching open shift on this device.",
    );
  }
  if (
    !staffDocument.exists
    || staff.tenantId !== input.tenantId
    || staff.status !== "active"
    || !SELLING_ROLES.has(String(staff.role))
  ) {
    throw new HttpsError(
      "permission-denied",
      "Staff member is not allowed to create sales.",
    );
  }
  if (
    !customerDocument.exists
    || customer.tenantId !== input.tenantId
    || customer.isActive !== true
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Customer is not active for this tenant.",
    );
  }
  if (!settingsDocument.exists || settings.tenantId !== input.tenantId) {
    throw new HttpsError(
      "failed-precondition",
      "Tenant settings are missing.",
    );
  }

  validateCounter(counterDocument.exists, counterDocument.data(), input);

  return {
    tenant,
    branch,
    shift,
    staff,
    settings,
    counterValue: counterDocument.exists
      && Number.isSafeInteger(counterDocument.data()?.value)
      ? Number(counterDocument.data()?.value)
      : 0,
    productDocuments,
    refs: { shift: shiftRef, counter: counterRef },
  };
}

function validateCounter(
  exists: boolean,
  counter: DocumentData | undefined,
  input: ParsedSaleInput,
): void {
  if (
    exists
    && (
      counter?.tenantId !== input.tenantId
      || counter?.branchId !== input.branchId
      || !Number.isSafeInteger(counter?.value)
      || Number(counter?.value) < 0
    )
  ) {
    throw new HttpsError(
      "data-loss",
      "The branch sale counter is invalid or belongs to another scope.",
    );
  }
}
