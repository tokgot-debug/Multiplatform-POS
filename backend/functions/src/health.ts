import { onRequest } from "firebase-functions/v2/https";

export const health = onRequest({ cors: false }, (request, response) => {
  if (request.method !== "GET") {
    response.set("Allow", "GET");
    response.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  response.status(200).json({
    ok: true,
    service: "multiplatform-pos-functions",
    timestamp: new Date().toISOString(),
  });
});
