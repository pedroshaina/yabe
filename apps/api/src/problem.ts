import { isDatabaseUnavailable } from "@yabe/db";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { z } from "zod";

/** RFC 9457 problem details. */
export const problemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
  })
  .meta({ id: "Problem" });

/** Error responses most routes can return, for the OpenAPI contract. */
export const problemResponses = {
  400: problemSchema,
  404: problemSchema,
  503: problemSchema,
} as const;

const TITLES: Record<number, string> = {
  400: "Bad Request",
  404: "Not Found",
  413: "Payload Too Large",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

/** An expected error a handler throws on purpose (unknown resource, bad input). */
export class HttpProblem extends Error {
  override name = "HttpProblem";
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(detail);
  }
}

export const notFound = (detail: string) => new HttpProblem(404, detail);
export const badRequest = (detail: string) => new HttpProblem(400, detail);

export function sendProblem(reply: FastifyReply, status: number, detail?: string) {
  return reply
    .code(status)
    .type("application/problem+json")
    .send({
      type: "about:blank",
      title: TITLES[status] ?? "Error",
      status,
      ...(detail ? { detail } : {}),
    });
}

export function problemErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return sendProblem(reply, 400, error.message);
  }
  if (error instanceof HttpProblem) {
    return sendProblem(reply, error.status, error.message);
  }
  if (isDatabaseUnavailable(error)) {
    request.log.warn({ err: error }, "database unavailable");
    return sendProblem(reply, 503, "the database is unavailable; try again shortly");
  }
  if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
    return sendProblem(reply, error.statusCode, error.message);
  }
  request.log.error({ err: error }, "unexpected error");
  return sendProblem(reply, 500, "an unexpected error occurred");
}
