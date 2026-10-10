/** Liveness for the Compose healthcheck. Deliberately doesn't call the API. */
export function GET(): Response {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
