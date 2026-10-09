import { sql, type PrismaClient } from "@yabe/db";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { notFound, problemResponses } from "../problem.ts";
import {
  INT4_MAX,
  blockIdSchema,
  blockSchema,
  blockSummarySchema,
  hashSchema,
  limitSchema,
  toNumber,
  transactionSummarySchema,
} from "../schemas.ts";

export const blockRoutes: FastifyPluginCallbackZod<{ prisma: PrismaClient }> = (
  app,
  { prisma },
  done,
) => {
  app.get(
    "/blocks",
    {
      schema: {
        summary: "Latest blocks, newest first",
        tags: ["blocks"],
        querystring: z.object({
          limit: limitSchema(20),
          before: z.coerce.number().int().min(0).max(INT4_MAX).optional(),
        }),
        response: {
          200: z.object({ blocks: z.array(blockSummarySchema), next: z.number().int().nullable() }),
          ...problemResponses,
        },
      },
    },
    async (request) => {
      const { limit, before } = request.query;
      const rows = await prisma.block.findMany({
        where: before === undefined ? {} : { height: { lt: before } },
        orderBy: { height: "desc" },
        take: limit,
        select: {
          height: true,
          hash: true,
          time: true,
          txCount: true,
          size: true,
          weight: true,
          totalFeeSat: true,
        },
      });
      const last = rows.at(-1);
      return {
        blocks: rows.map((row) => ({
          ...row,
          time: Number(row.time),
          totalFeeSat: Number(row.totalFeeSat),
        })),
        next: rows.length === limit && last && last.height > 0 ? last.height : null,
      };
    },
  );

  app.get(
    "/blocks/:hashOrHeight",
    {
      schema: {
        summary: "A block by height or hash",
        tags: ["blocks"],
        params: z.object({ hashOrHeight: blockIdSchema }),
        response: { 200: blockSchema, ...problemResponses },
      },
    },
    async (request) => {
      const id = request.params.hashOrHeight;
      const block = await prisma.block.findUnique({
        where: "height" in id ? { height: id.height } : { hash: id.hash },
      });
      if (!block) throw notFound(`no block ${"height" in id ? `at height ${id.height}` : id.hash}`);

      const [[tip], next] = await Promise.all([
        prisma.$queryRawTyped(sql.selectTip()),
        prisma.block.findUnique({ where: { height: block.height + 1 }, select: { hash: true } }),
      ]);
      return {
        ...block,
        nextBlockHash: next?.hash ?? null,
        confirmations: (tip?.height ?? block.height) - block.height + 1,
        nonce: Number(block.nonce),
        time: Number(block.time),
        medianTime: Number(block.medianTime),
        subsidySat: Number(block.subsidySat),
        totalFeeSat: Number(block.totalFeeSat),
        rewardSat: Number(block.subsidySat + block.totalFeeSat),
      };
    },
  );

  app.get(
    "/blocks/:hash/transactions",
    {
      schema: {
        summary: "A block's transactions, in block order",
        tags: ["blocks"],
        params: z.object({ hash: hashSchema }),
        querystring: z.object({
          limit: limitSchema(25),
          after: z.coerce.number().int().min(-1).max(INT4_MAX).default(-1),
        }),
        response: {
          200: z.object({
            transactions: z.array(transactionSummarySchema),
            next: z.number().int().nullable(),
          }),
          ...problemResponses,
        },
      },
    },
    async (request) => {
      const block = await prisma.block.findUnique({
        where: { hash: request.params.hash },
        select: { height: true, txCount: true },
      });
      if (!block) throw notFound(`no block ${request.params.hash}`);

      const { limit, after } = request.query;
      const rows = await prisma.$queryRawTyped(
        sql.selectBlockTransactions(block.height, after, limit),
      );
      // Positions run 0..txCount-1, so a page ending on the last one has nothing after it.
      const last = rows.at(-1);
      return {
        transactions: rows.map((row) => ({
          txid: row.txid,
          position: row.position,
          isCoinbase: row.isCoinbase,
          feeSat: toNumber(row.feeSat),
          vsize: row.vsize,
          inputCount: row.inputCount ?? 0,
          outputCount: row.outputCount ?? 0,
          totalInSat: toNumber(row.totalInSat),
          totalOutSat: toNumber(row.totalOutSat) ?? 0,
        })),
        next:
          rows.length === limit && last && last.position < block.txCount - 1 ? last.position : null,
      };
    },
  );

  done();
};
