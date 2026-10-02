import { pino, type Logger } from 'pino'
import type { LogLevel } from './config.js'

export type { Logger }

export const createLogger = (opts: { name: string; level: LogLevel }): Logger =>
  pino({ name: opts.name, level: opts.level })
