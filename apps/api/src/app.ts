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
}

export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    logger: deps.logger,
    bodyLimit: 1_024,
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
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
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  app.get("/openapi.json", { schema: { hide: true } }, () => app.swagger());

  await app.register(statusRoutes, { prisma: deps.prisma });
  await app.register(blockRoutes, { prefix: "/v1", prisma: deps.prisma });
  await app.register(transactionRoutes, { prefix: "/v1", prisma: deps.prisma });
  await app.register(searchRoutes, { prefix: "/v1", prisma: deps.prisma });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
