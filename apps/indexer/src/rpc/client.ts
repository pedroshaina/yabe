import { z } from "zod";
import { RpcConnectionError, RpcError, RpcHttpError, RpcResponseError } from "./errors.ts";

export interface RpcClientOptions {
  url: string;
  user: string;
  password: string;
  timeoutMs: number;
}

export type RpcCall = <T>(method: string, params: unknown[], schema: z.ZodType<T>) => Promise<T>;

const envelopeSchema = z.object({
  result: z.unknown(),
  error: z.object({ code: z.number(), message: z.string() }).nullable(),
});

export function createRpcCall(options: RpcClientOptions): RpcCall {
  const authorization =
    "Basic " + Buffer.from(`${options.user}:${options.password}`).toString("base64");

  return async <T>(method: string, params: unknown[], schema: z.ZodType<T>): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(options.url, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "1.0", id: method, method, params }),
        signal: AbortSignal.timeout(options.timeoutMs),
      });
    } catch (cause) {
      throw new RpcConnectionError(method, options.url, { cause });
    }

    let text: string;
    try {
      text = await response.text();
    } catch (cause) {
      // Headers arrived but the body broke off (reset, stall past the timeout).
      throw new RpcConnectionError(method, options.url, { cause });
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new RpcHttpError(method, response.status);
    }

    const envelope = envelopeSchema.safeParse(json);
    if (!envelope.success) {
      throw new RpcHttpError(method, response.status);
    }
    if (envelope.data.error) {
      throw new RpcError(method, envelope.data.error.code, envelope.data.error.message);
    }

    const result = schema.safeParse(envelope.data.result);
    if (!result.success) {
      throw new RpcResponseError(method, z.prettifyError(result.error));
    }
    return result.data;
  };
}
