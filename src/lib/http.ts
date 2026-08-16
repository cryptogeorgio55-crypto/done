import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { randomUUID } from "crypto";

export function ok<T>(data: T, init?: number | ResponseInit) {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json({ ok: true, data }, responseInit);
}

export function fail(code: string, message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, extra } }, { status });
}

/**
 * Wrap a route handler so every thrown error becomes a safe JSON response.
 * Unexpected errors are logged with a request id and never exposed verbatim.
 */
export function handle(
  fn: (req: Request, ctx: { requestId: string }) => Promise<Response>
) {
  return async (req: Request) => {
    const requestId = randomUUID();
    try {
      return await fn(req, { requestId });
    } catch (err) {
      if (err instanceof ZodError) {
        return fail("validation_error", "Some fields need attention.", 422, err.flatten());
      }
      if (err instanceof AppError) {
        return fail(err.code, err.message, err.status);
      }
      console.error(`[error] requestId=${requestId}`, err);
      return fail("internal_error", "Something went wrong on our end.", 500, { requestId });
    }
  };
}
