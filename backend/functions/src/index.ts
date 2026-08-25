// Keep discovery lightweight: domain modules own their triggers and this entry
// point only re-exports them for the Firebase Functions runtime.
export { health } from "./health";
export { createSale } from "./modules/sales";
export { authenticateStaffPin, startTillSession } from "./modules/staff-auth";
export { openShift } from "./modules/shifts";

// provisionTenant is deliberately NOT exported. It can mint staff identities
// and rewrite the catalogue, so it stays out of the deployed surface. To run it
// again, re-add the export below, deploy, run scripts/provision-tenant.mjs, then
// remove the export and redeploy:
//   export { provisionTenant } from "./modules/provisioning";
