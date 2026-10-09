import { sql, type PrismaClient } from "@yabe/db";
import type { BlockRows } from "./transform.ts";

/** Stored data would contradict itself. Fatal: the block's transaction is rolled back. */
export class IntegrityError extends Error {
  override name = "IntegrityError";
}

/** Writes one block atomically: all of its rows and spent marks, or nothing. */
export async function writeBlock(prisma: PrismaClient, rows: BlockRows): Promise<void> {
  const { height } = rows.block;
  const expectedSpends = rows.transactions.reduce(
    (count, t) => count + (t.transaction.isCoinbase ? 0 : t.inputs.length),
    0,
  );

  await prisma.$transaction(
    async (tx) => {
      await tx.block.create({ data: rows.block });

      const created = await tx.transaction.createManyAndReturn({
        data: rows.transactions.map((t) => ({ ...t.transaction, blockHeight: height })),
        select: { id: true, txid: true },
      });
      const idByTxid = new Map(created.map((t) => [t.txid, t.id]));
      const idOf = (txid: string): bigint => {
        const id = idByTxid.get(txid);
        if (id === undefined) {
          throw new IntegrityError(`block ${height}: transaction ${txid} was not inserted`);
        }
        return id;
      };

      await tx.transactionOutput.createMany({
        data: rows.transactions.flatMap((t) =>
          t.outputs.map((o) => ({ ...o, transactionId: idOf(t.transaction.txid) })),
        ),
      });
      await tx.transactionInput.createMany({
        data: rows.transactions.flatMap((t) =>
          t.inputs.map((i) => ({ ...i, transactionId: idOf(t.transaction.txid) })),
        ),
      });

      const [result] = await tx.$queryRawTyped(sql.markSpent(height));
      const marked = result?.markedCount ?? 0;
      if (marked !== expectedSpends) {
        throw new IntegrityError(
          `block ${height}: marked ${marked} outputs as spent, expected ${expectedSpends}`,
        );
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

/**
 * Removes every block above `forkHeight`. Cascades delete their transactions,
 * inputs and outputs, and the spent-by foreign key (ON DELETE SET NULL)
 * un-spends the earlier outputs their inputs had spent. One statement, so the
 * rollback is atomic. Returns how many blocks were removed.
 */
export async function rollbackTo(prisma: PrismaClient, forkHeight: number): Promise<number> {
  const { count } = await prisma.block.deleteMany({ where: { height: { gt: forkHeight } } });
  return count;
}
