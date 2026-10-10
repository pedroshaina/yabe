import { API_TIMEOUT_MS } from "./constants";

/** The read endpoints the browser needs (under /v1); everything else stays server-side. */
const ALLOWED_PATHS = [/^status$/, /^blocks$/, /^blocks\/[0-9a-fA-F]{64}\/transactions$/];
const FORWARDED_PARAMS = ["limit", "before", "after"] as const;

export interface PassthroughDeps {
  /** yabe-api's origin, e.g. http://yabe-api:8080. */
  apiUrl: string;
  log: { error(obj: object, msg: string): void };
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Forwards a browser GET to yabe-api if it is one of the allowed read endpoints.
 * Only the path (validated above) and the paging parameters reach the API.
 */
export async function passthrough(
  segments: readonly string[],
  query: URLSearchParams,
  deps: PassthroughDeps,
): Promise<Response> {
  // Next decodes %2F inside a segment; a segment holding a "/" is not a real path segment.
  const path = segments.join("/");
  if (segments.some((s) => s.includes("/")) || !ALLOWED_PATHS.some((p) => p.test(path))) {
    return problem(404, "Not Found", "This endpoint isn't available here.");
  }

  const upstream = new URL(`/v1/${path}`, deps.apiUrl);
  for (const name of FORWARDED_PARAMS) {
    const value = query.get(name);
    if (value !== null) upstream.searchParams.set(name, value);
  }

  let response: Response;
  try {
    response = await (deps.fetch ?? fetch)(upstream, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(deps.timeoutMs ?? API_TIMEOUT_MS),
    });
  } catch (error) {
    deps.log.error({ err: error, upstream: upstream.pathname }, "could not reach the API");
    return problem(503, "Service Unavailable", "The chain data can't be reached right now.");
  }

  if (response.status >= 500) {
    deps.log.error(
      { status: response.status, upstream: upstream.pathname },
      "the API answered with an error",
    );
  }
  const headers = new Headers({ "cache-control": "no-store" });
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new Response(response.body, { status: response.status, headers });
}

function problem(status: number, title: string, detail: string): Response {
  return Response.json(
    { type: "about:blank", title, status, detail },
    {
      status,
      headers: { "content-type": "application/problem+json", "cache-control": "no-store" },
    },
  );
}
