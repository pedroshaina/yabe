import { STATUS_CODES } from 'node:http'

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (message: string): HttpError => new HttpError(404, message)

// RFC 9457 problem details.
export const problem = (status: number, detail?: string) => ({
  type: 'about:blank',
  title: STATUS_CODES[status] ?? 'Error',
  status,
  ...(detail ? { detail } : {}),
})
