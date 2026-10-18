import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Bound the actual stream; Content-Length alone is controlled by the caller.
export async function readJson(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new HttpError(415, "JSON content required");
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "Request too large");
  if (!request.body) throw new HttpError(400, "Invalid JSON");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Request too large");
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid JSON");
  } finally {
    reader.releaseLock();
  }
}

export function apiError(e: unknown) {
  const requestId = crypto.randomUUID();
  const status =
    e instanceof HttpError ? e.status : e instanceof ZodError ? 400 : 500;
  const error =
    e instanceof HttpError
      ? e.message
      : status === 400
        ? "Invalid input"
        : "Request failed";
  if (status >= 500) {
    // Never log exception messages, request bodies, credentials, or household data.
    console.error(
      JSON.stringify({
        event: "api_failure",
        requestId,
        status,
        at: new Date().toISOString(),
      }),
    );
  }
  return Response.json(
    { error, requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
