import { sql, type PrismaClient } from "@yabe/db";
import type { FastifyPluginCallbackZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { notFound, problemResponses } from "../problem.ts";
import { hashSchema, toNumber, transactionSchema } from "../schemas.ts";
import { scriptToAsm } from "../script/asm.ts";

export const transactionRoutes: FastifyPluginCallbackZod<{ prisma: PrismaClient }> = (
  app,
  { prisma },
  done,
) => {
  app.get(
    "/transactions/:txid",
    {
      schema: {
        summary: "A transaction with its inputs, outputs and spends",
        tags: ["transactions"],
        params: z.object({ txid: hashSchema }),
        response: { 200: transactionSchema, ...problemResponses },
      },
    },
    async (request) => {
      const tx = await prisma.transaction.findUnique({
        where: { txid: request.params.txid },
        include: {
          block: { select: { hash: true, height: true, time: true } },
          inputs: { orderBy: { index: "asc" } },
          outputs: {
            orderBy: { index: "asc" },
            include: {
              spentBy: { select: { index: true, transaction: { select: { txid: true } } } },
            },
          },
        },
      });
      if (!tx) throw notFound(`no transaction ${request.params.txid}`);

      const [tip] = await prisma.$queryRawTyped(sql.selectTip());
      const feeSat = toNumber(tx.feeSat);
      return {
        txid: tx.txid,
        blockHash: tx.block.hash,
        blockHeight: tx.block.height,
        blockTime: Number(tx.block.time),
        position: tx.position,
        confirmations: (tip?.height ?? tx.block.height) - tx.block.height + 1,
        version: tx.version,
        locktime: Number(tx.locktime),
        size: tx.size,
        vsize: tx.vsize,
        weight: tx.weight,
        isCoinbase: tx.isCoinbase,
        feeSat,
        feeRate: feeSat === null ? null : Math.round((feeSat / tx.vsize) * 1_000) / 1_000,
        inputs: tx.inputs.map((input) => ({
          index: input.index,
          coinbaseHex: input.coinbaseHex,
          prevTxid: input.prevTxid,
          prevIndex: input.prevIndex,
          valueSat: toNumber(input.prevValueSat),
          address: input.prevAddress,
          scriptType: input.prevScriptType,
          scriptSig: input.scriptSigHex
            ? {
                hex: input.scriptSigHex,
                asm: scriptToAsm(input.scriptSigHex, { attemptSighashDecode: true }),
              }
            : null,
          witness: input.witness,
          sequence: Number(input.sequence),
        })),
        outputs: tx.outputs.map((output) => ({
          index: output.index,
          valueSat: Number(output.valueSat),
          address: output.address,
          scriptType: output.scriptType,
          script: { hex: output.scriptHex, asm: scriptToAsm(output.scriptHex) },
          spentBy: output.spentBy
            ? { txid: output.spentBy.transaction.txid, inputIndex: output.spentBy.index }
            : null,
        })),
      };
    },
  );

  done();
};
