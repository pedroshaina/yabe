import type { NextRequest } from "next/server";
import { getConfig } from "@/config";
import { passthrough } from "@/lib/api/passthrough";
import { getLogger } from "@/lib/logger";

/** Read-only passthrough to yabe-api for the browser (not Next.js's proxy.ts middleware). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  return passthrough(path, request.nextUrl.searchParams, {
    apiUrl: getConfig().apiUrl,
    log: getLogger(),
  });
}
