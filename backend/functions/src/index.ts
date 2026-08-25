// Keep discovery lightweight: domain modules own their triggers and this entry
// point only re-exports them for the Firebase Functions runtime.
export { health } from "./health";
export { createSale } from "./modules/sales";
export { authenticateStaffPin } from "./modules/staff-auth";
