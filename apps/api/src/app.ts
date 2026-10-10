import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { PrismaClient } from "@yabe/db";
import Fastify, { type FastifyServerOptions } from "fastify";
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { problemErrorHandler, sendProblem } from "./problem.ts";
import { blockRoutes } from "./routes/blocks.ts";
import { searchRoutes } from "./routes/search.ts";
import { statusRoutes } from "./routes/status.ts";
import { transactionRoutes } from "./routes/transactions.ts";

export interface AppDeps {
  prisma: PrismaClient;
  corsOrigins: string[];
  logger: FastifyServerOptions["logger"];
  /** The path a proxy strips before requests reach the API, e.g. "/api"; empty when none. */
  publicPrefix?: string;
}

export async function buildApp(deps: AppDeps) {
  const publicPrefix = deps.publicPrefix ?? "";
  const app = Fastify({
    logger: deps.logger,
    bodyLimit: 1_024,
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
    // Errors Fastify raises before routing (a malformed percent-encoded URL, a path
    // parameter over maxParamLength) bypass the error handler; answer them as problems too.
    frameworkErrors: (error, request, reply) => {
      if (error.code === "FST_ERR_BAD_URL" || error.code === "FST_ERR_MAX_PARAM_LENGTH") {
        void sendProblem(reply, 400, "the request URL is malformed or too long");
        return;
      }
      request.log.error({ err: error }, "unexpected framework error");
      void sendProblem(reply, 500, "an unexpected error occurred");
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(problemErrorHandler);
  app.setNotFoundHandler((request, reply) =>
    sendProblem(reply, 404, `no route for ${request.method} ${request.url.split("?")[0]}`),
  );

  // CSP off: this is a JSON API whose only HTML is the Swagger UI, which helmet's default CSP blocks.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: deps.corsOrigins.length > 0 ? deps.corsOrigins : false,
    methods: ["GET"],
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "yabe API",
        version: "1.0.0",
        description:
          "Read-only REST API over an indexed Bitcoin chain. Amounts are in satoshis; times are unix seconds.",
      },
      // Without a prefix, leave servers out: clients default to the document's own origin.
      ...(publicPrefix ? { servers: [{ url: publicPrefix }] } : {}),
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  // indexPrefix: the UI links its assets by absolute path, which must include the stripped prefix.
  await app.register(swaggerUi, { routePrefix: "/docs", indexPrefix: publicPrefix });
  app.get("/openapi.json", { schema: { hide: true } }, () => app.swagger());

  await app.register(statusRoutes, { prisma: deps.prisma });
  await app.register(blockRoutes, { prefix: "/v1", prisma: deps.prisma });
  await app.register(transactionRoutes, { prefix: "/v1", prisma: deps.prisma });
  await app.register(searchRoutes, { prefix: "/v1", prisma: deps.prisma });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
