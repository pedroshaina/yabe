import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client.js'

export const createPrismaClient = (databaseUrl: string): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
