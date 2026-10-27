export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");

  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export function withApiErrors(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof ApiError) {
        return jsonResponse(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.details === undefined ? {} : { details: error.details }),
            },
          },
          error.status,
        );
      }

      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error("DomainFlow API request failed.", { errorName });
      return jsonResponse(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Something went wrong. Please try again.",
          },
        },
        500,
      );
    }
  };
}

export async function readJson(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send the request as JSON.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
  }

  try {
    if (!request.body) {
      throw new SyntaxError("The request body is empty.");
    }

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        byteLength += value.byteLength;

        if (byteLength > maxBytes) {
          await reader.cancel();
          throw new ApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const body = new Uint8Array(byteLength);
    let offset = 0;

    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
}

export function methodNotAllowed(allowed: string[]): Response {
  return jsonResponse(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "This method is not supported for this endpoint.",
      },
    },
    405,
    { Allow: allowed.join(", ") },
  );
}
