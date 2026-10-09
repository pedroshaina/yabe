import { sql, type PrismaClient } from "@yabe/db";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { problemSchema } from "../problem.ts";

const okSchema = z.object({ status: z.literal("ok") });
const tipSchema = z
  .object({ height: z.number().int(), hash: z.string(), time: z.number().int() })
  .meta({ id: "Tip" });

export const statusRoutes: FastifyPluginCallbackZod<{ prisma: PrismaClient }> = (
  app,
  { prisma },
  done,
) => {
  app.get(
    "/health",
    {
      schema: {
        summary: "Liveness: the process is up",
        tags: ["health"],
        response: { 200: okSchema },
      },
    },
    () => ({ status: "ok" as const }),
  );

  app.get(
    "/ready",
    {
      schema: {
        summary: "Readiness: the database answers",
        tags: ["health"],
        response: { 200: okSchema, 503: problemSchema },
      },
    },
    async () => {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok" as const };
    },
  );

  app.get(
    "/v1/status",
    {
      schema: {
        summary: "The highest indexed block",
        tags: ["status"],
        response: { 200: z.object({ tip: tipSchema.nullable() }), 503: problemSchema },
      },
    },
    async () => {
      const [tip] = await prisma.$queryRawTyped(sql.selectTip());
      return { tip: tip ? { height: tip.height, hash: tip.hash, time: Number(tip.time) } : null };
    },
  );

  done();
};
