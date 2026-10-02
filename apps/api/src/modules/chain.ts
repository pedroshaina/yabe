import type { PrismaClient } from '@yabe/db'

export const getTipHeight = async (prisma: PrismaClient): Promise<number> => {
  const tip = await prisma.block.findFirst({ orderBy: { height: 'desc' }, select: { height: true } })
  return tip?.height ?? -1
}

export const confirmations = (height: number, tipHeight: number): number =>
  tipHeight >= height ? tipHeight - height + 1 : 0
