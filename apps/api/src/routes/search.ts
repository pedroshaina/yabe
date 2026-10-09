import type { PrismaClient } from "@yabe/db";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { badRequest, notFound, problemResponses } from "../problem.ts";
import { INT4_MAX, searchResultSchema } from "../schemas.ts";

export const searchRoutes: FastifyPluginCallbackZod<{ prisma: PrismaClient }> = (
  app,
  { prisma },
  done,
) => {
  app.get(
    "/search",
    {
      schema: {
        summary: "Find a block (height or hash) or a transaction (txid)",
        tags: ["search"],
        querystring: z.object({ q: z.string().max(100) }),
        response: { 200: searchResultSchema, ...problemResponses },
      },
    },
    async (request) => {
      const q = request.query.q.trim();

      if (/^\d{1,10}$/.test(q) && Number(q) <= INT4_MAX) {
        const block = await prisma.block.findUnique({
          where: { height: Number(q) },
          select: { hash: true, height: true },
        });
        if (!block) throw notFound(`no block at height ${q}`);
        return { type: "block" as const, ...block };
      }

      if (/^[0-9a-fA-F]{64}$/.test(q)) {
        const id = q.toLowerCase();
        const block = await prisma.block.findUnique({
          where: { hash: id },
          select: { hash: true, height: true },
        });
        if (block) return { type: "block" as const, ...block };
        const tx = await prisma.transaction.findUnique({
          where: { txid: id },
          select: { txid: true },
        });
        if (tx) return { type: "transaction" as const, txid: tx.txid };
        throw notFound(`no block or transaction ${id}`);
      }

      throw badRequest("q must be a block height, a block hash or a txid");
    },
  );

  done();
};
