import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra ?? null }, { status });
}

export async function handle<T>(fn: () => Promise<T>) {
  try {
    return ok(await fn());
  } catch (err) {
    // permission guards throw a ready-made Response
    if (err instanceof Response) return err;
    if (err instanceof ZodError) {
      return fail("Validation failed", 422, err.flatten());
    }
    console.error("[api]", err);
    return fail(err instanceof Error ? err.message : "Internal error", 500);
  }
}
