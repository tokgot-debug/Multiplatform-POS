// Must track the Firestore location (europe-west1). A cross-region callable
// pays an extra round trip and egress on every sale transaction.
export const FUNCTION_REGION = "europe-west1";
